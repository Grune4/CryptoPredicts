import cryptoMarketRepository from "../../repository/cryptoMarketRepository.js"
import {useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom"
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { FaSearch } from "react-icons/fa";
import { TbGridDots } from "react-icons/tb";
import { TbList } from "react-icons/tb";
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
import {Line} from "react-chartjs-2";
import cryptoOhlcvRepository from "../../repository/cryptoOhlcvRepository.js";
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

const TiltWrapper = ({ children }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x);
    const mouseYSpring = useSpring(y);

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const xPct = (e.clientX - rect.left) / rect.width - 0.5;
        const yPct = (e.clientY - rect.top) / rect.height - 0.5;
        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
                width: "100%",
                height: "100%"
            }}
        >
            {children}
        </motion.div>
    );
};


const TypingTitle = ({ text, speed = 100 }) => {
    const [displayedText, setDisplayedText] = useState("");
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        let i = 0;
        setDisplayedText("");
        setIsComplete(false);

        const typingInterval = setInterval(() => {
            if (i < text.length) {
                setDisplayedText(() => text.substring(0, i + 1));
                i++;
            } else {
                clearInterval(typingInterval);
                setIsComplete(true);
            }
        }, speed);

        return () => clearInterval(typingInterval);
    }, [text, speed]);

    return (
        <h1 style={{
            textAlign: "left",
            margin: "0 0 20px 0",
            display: "flex",
            alignItems: "center",

            backgroundImage: "linear-gradient(266deg,rgba(0, 183, 186, 1) 31%, rgba(11, 218, 81, 1) 100%)",
            filter: "drop-shadow(-5px 5px 2px rgba(11, 218, 81, 0.3))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontWeight: "900",
            fontSize: "42px"
        }}>
            {displayedText}
            <span style={{
                marginLeft: "4px",
                width: "4px",
                height: "0.9em",
                backgroundColor: "#0BDA51",
                display: "inline-block",
                WebkitTextFillColor: "initial",
                animation: isComplete ? "blink 1s step-end infinite" : "none",
            }} />

            <style>{`
      @keyframes blink {
        from, to { opacity: 1; }
        50% { opacity: 0; }
      }
    `}</style>
        </h1>
    );
};

