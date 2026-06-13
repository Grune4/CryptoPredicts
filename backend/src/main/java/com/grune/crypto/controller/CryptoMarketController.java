package com.grune.crypto.controller;

import com.grune.crypto.model.CryptoMarket;
import com.grune.crypto.service.AnalysisService;
import com.grune.crypto.service.CryptoMarketService;
import com.grune.crypto.service.NewsService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class CryptoMarketController {
    private final CryptoMarketService cryptoMarketService;
    private final AnalysisService analysisService;
    private final NewsService newsService;

    public CryptoMarketController(CryptoMarketService cryptoMarketService, AnalysisService analysisService, NewsService newsService) {
        this.cryptoMarketService = cryptoMarketService;
        this.analysisService = analysisService;
        this.newsService = newsService;
    }

    @GetMapping("/coins")
    public List<CryptoMarket> getCoins () {
        return cryptoMarketService.getCoins();
    }

    @GetMapping("/coins/{symbol}")
    public Optional<CryptoMarket> getCoin (@PathVariable String symbol) {
        return cryptoMarketService.findBySymbol(symbol);
    }

    @GetMapping("/{symbol}/analyze")
    public ResponseEntity<String> analyzeCrypto (@PathVariable String symbol) {
        String result = analysisService.analyzeCrypto(symbol);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/news")
    public ResponseEntity<String> getNews(@RequestParam(defaultValue = "all") String filter, @RequestParam(required = false) String currencies) {
        String newsData = newsService.fetchNews(filter, currencies);
        if (newsData == null) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
        return ResponseEntity.ok(newsData);
    }
}
