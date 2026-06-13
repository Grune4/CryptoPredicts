package com.grune.crypto.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "crypto_ohlcv")
@Getter
@Setter
public class CryptoOhlcv {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String symbol;
    private String name;
    private LocalDateTime date;
    private Double open;
    private Double high;
    private Double low;
    private Double close;
    private Double volume;

    public String getSymbol() {
        return symbol;
    }

    public String getName() {
        return name;
    }

}
