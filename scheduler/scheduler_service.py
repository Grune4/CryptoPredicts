import asyncio
import os
from datetime import datetime
from sqlalchemy import text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from main import run_pipeline_async, engine 
from market_data import fetch_data, upsert_data

def force_db_cleanup(engine):
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            print("Running manual database patch...")
            
            conn.execute(text("""
                DELETE FROM crypto_ohlcv a USING (
                  SELECT MIN(ctid) as keep_ctid, symbol, date
                  FROM crypto_ohlcv
                  GROUP BY symbol, date
                  HAVING COUNT(*) > 1
                ) b
                WHERE a.symbol = b.symbol 
                AND a.date = b.date 
                AND a.ctid <> b.keep_ctid;
            """))

            conn.execute(text("""
                ALTER TABLE crypto_ohlcv 
                DROP CONSTRAINT IF EXISTS unique_symbol_date;
                
                ALTER TABLE crypto_ohlcv 
                ADD CONSTRAINT unique_symbol_date UNIQUE (symbol, date);
            """))

            conn.execute(text("""
                ALTER TABLE market_data 
                DROP CONSTRAINT IF EXISTS unique_coingecko_id;
                
                ALTER TABLE market_data 
                ADD CONSTRAINT unique_coingecko_id UNIQUE (coingecko_id);
            """))

            conn.execute(text("""
                DELETE FROM market_data a USING (
                SELECT MIN(ctid) as keep_ctid, coingecko_id
                FROM market_data
                GROUP BY coingecko_id
                HAVING COUNT(*) > 1
                ) b
                WHERE a.coingecko_id = b.coingecko_id 
                AND a.ctid <> b.keep_ctid;
            """))
            
            trans.commit()
            print("✅ Successfully patched database constraints.")
        except Exception as e:
            trans.rollback()
            print(f"⚠️ Patch skipped/failed (Table might not exist yet): {e}")

async def scheduled_ohlcv_task():
    print(f"--- [SCHEDULED] Starting OHLCV Pipeline at {datetime.now()} ---")
    try:
        await run_pipeline_async()
    except Exception as e:
        print(f"OHLCV Pipeline Error: {e}")

async def scheduled_market_data_task():
    print(f"--- [SCHEDULED] Starting Market Data Sync at {datetime.now()} ---")
    try:
        loop = asyncio.get_event_loop()
        market_data = await loop.run_in_executor(None, fetch_data)
        if market_data:
            await loop.run_in_executor(None, upsert_data, market_data)
    except Exception as e:
        print(f"Market Data Sync Error: {e}")

async def main():
    force_db_cleanup(engine)

    scheduler = AsyncIOScheduler(timezone="Europe/Skopje")
    scheduler.add_job(scheduled_ohlcv_task, 'cron', hour=2, minute=0, next_run_time=datetime.now())
    scheduler.add_job(scheduled_market_data_task, 'interval', minutes=2, next_run_time=datetime.now())
    scheduler.start()
    print("Scheduler started")

    try:
        while True:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        pass

if __name__ == "__main__":
    asyncio.run(main())