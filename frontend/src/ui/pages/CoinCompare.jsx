import cryptoMarketRepository from "../../repository/cryptoMarketRepository.js"
import cryptoOhlcvRepository from "../../repository/cryptoOhlcvRepository.js"
import {useEffect, useMemo, useState} from "react"
import {Line} from "react-chartjs-2";
import { motion, AnimatePresence } from "framer-motion";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import {FiChevronDown} from "react-icons/fi";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LogarithmicScale,
    LineElement,
    Title,
    Tooltip,
    Legend
);
const itemVariants = {
    open: {
        opacity: 1,
        y: 0,
        transition: {
            when: "beforeChildren",
        },
    },
    closed: {
        opacity: 0,
        y: -15,
        transition: {
            when: "afterChildren",
        },
    },
};
const dropdownVariants = {
    open: {
        opacity: 1,
        transition: {
            when: "beforeChildren",
            staggerChildren: 0.05,
        },
    },
    closed: {
        opacity: 0,
        transition: {
            when: "afterChildren",
        },
    },
};

const CoinCompare = () => {
    const [coins, setCoins] = useState([])
    const [coinSelectors, setCoinSelectors] = useState([
        {id: 1, coinId: null, data: []}
    ])
    const [timeRange] = useState("3M")
    const [openDropdownId, setOpenDropdownId] = useState(null);


    useEffect(() => {
        cryptoMarketRepository.getCoins().then((response) => {
            setCoins(response.data)
        }).catch((error) => {
            console.log(error)
        })
    }, []);

    useEffect(() => {
        coinSelectors.forEach(selector => {
            if (!selector.coinId || selector.data.length > 0) return;

            cryptoOhlcvRepository
                .getCoin(selector.coinId + "USDT")
                .then(res => {
                    // eslint-disable-next-line react-hooks/immutability
                    const filtered = filterByRange(res.data, timeRange);
                    const formatted = filtered.map(item => ({
                        // eslint-disable-next-line react-hooks/immutability
                        date: formatDate(item.date, timeRange),
                        close: item.close
                    }));

                    setCoinSelectors(prev =>
                        prev.map(sel =>
                            sel.id === selector.id
                                ? { ...sel, data: formatted }
                                : sel
                        )
                    );
                })
                .catch(console.error);
        });
    }, [coinSelectors, timeRange]);

    const sortedCoinsList = useMemo(() => {
        return [...coins].sort((a, b) => {
            const rankA = a.marketCapRank ?? a.market_cap_rank ?? 9999;
            const rankB = b.marketCapRank ?? b.market_cap_rank ?? 9999;

            return rankA - rankB;
        });
    }, [coins]);

    const addCoinSelector = () => {
        if (coinSelectors.length < 5) {
            setCoinSelectors(prev => [
                ...prev,
                {id: Date.now(), coinId: null, data: []}
            ])
        }
    }

    const filterByRange = (data, range) => {
        if (range === "7D") return data.slice(-7);
        if (range === "1M") return data.slice(-30);
        if (range === "3M") return data.slice(-90);
        if (range === "1Y") return data.slice(-365);
        return data;
    };

    const formatDate = (date, range) => {
        const d = new Date(date);
        if (["7D", "1M", "3M"].includes(range)) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (["1Y", "ALL"].includes(range)) return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    };

    const Colors = ["#fcba03", "#ae00ff", "#00ff6e", "#006aff", "#871012"]

    const activeSelector = coinSelectors.find(sel => sel.data.length > 0);


    const getRawDatasets = () => {
        const activeSelectors = coinSelectors.filter(sel => sel.data.length > 0);
        return activeSelectors.map((sel, index) => ({
            label: sel.coinId.toUpperCase(),
            data: sel.data.map(d => d.close),
            borderColor: Colors[index % Colors.length],
            tension: 0.3,
            pointRadius: 0
        }));
    };

    const chartData = {
        labels: activeSelector?.data.map(d => d.date) || [],
        datasets: getRawDatasets()
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                ticks: {
                    callback: function (value) {
                        return `$${value.toLocaleString()}`;
                    }
                }
            }
        },
        plugins: {
            tooltip: {
                callbacks: {
                    label: (context) => `${context.dataset.label}: $${context.raw.toLocaleString()}`
                }
            }
        }
    };

    const handleChange = (selectorId, coinId) => {
        setCoinSelectors(prev =>
            prev.map(sel =>
                sel.id === selectorId ? {...sel, coinId, data: []} : sel
            )
        )
    }

    return (
        <div style={{
            width: "1200px",
            background: "var(--card-bg)",
            padding: "30px",
            borderRadius: "15px",
            border: "1px solid var(--card-border)",
            boxShadow: "0 4px 12px var(--card-shadow)",
            color: "var(--text-main)"
        }}>
            <h1>Coin Comparison</h1>
            <div style={{display: "flex", gap: "12px", marginBottom: "20px", justifyContent: "center"}}>
                {coinSelectors.map((selector) => (
                    <div key={selector.id} style={{position: "relative"}}>
                        <button
                            onClick={() =>
                                setOpenDropdownId(prev => (prev === selector.id ? null : selector.id))
                            }
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 20px",
                                borderRadius: "8px",
                                background: "#0BDA51",
                                color: "white",
                                border: "none",
                                cursor: "pointer",
                                fontWeight: "500",
                            }}
                        >
                            <span className="font-medium text-sm">
                              {selector.coinId || "Select a coin"}
                            </span>
                            <motion.span animate={{rotate: openDropdownId === selector.id ? 180 : 0}}>
                                <FiChevronDown/>
                            </motion.span>
                        </button>

                        <AnimatePresence>
                            {openDropdownId === selector.id && (
                                <motion.ul
                                    initial="closed"
                                    animate="open"
                                    exit="closed"
                                    variants={dropdownVariants}
                                    style={{
                                        position: "absolute",
                                        top: "110%",
                                        left: 0,
                                        width: "100%",
                                        backgroundColor: "var(--dropdown-bg)",
                                        boxShadow: "0 10px 15px -3px var(--card-shadow)",
                                        borderRadius: "8px",
                                        padding: "4px",
                                        zIndex: 10,
                                        overflowY: "auto",
                                        maxHeight: "300px",
                                        margin: 0,
                                        listStyle: "none",
                                        boxSizing: "border-box",
                                        border: "1px solid var(--card-border)"
                                    }}
                                >
                                    {sortedCoinsList.map((coin) => (
                                        <motion.li
                                            key={coin.symbol}
                                            variants={itemVariants}
                                            onClick={() => {
                                                handleChange(selector.id, coin.name);
                                                setOpenDropdownId(null);
                                            }}
                                            style={{
                                                padding: "8px 12px",
                                                cursor: "pointer",
                                                borderRadius: "4px",
                                                fontSize: "14px",
                                                display: "flex",
                                                alignItems: "center",
                                                color: "var(--text-main)"
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--dropdown-hover)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                        >
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                                width: "100%"
                                            }}>
                                                <img
                                                    src={`https://img.logo.dev/crypto/${coin.name}?token=pk_QiiUrT_TS0yFC7X9CGEddw`}
                                                    alt={coin.name}
                                                    style={{
                                                        width: "24px",
                                                        height: "24px",
                                                        borderRadius: "50%",
                                                        flexShrink: 0
                                                    }}
                                                />
                                                <span style={{
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis"
                                                }}>
                                                    {coin.name}
                                                </span>
                                            </div>
                                        </motion.li>
                                    ))}
                                </motion.ul>
                            )}
                        </AnimatePresence>
                    </div>
                ))}

                {coinSelectors.length < 5 && (
                    <button
                        onClick={addCoinSelector}
                        style={{
                            padding: "5px 15px",
                            borderRadius: "8px",
                            border: "2px dashed var(--compare-dashed)",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "18px",
                            color: "var(--compare-dashed)",
                        }}
                    >
                        +
                    </button>
                )}
            </div>

            <div>
                <div style={{height: "400px", width: "100%"}}>
                    <Line data={chartData} options={chartOptions}/>
                </div>
            </div>
        </div>
    );
}

export default CoinCompare;