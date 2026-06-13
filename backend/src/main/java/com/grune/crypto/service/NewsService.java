package com.grune.crypto.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Service
public class NewsService {
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${cryptopanic.api.key}")
    String apiKey;
    private final String CRYPTO_PANIC_URL = "https://cryptopanic.com/api/developer/v2/posts/";

    public String fetchNews(String filter, String currencies) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(CRYPTO_PANIC_URL).queryParam("auth_token", apiKey);

        if (filter != null && !filter.equalsIgnoreCase("all")) {
            builder.queryParam("filter", filter);
        }
        if (currencies != null && !currencies.isEmpty()) {
            builder.queryParam("currencies", currencies);
        }

        String finalUrl = builder.toUriString();

        try {
            ResponseEntity<String> response = restTemplate.getForEntity(finalUrl, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                return response.getBody();
            }
        } catch (Exception e) {
            System.err.println("Error calling CryptoPanic: " + e.getMessage());
        }
        return null;
    }
}
