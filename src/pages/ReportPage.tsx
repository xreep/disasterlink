import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Plus, Minus, ArrowLeft, ChevronDown, Sun, Moon, WifiOff } from "lucide-react";
import { INDIA_STATES, getDistricts } from "../lib/india-geo";
import { useTheme } from "../ThemeContext";
import { supabase } from "../lib/supabase";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { enqueueHelpRequest } from "../lib/offlineQueue";
import {
  getProfile,
  isSetupDone,
  type EmergencyProfile,
} from "../lib/emergencyProfile";
import { EmergencyProfileSetup } from "../components/EmergencyProfileSetup";

type SOSState = "idle" | "locating" | "sent" | "offline" | "denied" | "error";

function generateSOSId() {
  return `SOS-${Math.floor(10000 + Math.random() * 90000)}`;
}

const NEED_TYPES = ["Food & Water", "Medical Help", "Shelter", "Rescue", "Evacuation", "Other"];
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
  const { theme, toggleTheme } = useTheme();
  const { isOnline } = useOnlineStatus();
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
  const [savedOffline, setSavedOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ticketId] = useState(generateTicketId);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sosState, setSOSState] = useState<SOSState>("idle");
  const [sosTicketId, setSOSTicketId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(() => !isSetupDone());
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profile, setProfile] = useState<EmergencyProfile | null>(() => getProfile());

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

  function handleSetupDone(savedProfile: EmergencyProfile | null) {
    setShowSetup(false);
    if (savedProfile) setProfile(savedProfile);
  }

  function handleEditDone(savedProfile: EmergencyProfile | null) {
    setShowEditProfile(false);
    if (savedProfile) setProfile(savedProfile);
  }

  async function handleSOS() {
    if (sosState === "locating") return;
    const id = generateSOSId();
    setSOSTicketId(id);
    const currentProfile = getProfile();

    const victimName = currentProfile?.name?.trim() || "Unknown";
    const victimPhone = currentProfile?.phone?.trim() || null;

    if (!isOnline) {
      const payload = {
        id,
        victim_name: victimName,
        victim_phone: victimPhone,
        need_type: "SOS - Emergency",
        description: "SOS button — location unknown (offline)",
        location_state: "Locating...",
        location_district: "Locating...",
        latitude: null,
        longitude: null,
        severity: "Critical",
        people: 1,
        status: "Pending",
        source: "sos_button",
      };
      enqueueHelpRequest(payload as Record<string, unknown>);
      setSOSState("offline");
      return;
    }

    setSOSState("locating");

    if (!navigator.geolocation) {
      setSOSState("denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = +pos.coords.latitude.toFixed(5);
        const lng = +pos.coords.longitude.toFixed(5);
        const payload = {
          id,
          victim_name: victimName,
          victim_phone: victimPhone,
          need_type: "SOS - Emergency",
          description: `SOS button tap — GPS: ${lat}° N, ${lng}° E`,
          location_state: "Locating...",
          location_district: "Locating...",
          latitude: lat,
          longitude: lng,
          severity: "Critical",
          people: 1,
          status: "Pending",
          source: "sos_button",
        };
        const { error } = await supabase.from("help_requests").insert(payload);
        if (error) {
          setSOSState("error");
        } else {
          setSOSState("sent");
        }
      },
      () => {
        setSOSState("denied");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!needType || !severity || !selectedState || !selectedDistrict) return;
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      id: ticketId,
      victim_name: name || null,
      victim_phone: phone || null,
      need_type: needType,
      description: landmark || null,
      location_state: selectedState,
      location_district: selectedDistrict,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      severity,
      people,
      status: "Pending",
      source: "web",
    };

    if (!isOnline) {
      enqueueHelpRequest(payload as Record<string, unknown>);
      setSubmitting(false);
      setSavedOffline(true);
      setSubmitted(true);
      return;
    }

    const { error } = await supabase.from("help_requests").insert(payload);
    setSubmitting(false);
    if (error) {
      setSubmitError("Could not submit request. Please try again.");
    } else {
      setSavedOffline(false);
      setSubmitted(true);
    }
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={backBtn} onClick={() => navigate("/")}><ArrowLeft size={14} /> Home</button>
            <button onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)" }}>
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </div>
        <div style={{ ...bodyStyle, paddingTop: 48 }}>
          <div style={{ marginBottom: 40 }}>
            <div style={{ ...sectionLabel, marginBottom: 10 }}>Request ID</div>
            <div style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: "var(--text)", letterSpacing: 1 }}>#{ticketId}</div>
          </div>

          {/* Offline saved banner */}
          {savedOffline && (
            <div style={{
              marginBottom: 28,
              padding: "14px 16px",
              background: "#92400e18",
              border: "1px solid #d97706",
              borderRadius: 6,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}>
              <WifiOff size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#d97706", marginBottom: 4 }}>Saved offline</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                  Your request has been saved on this device. It will be submitted automatically when your internet connection is restored.
                </div>
              </div>
            </div>
          )}

          {!savedOffline && (
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
          )}

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
            {savedOffline
              ? "Keep this page open or return to it — your request will be sent as soon as the connection is restored."
              : "Your request has been logged. A coordinator has been notified."}
          </p>

          <button
            onClick={() => { setSubmitted(false); setSavedOffline(false); }}
            style={{ marginTop: 32, fontSize: 13, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 20px", cursor: "pointer" }}
          >
            Submit another request
          </button>
        </div>
      </div>
    );
  }

  const canSubmit = !!(needType && severity && selectedState && selectedDistrict);

  const hasFullProfile = !!(profile?.name && profile.name !== "Unknown" && profile?.phone);

  const sosSection = (
    <div style={{ maxWidth: isMobile ? "100%" : 480, margin: "0 auto", padding: isMobile ? "24px 16px 0" : "24px 20px 0" }}>
      {/* SOS button */}
      {(sosState === "idle" || sosState === "locating") && (
        <div>
          <button
            type="button"
            onClick={handleSOS}
            disabled={sosState === "locating"}
            className={sosState === "idle" ? "sos-pulse" : undefined}
            style={{
              width: "100%",
              background: sosState === "locating" ? "#991b1b" : "#dc2626",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              padding: "18px 20px",
              fontSize: isMobile ? 17 : 19,
              fontWeight: 700,
              cursor: sosState === "locating" ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
              transition: "background 0.2s",
            }}
          >
            {sosState === "locating" ? "📡 Getting your location..." : "🆘 SOS — Send My Location Now"}
          </button>
          <p style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            One tap sends your GPS location immediately — no form needed
          </p>
        </div>
      )}

      {/* SOS sent */}
      {sosState === "sent" && (
        <div style={{ background: "#14532d18", border: "1px solid #16a34a", borderRadius: 8, padding: "18px 20px" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>
            🆘 SOS Sent! Help is on the way.
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 10 }}>
            Stay where you are. Your GPS coordinates have been transmitted to emergency coordinators.
          </div>
          {sosTicketId && (
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)", marginBottom: 10 }}>
              Reference ID: {sosTicketId}
            </div>
          )}
          {!hasFullProfile && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                While you wait, add your details
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                Help responders reach you faster by adding your name and phone number.
              </div>
              <button
                type="button"
                onClick={() => setShowEditProfile(true)}
                style={{ fontSize: 12, fontWeight: 600, color: "var(--bg)", background: "var(--text)", border: "none", borderRadius: 5, padding: "7px 14px", cursor: "pointer" }}
              >
                Add my details →
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSOSState("idle")}
            style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 14px", cursor: "pointer" }}
          >
            Send another SOS
          </button>
        </div>
      )}

      {/* SOS offline */}
      {sosState === "offline" && (
        <div style={{ background: "#92400e18", border: "1px solid #d97706", borderRadius: 8, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <WifiOff size={16} style={{ color: "#d97706", flexShrink: 0 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "#d97706" }}>SOS saved — will be sent when connection restores</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Your SOS request is queued on this device and will be transmitted automatically when you're back online.
          </div>
          {sosTicketId && (
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: "monospace", color: "var(--text-muted)" }}>
              Reference ID: {sosTicketId}
            </div>
          )}
          <button
            type="button"
            onClick={() => setSOSState("idle")}
            style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 14px", cursor: "pointer" }}
          >
            Send another SOS
          </button>
        </div>
      )}

      {/* GPS denied */}
      {(sosState === "denied" || sosState === "error") && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            {sosState === "denied"
              ? "Location access denied."
              : "Could not send SOS — please try again."}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {sosState === "denied"
              ? "Please fill the form below with your location so coordinators can find you."
              : "Use the form below to submit your request manually."}
          </div>
          <button
            type="button"
            onClick={() => setSOSState("idle")}
            style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 14px", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Edit profile link — always shown */}
      <div style={{ marginTop: 10, textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setShowEditProfile(true)}
          style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          {profile?.name && profile.name !== "Unknown"
            ? `Emergency profile: ${profile.name} — Edit`
            : "✚ Set up emergency profile"}
        </button>
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>— or fill the form for more details —</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', sans-serif", color: "var(--text)" }}>
      {showSetup && (
        <EmergencyProfileSetup onDone={handleSetupDone} />
      )}
      {showEditProfile && (
        <EmergencyProfileSetup isEdit onDone={handleEditDone} />
      )}

      <div style={topBar}>
        <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>DisasterLink</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>Emergency Request</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button style={backBtn} onClick={() => navigate("/")}><ArrowLeft size={14} /> Home</button>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)" }}>
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>
      </div>

      {sosSection}

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
        {submitError && (
          <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 10, padding: "8px 12px", border: "1px solid #dc262633", borderRadius: 6, background: "#dc262608" }}>
            {submitError}
          </div>
        )}
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          style={{
            width: "100%", height: 52,
            background: !canSubmit || submitting ? "var(--surface)" : "var(--text)",
            color: !canSubmit || submitting ? "#525252" : "var(--bg)",
            fontSize: 14, fontWeight: 600, borderRadius: 6, border: "none",
            cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
