package com.grune.crypto.controller;

import com.grune.crypto.model.CryptoOhlcv;
import com.grune.crypto.service.CryptoOhlcvService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class CryptoOhlcvController {
    private final CryptoOhlcvService cryptoOhlcvService;

    public CryptoOhlcvController (CryptoOhlcvService cryptoOhlcvService) {
        this.cryptoOhlcvService = cryptoOhlcvService;
    }

    @GetMapping("/{symbol}")
    public List<CryptoOhlcv> getCoin(@PathVariable String symbol) {
        return cryptoOhlcvService.findBySymbol(symbol);
    }
}
