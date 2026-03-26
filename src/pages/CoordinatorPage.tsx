import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Waves, Activity, Wind, Mountain, Sun, Factory, Flame, Thermometer, Moon } from "lucide-react";
import { useDisaster, DISASTER_TYPES, DISASTER_CONFIG, type DisasterType } from "../DisasterContext";
import { useTheme } from "../ThemeContext";

// ─── Icon map ────────────────────────────────────────────────────────────────

const DISASTER_ICONS: Record<DisasterType, React.ComponentType<{ size?: number; color?: string }>> = {
  "Flood": Waves, "Earthquake": Activity, "Cyclone": Wind, "Landslide": Mountain,
  "Drought": Sun, "Industrial Accident": Factory, "Fire": Flame, "Heatwave": Thermometer,
};

// ─── Shared types ─────────────────────────────────────────────────────────────

type Severity = "Critical" | "Urgent" | "Resolved";
type ReqStatus = "Unassigned" | "Assigned" | "In Progress" | "Resolved";
type VolStatus = "Active" | "Deployed" | "Available" | "Completed";
type EOCTab = "Overview" | "Map" | "Requests" | "Volunteers" | "Resources" | "Analytics";

// ─── Mock data ────────────────────────────────────────────────────────────────

const REQUESTS: Array<{
  id: string; lat: number; lng: number; severity: Severity;
  needType: string; people: number; status: ReqStatus;
  district: string; state: string; reported: string;
}> = [
  { id: "DL-48291", lat: 25.574, lng: 85.158, severity: "Critical", needType: "Rescue",       people: 8,  status: "Unassigned",  district: "Patna",        state: "Bihar",       reported: "2h ago" },
  { id: "DL-48304", lat: 26.120, lng: 85.391, severity: "Critical", needType: "Medical Help", people: 3,  status: "Unassigned",  district: "Muzaffarpur",  state: "Bihar",       reported: "45m ago" },
  { id: "DL-48317", lat: 26.152, lng: 85.899, severity: "Critical", needType: "Food & Water", people: 22, status: "Assigned",    district: "Darbhanga",    state: "Bihar",       reported: "1h ago" },
  { id: "DL-48329", lat: 26.591, lng: 85.486, severity: "Critical", needType: "Food & Water", people: 15, status: "Unassigned",  district: "Sitamarhi",    state: "Bihar",       reported: "3h ago" },
  { id: "DL-48341", lat: 25.977, lng: 85.161, severity: "Critical", needType: "Rescue",       people: 7,  status: "Unassigned",  district: "Patna",        state: "Bihar",       reported: "30m ago" },
  { id: "DL-48355", lat: 25.688, lng: 85.212, severity: "Urgent",   needType: "Shelter",      people: 40, status: "Assigned",    district: "Vaishali",     state: "Bihar",       reported: "4h ago" },
  { id: "DL-48368", lat: 25.752, lng: 85.716, severity: "Urgent",   needType: "Food & Water", people: 11, status: "In Progress", district: "Bhagalpur",    state: "Bihar",       reported: "5h ago" },
  { id: "DL-48382", lat: 26.784, lng: 84.917, severity: "Urgent",   needType: "Medical Help", people: 6,  status: "In Progress", district: "Purnia",       state: "Bihar",       reported: "6h ago" },
  { id: "DL-48394", lat: 25.421, lng: 85.001, severity: "Urgent",   needType: "Evacuation",   people: 19, status: "Assigned",    district: "Gaya",         state: "Bihar",       reported: "7h ago" },
  { id: "DL-48401", lat: 10.080, lng: 76.970, severity: "Resolved", needType: "Food & Water", people: 30, status: "Resolved",    district: "Idukki",       state: "Kerala",      reported: "8h ago" },
  { id: "DL-48415", lat: 26.185, lng: 91.736, severity: "Resolved", needType: "Shelter",      people: 12, status: "Resolved",    district: "Kamrup",       state: "Assam",       reported: "9h ago" },
  { id: "DL-48429", lat: 20.462, lng: 85.879, severity: "Resolved", needType: "Medical Help", people: 4,  status: "Resolved",    district: "Cuttack",      state: "Odisha",      reported: "10h ago" },
  { id: "DL-48443", lat: 19.998, lng: 73.790, severity: "Urgent",   needType: "Evacuation",   people: 25, status: "Assigned",    district: "Nashik",       state: "Maharashtra", reported: "11h ago" },
  { id: "DL-48456", lat: 21.197, lng: 72.834, severity: "Critical", needType: "Other",        people: 9,  status: "Unassigned",  district: "Surat",        state: "Gujarat",     reported: "12h ago" },
  { id: "DL-48470", lat: 24.185, lng: 88.277, severity: "Urgent",   needType: "Medical Help", people: 17, status: "In Progress", district: "Murshidabad",  state: "West Bengal", reported: "13h ago" },
];

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "#dc2626", Urgent: "#d97706", Resolved: "#16a34a",
};
const STATUS_COLOR: Record<string, string> = {
  Unassigned: "#dc2626", Assigned: "#d97706", "In Progress": "#2563eb", Resolved: "#16a34a",
};
const NEED_COLOR: Record<string, string> = {
  "Food & Water": "#2563eb", "Medical Help": "#dc2626", "Shelter": "#7c3aed",
  "Rescue": "#ea580c", "Evacuation": "#d97706", "Other": "#525252",
};

