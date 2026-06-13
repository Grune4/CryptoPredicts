from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from sqlalchemy import create_engine, text
from ta.momentum import RSIIndicator, StochasticOscillator
from ta.trend import SMAIndicator, EMAIndicator, MACD, ADXIndicator, WMAIndicator, CCIIndicator
from ta.volatility import BollingerBands
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from sklearn.metrics import mean_squared_error, mean_absolute_percentage_error, r2_score
import math
from nltk.sentiment.vader import SentimentIntensityAnalyzer
import os
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

#DATABASE_URL = "postgresql://crypto_postgres:crypto123@db:5432/crypto_mydb"
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def fetch_data(symbol: str):
    query = text(f"""
        SELECT * FROM crypto_ohlcv 
        WHERE symbol = :symbol 
        ORDER BY date ASC
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"symbol": symbol})

    if df.empty:
        return None

    df.columns = [c.lower() for c in df.columns]

    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)

    return df


def calculate_indicators(df):
    df['rsi'] = RSIIndicator(close=df['close'], window=14).rsi()

    macd = MACD(close=df['close'])
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()

    df['cci'] = CCIIndicator(high=df['high'], low=df['low'], close=df['close'], window=20).cci()

    stoch = StochasticOscillator(high=df['high'], low=df['low'], close=df['close'], window=14)
    df['stoch'] = stoch.stoch()

    df['adx'] = ADXIndicator(high=df['high'], low=df['low'], close=df['close'], window=14).adx()

    df['sma_50'] = SMAIndicator(close=df['close'], window=50).sma_indicator()

    df['ema_20'] = EMAIndicator(close=df['close'], window=20).ema_indicator()

    df['wma_20'] = WMAIndicator(close=df['close'], window=20).wma()

    bb = BollingerBands(close=df['close'], window=20, window_dev=2)
    df['bb_high'] = bb.bollinger_hband()
    df['bb_low'] = bb.bollinger_lband()

    df['vol_sma'] = SMAIndicator(close=df['volume'], window=20).sma_indicator()

    return df


def generate_signal_decision(row):
    score = 0
    if row['rsi'] < 30:
        score += 1
    elif row['rsi'] > 70:
        score -= 1
    if row['close'] > row['sma_50']:
        score += 1
    else:
        score -= 1
    if row['macd'] > row['macd_signal']: score += 1

    if score >= 2:
        return "BUY"
    elif score <= -2:
        return "SELL"
    else:
        return "HOLD"


def create_sequences(data, lookback):
    X, y = [], []
    for i in range(lookback, len(data)):
        X.append(data[i - lookback:i, 0])
        y.append(data[i, 0])
    return np.array(X), np.array(y)


from tensorflow.keras.callbacks import EarlyStopping


def perform_lstm_prediction(df):
    try:
        # 1. Feature Selection: Use Price + Momentum
        # We must calculate indicators BEFORE clipping the tail
        df_feats = calculate_indicators(df.copy()).dropna()

        # Use last 400 days for a better training base
        df_subset = df_feats.tail(400).copy()

        # We select multiple columns now
        features = ['close', 'rsi', 'macd', 'ema_20']
        data = df_subset[features].values

        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_data = scaler.fit_transform(data)

        lookback_period = 60
        train_size = int(len(scaled_data) * 0.8)
        train_data = scaled_data[:train_size]
        test_data = scaled_data[train_size - lookback_period:]

        # 2. Create Sequences (Adjusted for multi-features)
        def create_multivariate_sequences(data, lookback):
            X, y = [], []
            for i in range(lookback, len(data)):
                X.append(data[i - lookback:i, :])  # All features
                y.append(data[i, 0])  # Only 'close' price
            return np.array(X), np.array(y)

        X_train, y_train = create_multivariate_sequences(train_data, lookback_period)
        X_test, y_test = create_multivariate_sequences(test_data, lookback_period)

        # 3. Enhanced Model
        model = Sequential()
        model.add(LSTM(units=50, return_sequences=True, input_shape=(X_train.shape[1], X_train.shape[2])))
        model.add(Dropout(0.1))
        model.add(LSTM(units=25, return_sequences=False))
        model.add(Dense(1))

        model.compile(optimizer="adam", loss="huber")  # Huber loss is more robust to crypto outliers

        # 4. Smart Training
        # We use more epochs but EarlyStopping will stop it if it gets 'good enough'
        early_stop = EarlyStopping(monitor='loss', patience=3, restore_best_weights=True)

        model.fit(X_train, y_train, epochs=30, batch_size=32, verbose=0, callbacks=[early_stop])

        # 5. Validation & Metrics
        predictions_scaled = model.predict(X_test, verbose=0)

        # Since we scaled 4 columns, we must 'inverse' correctly
        # We create a dummy matrix to satisfy the scaler shape
        dummy_pred = np.zeros((len(predictions_scaled), len(features)))
        dummy_pred[:, 0] = predictions_scaled.flatten()
        predictions = scaler.inverse_transform(dummy_pred)[:, 0]

        dummy_y = np.zeros((len(y_test), len(features)))
        dummy_y[:, 0] = y_test
        y_test_unscaled = scaler.inverse_transform(dummy_y)[:, 0]

        rmse = math.sqrt(mean_squared_error(y_test_unscaled, predictions))
        mape = mean_absolute_percentage_error(y_test_unscaled, predictions)
        r2 = r2_score(y_test_unscaled, predictions)

        # 6. Predict Tomorrow
        last_seq = scaled_data[-lookback_period:].reshape(1, lookback_period, len(features))
        tomorrow_scaled = model.predict(last_seq, verbose=0)

        dummy_tomorrow = np.zeros((1, len(features)))
        dummy_tomorrow[0, 0] = tomorrow_scaled[0][0]
        tomorrow_price = scaler.inverse_transform(dummy_tomorrow)[0, 0]

        from tensorflow.keras import backend as K
        K.clear_session()

        return {
            "price": float(round(tomorrow_price, 2)),
            "metrics": {
                "rmse": float(round(rmse, 2)),
                "mape": float(round(mape * 100, 2)),
                "r_squared": float(round(r2, 4))
            }
        }
    except Exception as e:
        print(f"Deep LSTM Error: {e}")
        return None

def fetch_crypto_news(symbol: str):
    api_key = "e875f1ba937f08540410dfb006fa7c86618bd54b"
    url = f"https://cryptopanic.com/api/developer/v2/posts/?auth_token={api_key}&currencies={symbol}&kind=news"

    headlines = []
    try:
        response = requests.get(url, timeout=5)
        data = response.json()
        for post in data.get('results', [])[:5]:  # Get top 5 news
            headlines.append(post['title'])
        print(headlines)
    except Exception:
        print("News API failed, using mock data")
        headlines = [
            f"Market outlook for {symbol} looks positive",
            f"Regulatory concerns rise for {symbol}",
            f"{symbol} sees massive transaction volume spike",
            "Investors are holding steady amidst volatility"
        ]
    return headlines


def analyze_sentiment(symbol: str):
    headlines = fetch_crypto_news(symbol.replace("USDT", ""))

    sia = SentimentIntensityAnalyzer()
    compound_scores = []

    for headline in headlines:
        score = sia.polarity_scores(headline)['compound']
        compound_scores.append(score)

    avg_score = sum(compound_scores) / len(compound_scores) if compound_scores else 0
    return avg_score


def fetch_tvl(coin_slug: str):
    try:
        url = f"https://api.llama.fi/v2/chains"
        response = requests.get(url, timeout=10)
        data = response.json()

        for chain in data:
            if chain.get("name", "").lower() == coin_slug.lower():
                return chain.get("tvl", 0)
        return 0
    except Exception:
        return 0


def fetch_on_chain_data(coin_id: str):
    if not coin_id:
        return {}

    santiment_results = fetch_santiment_metrics(coin_id, days=7)

    santiment_metrics = {}
    if santiment_results.get("errors"):
        print(f"Santiment API Errors for {coin_id}: {santiment_results['errors']}")

    if santiment_results.get("data"):
        santiment_data = santiment_results["data"]

        santiment_metrics = {
            "active_addresses": get_latest_santiment_value(santiment_data, "active_addresses"),
            "transactions_count": get_latest_santiment_value(santiment_data, "transactions_count"),
            "exchange_inflow": get_latest_santiment_value(santiment_data, "exchange_inflow"),
            "exchange_outflow": get_latest_santiment_value(santiment_data, "exchange_outflow"),
            "whale_transactions": get_latest_santiment_value(santiment_data, "whale_transactions"),
            "nvt_ratio_san": get_latest_santiment_value(santiment_data, "nvt_ratio"),
            "mvrv_ratio": get_latest_santiment_value(santiment_data, "mvrv_ratio")
        }

    try:
        cg_url = (
            "https://api.coingecko.com/api/v3/coins/markets"
            f"?vs_currency=usd&ids={coin_id}"
        )
        headers = {'User-Agent': 'Mozilla/5.0...'}

        response = requests.get(cg_url, headers=headers, timeout=10)

        if response.status_code != 200:
            return {"error": f"CoinGecko API Error: {response.status_code}", "metrics": {**santiment_metrics}}

        data = response.json()
        if not data or len(data) == 0:
            return {"error": "No CoinGecko data", "metrics": {**santiment_metrics}}

        coin = data[0]

        market_cap = coin.get("market_cap", 0)
        volume = coin.get("total_volume", 0)
        price = coin.get("current_price", 0)

        tvl = fetch_tvl(coin_id)

        nvt_ratio = santiment_metrics.get("nvt_ratio_san")
        if nvt_ratio == "Premium/Restricted Access" or nvt_ratio == "Data Unavailable":
            nvt_ratio = (market_cap / volume) if volume > 0 else 0

        nvt_signal = "Overvalued" if (isinstance(nvt_ratio, (int, float)) and nvt_ratio > 100) else "Undervalued"

        volume_to_cap = volume / market_cap if market_cap > 0 else 0
        exchange_flow_sentiment = "High Activity" if volume_to_cap > 0.1 else "Normal"

        final_metrics = {
            "market_cap": f"${market_cap:,.2f}",
            "price": f"${price:,.2f}",
            "tvl": f"${tvl:,.2f}" if tvl > 0 else "Not Applicable/Available",

            "nvt_ratio": round(nvt_ratio, 2) if isinstance(nvt_ratio, (int, float)) else nvt_ratio,
            "nvt_signal": nvt_signal,

            "active_addresses": f"{santiment_metrics.get('active_addresses', 'N/A'):,.0f}",
            "transactions_count": f"{santiment_metrics.get('transactions_count', 'N/A'):,.0f}",

            "exchange_net_flow": santiment_metrics.get("exchange_inflow", 0) - santiment_metrics.get("exchange_outflow", 0),
            "exchange_flow": exchange_flow_sentiment,

            "whale_activity": santiment_metrics.get("whale_transactions", "N/A"),
            "mvrv_ratio": santiment_metrics.get("mvrv_ratio", "N/A"),

            "hash_rate": "PoW Specific/Premium API"
        }

        return {"status": "success", "metrics": final_metrics}

    except Exception as e:
        return {"error": f"Data fetch failed: {str(e)}", "metrics": {**santiment_metrics}}


def get_latest_santiment_value(metrics_data, metric_name):
    if metrics_data and metric_name in metrics_data and metrics_data[metric_name].get('timeseriesData'):
        data_list = metrics_data[metric_name]['timeseriesData']
        if data_list:
            return float(data_list[-1]['value'])

    if metric_name in ["mvrv_ratio", "whale_transactions", "nvt_ratio"]:
        return "Premium/Restricted Access"

    return "Data Unavailable"


import requests
import json
from datetime import datetime, timedelta

API_KEY_SENTIMENT = "jlbfiskvnhcievgw_mm7eqtfyz67h3ygs"
URL = "https://api.santiment.net/graphql"


def fetch_santiment_metrics(slug: str, days: int = 7):
    query_full = """
        query($slug: String!, $from: DateTime!, $to: DateTime!) {
            active_addresses: getMetric(metric: "daily_active_addresses") {
                timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") { datetime, value }
            }
            transactions_count: getMetric(metric: "transactions_count") {
                timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") { datetime, value }
            }
            exchange_inflow: getMetric(metric: "exchange_inflow") {
                timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") { datetime, value }
            }
            exchange_outflow: getMetric(metric: "exchange_outflow") {
                timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") { datetime, value }
            }
            whale_transactions: getMetric(metric: "whale_transaction_count_100k_usd_to_inf") {
                timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") { datetime, value }
            }
            nvt_ratio: getMetric(metric: "nvt") {
                timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") { datetime, value }
            }
            mvrv_ratio: getMetric(metric: "mvrv_usd") {
                timeseriesData(slug: $slug, from: $from, to: $to, interval: "1d") { datetime, value }
            }
        }
    """

    end_date = datetime.utcnow()
    lag_days = 31
    query_end = end_date - timedelta(days=lag_days)
    query_start = query_end - timedelta(days=2)
    variables = {
        "slug": slug,
        "from": query_start.isoformat() + "Z",
        "to": query_end.isoformat() + "Z"
    }

    headers = {
        "Authorization": f"Apikey {API_KEY_SENTIMENT}",
        "Content-Type": "application/json"
    }

    payload = {
        'query': query_full,
        'variables': variables
    }

    try:
        response = requests.post(URL, headers=headers, json=payload, timeout=20)
        response.raise_for_status()

        return response.json()

    except requests.exceptions.RequestException as e:
        return {"error": f"Request failed: {e}"}
    except Exception as e:
        return {"error": f"An unexpected error occurred: {e}"}


results = fetch_santiment_metrics("bitcoin", days=7)

if results.get("errors"):
    print("--- API Errors Detected ---")
    print(json.dumps(results["errors"], indent=2))
elif results.get("error"):
    print(results["error"])
else:
    latest_mvrv_data = results['data']['mvrv_ratio']['timeseriesData']
    if latest_mvrv_data:
        latest_mvrv = latest_mvrv_data[-1]['value']
        print(f"Latest MVRV Ratio for Bitcoin: {latest_mvrv:.2f}")

    print("\nSuccessfully fetched all metrics. Check the full 'results' dictionary.")

if __name__ == "__main__":
    result = fetch_on_chain_data("ethereum")
    print(result)


@app.get("/api/analyze/{symbol}")
def analyze_crypto(symbol: str, coin_id: str = None):
    df_daily = fetch_data(symbol)

    if df_daily is None:
        raise HTTPException(status_code=404, detail="Symbol not found in database")

    agg_rules = {
        'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum',
        'symbol': 'first'
    }
    df_weekly = df_daily.resample('W').agg(agg_rules).dropna()
    df_monthly = df_daily.resample('ME').agg(agg_rules).dropna()

    timeframe_results = {}
    for tf_name, df_tf in [('1d', df_daily), ('1w', df_weekly), ('1m', df_monthly)]:
        if len(df_tf) < 52:
            timeframe_results[tf_name] = {"error": "Not enough data"}
            continue

        df_tf = calculate_indicators(df_tf)
        latest = df_tf.iloc[-1]

        signal = generate_signal_decision(latest)

        timeframe_results[tf_name] = {
            "price": float(latest["close"]),
            "signal": signal,
            "indicators": {
                "rsi": float(round(latest["rsi"], 2)),
                "macd": float(round(latest["macd"], 2)),
                "cci": float(round(latest["cci"], 2)),
                "stoch": float(round(latest["stoch"], 2)),
                "adx": float(round(latest["adx"], 2)),
                "sma_50": float(round(latest["sma_50"], 2)),
                "ema_20": float(round(latest["ema_20"], 2)),
                "wma_20": float(round(latest["wma_20"], 2)),
                "bb_high": float(round(latest["bb_high"], 2)),
                "bb_low": float(round(latest["bb_low"], 2)),
                "vol_sma": float(round(latest["vol_sma"], 2))
            }
        }

    lstm_result = perform_lstm_prediction(df_daily.copy())
    if lstm_result is None:
        lstm_result = {"price": None, "metrics": {"error": "Training failed or insufficient data"}}

    sentiment_score = analyze_sentiment(symbol)

    on_chain_data = fetch_on_chain_data(coin_id)
    on_chain_metrics = on_chain_data.get("metrics", {})

    result = {
        "symbol": symbol,
        "date": str(df_daily.index[-1]),
        "timeframes": timeframe_results,
        "prediction": lstm_result,
        "market_sentiment": {
            "sentiment_score": float(round(sentiment_score, 4)),
            "sentiment_label": "Bullish" if sentiment_score > 0.05 else "Bearish",
            "on_chain_metrics": {
                "nvt_ratio": on_chain_metrics.get("nvt_ratio"),
                "nvt_signal": on_chain_metrics.get("nvt_signal"),

                "mvrv_ratio": on_chain_metrics.get("mvrv_ratio"),
                "active_addresses": on_chain_metrics.get("active_addresses"),

                "exchange_net_flow": on_chain_metrics.get("exchange_net_flow"),

                "whale_activity": on_chain_metrics.get("whale_activity"),

                "hash_rate": on_chain_metrics.get("hash_rate"),
                "tvl": on_chain_metrics.get("tvl"),

                "transactions_count": on_chain_metrics.get("transactions_count"),
            },
        },
        "history_rsi": [float(x) for x in df_daily["rsi"].tail(30).tolist()] if "rsi" in df_daily else []
    }
    return result