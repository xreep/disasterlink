import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "../ThemeContext";
import { supabase } from "../lib/supabase";
import { hashPassword, setVolunteerSession } from "../lib/volunteerAuth";

export default function VolunteerLoginPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 44,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "0 14px",
    fontSize: 14,
    color: "var(--text)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: 6,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const passwordHash = await hashPassword(password);
      const { data, error: dbError } = await supabase
        .from("volunteers")
        .select("id, name, phone")
        .eq("phone", phone.trim())
        .eq("password_hash", passwordHash)
        .maybeSingle();

      if (dbError) throw dbError;
      if (!data) {
        setError("Incorrect phone number or password.");
        setLoading(false);
        return;
      }
      setVolunteerSession({ id: data.id, name: data.name, phone: data.phone });
      navigate("/volunteer");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  }

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

      <button
        onClick={() => navigate("/")}
        style={{ position: "absolute", top: 16, left: 16, fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}
      >
        <ArrowLeft size={14} /> Home
      </button>

      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: 6 }}>
            Volunteer Login
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Sign in with your registered phone number and password.
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Phone Number</label>
            <input
              type="tel"
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={inputStyle}
              autoComplete="tel"
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: "#dc2626", background: "#dc262610", border: "1px solid #dc262630", borderRadius: 5, padding: "10px 12px" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              height: 44, background: "var(--text)", color: "var(--bg)",
              border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              marginTop: 4,
            }}
          >
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
          Don't have an account?{" "}
          <Link
            to="/volunteer/register"
            style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none" }}
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
