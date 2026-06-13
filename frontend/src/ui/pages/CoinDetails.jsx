    import cryptoOhlcvRepository from "../../repository/cryptoOhlcvRepository.js";
    import cryptoMarketRepository from "../../repository/cryptoMarketRepository.js";
    import React, { useState, useEffect } from "react";
    import { useParams, useLocation, useNavigate } from "react-router-dom";
    import { motion } from "framer-motion";
    import { Line } from "react-chartjs-2";
    import {
        Chart as ChartJS,
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        Filler
    } from 'chart.js';

    ChartJS.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        Filler
    );

    const formatLargeNumber = (num) => {
        if (num === null || num === undefined) return "N/A";
        const number = Number(num);
        if (number > 0 && number < 0.01) return `$${number.toFixed(6)}`;
        if (number >= 1000000000) return `$${(number / 1000000000).toFixed(1)}B`;
        if (number >= 1000000) return `$${(number / 1000000).toFixed(1)}M`;
        return `$${number.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    };

    const CoinDetails = () => {
        const [coinData, setCoinData] = useState([]);
        const [marketCoin, setMarketCoin] = useState(null);
        const location = useLocation();
        const query = new URLSearchParams(location.search);
        const defaultRange = query.get("range") || "7D";
        const [timeRange, setTimeRange] = useState(defaultRange);
        const { symbol: coinName } = useParams();
        const navigate = useNavigate();
        const [coinNews, setCoinNews] = useState([]);

        const displaySymbol = marketCoin?.name?.toUpperCase() || coinName.toUpperCase();
        const displayName = marketCoin?.name || coinName;
        const displayCoinNewsSymbol = marketCoin?.name?.toUpperCase()
        const coinSymbol = displaySymbol + "USDT";

        useEffect(() => {
            if (location.state?.coin) {
                setMarketCoin(location.state.coin);
            }
        }, [location.state]);

        console.log(marketCoin?.name?.toUpperCase());

        useEffect(() => {
            if (displayCoinNewsSymbol) {
                cryptoMarketRepository.fetchCoinNews(displayCoinNewsSymbol)
                    .then(res => setCoinNews(res.data.results || []))
                    .catch(console.error);
            }
        }, [displayCoinNewsSymbol]);

        console.log(coinNews)

        useEffect(() => {
            if (!marketCoin) {
                cryptoMarketRepository.getCoin(coinName)
                    .then(res => setMarketCoin(res.data))
                    .catch(console.error);
            }
        }, [marketCoin, coinName]);

        useEffect(() => {
            cryptoOhlcvRepository.getCoin(coinSymbol)
                .then((res) => {
                    const raw = res.data;
                    // eslint-disable-next-line react-hooks/immutability
                    const filtered = filterByRange(raw, timeRange);
                    const formatted = filtered.map(item => ({
                        // eslint-disable-next-line react-hooks/immutability
                        date: formatDate(item.date, timeRange),
                        close: item.close,
                    }));
                    setCoinData(formatted);
                })
                .catch(console.error);
        }, [coinSymbol, timeRange]);

        const formatDate = (date, range) => {
            const d = new Date(date);
            if (["7D", "1M", "3M"].includes(range)) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            if (["1Y", "ALL"].includes(range)) return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        };

        const filterByRange = (data, range) => {
            if (range === "7D") return data.slice(-7);
            if (range === "1M") return data.slice(-30);
            if (range === "3M") return data.slice(-90);
            if (range === "1Y") return data.slice(-365);
            return data;
        };
        console.log(coinData)

        const priceChange = marketCoin?.priceChangePercentage24h ?? 0;
        const currentPrice = marketCoin?.currentPrice;
        const isPriceChangeAvailable = marketCoin?.priceChangePercentage24h !== undefined && marketCoin?.priceChangePercentage24h !== null;
        const priceChangeStyle = priceChange >= 0 ? { color: "green", fontWeight: "bold" } : { color: "red", fontWeight: "bold" };
        const priceChangeText = isPriceChangeAvailable ? (priceChange >= 0 ? `+${priceChange.toFixed(2)}%` : `${priceChange.toFixed(2)}%`) : 'N/A';
        const formattedPriceChangeAmount = marketCoin?.priceChange24h !== undefined
            ? (marketCoin.priceChange24h >= 0 ? "+" : "") + Number(marketCoin.priceChange24h).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : 'N/A';

        const keyMetrics = [
            { label: "Market Cap", value: marketCoin?.marketCap ? marketCoin.marketCap.toLocaleString() : "N/A" },
            { label: "Total Supply", value: marketCoin?.totalSupply ? marketCoin.totalSupply.toLocaleString() + " " + displaySymbol : "N/A" },
            { label: "All-Time High", value: marketCoin?.ath ? formatLargeNumber(marketCoin.ath) : "N/A" },
            { label: "All-Time Low", value: marketCoin?.atl ? formatLargeNumber(marketCoin.atl) : "N/A" },
        ];

        const chartData = {
            labels: coinData.map(item => item.date),
            datasets: [
                {
                    label: `${displaySymbol} Price`,
                    data: coinData.map(item => item.close),
                    borderColor: "#0BDA51",
                    backgroundColor: (context) => {
                        const ctx = context.chart.ctx;
                        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                        gradient.addColorStop(0, "rgba(11, 218, 81, 0.4)");
                        gradient.addColorStop(1, "rgba(11, 218, 81, 0)");
                        return gradient;
                    },
                    tension: 0.3,
                    pointRadius: 0,
                    fill: true
                }
            ]
        };

        const chartOptions = {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `$${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    ticks: {
                        callback: function (value) {
                            return `$${value.toLocaleString()}`;
                        }
                    }
                }
            }
        };

        return (
            <div style={{width: "1200px", display: "flex", flexDirection: "column", padding: "0 50px"}}>
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "40px"
                }}>
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        padding: "15px 20px",
                        borderRadius: "15px",
                        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
                        border: "1px solid var(--card-border)",
                        backdropFilter: "blur(12px)",
                        background: "var(--card-bg)",
                        color: "var(--text-main)"
                    }}>

                        <div style={{display: "flex", alignItems: "center"}}>
                            {marketCoin && (
                                <img
                                    style={{borderRadius: "50%", width: "100px", height: "100px"}}
                                    src={`https://img.logo.dev/crypto/${marketCoin.name}?token=pk_QiiUrT_TS0yFC7X9CGEddw`}
                                    alt={marketCoin.name}
                                />
                            )}
                            <div style={{marginLeft: "20px"}}>
                                <h2 style={{margin: 0, fontSize: "32px", fontWeight: "600"}}>{displayName}</h2>
                                <p style={{margin: 0, color: "var(--text-muted)", fontSize: "18px"}}>{displaySymbol}</p>
                            </div>
                        </div>
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            textAlign: "right"
                        }}>
                            <h2 style={{margin: 0, fontSize: "36px", fontWeight: "bold"}}>
                                {formatLargeNumber(currentPrice)}
                            </h2>
                            <span style={{fontSize: "16px", marginBottom: "10px", ...priceChangeStyle}}>
                                {formattedPriceChangeAmount} ({priceChangeText})
                            </span>
                            <button
                                className="liquid-button"
                                style={{
                                    position: "relative",
                                    padding: "10px 20px",
                                    border: "2px solid #0BDA51",
                                    borderRadius: "5px",
                                    color: "#333",
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                    overflow: "hidden",
                                    background: "transparent",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                }}
                                onClick={() => navigate(`/${coinSymbol}/analyze`)}
                            >
                                View Prediction Models ↗
                                <span className="liquid"></span>
                            </button>

                        </div>
                    </div>
                </div>
                <div style={{
                    display: "flex",
                    gap: "30px",
                    borderRadius: "24px",
                    padding: "30px",
                    background: "var(--card-bg)",
                    backdropFilter: "blur(10px)",
                    border: "1px solid var(--card-border)",
                    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
                    color: "var(--text-main)"
                }}>
                    <div style={{flex: 3}}>
                        <h2 style={{
                            borderBottom: "1px solid var(--border-color)",
                            color: "var(--text-main)",
                            paddingBottom: "10px",
                            display: "flex",
                            justifyContent: "space-between"
                        }}>
                            Price History
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                backgroundColor: "var(--pill-bg)",
                                padding: "4px",
                                borderRadius: "12px",
                                width: "fit-content"
                            }}>
                                {['7D', '1M', '3M', '1Y', 'ALL'].map((range) => {
                                    const isActive = timeRange === range;

                                    return (
                                        <button
                                            key={range}
                                            onClick={() => {
                                                setTimeRange(range);
                                                window.history.replaceState({}, "", `?range=${range}`);
                                            }}
                                            style={{
                                                position: "relative",
                                                padding: "8px 16px",
                                                border: "none",
                                                backgroundColor: "transparent",
                                                cursor: "pointer",
                                                fontSize: "14px",
                                                fontWeight: isActive ? "bold" : "500",
                                                color: isActive ? "#0BDA51" : "#5f6368",
                                                transition: "color 0.3s ease",
                                                outline: "none",
                                            }}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="activeTab"
                                                    style={{
                                                        position: "absolute",
                                                        inset: 0,
                                                        backgroundColor: "var(--pill-active)",
                                                        borderRadius: "8px",
                                                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                                                        zIndex: 0,
                                                    }}
                                                    transition={{type: "spring", bounce: 0.2, duration: 0.6}}
                                                />
                                            )}
                                            <span style={{position: "relative", zIndex: 1}}>{range}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </h2>

                        <div style={{height: "400px", width: "920px"}}>
                            <Line data={chartData} options={chartOptions} width={1000} height={400}/>
                        </div>
                    </div>

                    <div style={{flex: 1}}>
                        <h2 style={{
                            borderBottom: "1px solid var(--border-color)",
                            color: "var(--text-main)",
                            paddingBottom: "10px"
                        }}>
                            Key Metrics
                        </h2>
                        <div style={{padding: "10px 0"}}>
                            {keyMetrics.map((metric) => (
                                <div key={metric.label} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "8px 0",
                                    borderBottom: '1px dashed #ccc',
                                    fontSize: "15px"
                                }}>
                                    <span style={{color: "var(--text-muted)"}}>{metric.label}</span>
                                    <span style={{fontWeight: "bold"}}>{metric.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={{
                    marginTop: "40px",
                    padding: "30px",
                    background: "var(--card-bg)",
                    borderRadius: "24px",
                    border: "1px solid var(--card-border)",
                    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
                }}>
                    <h2 style={{marginBottom: "20px", fontSize: "24px"}}>Latest News</h2>

                    <div style={{display: "flex", flexDirection: "column", gap: "15px"}}>
                        {coinNews.length > 0 ? (
                            coinNews.filter(i => i.description != null).slice(0, 5).map((item) => (
                                <div key={item.id} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "15px",
                                    borderRadius: "12px",
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid var(--card-border)",
                                    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)"
                                }}>
                                    <div style={{flex: 1}}>
                                        <h4 style={{margin: "0 0 5px 0", fontSize: "20px"}}>{item.title}</h4>
                                        <div>
                                            {item.description}
                                        </div>
                                        <div>
                                            <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)" }}>{new Date(item.published_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p style={{color: "var(--text-muted)"}}>No recent news found for this coin.</p>
                        )
                        }
                    </div>
                </div>
                <style>{`
.liquid-button {
  position: relative;
  display: inline-block;
  font-size: 16px;
  font-weight: bold;
  color: #333;
  border: 2px solid #0BDA51;
  border-radius: 5px;
  overflow: hidden;
  cursor: pointer;
  transition: color 0.3s ease;
  background: transparent;
}

.liquid-button .liquid {
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 200%;
  background: #0BDA51;
  z-index: -1;

  transform: scale(0);
  transform-origin: bottom right;
  transition: transform 0.6s ease-in-out;

  background: repeating-linear-gradient(
    -45deg,
    #0BDA51,
    #0BDA51 20px,
    #0acb4a 20px,
    #0acb4a 40px
  );
  animation: wave 3s linear infinite;
}

.liquid-button:hover .liquid {
  transform: scale(1);
}

.liquid-button:hover {
  color: #fff;
}

@keyframes wave {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 80px 80px;
  }
}


`}</style>
            </div>
        );
    };


    export default CoinDetails;
