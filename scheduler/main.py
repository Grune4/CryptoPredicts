import time
import asyncio
import aiohttp
import sys
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

Base = declarative_base()

class CryptoOHLCV(Base):
    __tablename__ = 'crypto_ohlcv'
    id = Column(Integer, primary_key=True)
    symbol = Column(String, index=True)
    name = Column(String, index=True)
    date = Column(DateTime, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)


load_dotenv()
POSTGRES_USER = os.getenv("DB_USER")
POSTGRES_PASSWORD = os.getenv("DB_PASSWORD")
POSTGRES_HOST = os.getenv("DB_HOST")
POSTGRES_PORT = os.getenv("DB_PORT")
POSTGRES_DB = os.getenv("DB_NAME")

DATABASE_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

engine = create_engine(DATABASE_URL)

Base.metadata.create_all(engine)
with engine.connect() as conn:
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_symbol_date ON crypto_ohlcv (symbol, date DESC);"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_symbol_only ON crypto_ohlcv (symbol);"
    ))

Session = sessionmaker(bind=engine)

CG_MAX_RETRIES = 5
CG_INITIAL_DELAY = 10
MIN_VOLUME = 10000.0
CG_MAX_PAGES = 15
EXCHANGE_CONCURRENT_LIMIT = 50

BINANCE_EXCHANGE_INFO_URL = "https://api.binance.com/api/v3/exchangeInfo"
BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines"
BINANCE_INTERVAL = '1d'

KUCOIN_SYMBOLS_URL = "https://api.kucoin.com/api/v1/symbols"
KUCOIN_KLINES_URL = "https://api.kucoin.com/api/v1/market/candles"
KUCOIN_INTERVAL = '1day'

KRAKEN_ASSET_PAIRS_URL = "https://api.kraken.com/0/public/AssetPairs"
KRAKEN_OHLC_URL = "https://api.kraken.com/0/public/OHLC"
KRAKEN_INTERVAL = '1440'

CG_MARKET_LIST_URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page={}&sparkline=False"
CG_API_KEY = os.getenv("COINGECKO_API_KEY")

TEN_YEARS_AGO = datetime.now(timezone.utc) - timedelta(days=365 * 10)


async def async_filter_1_get_symbols():
    print(f"--- Starting Filter 1 (ASYNC): Fetching Top {CG_MAX_PAGES * 250} Coins ---")

    headers = {"User-Agent": "DataCollector/1.0"}
    if CG_API_KEY and CG_API_KEY != "YOUR_CG_DEMO_API_KEY":
        headers["x-cg-demo-api-key"] = CG_API_KEY

    async def fetch_page(session, page):
        url = CG_MARKET_LIST_URL.format(page)

        for attempt in range(5):
            try:
                async with session.get(url, headers=headers, timeout=10) as resp:
                    if resp.status == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    if resp.status != 200:
                        print(f"[CG] Page {page} error {resp.status}")
                        return []
                    return await resp.json()
            except:
                await asyncio.sleep(2 ** attempt)

        print(f"[CG] Failed after retries (page {page})")
        return []

    async with aiohttp.ClientSession() as session:
        tasks = [fetch_page(session, page) for page in range(1, CG_MAX_PAGES + 1)]
        all_pages = await asyncio.gather(*tasks)

    seen = set()
    for data in all_pages:
        for coin in data:
            symbol = coin["symbol"].upper() + "USDT"
            if coin.get("total_volume", 0) >= MIN_VOLUME:
                if symbol not in seen:
                    seen.add(symbol)
                    yield (coin["id"], symbol)

    print(f"--- Filter 1 Complete. Found {len(seen)} symbols. ---")


