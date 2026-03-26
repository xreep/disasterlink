import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useDisaster } from "../DisasterContext";

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { label: "Active Requests", value: 58 },
  { label: "Volunteers Deployed", value: 34 },
  { label: "Resolved Today", value: 189 },
  { label: "Critical Unassigned", value: 12 },
  { label: "Response Rate", value: "78%" },
];

const NEEDS_DATA = [
  { name: "Food", pct: 32 },
  { name: "Water", pct: 28 },
  { name: "Medical", pct: 18 },
  { name: "Shelter", pct: 14 },
  { name: "Rescue", pct: 8 },
];
const MAX_PCT = Math.max(...NEEDS_DATA.map(d => d.pct));

const INCIDENTS: Array<{
  id: string; lat: number; lng: number; type: "Critical" | "Urgent" | "Resolved";
  needType: string; people: number; status: string; reported: string;
}> = [
  { id: "DL-48291", lat: 25.5741, lng: 85.1576, type: "Critical", needType: "Rescue", people: 8, status: "Unassigned", reported: "2h ago" },
  { id: "DL-48304", lat: 26.120, lng: 85.391, type: "Critical", needType: "Medical", people: 3, status: "Unassigned", reported: "45m ago" },
  { id: "DL-48317", lat: 26.152, lng: 85.899, type: "Critical", needType: "Food", people: 22, status: "Assigned", reported: "1h ago" },
  { id: "DL-48329", lat: 26.591, lng: 85.486, type: "Critical", needType: "Water", people: 15, status: "Unassigned", reported: "3h ago" },
  { id: "DL-48341", lat: 25.977, lng: 85.161, type: "Critical", needType: "Rescue", people: 7, status: "Unassigned", reported: "30m ago" },
  { id: "DL-48355", lat: 25.688, lng: 85.212, type: "Urgent", needType: "Shelter", people: 40, status: "Assigned", reported: "4h ago" },
  { id: "DL-48368", lat: 25.752, lng: 85.716, type: "Urgent", needType: "Food", people: 11, status: "In Progress", reported: "5h ago" },
  { id: "DL-48382", lat: 26.784, lng: 84.917, type: "Urgent", needType: "Medical", people: 6, status: "In Progress", reported: "6h ago" },
  { id: "DL-48394", lat: 25.421, lng: 85.001, type: "Urgent", needType: "Water", people: 19, status: "Assigned", reported: "7h ago" },
  { id: "DL-48401", lat: 26.003, lng: 86.062, type: "Resolved", needType: "Food", people: 30, status: "Resolved", reported: "8h ago" },
  { id: "DL-48415", lat: 25.870, lng: 85.780, type: "Resolved", needType: "Shelter", people: 12, status: "Resolved", reported: "9h ago" },
  { id: "DL-48429", lat: 26.361, lng: 84.992, type: "Resolved", needType: "Medical", people: 4, status: "Resolved", reported: "10h ago" },
];

const INCIDENT_COLOR: Record<string, string> = {
  Critical: "#dc2626",
  Urgent: "#d97706",
  Resolved: "#16a34a",
};

const INITIAL_FEED = [
  "14:23 — Volunteer Arjun accepted task #DL-48291 in Patna",
  "14:21 — New critical request: Muzaffarpur, 8 people, Medical",
  "14:19 — Task #DL-48304 marked complete by Priya S.",
  "14:17 — Volunteer Rahul deployed to Darbhanga sector",
  "14:15 — New urgent request: Sitamarhi, 15 people, Water",
  "14:12 — Resource delivery confirmed: Chhapra evacuation centre",
  "14:10 — 3 new volunteers registered in Vaishali district",
  "14:08 — Critical unassigned count updated: 12 pending",
  "14:05 — Rescue boat dispatched to Mahendrughat, Patna",
  "14:02 — Task #DL-48317 escalated to Critical by coordinator",
  "13:58 — Food packets distributed: 200 units, Muzaffarpur",
  "13:55 — Volunteer Kavita completed task #DL-48329",
  "13:52 — New request: Bagaha, 6 people, Rescue",
  "13:49 — Medical team arrived at Laheriasarai camp",
  "13:45 — System sync completed. 58 active requests loaded.",
];

const FEED_POOL = [
  "New critical request: Muzaffarpur, 3 people, Medical",
  "Volunteer Arjun marked task #DL-48355 complete",
  "Alert: Water level rising at Hajipur sector",
  "Food packets dispatched: 120 units to Saran",
  "New volunteer registered: Anjali R., Vaishali",
  "Task #DL-48368 accepted by Rahul in Darbhanga",
  "Shelter capacity at 80% — requesting overflow site",
  "Rescue team returned from Sitamarhi with 7 survivors",
  "Critical request closed: Patna Mahendrughat sector",
  "Coordinator updated status: Chhapra camp operational",
];

