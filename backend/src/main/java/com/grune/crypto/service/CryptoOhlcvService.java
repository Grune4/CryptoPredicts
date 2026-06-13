package com.grune.crypto.service;

import com.grune.crypto.model.CryptoOhlcv;
import com.grune.crypto.repository.CryptoOhlcvRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CryptoOhlcvService {
    private CryptoOhlcvRepository cryptoOhlcvRepository;

    public CryptoOhlcvService (CryptoOhlcvRepository cryptoOhlcvRepository) {
        this.cryptoOhlcvRepository = cryptoOhlcvRepository;
    }

    public List<CryptoOhlcv> findBySymbol (String symbol) {
        return cryptoOhlcvRepository.findBySymbol(symbol);
    }
}
