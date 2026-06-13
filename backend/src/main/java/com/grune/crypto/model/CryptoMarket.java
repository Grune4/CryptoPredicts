package com.grune.crypto.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "market_data")
@Getter
@Setter
public class CryptoMarket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coingecko_id")
    private String symbol;

    @Column(name = "symbol")
    private String name;

    @Column(name = "current_price")
    private Double currentPrice;

    @Column(name = "market_cap")
    private Double marketCap;

    @Column(name = "market_cap_rank")
    private Integer marketCapRank;

    @Column(name = "high_24h")
    private Double high24h;

    @Column(name = "low_24h")
    private Double low24h;

    @Column(name = "total_supply")
    private Double totalSupply;

    @Column(name = "price_change_24h")
    private Double priceChange24h;

    @Column(name = "price_change_percentage_24h")
    private Double priceChangePercentage24h;

    private String ath;

    private String atl;

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;

    public String getSymbol() {
        return symbol;
    }

    public String getName() {
        return name;
    }

}
