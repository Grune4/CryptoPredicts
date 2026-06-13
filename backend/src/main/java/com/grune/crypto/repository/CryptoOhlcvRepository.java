package com.grune.crypto.repository;

import com.grune.crypto.model.CryptoOhlcv;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CryptoOhlcvRepository extends JpaRepository<CryptoOhlcv, Long> {
    List<CryptoOhlcv> findBySymbol (String symbol);
    @Query(value = "SELECT c.name FROM CryptoOhlcv c WHERE c.symbol = :symbol ORDER BY c.date DESC LIMIT 1")
    Optional<String> findNameBySymbol (@Param("symbol") String symbol);
}
