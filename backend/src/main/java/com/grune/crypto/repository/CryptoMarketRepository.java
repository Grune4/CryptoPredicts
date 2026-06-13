package com.grune.crypto.repository;

import com.grune.crypto.model.CryptoMarket;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CryptoMarketRepository extends JpaRepository<CryptoMarket, Long> {
    Optional<CryptoMarket> findBySymbol(String symbol);
}
