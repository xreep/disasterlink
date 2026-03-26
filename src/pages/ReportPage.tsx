import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus, Minus, ArrowLeft, ChevronDown } from "lucide-react";
import { INDIA_STATES, getDistricts } from "../lib/india-geo";

const NEED_TYPES = ["Food", "Water", "Medical", "Shelter", "Rescue"];
const SEVERITY_OPTIONS = [
  { label: "Critical", color: "#dc2626" },
  { label: "Urgent", color: "#d97706" },
  { label: "Moderate", color: "#16a34a" },
];

function generateTicketId() {
  return `DL-${Math.floor(10000 + Math.random() * 90000)}`;
}

export default function ReportPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [landmark, setLandmark] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [needType, setNeedType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [people, setPeople] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId] = useState(generateTicketId);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const districts = selectedState ? getDistricts(selectedState) : [];

  function handleStateChange(state: string) {
    setSelectedState(state);
    setSelectedDistrict("");
  }

  function detectLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = +pos.coords.latitude.toFixed(5);
        const lng = +pos.coords.longitude.toFixed(5);
        setCoords({ lat, lng });
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!needType || !severity || !selectedState || !selectedDistrict) return;
    setSubmitted(true);
  }

  const locationString = [selectedDistrict, selectedState].filter(Boolean).join(", ")
    + (landmark ? ` — ${landmark}` : "");

  const topBar: React.CSSProperties = {
    height: 48,
    background: "var(--bg)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 8,
  };

  const fieldLabel: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 500,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 48,
    border: "1px solid var(--input-border)",
    borderRadius: 6,
    padding: "0 14px",
    fontSize: 14,
    color: "var(--text)",
    background: "var(--input-bg)",
    outline: "none",
    boxSizing: "border-box",
  };

  const selectWrapper: React.CSSProperties = {
    position: "relative",
    width: "100%",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    height: 48,
    border: "1px solid var(--input-border)",
    borderRadius: 6,
    padding: "0 36px 0 14px",
    fontSize: 14,
    color: "var(--text)",
    background: "var(--input-bg)",
    outline: "none",
    appearance: "none",
    cursor: "pointer",
    boxSizing: "border-box",
  };

  const selectDisabled: React.CSSProperties = {
    ...selectStyle,
    opacity: 0.45,
    cursor: "not-allowed",
  };

  const chevronStyle: React.CSSProperties = {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "var(--text-muted)",
  };

  const backBtn: React.CSSProperties = {
    fontSize: 13,
    color: "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  };

  const bodyStyle: React.CSSProperties = {
    maxWidth: isMobile ? "100%" : 480,
    margin: "0 auto",
    padding: isMobile ? "32px 16px 80px" : "32px 20px 48px",
  };

  if (submitted) {
    const STEPS = ["Received", "Triaged", "Assigned", "Resolved"];
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', sans-serif", color: "var(--text)" }}>
        <div style={topBar}>
          <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>DisasterLink</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>Emergency Request</span>
          <button style={backBtn} onClick={() => navigate("/")}><ArrowLeft size={14} /> Home</button>
        </div>
        <div style={{ ...bodyStyle, paddingTop: 48 }}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ ...sectionLabel, marginBottom: 10 }}>Request ID</div>
            <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: "var(--text)", letterSpacing: 1 }}>#{ticketId}</div>
          </div>

          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              {STEPS.map((step, i) => (
                <div key={step} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: i === 0 ? "var(--text)" : "transparent",
                    border: `1px solid ${i === 0 ? "var(--text)" : "#525252"}`,
                    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {i === 0 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--bg)" }} />}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: i === 0 ? "var(--text)" : "var(--border)" }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {STEPS.map((step, i) => (
                <span key={step} style={{ fontSize: 11, color: i === 0 ? "var(--text)" : "#525252", fontWeight: i === 0 ? 600 : 400, flex: i < STEPS.length - 1 ? 1 : "auto" }}>
                  {step}
                </span>
              ))}
            </div>
          </div>

          {locationString && (
            <div style={{ marginBottom: 20, padding: "12px 14px", background: "var(--surface)", borderRadius: 6, border: "1px solid var(--border)" }}>
              <div style={{ ...sectionLabel, marginBottom: 4 }}>Reported Location</div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>{locationString}</div>
              {coords && (
                <div style={{ marginTop: 4, fontSize: 11, color: "#525252", fontFamily: "monospace" }}>
                  GPS: {coords.lat}° N, {coords.lng}° E
                </div>
              )}
            </div>
          )}

          <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
            Your request has been logged. A coordinator has been notified.
          </p>

          <button
            onClick={() => setSubmitted(false)}
            style={{ marginTop: 32, fontSize: 13, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 20px", cursor: "pointer" }}
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  const canSubmit = !!(needType && severity && selectedState && selectedDistrict);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', sans-serif", color: "var(--text)" }}>
      <div style={topBar}>
        <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>DisasterLink</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>Emergency Request</span>
        <button style={backBtn} onClick={() => navigate("/")}><ArrowLeft size={14} /> Home</button>
      </div>

      <form onSubmit={handleSubmit} style={bodyStyle}>
        {/* Identity */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>Your Information</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={fieldLabel}>Name</label>
              <input style={inputStyle} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <label style={fieldLabel}>Phone</label>
              <input style={inputStyle} placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} type="tel" required />
            </div>
          </div>
        </div>

        {/* Location */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>Location</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* State */}
            <div>
              <label style={fieldLabel}>State / Union Territory</label>
              <div style={selectWrapper}>
                <select
                  style={selectStyle}
                  value={selectedState}
                  onChange={e => handleStateChange(e.target.value)}
                  required
                >
                  <option value="">Select state…</option>
                  {INDIA_STATES.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} style={chevronStyle} />
              </div>
            </div>

            {/* District */}
            <div>
              <label style={fieldLabel}>District</label>
              <div style={selectWrapper}>
                <select
                  style={selectedState ? selectStyle : selectDisabled}
                  value={selectedDistrict}
                  onChange={e => setSelectedDistrict(e.target.value)}
                  disabled={!selectedState}
                  required
                >
                  <option value="">
                    {selectedState ? "Select district…" : "Select a state first"}
                  </option>
                  {districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown size={14} style={chevronStyle} />
              </div>
            </div>

            {/* Landmark / address */}
            <div>
              <label style={fieldLabel}>Landmark or Address <span style={{ textTransform: "none", fontWeight: 400, color: "#525252" }}>(optional)</span></label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...inputStyle, paddingRight: 90 }}
                  placeholder="Nearest landmark, street, village…"
                  value={landmark}
                  onChange={e => setLandmark(e.target.value)}
                />
                <button
                  type="button"
                  onClick={detectLocation}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    fontSize: 12, fontWeight: 500, color: "var(--text)",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 4, padding: "4px 10px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <MapPin size={12} />
                  {locating ? "…" : "GPS"}
                </button>
              </div>
              {coords && (
                <div style={{ marginTop: 5, fontSize: 11, color: "#525252", fontFamily: "monospace" }}>
                  GPS captured: {coords.lat}° N, {coords.lng}° E
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Need Type */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>Need Type</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
            {NEED_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setNeedType(type)}
                style={{
                  height: 40, borderRadius: 6,
                  border: `1px solid ${needType === type ? "var(--text)" : "var(--border)"}`,
                  background: needType === type ? "var(--text)" : "var(--surface)",
                  color: needType === type ? "var(--bg)" : "var(--text)",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>Severity</div>
          <div style={{ display: "flex", gap: 8 }}>
            {SEVERITY_OPTIONS.map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSeverity(opt.label)}
                style={{
                  flex: 1, height: 40, borderRadius: 6,
                  border: `1px solid ${opt.color}`,
                  background: severity === opt.label ? opt.color : "var(--surface)",
                  color: severity === opt.label ? "#ffffff" : opt.color,
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* People count */}
        <div style={{ marginBottom: 24 }}>
          <div style={sectionLabel}>People Affected</div>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 6, width: "fit-content", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setPeople(p => Math.max(1, p - 1))}
              style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "none", borderRight: "1px solid var(--border)", cursor: "pointer", color: "var(--text)" }}
            >
              <Minus size={14} />
            </button>
            <div style={{ width: 56, height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, color: "var(--text)", background: "var(--input-bg)" }}>
              {people}
            </div>
            <button
              type="button"
              onClick={() => setPeople(p => p + 1)}
              style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "none", borderLeft: "1px solid var(--border)", cursor: "pointer", color: "var(--text)" }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: "100%", height: 52,
            background: !canSubmit ? "var(--surface)" : "var(--text)",
            color: !canSubmit ? "#525252" : "var(--bg)",
            fontSize: 14, fontWeight: 600, borderRadius: 6, border: "none",
            cursor: !canSubmit ? "not-allowed" : "pointer",
          }}
        >
          Submit Request
        </button>
      </form>
    </div>
  );
}
