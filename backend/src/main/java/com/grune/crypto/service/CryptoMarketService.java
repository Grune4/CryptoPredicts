package com.grune.crypto.service;

import com.grune.crypto.model.CryptoMarket;
import com.grune.crypto.repository.CryptoMarketRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CryptoMarketService {
    private CryptoMarketRepository cryptoMarketRepository;

    public CryptoMarketService (CryptoMarketRepository cryptoMarketRepository) {
        this.cryptoMarketRepository = cryptoMarketRepository;
    }

    public List<CryptoMarket> getCoins () {
        return cryptoMarketRepository.findAll();
    }

    public Optional<CryptoMarket> findBySymbol (String symbol) {
        return cryptoMarketRepository.findBySymbol(symbol);
    }
}
