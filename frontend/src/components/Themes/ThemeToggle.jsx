import React from "react";
import { useTheme } from "./useTheme.js";

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    const getIcon = () => {
        if (theme === "light") return "☀️";
        if (theme === "dark") return "🌙";
        return "💻";
    };

    return (
        <button
            onClick={toggleTheme}
            style={{
                padding: "4px 10px",      // Reduced from 8px 16px
                borderRadius: "12px",     // Slightly less rounded
                cursor: "pointer",
                background: "var(--btn-bg)",
                color: "var(--text-color)",
                border: "1px solid var(--card-border)",
                fontSize: "14px",         // Smaller icon/text
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease"
            }}
        >
            {getIcon()}
        </button>
    );
};

export default ThemeToggle;
