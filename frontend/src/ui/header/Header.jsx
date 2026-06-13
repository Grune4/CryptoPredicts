import { NavLink } from "react-router-dom";
import logo from "../../assets/Crypto Predicts Logo.png"
import ThemeToggle from "@/components/Themes/ThemeToggle.jsx";

const Header = () => {
    return (
        <header style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            maxWidth: "600px",
            height: "65px",
            background: "var(--header-bg)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--header-border)",
            borderRadius: "15px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 25px",
            zIndex: 1000,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)"
        }}>
            <div style={{display: "flex", alignItems: "center", height: "100%"}}>
                <img
                    style={{
                        height: "120px",
                        width: "auto",
                        objectFit: "contain",
                        display: "block"
                    }}
                    src={logo}
                    alt="Logo"
                />
            </div>

            <nav style={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
            }}>
                <NavLink style={navItemStyle} to="/market">Market</NavLink>
                <NavLink style={navItemStyle} to="/news">News & Insights</NavLink>
                <NavLink style={navItemStyle} to="/compare">Compare</NavLink>
            </nav>

            <div style={{display: "flex", alignItems: "center" }}>
                <ThemeToggle />
            </div>
        </header>
    );
};

const navItemStyle = ({isActive}) => ({
    fontSize: "20px",
    color: isActive ? "#0BDA51" : "var(--nav-text)",
    textDecoration: "none",
    fontWeight: 600,
    transition: "color 0.2s ease"
})

export default Header;