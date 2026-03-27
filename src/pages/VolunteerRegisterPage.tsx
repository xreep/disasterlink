import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "../ThemeContext";
import { supabase } from "../lib/supabase";
import { INDIA_STATES, getDistricts } from "../lib/india-geo";
import { hashPassword, setVolunteerSession, generateVolunteerId } from "../lib/volunteerAuth";

const SKILLS = ["Rescue", "Medical", "Logistics", "Communication", "Driving"];

export default function VolunteerRegisterPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [skill, setSkill] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const districts = selectedState ? getDistricts(selectedState) : [];

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

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none",
    cursor: "pointer",
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim() || !password || !skill || !selectedState || !selectedDistrict) {
      setError("Please fill in all fields.");
      return;
    }
    if (phone.trim().length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("volunteers")
        .select("id")
        .eq("phone", phone.trim())
        .maybeSingle();

      if (existing) {
        setError("This phone number is already registered. Please login.");
        setLoading(false);
        return;
      }

      const passwordHash = await hashPassword(password);
      const volunteerId = generateVolunteerId();

      const { error: insertError } = await supabase.from("volunteers").insert({
        id: volunteerId,
        name: name.trim(),
        phone: phone.trim(),
        password_hash: passwordHash,
        skill,
        state: selectedState,
        district: selectedDistrict,
        status: "Available",
        task_id: null,
      });

      if (insertError) throw insertError;

      setVolunteerSession({ id: volunteerId, name: name.trim(), phone: phone.trim() });
      navigate("/volunteer");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("phone")) {
        setError("This phone number is already registered.");
      } else {
        setError("Registration failed. Please try again.");
      }
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
        onClick={() => navigate("/volunteer/login")}
        style={{ position: "absolute", top: 16, left: 16, fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}
      >
        <ArrowLeft size={14} /> Back to Login
      </button>

      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: 6 }}>
            Register as Volunteer
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Join the DisasterLink volunteer network.
          </div>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              autoComplete="name"
            />
          </div>

          <div>
            <label style={labelStyle}>Phone Number</label>
            <input
              type="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              style={inputStyle}
              autoComplete="tel"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Skill</label>
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              style={selectStyle}
            >
              <option value="">Select a skill…</option>
              {SKILLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>State</label>
            <select
              value={selectedState}
              onChange={(e) => { setSelectedState(e.target.value); setSelectedDistrict(""); }}
              style={selectStyle}
            >
              <option value="">Select state…</option>
              {INDIA_STATES.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>District</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              style={selectStyle}
              disabled={!selectedState}
            >
              <option value="">Select district…</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
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
            {loading ? "Registering…" : "Create Account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
          Already registered?{" "}
          <Link to="/volunteer/login" style={{ color: "var(--text)", fontWeight: 600, textDecoration: "none" }}>
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
