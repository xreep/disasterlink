import { useNavigate } from "react-router-dom";
import { useDisaster } from "../DisasterContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { disasterName } = useDisaster();

  const btnBase: React.CSSProperties = {
    width: "100%",
    height: 52,
    background: "var(--surface)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 6,
    border: "1px solid var(--border)",
    cursor: "pointer",
    textAlign: "left",
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
    }}>
      <div style={{ marginBottom: 28, textAlign: "center" }}>
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
        <div style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 360 }}>
          India's Real-Time Disaster Coordination Platform. <br />
          Choose your role to continue.
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#525252", marginBottom: 20, textAlign: "center" }}>
        {disasterName} · 58 active requests · 34 volunteers deployed
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 360 }}>
        <button
          onClick={() => navigate("/report")}
          style={{ ...btnBase, borderLeft: "3px solid #dc2626" }}
        >
          I Need Help — Report Emergency
        </button>

        <button
          onClick={() => navigate("/volunteer")}
          style={btnBase}
        >
          Volunteer Operations
        </button>

        <button
          onClick={() => navigate("/coordinator")}
          style={{ ...btnBase, color: "var(--text-muted)" }}
        >
          Emergency Operations Center
        </button>
      </div>
    </div>
  );
}
