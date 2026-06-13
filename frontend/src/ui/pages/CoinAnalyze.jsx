import cryptoMarketRepository from "../../repository/cryptoMarketRepository.js"
import cryptoOhlcvRepository from "../../repository/cryptoOhlcvRepository.js";
import {useEffect, useState} from "react";
import {useParams} from "react-router-dom"
import {Line} from "react-chartjs-2";
import { motion } from "framer-motion";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const getSignalColor = (signal) => {
    if (signal === 'BUY') return 'rgba(0, 255, 0, 0.8)'
    if (signal === 'SELL') return '#E32636'
    return '#FFC300'
};

const formatPrice = (price) => {
    if (price === undefined || price === null) return '-';
    return `$${Number(price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatIndicator = (value) => {
    if (value === undefined || value === null) return '-';
    return Number(value).toFixed(2);
};

const formatDate = (date, tf) => {
    const d = new Date(date);

    if (tf === "1d")
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (tf === "1w")
        return d.toLocaleDateString("en-US", { weekday: "short" });

    if (tf === "1m")
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};


const CoinAnalyze = () => {
    let {coinSymbol: symbol} = useParams();
    const [coinAnalyze, setCoinAnalyze] = useState([])
    const [timeFrame, setTimeFrame] = useState("1d")
    const [analysisLoading, setAnalysisLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(true);
    const [coinData, setCoinData] = useState([])
    const timeFrames = [
        {key: "1d", label: "1 Day"},
        {key: "1w", label: "1 Week"},
        {key: "1m", label: "1 Month"},
    ]

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAnalysisLoading(true);
        cryptoMarketRepository.analyzeCrypto(symbol)
            .then((response) => setCoinAnalyze(response.data))
            .catch((error) => {
                console.log(error);
                setCoinAnalyze({ timeframes: { '1d': null, '1w': null, '1m': null } });
            })
            .finally(() => setAnalysisLoading(false));
    }, [symbol]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setChartLoading(true);
        cryptoOhlcvRepository.getCoin(symbol, timeFrame)
            .then(res => {
                const raw = res.data;
                const formatted = raw.map(item => ({
                    rawDate: item.date,
                    label: formatDate(item.date, timeFrame),
                    close: item.close,
                    name: item.name
                }));
                setCoinData(formatted);
            })
            .catch(error => {
                console.log(error);
                setCoinData([]);
            })
            .finally(() => setChartLoading(false));
    }, [symbol, timeFrame]);

    if (analysisLoading || chartLoading) {
        return (
            <div style={styles.loadingContainer}>
                Loading analysis for {symbol}...
            </div>
        );
    }

    console.log(coinAnalyze)
    console.log(coinData[0].name)

    const getPredictionDate = (lastDate, timeFrame) => {
        const date = new Date(lastDate);
        switch(timeFrame) {
            case "1w":
                date.setDate(date.getDate() + 7);
                break;
            case "1m":
                date.setMonth(date.getMonth() + 1);
                break;
            default:
                date.setDate(date.getDate() + 1);
        }
        return date.toISOString().substring(0, 10);
    };

    const getVisiblePoints = (tf) => {
        switch (tf) {
            case "1d":
                return 1;
            case "1w":
                return 7;
            case "1m":
                return 30;
            default:
                return 30;
        }
    };

    const currentAnalysis = coinAnalyze.timeframes?.[timeFrame];
    const sentiment = coinAnalyze.market_sentiment;
    const signalColor = currentAnalysis ? getSignalColor(currentAnalysis.signal) : '#95a5a6';
    const predictedPrice = coinAnalyze.prediction?.price;

    const visiblePoints = getVisiblePoints(timeFrame);

    const slicedData = coinData.slice(-visiblePoints);

    const historicalLabels = slicedData.map(item => item.label);
    const historicalRawDates = slicedData.map(item => item.rawDate);
    const historicalCloses = slicedData.map(item => item.close);

    const lastRawDate = historicalRawDates[historicalRawDates.length - 1];
    const predictionDateLabel = formatDate(getPredictionDate(lastRawDate, timeFrame), timeFrame);

    const predictionDataArray = Array(historicalCloses.length - 1).fill(null);
    predictionDataArray.push(historicalCloses[historicalCloses.length - 1]);
    predictionDataArray.push(predictedPrice);

    const chartData = {
        labels: [...historicalLabels, predictionDateLabel],
        datasets: [
            {
                label: `${symbol} Price`,
                data: historicalCloses,
                borderColor: "#8884d8",
                backgroundColor: "rgba(136, 132, 216, 0.2)",
                tension: 0.3,
                pointRadius: 0
            },
            {
                label: "Predicted Price",
                data: predictionDataArray,
                borderColor: "#0BDA51",
                borderDash: [5, 5],
                backgroundColor: 'transparent',
                tension: 0.1,
                pointRadius: (context) => context.dataIndex === predictionDataArray.length - 1 ? 5 : 0,
                pointBackgroundColor: "#0BDA51"
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
                    maxTicksLimit:
                        timeFrame === "1d" ? 2 :
                            timeFrame === "1w" ? 7 :
                                10
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
        <div style={styles.container}>

            <div style={styles.header}>
                <img
                    style={{borderRadius: "50%", width: "100px", height: "100px"}}
                    src={`https://img.logo.dev/crypto/${symbol.replace("USDT", "")}?token=pk_QiiUrT_TS0yFC7X9CGEddw`}
                    alt={symbol.replace("USDT", "")}
                />
                <h1 style={styles.symbolTitle}>{symbol.replace("USDT", "")}</h1>
            </div>

            <div style={styles.topRow}>
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Prediction</h3>
                    <p style={styles.predictionPrice}>{formatPrice(coinAnalyze.prediction?.price)}</p>
                    <p style={styles.metricsText}>
                    Accuracy (R²): <span style={{fontWeight: 'bold'}}>{formatIndicator(coinAnalyze.prediction?.metrics.r_squared)}</span>
                    </p>
                </div>
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>Market Sentiment</h3>
                    <p style={{...styles.sentimentLabel, color: getSignalColor(sentiment?.sentiment_label === 'Bullish' ? 'BUY' : 'SELL')}}>
                        {sentiment?.sentiment_label}
                    </p>
                    <p style={styles.metricsText}>Score: {formatIndicator(sentiment?.sentiment_score)}</p>
                </div>
                <div style={{...styles.signalCard, backgroundColor: signalColor, boxShadow: `0 0 20px ${signalColor}33`, border: '1px solid rgba(255,255,255,0.2)'}}>
                    <h3 style={styles.signalTitle}>Current Signal ({timeFrame.toUpperCase()})</h3>
                    <p style={styles.signalText}>{currentAnalysis ? currentAnalysis.signal : 'N/A'}</p>
                </div>
            </div>
            <div style={{ height: "400px", width: "920px" }}>
                <Line data={chartData} options={chartOptions} width={1000} height={400} />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2 style={{
                    margin: 0,
                    fontSize: "30px",
                    fontWeight: "600",
                    color: "var(--text-main)",
                }}>
                    Technical Analysis ({timeFrame.toUpperCase()})
                </h2>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "var(--pill-bg)",
                    padding: "4px",
                    borderRadius: "12px",
                    width: "fit-content"
                }}>
                    {timeFrames.map((tf) => {
                        const isActive = timeFrame === tf.key;

                        return (
                            <button
                                key={tf.key}
                                onClick={() => setTimeFrame(tf.key)}
                                style={{
                                    position: "relative",
                                    padding: "8px 20px",
                                    border: "none",
                                    backgroundColor: "transparent",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    fontWeight: isActive ? "700" : "500",
                                    color: isActive ? "#0BDA51" : "#5f6368",
                                    transition: "color 0.3s ease",
                                    outline: "none",
                                }}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabPill"
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            backgroundColor: "var(--pill-active)",
                                            boxShadow: "0 2px 6px var(--card-shadow)",
                                            borderRadius: "8px",
                                            zIndex: 0,
                                        }}
                                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                                    />
                                )}
                                <span style={{ position: "relative", zIndex: 1 }}>
                        {tf.label}
                    </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {currentAnalysis ? (
                <div style={styles.indicatorsGrid}>
                    <div style={styles.indicatorGroup}>
                        <h3 style={styles.groupTitle}>Oscillators</h3>
                        <div style={styles.indicatorList}>
                            <p style={styles.indicatorItem}>RSI: <span>{formatIndicator(currentAnalysis.indicators.rsi)}</span>
                            </p>
                            <p style={styles.indicatorItem}>MACD: <span>{formatIndicator(currentAnalysis.indicators.macd)}</span>
                            </p>
                            <p style={styles.indicatorItem}>STOCH: <span>{formatIndicator(currentAnalysis.indicators.stoch)}</span>
                            </p>
                            <p style={styles.indicatorItem}>ADX: <span>{formatIndicator(currentAnalysis.indicators.adx)}</span>
                            </p>
                            <p style={styles.indicatorItem}>CCI: <span>{formatIndicator(currentAnalysis.indicators.cci)}</span>
                            </p>
                        </div>
                    </div>
                    <div style={styles.indicatorGroup}>
                        <h3 style={styles.groupTitle}>Moving Averages & Volatility</h3>
                        <div style={styles.indicatorList}>
                            <p style={styles.indicatorItem}>SMA: <span>{formatPrice(currentAnalysis.indicators.sma_50)}</span>
                            </p>
                            <p style={styles.indicatorItem}>EMA: <span>{formatPrice(currentAnalysis.indicators.ema_20)}</span>
                            </p>
                            <p style={styles.indicatorItem}>WMA: <span>{formatPrice(currentAnalysis.indicators.wma_20)}</span>
                            </p>
                            <p style={styles.indicatorItem}>BB
                                High: <span>{formatPrice(currentAnalysis.indicators.bb_high)}</span></p>
                            <p style={styles.indicatorItem}>BB
                                Low: <span>{formatPrice(currentAnalysis.indicators.bb_low)}</span></p>
                            <p style={styles.indicatorItem}>Volume
                                SMA: <span>{formatIndicator(currentAnalysis.indicators.vol_sma)}</span></p>
                        </div>
                    </div>
                    <div style={{...styles.card, ...styles.onChainCard}}>
                        <h3 style={styles.groupTitle}>On-Chain Analysis</h3>

                        <p style={styles.metricsText}>
                            NVT Ratio:
                            <span style={{
                                color: Number(coinAnalyze?.on_chain_metrics?.nvt_ratio) > 30 ? "red" : "#0BDA51",
                                marginLeft: 6
                            }}>
                                {formatIndicator(coinAnalyze.market_sentiment.on_chain_metrics?.nvt_ratio)}
                            </span>
                        </p>
                        <p style={styles.metricsText}>
                            TVL: <strong>{coinAnalyze.market_sentiment.on_chain_metrics?.tvl}</strong>
                        </p>
                    </div>
                </div>
            ) : (
                <div style={{...styles.errorContainer, padding: '20px'}}>No data available for the selected
                    timeframe.</div>
            )}
        </div>
    )
}