const MarketOverview = () => {
    const [coins, setCoins] = useState([]);
    const [sortColumn, setSortColumn] = useState("marketCapRank");
    const [sortDirection, setSortDirection] = useState("asc");
    const [searchItem, setSearchItem] = useState("")
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;
    const navigate = useNavigate()
    const [viewMode, setViewMode] = useState("list");

    useEffect(() => {
        cryptoMarketRepository.getCoins().then((response) => {
            setCoins(response.data)
        }).catch ((error) => {
            console.log(error)
        })
    }, [])

    const filteredCoins = useMemo(() => {
        if (!searchItem) {
            return coins
        }
        return coins.filter(coin =>
            coin.symbol.toLowerCase().includes(searchItem.toLowerCase()) || coin.name.toLowerCase().includes(searchItem.toLowerCase())
        );
    }, [coins, searchItem])

    const sortedCoins = [...filteredCoins].sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (valA === null) return 1;
        if (valB === null) return -1;

        if (sortDirection === "asc") return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
    }, [filteredCoins, sortColumn, sortDirection]);

    const startIndex = (page - 1) * itemsPerPage;
    const paginatedCoins = sortedCoins.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        paginatedCoins.forEach(coin => {
            if (coin.sparklineData) return;

            cryptoOhlcvRepository.getCoin(coin.name + "USDT")
                .then(response => {
                    const filtered = response.data.slice(-7);
                    const prices = filtered.map(item => item.close);

                    setCoins(prev => prev.map(c =>
                        c.symbol === coin.symbol ? { ...c, sparklineData: prices } : c
                    ));
                }).catch(console.error);
        });
    }, [paginatedCoins]);

    const MiniChart = ({ data }) => {
        if (!data || data.length === 0) return <div style={{fontSize: '10px', color: '#ccc'}}>Loading...</div>;

        const isUp = data[data.length - 1] >= data[0];
        const chartColor = isUp ? "#4caf50" : "#f44336";

        const chartData = {
            labels: new Array(data.length).fill(""),
            datasets: [{
                data: data,
                borderColor: chartColor,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: false,
            }]
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } }
        };

        return (
            <div style={{ width: "150px", height: "60px", margin: "0 auto" }}>
                <Line data={chartData} options={chartOptions} />
            </div>
        );
    }

    const totalPages = Math.ceil(coins.length / itemsPerPage);

    const topGainers = [...coins]
        .filter(c => c.priceChangePercentage24h !== null)
        .sort((a, b) => b.priceChangePercentage24h - a.priceChangePercentage24h)
        .slice(0, 5)

    const topLosers = [...coins]
        .filter(c => c.priceChangePercentage24h !== null)
        .sort((a, b) => a.priceChangePercentage24h - b.priceChangePercentage24h)
        .slice(0, 5)

    const changeSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortColumn(column);
            setSortDirection("asc");
        }
    };

    return (
        <div>
            <div style={{ display: "flex", flexDirection: "column", width: "1300px", margin: "0 auto" }}>
                <TypingTitle text={"Market Overview"} speed={80}/>
                <div style={{ maxHeight: "415px", display: "flex", justifyContent: "space-evenly", gap: "20px", paddingBottom: "20px" }}>
                    <div style={{
                        boxShadow: "0 4px 12px var(--card-shadow)",
                        width: "700px",
                        padding: "20px",
                        border: "1px solid var(--card-border)",
                        borderRadius: "15px",
                        background: "var(--card-bg)",
                        backdropFilter: "blur(10px)"
                    }}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "15px"
                        }}>
                            <h2 style={{
                                margin: 0,
                                textAlign: "left",
                                color: "#0BDA51",
                                fontWeight: "800",
                                textShadow: `
                                0 0 5px rgba(11, 218, 81, 0.4),
                                0 0 10px rgba(11, 218, 81, 0.3),
                                0 0 20px rgba(11, 218, 81, 0.2)
                            `,
                                letterSpacing: "0.5px"
                            }}>
                                Top Gainers (24h)
                            </h2>
                            <TrendingUpIcon style={{
                                color: "#0BDA51",
                                fontSize: "30px",
                                filter: "drop-shadow(0 0 8px rgba(11, 218, 81, 0.6))"
                            }}/>
                        </div>
                        {topGainers.map((coin) => (
                            <div key={coin.id} style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                marginBottom: "10px",
                                padding: "10px 5px",
                                backgroundColor: "var(--table-row-alt)",
                                color: "var(--text-main)",
                                border: "1px solid var(--card-border)",
                                borderRadius: "10px",
                                boxShadow: "0 2px 5px var(--card-shadow)"
                            }}>
                                <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
                                    <img
                                        src={`https://img.logo.dev/crypto/${coin.name}?token=pk_QiiUrT_TS0yFC7X9CGEddw`}
                                        alt={coin.name} style={{width: "35px", height: "35px", borderRadius: "50%"}}/>
                                    <span>{coin.name}</span>
                                </div>
                                <div style={{
                                    display: "flex",
                                    gap: "10px",
                                    justifyContent: "flex-end",
                                    alignItems: "center"
                                }}>
                                    <strong>${coin.currentPrice?.toLocaleString()}</strong>
                                    <div style={{
                                        padding: "5px 10px",
                                        color: "white",
                                        borderRadius: "20px",
                                        backgroundColor: "#0BDA51"
                                    }}>
                                        +{coin.priceChangePercentage24h?.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{
                        boxShadow: "0 4px 12px var(--card-shadow)",
                        width: "700px",
                        padding: "20px",
                        border: "1px solid var(--card-border)",
                        borderRadius: "15px",
                        background: "var(--card-bg)",
                        backdropFilter: "blur(10px)"
                    }}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "15px"
                        }}>
                            <h2 style={{
                                margin: 0,
                                textAlign: "left",
                                color: "red",
                                fontWeight: "800",
                                textShadow: `
                                0 0 5px rgba(218, 11, 81, 0.4),
                                0 0 10px rgba(218, 11, 81, 0.3),
                                0 0 20px rgba(218, 11, 81, 0.2)
                            `,
                                letterSpacing: "0.5px"
                            }}>
                                Top Losers (24h)
                            </h2>
                            <TrendingDownIcon style={{
                                color: "red",
                                fontSize: "30px",
                                filter: "drop-shadow(0 0 8px rgba(218, 11, 81, 0.6))"
                            }}/>
                        </div>
                        {topLosers.map((coin) => (
                            <div key={coin.id} style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto",
                                alignItems: "center",
                                marginBottom: "10px",
                                padding: "10px 5px",
                                backgroundColor: "var(--table-row-alt)",
                                border: "1px solid var(--card-border)",
                                color: "var(--text-main)",
                                borderRadius: "10px",
                                boxShadow: "0 2px 5px var(--card-shadow)"
                            }}>
                                <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
                                    <img
                                        src={`https://img.logo.dev/crypto/${coin.name}?token=pk_QiiUrT_TS0yFC7X9CGEddw`}
                                        alt={coin.name} style={{width: "35px", height: "35px", borderRadius: "50%"}}/>
                                    <span>{coin.name}</span>
                                </div>
                                <div style={{
                                    display: "flex",
                                    gap: "10px",
                                    justifyContent: "flex-end",
                                    alignItems: "center"
                                }}>
                                    <strong>${coin.currentPrice?.toLocaleString()}</strong>
                                    <div style={{
                                        padding: "5px 10px",
                                        color: "white",
                                        borderRadius: "20px",
                                        backgroundColor: "red"
                                    }}>
                                        {coin.priceChangePercentage24h?.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "30px"
                }}>
                    <div style={{display: "flex", alignItems: "center"}}>
                    <FaSearch style={{ marginRight: "8px", color: "#888" }} />
                        <input
                            type="text"
                            placeholder="Search cryptocurrencies"
                            value={searchItem}
                            onChange={(e) => setSearchItem(e.target.value)}
                            style={{
                                padding: "10px",
                                fontSize: "16px",
                                width: "300px",
                                borderRadius: "5px",
                                border: "1px solid var(--card-border)",
                                boxShadow: "0 2px 4px var(--card-shadow)",
                                background: "var(--input-bg)",
                                color: "var(--text-main)"
                            }}
                        />
                    </div>

                    <div style={{display: "flex", gap: "10px"}}>
                        <button
                            onClick={() => setViewMode("list")}
                            style={{
                                cursor: "pointer",
                                backgroundColor: viewMode === "list" ? "#0BDA51" : "var(--toggle-inactive-bg)",
                                border: "3px solid #0BDA51",
                                color: viewMode === "list" ? "#fff" : "var(--toggle-inactive-text)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "45px",
                                height: "45px",
                                padding: "0",
                                borderRadius: "8px",
                                transition: "all 0.3s ease",
                            }}
                        >
                            <TbList size={24}/>
                        </button>
                        <button
                            onClick={() => setViewMode("grid")}
                            style={{
                                cursor: "pointer",
                                backgroundColor: viewMode === "grid" ? "#0BDA51" : "var(--toggle-inactive-bg)",
                                border: "3px solid #0BDA51",
                                color: viewMode === "grid" ? "#fff" : "var(--toggle-inactive-text)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "45px",
                                height: "45px",
                                padding: "0",
                                borderRadius: "8px",
                                transition: "all 0.3s ease",
                            }}
                        >
                            <TbGridDots size={24}/>
                        </button>
                    </div>
                </div>

                {viewMode === "list" ? (
                    <div style={{ maxHeight: "600px", overflowY: "auto", borderRadius: "20px", boxShadow: "0 2px 4px rgba(0,0,0,0.4)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                            <thead style={{ position: "sticky", background: "var(--bg-color)", top: 0, zIndex: 1 }}>
                                <tr style={{ color: "var(--text-main)" }}>
                                    <th onClick={() => changeSort("marketCapRank")} style={{ width: "7%", cursor: "pointer", padding: "12px", borderBottom: "2px solid var(--card-border)" }}>Rank</th>
                                    <th onClick={() => changeSort("symbol")} style={{ cursor: "pointer", padding: "12px", borderBottom: "2px solid var(--card-border)" }}>Symbol</th>
                                    <th onClick={() => changeSort("currentPrice")} style={{ cursor: "pointer", padding: "12px", borderBottom: "2px solid var(--card-border)" }}>Price</th>
                                    <th onClick={() => changeSort("marketCap")} style={{ cursor: "pointer", padding: "12px", borderBottom: "2px solid var(--card-border)" }}>Market Cap</th>
                                    <th style={{ padding: "12px", borderBottom: "2px solid var(--card-border)" }}>High (24h)</th>
                                    <th style={{ padding: "12px", borderBottom: "2px solid var(--card-border)" }}>Low (24h)</th>
                                    <th style={{ padding: "12px", borderBottom: "2px solid var(--card-border)" }}>Graph (7D)</th>
                                </tr>
                            </thead>
                            <tbody>
                            {paginatedCoins.map((coin, index) => (
                            <tr key={coin.symbol} style={{color: "var(--text-main)", backgroundColor: index % 2 === 0 ? "transparent" : "var(--table-row-alt)", transition: "background-color 0.3s"}}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--table-row-hover)"}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = index % 2 === 0 ? "transparent" : "var(--table-row-alt)"}>
                                    <td style={{ padding: "10px", borderBottom: "1px solid var(--card-border)" }}>{coin.marketCapRank}</td>
                                    <td style={{ padding: "10px", borderBottom: "1px solid var(--card-border)", cursor: "pointer" }} onClick={() => navigate(`/${coin.symbol}`, { state: { coin } })}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "15px" }}>
                                            <img style={{ borderRadius: "50%", width: "40px", height: "40px" }} src={`https://img.logo.dev/crypto/${coin.name}?token=pk_QiiUrT_TS0yFC7X9CGEddw`} alt={coin.name} />
                                            {coin.name}
                                        </div>
                                    </td>
                                    <td style={{ padding: "10px", borderBottom: "1px solid var(--card-border)" }}>${coin.currentPrice?.toLocaleString()}</td>
                                    <td style={{ padding: "10px", borderBottom: "1px solid var(--card-border)" }}>${coin.marketCap?.toLocaleString()}</td>
                                    <td style={{ padding: "10px", borderBottom: "1px solid var(--card-border)" }}>${coin.high24h?.toLocaleString()}</td>
                                    <td style={{ padding: "10px", borderBottom: "1px solid var(--card-border)" }}>${coin.low24h?.toLocaleString()}</td>
                                    <td style={{ padding: "10px", borderBottom: "1px solid var(--card-border)" }}>
                                        <MiniChart data={coin.sparklineData} />
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                        gap: "20px",
                        maxHeight: "600px",
                        overflowY: "auto",
                        padding: "10px"
                    }}>
                        {paginatedCoins.map((coin) => (
                            <div key={coin.symbol} className="flip-card">
                                <TiltWrapper>
                                    <div className="flip-card-inner">
                                        <div className="flip-card-front" style={{ border: "1px solid #eee", borderRadius: "15px", boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}>
                                            <div style={{ marginBottom: "15px" }}>
                                                <img src={`https://img.logo.dev/crypto/${coin.name}?token=pk_QiiUrT_TS0yFC7X9CGEddw`} alt={coin.name} style={{ width: "80px", height: "80px", borderRadius: "50%", marginBottom: "15px" }} />
                                            </div>
                                            <h3 style={{ margin: 0, transform: "translateZ(30px)" }}>{coin.name}</h3>
                                            <p style={{ color: "#888", transform: "translateZ(20px)" }}>{coin.symbol.toUpperCase()}</p>
                                        </div>

                                        <div className="flip-card-back" style={{ border: "1px solid #eee", borderRadius: "15px", boxShadow: "0 4px 8px rgba(0,0,0,0.1)"}}>
                                            <div style={{ textAlign: "center", width: "90%", transform: "translateZ(40px)" }}>
                                                <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>{coin.name} Stats</h4>

                                                <div style={{ fontSize: "14px", textAlign: "left", marginBottom: "10px" }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
                                                        <span style={{ color: "#888" }}>Price:</span>
                                                        <strong>${coin.currentPrice?.toLocaleString()}</strong>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
                                                        <span style={{ color: "#888" }}>Market Cap:</span>
                                                        <strong>${(coin.marketCap / 1000000000).toFixed(2)}B</strong>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
                                                        <span style={{ color: "#888" }}>24h High:</span>
                                                        <strong style={{ color: "green" }}>${coin.high24h?.toLocaleString()}</strong>
                                                    </div>
                                                    <div style={{ display: "flex", justifyContent: "space-between", margin: "4px 0" }}>
                                                        <span style={{ color: "#888" }}>24h Low:</span>
                                                        <strong style={{ color: "red" }}>${coin.low24h?.toLocaleString()}</strong>
                                                    </div>
                                                </div>

                                                <div style={{ height: "50px", margin: "10px 0" }}>
                                                    <MiniChart data={coin.sparklineData} />
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/${coin.symbol}`, { state: { coin } });
                                                    }}
                                                    style={{
                                                        width: "100%",
                                                        padding: "8px",
                                                        backgroundColor: "#90EE90",
                                                        border: "none",
                                                        borderRadius: "10px",
                                                        cursor: "pointer",
                                                        fontWeight: "bold",
                                                        marginTop: "5px"
                                                    }}
                                                >
                                                    Full Analysis
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </TiltWrapper>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{
                    marginTop: "20px",
                    display: "flex",
                    gap: "15px",
                    justifyContent: "center",
                    color: "var(--text-main)"
                }}>
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            cursor: page === 1 ? "not-allowed" : "pointer",
                            border: `1px solid ${page === 1 ? "var(--card-border)" : "#0BDA51"}`,
                            backgroundColor: page === 1 ? "var(--pagination-disabled)" : "var(--pagination-btn-bg)",
                            color: page === 1 ? "var(--pagination-disabled-text)" : "var(--text-main)",
                            transition: "all 0.2s ease",
                            fontWeight: "600"
                        }}
                    >
                        Previous
                    </button>

                    <span style={{alignSelf: "center", fontWeight: "500"}}>
        Page <span style={{color: "#0BDA51"}}>{page}</span> of {totalPages}
    </span>

                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                        style={{
                            padding: "8px 16px",
                            borderRadius: "8px",
                            cursor: page === totalPages ? "not-allowed" : "pointer",
                            border: `1px solid ${page === totalPages ? "var(--card-border)" : "#0BDA51"}`,
                            backgroundColor: page === totalPages ? "var(--pagination-disabled)" : "var(--pagination-btn-bg)",
                            color: page === totalPages ? "var(--pagination-disabled-text)" : "var(--text-main)",
                            transition: "all 0.2s ease",
                            fontWeight: "600"
                        }}
                    >
                        Next
                    </button>
                </div>
            </div>

            <style>{`
    .flip-card {
        background-color: transparent;
        width: 100%;
        height: 300px;
        perspective: 1200px; 
    }

    .flip-card-inner {
        position: relative;
        width: 100%;
        height: 100%;
        text-align: center;
        transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        transform-style: preserve-3d;
    }

    .flip-card:hover .flip-card-inner {
        transform: rotateY(180deg);
    }

    .flip-card-front, .flip-card-back {
        position: absolute;
        width: 100%;
        height: 100%;
        backface-visibility: hidden !important;
        -webkit-backface-visibility: hidden !important;
        
        background: var(--card-bg); 
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--card-border) !important;
        color: var(--text-main);
        
        border-radius: 15px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        top: 0;
        left: 0;
    }

    .flip-card-front {
        z-index: 2;
        transform: rotateY(0deg);
    }

    .flip-card-back {
        z-index: 1;
        transform: rotateY(180deg);
    }
    
    .flip-card-back h4 {
        color: var(--text-main) !important;
    }
`}</style>
        </div>
    );
}

export default MarketOverview;