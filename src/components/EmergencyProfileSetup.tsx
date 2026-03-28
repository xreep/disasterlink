import { useState } from "react";
import { X, UserCircle } from "lucide-react";
import {
  getProfile,
  saveProfile,
  markSetupDone,
  parseDeviceName,
  type EmergencyProfile,
} from "../lib/emergencyProfile";

interface Props {
  isEdit?: boolean;
  onDone: (profile: EmergencyProfile | null) => void;
}

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
  fontFamily: "'Inter', sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
};

export function EmergencyProfileSetup({ isEdit = false, onDone }: Props) {
  const existing = getProfile();
  const [name, setName] = useState(existing?.name ?? parseDeviceName());
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [contactName, setContactName] = useState(existing?.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? "");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    const profile: EmergencyProfile = {
      name: name.trim() || "Unknown",
      phone: phone.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
    };
    saveProfile(profile);
    setSaved(true);
    setTimeout(() => onDone(profile), 1400);
  }

  function handleSkip() {
    markSetupDone();
    onDone(null);
  }

  const formContent = (
    <div style={{ width: "100%", maxWidth: 420 }}>
      {isEdit ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
              Emergency Profile
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Saved on this device only — never shared without your consent.
            </div>
          </div>
          <button
            onClick={handleSkip}
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <UserCircle size={22} style={{ color: "#dc2626", flexShrink: 0 }} />
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
              Set up your emergency profile
            </div>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            This takes 30 seconds and could save your life in an emergency.
          </div>
        </div>
      )}

      {saved ? (
        <div style={{ padding: "20px 0", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            Profile saved!
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {isEdit ? "Your emergency profile has been updated." : "You're ready. In an emergency, just tap SOS."}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Your Name</label>
              <input
                style={inputStyle}
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={!isEdit}
              />
            </div>
            <div>
              <label style={labelStyle}>Your Phone Number</label>
              <input
                style={inputStyle}
                placeholder="+91 98765 43210"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                Emergency Contact <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Contact Name</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Priya Sharma"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Contact Phone</label>
                  <input
                    style={inputStyle}
                    placeholder="+91 98765 43210"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            style={{
              marginTop: 20,
              width: "100%",
              height: 50,
              background: "var(--text)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.01em",
            }}
          >
            {isEdit ? "Save Profile" : "Save Profile — I'm Ready"}
          </button>
        </>
      )}
    </div>
  );

  if (isEdit) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) handleSkip(); }}
      >
        <div style={{
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 28,
          width: "100%",
          maxWidth: 420,
        }}>
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background: "var(--bg)",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Inter', sans-serif",
    }}>
      <button
        onClick={handleSkip}
        style={{
          width: "100%",
          padding: "16px 20px",
          background: "#dc2626",
          color: "#ffffff",
          border: "none",
          borderBottom: "2px solid #991b1b",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          letterSpacing: "0.01em",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        SKIP — I need help RIGHT NOW
      </button>

      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "36px 20px 60px",
      }}>
        {formContent}
      </div>
    </div>
  );
}