const RESOURCES = [
  { name: "Food Packets", available: 840, deployed: 360, total: 1200 },
  { name: "Water Pouches", available: 1240, deployed: 560, total: 1800 },
  { name: "Medical Kits", available: 92, deployed: 58, total: 150 },
  { name: "Rescue Boats", available: 6, deployed: 4, total: 10 },
  { name: "Tarpaulins", available: 310, deployed: 190, total: 500 },
];

type MobileTab = "Overview" | "Map" | "Feed" | "Resources";

// ─── Shared subcomponents ────────────────────────────────────────────────────

function SitrepPanel() {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
        Situation Report
      </div>
      {STATS.map((s, i) => (
        <div key={s.label} style={{ marginBottom: i === STATS.length - 1 ? 20 : 16 }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text)", lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
        </div>
      ))}
    </>
  );
}

function NeedsPanel() {
  return (
    <>
      <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0 20px" }} />
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
        Needs Breakdown
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {NEEDS_DATA.map(d => (
          <div key={d.name}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.name}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{d.pct}%</span>
            </div>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${d.pct}%`, background: d.pct === MAX_PCT ? "#dc2626" : "var(--text)", borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function SystemStatus() {
  return (
    <>
      <div style={{ borderTop: "1px solid var(--border)", margin: "0 0 16px" }} />
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        System Status
      </div>
      {["Data Sync", "Alert System", "Comms Bridge"].map(name => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1 }}>{name}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Operational</span>
        </div>
      ))}
    </>
  );
}

function ResourcesPanel() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        Resource Inventory
      </div>
      <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
        <span style={{ flex: 1, fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>Resource</span>
        <span style={{ width: 40, fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>Avail</span>
        <span style={{ width: 48, fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>Dep'd</span>
      </div>
      {RESOURCES.map(r => (
        <div key={r.name} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <span style={{ flex: 1, fontSize: 12, color: "var(--text-muted)" }}>{r.name}</span>
            <span style={{ width: 40, fontSize: 12, color: "var(--text)", textAlign: "right", fontFamily: "monospace" }}>{r.available}</span>
            <span style={{ width: 48, fontSize: 12, color: "var(--text-muted)", textAlign: "right", fontFamily: "monospace" }}>{r.deployed}</span>
          </div>
          <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(r.available / r.total) * 100}%`, background: "var(--text)", borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoordinatorPage() {
  const navigate = useNavigate();
  const { disasterName } = useDisaster();
  const [filter, setFilter] = useState<"All" | "Critical" | "Active">("All");
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [lastSync, setLastSync] = useState("just now");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileTab, setMobileTab] = useState<MobileTab>("Overview");
  const [highlightFirst, setHighlightFirst] = useState(false);
  const feedIdxRef = useRef(0);

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const msg = FEED_POOL[feedIdxRef.current % FEED_POOL.length];
      feedIdxRef.current++;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setFeed(prev => [`${hh}:${mm} — ${msg}`, ...prev.slice(0, 24)]);
      setHighlightFirst(true);
      setTimeout(() => setHighlightFirst(false), 3000);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setLastSync("just now"), 30000);
    return () => clearInterval(interval);
  }, []);

  function handleMobileTab(tab: MobileTab) {
    setMobileTab(tab);
    if (tab === "Map") {
      setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
    }
  }

  const filteredIncidents = INCIDENTS.filter(inc => {
    if (filter === "All") return true;
    if (filter === "Critical") return inc.type === "Critical";
    if (filter === "Active") return inc.type !== "Resolved";
    return true;
  });

  const mapEl = (
    <MapContainer
      center={[20.5937, 78.9629]}
      zoom={5}
      style={{ height: "100%", width: "100%", background: "#111" }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      />
      {filteredIncidents.map(inc => (
        <CircleMarker
          key={inc.id}
          center={[inc.lat, inc.lng]}
          radius={inc.type === "Critical" ? 10 : 8}
          pathOptions={{ color: INCIDENT_COLOR[inc.type], fillColor: INCIDENT_COLOR[inc.type], fillOpacity: 0.85, weight: 1.5 }}
        >
          <Popup>
            <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 180 }}>
              <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0a0a0a", marginBottom: 8 }}>{inc.id}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>Need</span><span style={{ fontWeight: 500 }}>{inc.needType}</span>
                <span style={{ color: "#6b7280" }}>People</span><span style={{ fontWeight: 500 }}>{inc.people}</span>
                <span style={{ color: "#6b7280" }}>Status</span>
                <span style={{ fontWeight: 500, color: inc.type === "Critical" ? "#dc2626" : inc.type === "Urgent" ? "#d97706" : "#16a34a" }}>{inc.status}</span>
                <span style={{ color: "#6b7280" }}>Reported</span><span style={{ fontWeight: 500 }}>{inc.reported}</span>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );

  const feedEl = (
    <div style={{ padding: "16px" }}>
      {feed.map((event, i) => {
        const colonIdx = event.indexOf(" — ");
        const time = event.slice(0, colonIdx);
        const msg = event.slice(colonIdx + 3);
        return (
          <div
            key={i}
            className={i === 0 && highlightFirst ? "feed-item feed-new" : "feed-item"}
            style={{ display: "flex", gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}
          >
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", flexShrink: 0, paddingTop: 1 }}>{time}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{msg}</span>
          </div>
        );
      })}
    </div>
  );

  const filterRow = (
    <div style={{
      height: 44, borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", padding: "0 16px", gap: 8, flexShrink: 0,
      background: "var(--bg)",
    }}>
      {(["All", "Critical", "Active"] as const).map(f => (
        <button key={f} onClick={() => setFilter(f)} style={{
          fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 4,
          border: `1px solid ${filter === f ? "var(--text)" : "var(--border)"}`,
          background: filter === f ? "var(--text)" : "transparent",
          color: filter === f ? "var(--bg)" : "var(--text-muted)",
          cursor: "pointer",
        }}>
          {f}
        </button>
      ))}
      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
        {filteredIncidents.length} markers
      </span>
    </div>
  );

  return (
    <div style={{
      height: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      fontFamily: "'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* ── Top Bar ── */}
      <div style={{
        height: 48, borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", padding: "0 20px", gap: 0, flexShrink: 0,
      }}>
        <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px", marginRight: 24 }}>
          DisasterLink
        </span>
        <span style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>
          {disasterName} — Active Incident
        </span>
        {!isMobile && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 16, fontFamily: "monospace" }}>
            Last sync: {lastSync}
          </span>
        )}
        <button onClick={() => navigate("/")} style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 12px", cursor: "pointer", marginRight: 10 }}>
          Home
        </button>
        <button style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 12px", cursor: "pointer" }}>
          Export
        </button>
      </div>

      {/* ── Mobile Tabbed Layout ── */}
      {isMobile ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{ height: 44, background: "var(--bg)", borderBottom: "1px solid var(--border)", display: "flex", flexShrink: 0 }}>
            {(["Overview", "Map", "Feed", "Resources"] as MobileTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => handleMobileTab(tab)}
                style={{
                  flex: 1, padding: "10px 4px", fontSize: 13, fontWeight: 500,
                  color: mobileTab === tab ? "var(--text)" : "var(--text-muted)",
                  background: "none", border: "none",
                  borderBottom: `2px solid ${mobileTab === tab ? "var(--text)" : "transparent"}`,
                  cursor: "pointer",
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview tab */}
          <div style={{ flex: 1, overflowY: "auto", display: mobileTab === "Overview" ? "block" : "none", padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              {STATS.map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 28, fontWeight: 600, color: "var(--text)", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <SystemStatus />
            <NeedsPanel />
          </div>

          {/* Map tab */}
          <div style={{ flex: 1, display: mobileTab === "Map" ? "flex" : "none", flexDirection: "column", overflow: "hidden" }}>
            {filterRow}
            <div style={{ flex: 1 }}>{mapEl}</div>
          </div>

          {/* Feed tab */}
          <div style={{ flex: 1, overflowY: "auto", display: mobileTab === "Feed" ? "block" : "none" }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "16px 16px 8px" }}>
              Live Feed
            </div>
            {feedEl}
          </div>

          {/* Resources tab */}
          <div style={{ flex: 1, overflowY: "auto", display: mobileTab === "Resources" ? "block" : "none" }}>
            <ResourcesPanel />
          </div>
        </div>
      ) : (
        /* ── Desktop 3-Column Layout ── */
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* LEFT */}
          <div style={{ width: 240, borderRight: "1px solid var(--border)", padding: "20px 16px", overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
            <SitrepPanel />
            <NeedsPanel />
            <SystemStatus />
          </div>

          {/* CENTER */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {filterRow}
            <div style={{ flex: 1 }}>{mapEl}</div>
          </div>

          {/* RIGHT */}
          <div style={{ width: 280, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, background: "var(--bg)" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "16px 0 0" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, padding: "0 16px" }}>
                Live Feed
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>{feedEl}</div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)" }} />
            <ResourcesPanel />
          </div>
        </div>
      )}
    </div>
  );
}
