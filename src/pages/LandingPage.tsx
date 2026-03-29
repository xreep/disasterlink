import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [hovered, setHovered] = useState<string | null>(null);

  const buttons = [
    { label: "I Need Help — Report Emergency", path: "/report", bg: "#ef4444", hover: "#dc2626" },
    { label: "Volunteer Operations", path: "/volunteer/login", bg: "#b91c1c", hover: "#991b1b" },
    { label: "Emergency Operations Center", path: "/coordinator", bg: "#7f1d1d", hover: "#6b1212" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      position: "relative",
    }}>
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)" }}
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      </button>

      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div style={{
          fontFamily: "monospace",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: "-0.5px",
          marginBottom: 12,
        }}>
          DisasterLink
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 360, lineHeight: 1.6 }}>
          India's Real-Time Disaster Coordination Platform.<br />
          Choose your role to continue.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 360 }}>
        {buttons.map(btn => (
          <button
            key={btn.path}
            onClick={() => navigate(btn.path)}
            onMouseEnter={() => setHovered(btn.path)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: "100%",
              height: 52,
              background: hovered === btn.path ? btn.hover : btn.bg,
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              padding: "0 18px",
              display: "flex",
              alignItems: "center",
              transition: "background 0.15s",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
