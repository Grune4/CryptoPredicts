DELETE FROM crypto_ohlcv a USING (
      SELECT MIN(ctid) as keep_ctid, symbol, date
      FROM crypto_ohlcv
      GROUP BY symbol, date
      HAVING COUNT(*) > 1
    ) b
    WHERE a.symbol = b.symbol 
    AND a.date = b.date 
    AND a.ctid <> b.keep_ctid;

ALTER TABLE crypto_ohlcv 
ADD CONSTRAINT unique_symbol_date UNIQUE (symbol, date);