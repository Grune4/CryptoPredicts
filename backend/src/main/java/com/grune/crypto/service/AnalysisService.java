package com.grune.crypto.service;

import com.grune.crypto.repository.CryptoOhlcvRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

@Service
public class AnalysisService {
    private final RestTemplate restTemplate = new RestTemplate();
    private final String PYTHON_SERVICE_URL = "http://fastapi:8000/api/analyze";
    private final CryptoOhlcvRepository cryptoOhlcvRepository;

    public AnalysisService (CryptoOhlcvRepository cryptoOhlcvRepository) {
        this.cryptoOhlcvRepository = cryptoOhlcvRepository;
    }

    public String analyzeCrypto (String symbol) {
        Optional<String> coinIdOptional = cryptoOhlcvRepository.findNameBySymbol(symbol);
        String coinId = coinIdOptional.get();
        String pythonUrl = String.format("%s/%s?coin_id=%s", PYTHON_SERVICE_URL, symbol, coinId);
        ResponseEntity<String> response = restTemplate.getForEntity(pythonUrl, String.class);
        if (response.getStatusCode().is2xxSuccessful()) {
            return response.getBody();
        } else {
            return  null;
        }
    }
}
