// ThemeContext.jsx
import React, { createContext, useState, useEffect, useContext } from "react";

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({children}) => {
    // Start with 'system' as default if nothing is in storage
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("app-theme") || 'system';
    });

    useEffect(() => {
        const root = document.documentElement;
        const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const applyTheme = () => {
            if (theme === 'system') {
                const effectiveTheme = systemQuery.matches ? 'dark' : 'light';
                root.setAttribute('data-theme', effectiveTheme);
            } else {
                root.setAttribute('data-theme', theme);
            }
        };

        applyTheme();
        localStorage.setItem("app-theme", theme);

        // Listen for OS changes while in 'system' mode
        const handleChange = () => { if (theme === 'system') applyTheme(); };
        systemQuery.addEventListener('change', handleChange);
        return () => systemQuery.removeEventListener('change', handleChange);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => {
            if (prev === "light") return "dark";
            if (prev === "dark") return "system";
            return "light";
        });
    };

    return (
        <ThemeContext.Provider value={{theme, toggleTheme}}>
            {children}
        </ThemeContext.Provider>
    );
};