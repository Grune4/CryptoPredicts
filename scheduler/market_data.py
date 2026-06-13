import requests
import time
import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
from typing import List, Dict, Any

load_dotenv()

Base = declarative_base()

class MarketData(Base):
    __tablename__ = 'market_data'

    id = Column(Integer, primary_key=True)
    coingecko_id = Column(String, unique=True, index=True)
    symbol = Column(String, index=True)

    current_price = Column(Float)
    market_cap = Column(Float)
    market_cap_rank = Column(Integer)
    high_24h = Column(Float)
    low_24h = Column(Float)
    total_supply = Column(Float)
    price_change_24h = Column(Float)
    price_change_percentage_24h = Column(Float)
    ath = Column(Float)
    atl = Column(Float)
    last_updated = Column(DateTime)


POSTGRES_USER = os.getenv("DB_USER")
POSTGRES_PASSWORD = os.getenv("DB_PASSWORD")
POSTGRES_HOST = os.getenv("DB_HOST")
POSTGRES_PORT = os.getenv("DB_PORT")
POSTGRES_DB = os.getenv("DB_NAME")

DATABASE_URL = f"postgresql+psycopg2://postgres:test123@localhost:5432/postgres"

try:
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
except Exception as e:
    print(f"Error connecting to the database: {e}")
    exit()

COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/markets"
PER_PAGE = 250
TOTAL_PAGES = 4
MAX_RETRIES = 5
DELAY_SECONDS = 0.5

def fetch_data() -> List[Dict[str, Any]]:
    """Fetches all market data across multiple pages with rate-limit handling."""
    all_coins = []

    print(f"Starting fetch for {TOTAL_PAGES * PER_PAGE} coins...")

    for page in range(1, TOTAL_PAGES + 1):
        retries = 0
        while retries < MAX_RETRIES:
            params = {
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": PER_PAGE,
                "page": page,
                "sparkline": "false"
            }
            try:
                response = requests.get(COINGECKO_URL, params=params, timeout=15)

                if response.status_code == 200:
                    coins = response.json()
                    all_coins.extend(coins)
                    print(f"Page {page} fetched successfully with {len(coins)} coins.")
                    time.sleep(DELAY_SECONDS)
                    break
                elif response.status_code == 429:
                    wait = (2 ** retries) * 5
                    print(f"Rate limited (429) on page {page}, retrying in {wait}s...")
                    time.sleep(wait)
                    retries += 1
                else:
                    print(f"Error fetching page {page}: {response.status_code} - {response.text[:100]}...")
                    retries += 1
                    time.sleep(5)
            except requests.exceptions.RequestException as e:
                print(f"Connection error on page {page}: {e}")
                retries += 1
                time.sleep(5)
        else:
            print(f"🚨 Failed to fetch page {page} after {MAX_RETRIES} retries. Stopping.")
            break

    return all_coins

from sqlalchemy.dialects.postgresql import insert

def upsert_data(coins: List[Dict[str, Any]]):
    session = Session()
    try:
        for coin in coins:
            data = {
                "coingecko_id": coin.get('id'),
                "symbol": coin['symbol'].upper(),
                "current_price": coin.get('current_price'),
                "market_cap": coin.get('market_cap'),
                "market_cap_rank": coin.get('market_cap_rank'),
                "high_24h": coin.get('high_24h'),
                "low_24h": coin.get('low_24h'),
                "total_supply": coin.get('total_supply'),
                "price_change_24h": coin.get('price_change_24h'),
                "price_change_percentage_24h": coin.get('price_change_percentage_24h'),
                "ath": coin.get('ath'),
                "atl": coin.get('atl'),
                "last_updated": datetime.strptime(coin['last_updated'], "%Y-%m-%dT%H:%M:%S.%fZ")
            }

            stmt = insert(MarketData).values(data)
            stmt = stmt.on_conflict_do_update(
                index_elements=['coingecko_id'], # Користи ја оваа колона за проверка на дупликати
                set_={k: v for k, v in data.items() if k != 'coingecko_id'}
            )
            session.execute(stmt)

        session.commit()
        print("✅ Data synchronized successfully.")
    except Exception as e:
        session.rollback()
        print(f"DB Error: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    market_data = fetch_data()
    if market_data:
        upsert_data(market_data)
        print(f"Total records processed: {len(market_data)}")
    else:
        print("No data was fetched to process.")

    print("Script finished.")