const styles = {
    container: {
        background: 'transparent',
        color: 'var(--text-main)',
        padding: '30px',
        minHeight: '100vh',
    },
    loadingContainer: {
        color: '#333333',
        padding: '50px',
        textAlign: 'center',
    },
    errorContainer: {
        color: '#E32636',
        padding: '20px',
        backgroundColor: '#fdebeb',
        border: '1px solid #E32636',
        borderRadius: '8px',
    },
    header: {
        borderBottom: '1px solid #ddd',
        paddingBottom: '20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    symbolTitle: {
        fontSize: '48px',
        fontWeight: '700',
        margin: 0,
        color: 'var(--text-main)',
    },
    topRow: {
        display: 'flex',
        gap: '20px',
        marginBottom: '40px',
    },
    card: {
        flex: 1,
        backgroundColor: 'var(--analyze-card-bg)',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px var(--card-shadow)',
        border: '1px solid var(--analyze-border)',
        backdropFilter: 'blur(10px)',
    },
    cardTitle: {
        fontSize: '16px',
        color: 'var(--analyze-text-dim)',
        margin: '0 0 10px 0',
        fontWeight: '500',
    },
    predictionPrice: {
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#0BDA51',
        margin: '5px 0',
    },
    metricsText: {
        fontSize: '14px',
        color: 'var(--analyze-text-dim)',
        margin: 0,
    },
    sentimentLabel: {
        fontSize: '24px',
        fontWeight: 'bold',
        margin: '5px 0',
    },
    signalCard: {
        flex: 0.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: '8px',
        padding: '10px',
        textAlign: 'center',
        color: '#fff',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    },
    signalTitle: {
        fontSize: '14px',
        margin: 0,
        fontWeight: 'normal',
    },
    signalText: {
        fontSize: '36px',
        fontWeight: 'bold',
        margin: '5px 0 0 0',
    },

    tabsContainer: {
        display: 'flex',
        marginBottom: '30px',
        borderBottom: '1px solid #ddd',
    },
    tabButton: {
        padding: '10px 20px',
        marginRight: '10px',
        cursor: 'pointer',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        color: '#333',
        border: '1px solid #ccc',
        borderBottom: 'none',
        borderRadius: '5px 5px 0 0',
        fontWeight: '500',
        transition: 'background-color 0.2s',
    },
    activeTabButton: {
        padding: '10px 20px',
        marginRight: '10px',
        cursor: 'pointer',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        color: '#0BDA51',
        border: '1px solid #ccc',
        borderBottom: 'none',
        borderRadius: '5px 5px 0 0',
        fontWeight: 'bold',
        zIndex: 1,
        boxShadow: "0px -4px 6px -2px rgba(0,0,0,0.1), -4px 0px 6px -2px rgba(0,0,0,0.1), 4px 0px 6px -2px rgba(0,0,0,0.1)"
    },

    indicatorsHeader: {
        fontSize: '22px',
        borderBottom: '2px solid #0BDA51',
        paddingBottom: '10px',
        marginBottom: '20px',
        color: '#333',
    },
    indicatorsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1.2fr',
        gap: '20px',
    },
    indicatorGroup: {
        backgroundColor: 'var(--analyze-card-bg)',
        padding: '15px',
        borderRadius: '12px',
        border: '1px solid var(--analyze-border)',
        boxShadow: "0 4px 12px var(--card-shadow)",
        backdropFilter: 'blur(10px)',
    },
    groupTitle: {
        fontSize: '18px',
        color: '#0BDA51',
        borderBottom: '1px dashed #ccc',
        paddingBottom: '5px',
        marginBottom: '10px',
        fontWeight: '600',
    },
    indicatorList: {
        fontSize: '14px',
    },
    indicatorItem: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px dotted var(--indicator-dot)',
        margin: 0,
        fontWeight: '400',
        color: 'var(--text-main)',
    },
    onChainCard: {
        backgroundColor: 'var(--analyze-card-bg)'
    },
    onChainMetric: {
        fontSize: '20px',
        margin: '10px 0',
        fontWeight: '600',
    }
};

export default CoinAnalyze;