def filter_2_check_date(symbol_stream):
    print("--- Starting Filter 2 (Optimized Bulk Date Lookup) ---")
    session = Session()

    default_start_timestamp = int(TEN_YEARS_AGO.timestamp() * 1000)

    # 1. Load ALL latest dates in ONE QUERY
    rows = session.execute(text("""
        SELECT symbol, MAX(date) AS last_date
        FROM crypto_ohlcv
        GROUP BY symbol;
    """)).fetchall()

    # 2. Build a lookup dictionary for instant access
    last_dates = {row[0]: row[1] for row in rows}

    tasks = []

    # 3. Process each symbol using the dictionary
    for coin_id, symbol in symbol_stream:
        if symbol in last_dates:
            last_date = last_dates[symbol].replace(hour=0, minute=0, second=0, microsecond=0)
            start_time = int(last_date.timestamp() * 1000)
        else:
            start_time = default_start_timestamp

        tasks.append((coin_id, symbol, start_time))

    session.close()
    print(f"Filter 2 Complete. {len(tasks)} symbols prepared for processing.")
    return tasks


async def get_valid_binance_symbols(session):
    print("--- ASYNC HELPER: Fetching valid Binance symbols ---")
    binance_symbols = set()
    try:
        async with session.get(BINANCE_EXCHANGE_INFO_URL, timeout=10) as response:
            if response.status == 200:
                data = await response.json()
                symbols = data.get('symbols', [])
                for s in symbols:
                    if s['quoteAsset'] == 'USDT' and s['status'] == 'TRADING':
                        binance_symbols.add(s['symbol'])
                print(f"✅ Found {len(binance_symbols)} valid USDT pairs on Binance.")
                return binance_symbols
            else:
                print(f"Error fetching Binance info: {response.status}")
                return set()
    except Exception as e:
        print(f"Error connecting to Binance: {e}")
        return set()


async def get_valid_kucoin_symbols(session):
    print("--- ASYNC HELPER: Fetching valid KuCoin symbols ---")
    kucoin_symbols = {}
    try:
        async with session.get(KUCOIN_SYMBOLS_URL, timeout=10) as response:
            if response.status != 200:
                print(f"Error fetching KuCoin info: {response.status}")
                return {}

            data = await response.json()
            if data.get('code') != '200000':
                print(f"KuCoin API Error: {data.get('msg')}")
                return {}

            pairs = data.get('data', [])
            for pair in pairs:
                if pair.get('quoteCurrency') == 'USDT' and pair.get('enableTrading'):
                    kucoin_pair_name = pair['symbol']
                    base_currency = pair['baseCurrency']
                    standard_symbol_usdt = f"{base_currency}USDT"
                    kucoin_symbols[standard_symbol_usdt] = kucoin_pair_name

            print(f"✅ Found {len(kucoin_symbols)} valid USDT pairs on KuCoin.")
            return kucoin_symbols
    except Exception as e:
        print(f"Error connecting to KuCoin: {e}")
        return {}


def _kraken_asset_name_to_standard(asset_name):
    mapping = {
        'XBT': 'BTC', 'XDG': 'DOGE',
    }
    return mapping.get(asset_name.upper(), asset_name.upper())


async def get_valid_kraken_symbols(session):
    print("--- ASYNC HELPER: Fetching valid Kraken symbols ---")
    kraken_symbols = {}
    try:
        async with session.get(KRAKEN_ASSET_PAIRS_URL, timeout=10) as response:
            if response.status != 200:
                print(f"Error fetching Kraken info: {response.status}")
                return {}

            data = await response.json()
            if data.get('error'):
                print(f"Kraken API Error: {data['error']}")
                return {}

            result = data.get('result', {})
            for kraken_pair_name, pair_info in result.items():
                base = pair_info.get('base')
                quote = pair_info.get('quote')

                if quote in ['USDT', 'ZUSD', 'USD']:
                    standard_base = _kraken_asset_name_to_standard(base)
                    standard_symbol_usdt = f"{standard_base}USDT"

                    kraken_symbols[standard_symbol_usdt] = kraken_pair_name

            print(f"✅ Found {len(kraken_symbols)} valid USDT-equivalent pairs on Kraken.")
            return kraken_symbols
    except Exception as e:
        print(f"Error connecting to Kraken: {e}")
        return {}

