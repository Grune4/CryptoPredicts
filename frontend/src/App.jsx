import React from 'react'
import './App.css'
import MarketOverview from "./ui/pages/MarketOverview.jsx";
import CoinDetails from "./ui/pages/CoinDetails.jsx";
import Header from "./ui/header/Header.jsx";
import {BrowserRouter as Router, Routes, Route, Navigate} from "react-router-dom";
import CoinAnalyze from "./ui/pages/CoinAnalyze.jsx";
import CoinCompare from "./ui/pages/CoinCompare.jsx";
import Orb from "./components/Backgrounds/Orb.jsx"
import {ThemeProvider} from "@/components/Themes/ThemeContext.jsx";
import NewsAndInsights from "@/ui/pages/NewsAndInsights.jsx";


function App() {
    return (
        <ThemeProvider>
            <Router>
                <div style={{ position: "relative", minHeight: "100vh", width: "100%" }}>
                    <div style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: -1,
                        overflow: "hidden"
                    }}>
                        <Orb
                            hoverIntensity={0.5}
                            rotateOnHover={true}
                            hue={90}
                            forceHoverState={false}
                        />
                    </div>
                    <Header />
                    <main style={{
                        position: "relative",
                        zIndex: 1,
                        paddingTop: "120px"
                    }}>
                        <Routes>
                            <Route path="/" element={<Navigate to="/market" replace />} />"
                            <Route path={"/market"} element={<MarketOverview/>}/>
                            <Route path={"/:symbol"} element={<CoinDetails/>}/>
                            <Route path={"/:coinSymbol/analyze"} element={<CoinAnalyze/>}/>
                            <Route path={"/compare"} element={<CoinCompare/>}/>
                            <Route path={"/news"} element={<NewsAndInsights/>}/>
                        </Routes>
                    </main>
                </div>
            </Router>
        </ThemeProvider>
    );
}

export default App