const VOLUNTEERS: Array<{
  id: string; name: string; district: string; state: string;
  skill: string; status: VolStatus; task: string | null;
}> = [
  { id: "V-001", name: "Arjun Sharma",   district: "Patna",       state: "Bihar",       skill: "Rescue",     status: "Active",    task: "DL-48291" },
  { id: "V-002", name: "Priya Singh",    district: "Muzaffarpur", state: "Bihar",       skill: "Medical",    status: "Active",    task: "DL-48304" },
  { id: "V-003", name: "Rahul Kumar",    district: "Darbhanga",   state: "Bihar",       skill: "Logistics",  status: "Deployed",  task: "DL-48368" },
  { id: "V-004", name: "Anjali Rao",     district: "Vaishali",    state: "Bihar",       skill: "First Aid",  status: "Available", task: null },
  { id: "V-005", name: "Kavita Patel",   district: "Saran",       state: "Bihar",       skill: "Rescue",     status: "Completed", task: "DL-48329" },
  { id: "V-006", name: "Vikram Das",     district: "Sitamarhi",   state: "Bihar",       skill: "Shelter",    status: "Deployed",  task: "DL-48355" },
  { id: "V-007", name: "Meena Kumari",   district: "Chhapra",     state: "Bihar",       skill: "Food Dist.", status: "Active",    task: "DL-48317" },
  { id: "V-008", name: "Suresh Verma",   district: "Hajipur",     state: "Bihar",       skill: "Rescue",     status: "Available", task: null },
  { id: "V-009", name: "Deepa Nair",     district: "Ernakulam",   state: "Kerala",      skill: "Medical",    status: "Active",    task: "DL-48401" },
  { id: "V-010", name: "Rajesh Borah",   district: "Kamrup",      state: "Assam",       skill: "Rescue",     status: "Completed", task: "DL-48415" },
  { id: "V-011", name: "Sunita Mishra",  district: "Cuttack",     state: "Odisha",      skill: "First Aid",  status: "Available", task: null },
  { id: "V-012", name: "Amit Desai",     district: "Nashik",      state: "Maharashtra", skill: "Evacuation", status: "Active",    task: "DL-48443" },
];
const VOL_STATUS_COLOR: Record<string, string> = {
  Active: "#16a34a", Deployed: "#2563eb", Available: "#d97706", Completed: "#525252",
};

const RESOURCES: Array<{
  name: string; category: string; available: number; deployed: number; total: number; location: string;
}> = [
  { name: "Food Packets",   category: "Nutrition",  available: 840,  deployed: 360, total: 1200, location: "Patna Dist. HQ" },
  { name: "Water Pouches",  category: "Nutrition",  available: 1240, deployed: 560, total: 1800, location: "Muzaffarpur Camp" },
  { name: "Medical Kits",   category: "Medical",    available: 92,   deployed: 58,  total: 150,  location: "Civil Hospital, Patna" },
  { name: "Rescue Boats",   category: "Rescue",     available: 6,    deployed: 4,   total: 10,   location: "Hajipur River Station" },
  { name: "Tarpaulins",     category: "Shelter",    available: 310,  deployed: 190, total: 500,  location: "Vaishali Dist. Centre" },
  { name: "Helicopters",    category: "Rescue",     available: 2,    deployed: 1,   total: 3,    location: "Patna Airport" },
  { name: "Ambulances",     category: "Medical",    available: 8,    deployed: 5,   total: 13,   location: "SDRF Headquarters" },
  { name: "Blankets",       category: "Shelter",    available: 620,  deployed: 380, total: 1000, location: "Darbhanga Relief Camp" },
];
const RESOURCE_CATEGORY_COLOR: Record<string, string> = {
  Nutrition: "#2563eb", Medical: "#dc2626", Rescue: "#ea580c", Shelter: "#7c3aed",
};