async def fetch_binance_klines(session, symbol, start_time_ms):
    all_klines = []
    limit = 1000
    time_cursor_ms = start_time_ms

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    while True:
        if time_cursor_ms >= now_ms: break

        url = BINANCE_KLINES_URL
        params = {
            'symbol': symbol,
            'interval': BINANCE_INTERVAL,
            'startTime': time_cursor_ms,
            'limit': limit
        }

        try:
            async with session.get(url, params=params, timeout=30) as response:
                if response.status in [429, 403]:
                    await asyncio.sleep(5)
                    continue

                if response.status != 200: return None

                klines = await response.json()
                if not klines: break

                all_klines.extend(klines)

                if len(klines) < limit: break
                time_cursor_ms = klines[-1][0] + 1
                if time_cursor_ms <= klines[-1][0]:
                    break

        except Exception:
            return None

    if not all_klines: return None

    formatted_klines = [k[:6] for k in all_klines]
    formatted_klines.sort(key=lambda x: x[0])
    return formatted_klines


async def fetch_kucoin_klines(session, symbol, kucoin_pair_name, start_time_ms):
    all_klines = []
    start_time_sec = max(int(start_time_ms / 1000), int(TEN_YEARS_AGO.timestamp()))
    current_end_time_sec = int(datetime.now(timezone.utc).timestamp())

    while True:
        if current_end_time_sec <= start_time_sec: break

        url = KUCOIN_KLINES_URL
        params = {
            'type': KUCOIN_INTERVAL,
            'symbol': kucoin_pair_name,
            'startAt': start_time_sec,
            'endAt': current_end_time_sec
        }

        try:
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 429:
                    await asyncio.sleep(5)
                    continue

                if response.status != 200: return None
                data = await response.json()

                if data.get('code') != '200000': return None
                klines = data.get('data', [])

                if not klines: break
                all_klines.extend(klines)

                if len(klines) < 1500: break
                oldest_ts_sec = int(klines[-1][0])

                if oldest_ts_sec <= start_time_sec: break
                current_end_time_sec = oldest_ts_sec - 1

        except Exception:
            return None

    if not all_klines: return None

    formatted_klines = []
    for k in all_klines:
        timestamp_ms = int(k[0]) * 1000
        if timestamp_ms >= start_time_ms:
            formatted_klines.append([
                timestamp_ms, float(k[1]), float(k[3]), float(k[4]),
                float(k[2]), float(k[5])
            ])

    formatted_klines.sort(key=lambda x: x[0])
    return formatted_klines


async def fetch_kraken_klines(session, symbol, kraken_pair_name, start_time_ms):
    all_klines = []
    current_since = max(int(start_time_ms / 1000), int(TEN_YEARS_AGO.timestamp()))

    while True:
        url = KRAKEN_OHLC_URL
        params = {
            'pair': kraken_pair_name,
            'interval': KRAKEN_INTERVAL,
            'since': current_since
        }

        try:
            async with session.get(url, params=params, timeout=30) as response:
                if response.status == 429:
                    await asyncio.sleep(5)
                    continue

                if response.status != 200: return None
                data = await response.json()

                if data.get('error'):
                    return None
                klines = data['result'].get(kraken_pair_name)

                if not klines: break
                all_klines.extend(klines)
                last_ts_sec = data['result'].get('last')

                if not last_ts_sec or last_ts_sec <= current_since: break
                current_since = last_ts_sec

        except Exception:
            return None

    if not all_klines: return None

    formatted_klines = []
    for k in all_klines:
        timestamp_ms = int(k[0]) * 1000
        if timestamp_ms >= start_time_ms:
            formatted_klines.append([
                timestamp_ms, float(k[1]), float(k[2]), float(k[3]),
                float(k[4]), float(k[6])
            ])

    formatted_klines.sort(key=lambda x: x[0])
    return formatted_klines

