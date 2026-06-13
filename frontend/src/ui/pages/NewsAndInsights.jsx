import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiTrendingUp, FiMail, FiArrowRight, FiExternalLink } from "react-icons/fi";
import cryptoMarketRepository from "@/repository/cryptoMarketRepository.js";

const NewsAndInsights = () => {
    const [news, setNews] = useState([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);

    const filters = ["all", "rising", "hot", "bullish", "bearish", "important", "saved", "lol"];

    useEffect(() => {
        setLoading(true);

        cryptoMarketRepository.fetchNews(filter)
            .then((response) => {
                setNews(response.data.results || []);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching from backend:", err);
                setLoading(false);
            });
    }, [filter]);

    console.log(news)

    return (
        <div style={styles.pageContainer}>
            <h1 style={styles.mainTitle}>News & Insights</h1>

            <div style={styles.filterBar}>
                {filters.map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            ...styles.filterBtn,
                            backgroundColor: filter === f ? "#0BDA51" : "var(--card-bg)",
                            color: filter === f ? "white" : "var(--text-main)",
                        }}
                    >
                        {f.toUpperCase()}
                    </button>
                ))}
            </div>

            <div style={styles.layoutGrid}>
                <div style={styles.mainContent}>
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div initial={{opacity:0}} animate={{opacity:1}} style={styles.loader}>
                                Loading Market Intel...
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                style={styles.newsGrid}
                            >
                                {news.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        whileHover={{ scale: 1.01 }}
                                        style={styles.newsCard}
                                    >
                                        <div style={styles.cardInfo}>
                                            <h3 style={styles.newsTitle}>{item.title}</h3>
                                            <div>
                                                {item.description}
                                            </div>
                                            <div style={styles.cardFooter}>
                                                <span>{new Date(item.published_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

const styles = {
    pageContainer: {
        maxWidth: "1200px",
        padding: "0 20px",
        color: "var(--text-main)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
    },
    mainContent: {
        width: "100%",
        maxWidth: "800px"
    },
    mainTitle: { fontSize: "42px", fontWeight: "800", marginBottom: "20px", textAlign: "center" },

    filterBar: {
        display: "flex",
        gap: "10px",
        marginBottom: "30px",
        flexWrap: "wrap",
        justifyContent: "center"
    },
    filterBtn: {
        padding: "8px 16px",
        borderRadius: "20px",
        border: "1px solid var(--card-border)",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: "700",
        transition: "all 0.2s ease",
        backdropFilter: "blur(10px)"
    },

    layoutGrid: {
        display: "flex",
        justifyContent: "center",
        width: "100%"
    },
    loader: { textAlign: "center", padding: "50px", color: "var(--text-muted)", fontSize: "18px" },

    newsGrid: { display: "flex", flexDirection: "column", gap: "15px" },
    newsCard: {
        background: "var(--card-bg)",
        borderRadius: "16px",
        border: "1px solid var(--card-border)",
        backdropFilter: "blur(12px)",
        padding: "20px",
        boxShadow: "0 4px 15px var(--card-shadow)"
    },
    sourceTag: { background: "rgba(11, 218, 81, 0.15)", color: "#0BDA51", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", marginBottom: "10px", display: "inline-block" },
    newsTitle: { fontSize: "18px", margin: "0 0 15px 0", lineHeight: "1.4" },
    cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)" },

    sidebar: { display: "flex", flexDirection: "column", gap: "20px" },
    sidebarCard: { background: "var(--card-bg)", padding: "20px", borderRadius: "20px", border: "1px solid var(--card-border)", backdropFilter: "blur(12px)" },
    sidebarTitle: { fontSize: "16px", marginBottom: "10px", fontWeight: "700" },
    inputWrapper: { position: "relative", marginTop: "15px" },
    inputIcon: { position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" },
    input: { width: "100%", padding: "10px 10px 10px 35px", borderRadius: "8px", border: "1px solid var(--card-border)", background: "var(--input-bg)", color: "var(--text-main)", boxSizing: "border-box" },
    subscribeBtn: { width: "100%", marginTop: "10px", padding: "12px", borderRadius: "8px", border: "none", background: "#0BDA51", color: "white", fontWeight: "700", cursor: "pointer" }
};

export default NewsAndInsights;