const ANALYTICS_NEED = [
  { name: "Food & Water", count: 18 },
  { name: "Medical Help", count: 14 },
  { name: "Rescue",       count: 12 },
  { name: "Shelter",      count: 8  },
  { name: "Evacuation",   count: 7  },
  { name: "Other",        count: 3  },
];
const ANALYTICS_STATE = [
  { name: "Bihar",        count: 28 },
  { name: "Assam",        count: 12 },
  { name: "Kerala",       count: 8  },
  { name: "Odisha",       count: 6  },
  { name: "Maharashtra",  count: 5  },
  { name: "West Bengal",  count: 4  },
  { name: "Gujarat",      count: 3  },
  { name: "Uttarakhand",  count: 2  },
];
const RESOLUTION_TREND = [
  { day: "Mon", pct: 71 }, { day: "Tue", pct: 76 },
  { day: "Wed", pct: 68 }, { day: "Thu", pct: 80 },
  { day: "Fri", pct: 78 }, { day: "Sat", pct: 83 },
  { day: "Sun", pct: 78 },
];

const INITIAL_FEED = [
  "14:23 — Volunteer Arjun accepted task #DL-48291 in Patna",
  "14:21 — New critical request: Muzaffarpur, 8 people, Medical",
  "14:19 — Task #DL-48304 marked complete by Priya S.",
  "14:17 — Volunteer Rahul deployed to Darbhanga sector",
  "14:15 — New urgent request: Sitamarhi, 15 people, Food & Water",
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
  "New critical request: Muzaffarpur, 3 people, Medical Help",
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

// ─── Shared styles ────────────────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "var(--text-muted)",
  textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8,
};
const divider: React.CSSProperties = { borderTop: "1px solid var(--border)", margin: "16px 0" };

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 3,
      border: `1px solid ${color}`, color, background: `${color}18`,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoordinatorPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { disasterName, disasterType, disasterColor, setDisasterType } = useDisaster();
  const [activeTab, setActiveTab] = useState<EOCTab>("Overview");
  const [mapFilter, setMapFilter] = useState<"All" | "Critical" | "Active">("All");
  const [reqFilter, setReqFilter] = useState<"All" | "Unassigned" | "Assigned" | "Resolved">("All");
  const [feed, setFeed] = useState(INITIAL_FEED);
  const [lastSync, setLastSync] = useState("just now");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
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

  function handleTab(tab: EOCTab) {
    setActiveTab(tab);
    if (tab === "Map") setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
  }

  const filteredRequests = REQUESTS.filter(r => {
    if (mapFilter === "All") return true;
    if (mapFilter === "Critical") return r.severity === "Critical";
    if (mapFilter === "Active") return r.severity !== "Resolved";
    return true;
  });

  const filteredReqList = REQUESTS.filter(r => {
    if (reqFilter === "All") return true;
    if (reqFilter === "Resolved") return r.status === "Resolved";
    if (reqFilter === "Unassigned") return r.status === "Unassigned";
    if (reqFilter === "Assigned") return r.status === "Assigned" || r.status === "In Progress";
    return true;
  });

  // ── Disaster type selector (reused in sidebar + mobile overview) ──────────

  const disasterSelector = (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionLabel}>Active Disaster Type</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {DISASTER_TYPES.map((type: DisasterType) => {
          const Icon = DISASTER_ICONS[type];
          const meta = DISASTER_CONFIG[type];
          const isActive = disasterType === type;
          return (
            <button key={type} onClick={() => setDisasterType(type)} style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "7px 9px", borderRadius: 5, cursor: "pointer",
              border: `1px solid ${isActive ? meta.color : "transparent"}`,
              background: isActive ? `${meta.color}22` : "transparent",
              textAlign: "left", width: "100%",
            }}>
              <Icon size={13} color={isActive ? meta.color : "#525252"} />
              <div>
                <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? meta.color : "var(--text-muted)", lineHeight: 1.2 }}>{type}</div>
                <div style={{ fontSize: 10, color: "#525252", lineHeight: 1.3, marginTop: 1 }}>{meta.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── System status ─────────────────────────────────────────────────────────

  const systemStatus = (
    <>
      <div style={divider} />
      <div style={sectionLabel}>System Status</div>
      {["Data Sync", "Alert System", "Comms Bridge"].map(name => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)", flex: 1 }}>{name}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Online</span>
        </div>
      ))}
    </>
  );

  // ── Tab content ───────────────────────────────────────────────────────────

  const overviewContent = (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      {isMobile && <div style={{ marginBottom: 20 }}>{disasterSelector}</div>}

      {/* KPI cards */}
      <div style={sectionLabel}>Live KPIs</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Active Requests", value: 58, color: "#dc2626" },
          { label: "Volunteers Deployed", value: 34, color: "#2563eb" },
          { label: "Resources Available", value: 3118, color: "#16a34a" },
          { label: "Resolved Today", value: 189, color: "#525252" },
        ].map(k => (
          <div key={k.label} style={{ padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: k.color, lineHeight: 1, fontFamily: "monospace" }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Needs breakdown */}
        <div>
          <div style={sectionLabel}>Needs Breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: isMobile ? 24 : 0 }}>
            {[
              { name: "Food & Water", pct: 32 }, { name: "Medical Help", pct: 23 },
              { name: "Rescue", pct: 20 }, { name: "Shelter", pct: 13 },
              { name: "Evacuation", pct: 8 }, { name: "Other", pct: 4 },
            ].map(d => (
              <div key={d.name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{d.pct}%</span>
                </div>
                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.pct}%`, background: NEED_COLOR[d.name] || "var(--text)", borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live feed */}
        <div>
          <div style={sectionLabel}>Live Feed</div>
          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {feed.slice(0, 10).map((event, i) => {
              const colonIdx = event.indexOf(" — ");
              const time = event.slice(0, colonIdx);
              const msg = event.slice(colonIdx + 3);
              return (
                <div key={i} className={i === 0 && highlightFirst ? "feed-item feed-new" : "feed-item"}
                  style={{ display: "flex", gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", flexShrink: 0, paddingTop: 1 }}>{time}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{msg}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const mapContent = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Filter row */}
      <div style={{ height: 44, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8, flexShrink: 0, background: "var(--bg)" }}>
        {(["All", "Critical", "Active"] as const).map(f => (
          <button key={f} onClick={() => setMapFilter(f)} style={{
            fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 4,
            border: `1px solid ${mapFilter === f ? "var(--text)" : "var(--border)"}`,
            background: mapFilter === f ? "var(--text)" : "transparent",
            color: mapFilter === f ? "var(--bg)" : "var(--text-muted)", cursor: "pointer",
          }}>{f}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
          {filteredRequests.length} request pins · {VOLUNTEERS.length} volunteer pins
        </span>
      </div>
      {/* Legend */}
      <div style={{ height: 36, display: "flex", alignItems: "center", gap: 16, padding: "0 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {[{ label: "Critical", color: "#dc2626" }, { label: "Urgent", color: "#d97706" }, { label: "Resolved", color: "#16a34a" }, { label: "Volunteer", color: "#3b82f6" }].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.label}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: "100%", width: "100%", background: "#111" }} zoomControl>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://carto.com/">CARTO</a>' />
          {filteredRequests.map(r => (
            <CircleMarker key={r.id} center={[r.lat, r.lng]}
              radius={r.severity === "Critical" ? 10 : 7}
              pathOptions={{ color: SEVERITY_COLOR[r.severity], fillColor: SEVERITY_COLOR[r.severity], fillOpacity: 0.85, weight: 1.5 }}
            >
              <Popup>
                <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 180 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0a0a0a", marginBottom: 8 }}>{r.id}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
                    <span style={{ color: "#6b7280" }}>Need</span><span style={{ fontWeight: 500 }}>{r.needType}</span>
                    <span style={{ color: "#6b7280" }}>Location</span><span style={{ fontWeight: 500 }}>{r.district}, {r.state}</span>
                    <span style={{ color: "#6b7280" }}>People</span><span style={{ fontWeight: 500 }}>{r.people}</span>
                    <span style={{ color: "#6b7280" }}>Status</span><span style={{ fontWeight: 500, color: STATUS_COLOR[r.status] }}>{r.status}</span>
                    <span style={{ color: "#6b7280" }}>Reported</span><span style={{ fontWeight: 500 }}>{r.reported}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {/* Volunteer pins (blue, smaller) */}
          {VOLUNTEERS.filter(v => v.status === "Active" || v.status === "Deployed").map(v => {
            const req = REQUESTS.find(r => r.id === v.task);
            if (!req) return null;
            return (
              <CircleMarker key={v.id} center={[req.lat + 0.05, req.lng + 0.05]}
                radius={5}
                pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 1.5 }}
              >
                <Popup>
                  <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 160 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0a0a0a", marginBottom: 6 }}>{v.id}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>Name</span><span style={{ fontWeight: 500 }}>{v.name}</span>
                      <span style={{ color: "#6b7280" }}>Skill</span><span style={{ fontWeight: 500 }}>{v.skill}</span>
                      <span style={{ color: "#6b7280" }}>Task</span><span style={{ fontWeight: 500, color: "#2563eb" }}>{v.task}</span>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );

  const requestsContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Filter row */}
      <div style={{ height: 44, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 16px", gap: 8, flexShrink: 0 }}>
        {(["All", "Unassigned", "Assigned", "Resolved"] as const).map(f => (
          <button key={f} onClick={() => setReqFilter(f)} style={{
            fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 4,
            border: `1px solid ${reqFilter === f ? "var(--text)" : "var(--border)"}`,
            background: reqFilter === f ? "var(--text)" : "transparent",
            color: reqFilter === f ? "var(--bg)" : "var(--text-muted)", cursor: "pointer",
          }}>{f}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
          {filteredReqList.length} requests
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "90px 1fr 120px 60px 100px 80px", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          {(isMobile ? ["ID", "Need / Location", "Status"] : ["ID", "Location", "Need Type", "People", "Severity", "Status"]).map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>
        {filteredReqList.map(r => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "90px 1fr 120px 60px 100px 80px", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{r.id}</span>
            {isMobile ? (
              <>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{r.needType}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.district}, {r.state}</div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{r.district}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.state} · {r.reported}</div>
                </div>
                <Badge label={r.needType} color={NEED_COLOR[r.needType] || "#525252"} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "monospace" }}>{r.people}</span>
                <Badge label={r.severity} color={SEVERITY_COLOR[r.severity]} />
              </>
            )}
            <Badge label={r.status} color={STATUS_COLOR[r.status]} />
          </div>
        ))}
      </div>
    </div>
  );

  const volunteersContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 44, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{VOLUNTEERS.length} registered volunteers</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>·</span>
        <span style={{ fontSize: 12, color: "#16a34a" }}>{VOLUNTEERS.filter(v => v.status === "Active" || v.status === "Deployed").length} active</span>
        <span style={{ fontSize: 12, color: "#d97706" }}>{VOLUNTEERS.filter(v => v.status === "Available").length} available</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 140px 80px 100px 100px", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          {(isMobile ? ["Volunteer", "Status"] : ["Volunteer", "Location", "Skill", "Status", "Assigned Task"]).map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>
        {VOLUNTEERS.map(v => (
          <div key={v.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 140px 80px 100px 100px", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{v.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.id}</div>
            </div>
            {!isMobile && (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{v.district}, {v.state}</div>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{v.skill}</span>
              </>
            )}
            <Badge label={v.status} color={VOL_STATUS_COLOR[v.status]} />
            {!isMobile && (
              <span style={{ fontFamily: "monospace", fontSize: 12, color: v.task ? "#2563eb" : "var(--text-muted)" }}>{v.task ?? "—"}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const resourcesContent = (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {RESOURCES.map(r => {
          const pct = Math.round((r.available / r.total) * 100);
          const color = RESOURCE_CATEGORY_COLOR[r.category] || "#525252";
          return (
            <div key={r.name} style={{ padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{r.location}</div>
                </div>
                <Badge label={r.category} color={color} />
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", fontFamily: "monospace", lineHeight: 1 }}>{r.available}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Available</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace", lineHeight: 1 }}>{r.deployed}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Deployed</div>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace", lineHeight: 1 }}>{r.total}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Total</div>
                </div>
              </div>
              <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{pct}% available</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const analyticsContent = (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Requests by need type */}
        <div style={{ marginBottom: isMobile ? 28 : 0 }}>
          <div style={sectionLabel}>Requests by Need Type</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ANALYTICS_NEED.map(d => {
              const max = Math.max(...ANALYTICS_NEED.map(x => x.count));
              return (
                <div key={d.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{d.count}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(d.count / max) * 100}%`, background: NEED_COLOR[d.name] || "var(--text)", borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Requests by state */}
        <div style={{ marginBottom: isMobile ? 28 : 0 }}>
          <div style={sectionLabel}>Requests by State</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ANALYTICS_STATE.map(d => {
              const max = Math.max(...ANALYTICS_STATE.map(x => x.count));
              return (
                <div key={d.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.name}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>{d.count}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(d.count / max) * 100}%`, background: disasterColor, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resolution rate trend */}
        <div style={{ marginBottom: isMobile ? 28 : 0 }}>
          <div style={sectionLabel}>7-Day Resolution Rate</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 80 }}>
            {RESOLUTION_TREND.map(d => (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace" }}>{d.pct}%</span>
                <div style={{ width: "100%", background: "#16a34a", borderRadius: "2px 2px 0 0", height: `${d.pct}%`, opacity: 0.8 }} />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div>
          <div style={sectionLabel}>Response Summary</div>
          {[
            { label: "Avg. Response Time", value: "28 min" },
            { label: "Critical Resolution Rate", value: "71%" },
            { label: "Volunteer Utilisation", value: "83%" },
            { label: "Resource Deployment", value: "47%" },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", fontFamily: "monospace" }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const TABS: EOCTab[] = ["Overview", "Map", "Requests", "Volunteers", "Resources", "Analytics"];
  const tabContent: Record<EOCTab, React.ReactNode> = {
    Overview: overviewContent, Map: mapContent,
    Requests: requestsContent, Volunteers: volunteersContent,
    Resources: resourcesContent, Analytics: analyticsContent,
  };

  const tabBar = (
    <div style={{ height: 44, borderBottom: "1px solid var(--border)", display: "flex", flexShrink: 0, overflowX: "auto", background: "var(--bg)" }}>
      {TABS.map(tab => (
        <button key={tab} onClick={() => handleTab(tab)} style={{
          flexShrink: 0, padding: isMobile ? "10px 12px" : "10px 18px",
          fontSize: isMobile ? 12 : 13, fontWeight: 500,
          color: activeTab === tab ? "var(--text)" : "var(--text-muted)",
          background: "none", border: "none",
          borderBottom: `2px solid ${activeTab === tab ? "var(--text)" : "transparent"}`,
          cursor: "pointer", whiteSpace: "nowrap",
        }}>
          {tab}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ height: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── Top Bar ── */}
      <div style={{ height: 48, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 16px", gap: 0, flexShrink: 0 }}>
        <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px", marginRight: 20 }}>
          DisasterLink
        </span>
        <span style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 500, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: disasterColor, flexShrink: 0, display: "inline-block" }} />
          {disasterName} — Active Incident
        </span>
        {!isMobile && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 16, fontFamily: "monospace" }}>
            Sync: {lastSync}
          </span>
        )}
        <button onClick={() => navigate("/")} style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 12px", cursor: "pointer", marginRight: 8 }}>
          Home
        </button>
        <button onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)" }}>
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left sidebar — desktop only */}
        {!isMobile && (
          <div style={{ width: 240, borderRight: "1px solid var(--border)", padding: "16px", overflowY: "auto", flexShrink: 0, background: "var(--bg)" }}>
            {disasterSelector}
            {systemStatus}
          </div>
        )}

        {/* Main area: tab bar + content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {tabBar}
          {TABS.map(tab => (
            <div key={tab} style={{ flex: 1, overflow: "hidden", display: activeTab === tab ? "flex" : "none", flexDirection: "column" }}>
              {tabContent[tab]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