async def fetch_kucoin_single_day(session, pair):
    url = KUCOIN_KLINES_URL
    params = {
        'type': '1day',
        'symbol': pair
    }
    try:
        async with session.get(url, params=params, timeout=10) as r:
            if r.status != 200:
                return None
            data = await r.json()
            if data.get("code") != "200000":
                return None

            klines = data.get("data", [])
            formatted = []
            for k in klines[-3:]:
                ts = int(k[0]) * 1000
                formatted.append([ts, float(k[1]), float(k[3]), float(k[4]), float(k[2]), float(k[5])])
            return formatted
    except:
        return None

async def fetch_kraken_single_day(session, pair):
    url = KRAKEN_OHLC_URL
    params = {
        'pair': pair,
        'interval': 1440
    }
    try:
        async with session.get(url, params=params, timeout=10) as r:
            if r.status != 200:
                return None
            data = await r.json()
            if data.get("error"):
                return None

            klines = data["result"].get(pair)
            if not klines:
                return None

            formatted = []
            for k in klines[-3:]:
                ts = int(k[0]) * 1000
                formatted.append([ts, float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[6])])
            return formatted
    except:
        return None


async def fetch_binance_single_day(session, symbol):
    url = BINANCE_KLINES_URL
    params = {
        "symbol": symbol,
        "interval": "1d",
        "limit": 3
    }
    try:
        async with session.get(url, params=params, timeout=10) as r:
            if r.status != 200:
                return None
            return [k[:6] for k in await r.json()]
    except:
        return None


async def process_coin(session, db_session, coin_id, symbol, start_time, binance_symbols, kucoin_symbols,
                       kraken_symbols,
                       exchange_limiter):
    async with exchange_limiter:

        # 1. PRIMARY CHECK: Binance
        if symbol in binance_symbols:
            klines = await fetch_binance_klines(session, symbol, start_time)
            if klines:
                save_to_db(db_session, symbol, klines, coin_name=coin_id)
                print(f"   [BINANCE] Saved {len(klines)} rows for {symbol}.")
                return

        # 2. SECONDARY CHECK: KuCoin
        kucoin_pair_name = kucoin_symbols.get(symbol)
        if kucoin_pair_name:
            klines = await fetch_kucoin_klines(session, symbol, kucoin_pair_name, start_time)
            if klines:
                save_to_db(db_session, symbol, klines, coin_name=coin_id)
                print(f"   [KUCOIN] Saved {len(klines)} rows for {symbol}.")
                return

        # 3. TERTIARY CHECK: Kraken
        kraken_pair_name = kraken_symbols.get(symbol)
        if kraken_pair_name:
            klines = await fetch_kraken_klines(session, symbol, kraken_pair_name, start_time)
            if klines:
                save_to_db(db_session, symbol, klines, coin_name=coin_id)
                print(f"   [KRAKEN] Saved {len(klines)} rows for {symbol}.")
                return

    start_time_as_dt = datetime.fromtimestamp(start_time / 1000).strftime('%Y-%m-%d')
    print(f"   [FAILURE] No new data found for {symbol} on any exchange (starting from {start_time_as_dt}).")




def save_to_db(session, symbol, klines, coin_name=None):
    if not klines:
        return

    for k in klines:
        try:
            ts = int(k[0])
            dt = datetime.fromtimestamp(ts / 1000)

            data = {
                "symbol": symbol,
                "name": coin_name,
                "date": dt,
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5])
            }

            stmt = insert(CryptoOHLCV).values(data)
            stmt = stmt.on_conflict_do_update(
                constraint="unique_symbol_date",
                set_={
                    "open": stmt.excluded.open,
                    "high": stmt.excluded.high,
                    "low": stmt.excluded.low,
                    "close": stmt.excluded.close,
                    "volume": stmt.excluded.volume
                }
            )

            with session.begin_nested():
                session.execute(stmt)

        except Exception as e:
            print(f"Row skip for {symbol} at {dt}: {e}")
            continue

    try:
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Commit failed: {e}")


async def filter_3_orchestrator(task_list):
    print("--- Starting Filter 3: Processing (High Concurrency) ---")

    exchange_limiter = asyncio.Semaphore(EXCHANGE_CONCURRENT_LIMIT)

    async with aiohttp.ClientSession() as session:
        db_session = Session()

        binance_task = get_valid_binance_symbols(session)
        kucoin_task = get_valid_kucoin_symbols(session)
        kraken_task = get_valid_kraken_symbols(session)

        results = await asyncio.gather(binance_task, kucoin_task, kraken_task)
        binance_symbols, kucoin_symbols, kraken_symbols = results

        tasks = []
        for coin_id, symbol, start_time in task_list:
            task = asyncio.create_task(
                process_coin(session, db_session, coin_id, symbol, start_time,
                             binance_symbols, kucoin_symbols, kraken_symbols, exchange_limiter)
            )
            tasks.append(task)

        await asyncio.gather(*tasks)

        db_session.close()


def analyze_database_sources():
    session = Session()
    print("\n--- Database Source Analysis (Binance/KuCoin/Kraken Only) ---")

    try:
        exchange_symbols_query = session.query(CryptoOHLCV.symbol) \
            .filter(CryptoOHLCV.quote_volume > 1.0) \
            .group_by(CryptoOHLCV.symbol)

        exchange_symbols = set([row[0] for row in exchange_symbols_query.all()])
        count_exchange = len(exchange_symbols)

        all_symbols_query = session.query(CryptoOHLCV.symbol).distinct()
        total_coins_with_data = all_symbols_query.count()

        if total_coins_with_data == 0:
            print("Database is empty. Run the pipeline first to collect data.")
        else:
            print(f"Total Unique Symbols in DB: {total_coins_with_data}")
            print("-------------------------------------------------")
            print(f"✅ Exchange-Sourced (Quote Volume > $1.0): {count_exchange} symbols")
            print(
                f"❌ Symbols with low/no volume data: {total_coins_with_data - count_exchange} symbols (Data likely incomplete/corrupt)")
            print("-------------------------------------------------")

    except Exception as e:
        print(f"An error occurred during database analysis: {e}")

    finally:
        session.close()


def count_distinct_symbols():
    session = Session()
    print("\n--- Distinct Symbol Count (Total) ---")

    try:
        count = session.query(CryptoOHLCV.symbol).distinct().count()
        print(f"Total Unique Symbols in DB: {count}")
        print("------------------------------------")
    except Exception as e:
        print(f"An error occurred while counting distinct symbols: {e}")
    finally:
        session.close()


def count_high_volume_symbols():
    session = Session()
    print("\n--- Distinct Symbol Count (Quote Volume > $1.0) ---")

    try:
        count = session.query(CryptoOHLCV.symbol) \
            .filter(CryptoOHLCV.quote_volume > 1.0) \
            .group_by(CryptoOHLCV.symbol) \
            .count()

        print(f"Total Unique Symbols with Quote Volume > $1.0: {count}")
        print("---------------------------------------------")
    except Exception as e:
        print(f"An error occurred while counting high volume symbols: {e}")
    finally:
        session.close()

async def run_pipeline_async():
    start_time = time.time()

    symbols = []
    async for item in async_filter_1_get_symbols():
        symbols.append(item)

    tasks = filter_2_check_date(symbols)

    await filter_3_orchestrator(tasks)

    print(f"\nDone in {time.time() - start_time:.2f} seconds.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        if command == '--analyze':
            analyze_database_sources()
        elif command == '--count-symbols':
            count_distinct_symbols()
        elif command == '--count-high-volume':
            count_high_volume_symbols()
        else:
            print(f"Unknown command: {command}. Running data collection pipeline.")
            asyncio.run(run_pipeline_async())
    else:
        asyncio.run(run_pipeline_async())
