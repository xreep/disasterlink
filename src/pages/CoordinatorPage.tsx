import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Waves, Activity, Wind, Mountain, Sun, Factory, Flame, Thermometer, Moon } from "lucide-react";
import { useDisaster, DISASTER_TYPES, DISASTER_CONFIG, type DisasterType } from "../DisasterContext";
import { useTheme } from "../ThemeContext";
import { supabase, type HelpRequest, type Volunteer, type Resource } from "../lib/supabase";

// ─── Icon map ────────────────────────────────────────────────────────────────

const DISASTER_ICONS: Record<DisasterType, React.ComponentType<{ size?: number; color?: string }>> = {
  "Flood": Waves, "Earthquake": Activity, "Cyclone": Wind, "Landslide": Mountain,
  "Drought": Sun, "Industrial Accident": Factory, "Fire": Flame, "Heatwave": Thermometer,
};

// ─── Shared types ─────────────────────────────────────────────────────────────

type EOCTab = "Overview" | "Map" | "Requests" | "Volunteers" | "Resources" | "Analytics";

// ─── Colour maps ──────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "#dc2626", Urgent: "#d97706", Moderate: "#16a34a",
};
const STATUS_COLOR: Record<string, string> = {
  Pending: "#dc2626", Unassigned: "#dc2626", Assigned: "#d97706",
  "In Progress": "#2563eb", Resolved: "#16a34a",
};
const NEED_COLOR: Record<string, string> = {
  "Food & Water": "#2563eb", "Medical Help": "#dc2626", "Shelter": "#7c3aed",
  "Rescue": "#ea580c", "Evacuation": "#d97706", "Other": "#525252",
};
const VOL_STATUS_COLOR: Record<string, string> = {
  Active: "#16a34a", Deployed: "#2563eb", Available: "#d97706", Completed: "#525252",
};
const RESOURCE_CATEGORY_COLOR: Record<string, string> = {
  Nutrition: "#2563eb", Medical: "#dc2626", Rescue: "#ea580c", Shelter: "#7c3aed",
};

// ─── Resolution trend (static analytics skeleton) ─────────────────────────────

const RESOLUTION_TREND = [
  { day: "Mon", pct: 71 }, { day: "Tue", pct: 76 },
  { day: "Wed", pct: 68 }, { day: "Thu", pct: 80 },
  { day: "Fri", pct: 78 }, { day: "Sat", pct: 83 },
  { day: "Sun", pct: 78 },
];

// ─── Feed event type ──────────────────────────────────────────────────────────

interface FeedEvent {
  key: string;
  eventType: "New Request" | "Status Updated" | "Resolved";
  victimName: string;
  needType: string;
  locationDistrict: string;
  locationState: string;
  timestamp: string;
  status: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function displayStatus(status: string): string {
  return status === "Pending" ? "Unassigned" : status;
}

function markerColor(req: HelpRequest): string {
  if (req.status === "Resolved") return "#16a34a";
  return SEVERITY_COLOR[req.severity] || "#525252";
}

function feedColor(status: string): string {
  if (status === "Resolved") return "#16a34a";
  if (status === "Assigned" || status === "In Progress") return "#d97706";
  return "#dc2626";
}

function feedEventType(status: string): FeedEvent["eventType"] {
  if (status === "Resolved") return "Resolved";
  if (status === "Assigned" || status === "In Progress") return "Status Updated";
  return "New Request";
}

function requestToFeedEvent(req: HelpRequest, ts?: string): FeedEvent {
  return {
    key: `${req.id}-${req.status}`,
    eventType: feedEventType(req.status),
    victimName: req.victim_name?.trim() || "Unknown",
    needType: req.need_type,
    locationDistrict: req.location_district,
    locationState: req.location_state,
    timestamp: ts ?? req.created_at,
    status: req.status,
  };
}

function formatFeedTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "--:--";
  }
}

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
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [lastSync, setLastSync] = useState("just now");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [highlightFirst, setHighlightFirst] = useState(false);
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  // ── Resize handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Supabase fetch + real-time subscriptions ─────────────────────────────────
  useEffect(() => {
    Promise.all([
      supabase.from("help_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("volunteers").select("*"),
      supabase.from("resources").select("*"),
    ]).then(([reqRes, volRes, resRes]) => {
      if (reqRes.data) {
        const rows = reqRes.data as HelpRequest[];
        setRequests(rows);
        setFeed(rows.map(r => requestToFeedEvent(r)));
      }
      if (volRes.data) setVolunteers(volRes.data as Volunteer[]);
      if (resRes.data) setResources(resRes.data as Resource[]);
      setLastSync("just now");
    }).catch(() => {});

    const channel = supabase
      .channel("eoc-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "help_requests" }, (payload) => {
        const row = payload.new as HelpRequest;
        setRequests((prev) => [row, ...prev]);
        setFeed((prev) => [requestToFeedEvent(row, new Date().toISOString()), ...prev]);
        setHighlightFirst(true);
        setTimeout(() => setHighlightFirst(false), 3000);
        setLastSync("just now");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "help_requests" }, (payload) => {
        const row = payload.new as HelpRequest;
        setRequests((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        setFeed((prev) => [requestToFeedEvent(row, new Date().toISOString()), ...prev]);
        setHighlightFirst(true);
        setTimeout(() => setHighlightFirst(false), 3000);
        setLastSync("just now");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "volunteers" }, (payload) => {
        setVolunteers((prev) => [payload.new as Volunteer, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "volunteers" }, (payload) => {
        const row = payload.new as Volunteer;
        setVolunteers((prev) => prev.map((v) => (v.id === row.id ? row : v)));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "resources" }, (payload) => {
        const row = payload.new as Resource;
        setResources((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setLastSync("just now"), 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Derived data ────────────────────────────────────────────────────────────

  const activeRequests = useMemo(() => requests.filter(r => r.status !== "Resolved"), [requests]);
  const resolvedRequests = useMemo(() => requests.filter(r => r.status === "Resolved"), [requests]);
  const totalResourcesAvailable = useMemo(() => resources.reduce((s, r) => s + r.available, 0), [resources]);
  const activeVolunteers = useMemo(() => volunteers.filter(v => v.status === "Active" || v.status === "Deployed"), [volunteers]);

  const analyticsNeed = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of requests) { counts[r.need_type] = (counts[r.need_type] || 0) + 1; }
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [requests]);

  const analyticsState = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of requests) { counts[r.location_state] = (counts[r.location_state] || 0) + 1; }
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [requests]);

  const needsBreakdown = useMemo(() => {
    const total = requests.length || 1;
    const counts: Record<string, number> = {};
    for (const r of requests) { counts[r.need_type] = (counts[r.need_type] || 0) + 1; }
    return ["Food & Water", "Medical Help", "Rescue", "Shelter", "Evacuation", "Other"].map(name => ({
      name, pct: Math.round(((counts[name] || 0) / total) * 100),
    }));
  }, [requests]);

  function handleTab(tab: EOCTab) {
    setActiveTab(tab);
    if (tab === "Map") setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
  }

  const filteredMapRequests = useMemo(() =>
    requests.filter(r => r.latitude != null && r.longitude != null).filter(r => {
      if (mapFilter === "All") return true;
      if (mapFilter === "Critical") return r.severity === "Critical";
      if (mapFilter === "Active") return r.status !== "Resolved";
      return true;
    }),
  [requests, mapFilter]);

  const filteredReqList = useMemo(() =>
    requests.filter(r => {
      if (reqFilter === "All") return true;
      if (reqFilter === "Resolved") return r.status === "Resolved";
      if (reqFilter === "Unassigned") return r.status === "Pending";
      if (reqFilter === "Assigned") return r.status === "Assigned" || r.status === "In Progress";
      return true;
    }),
  [requests, reqFilter]);

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
          { label: "Active Requests", value: activeRequests.length, color: "#dc2626" },
          { label: "Volunteers Active", value: activeVolunteers.length, color: "#2563eb" },
          { label: "Resources Available", value: totalResourcesAvailable, color: "#16a34a" },
          { label: "Resolved", value: resolvedRequests.length, color: "#525252" },
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
            {needsBreakdown.map(d => (
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
          {feed.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Waiting for events…</div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {feed.slice(0, 10).map((event, i) => {
                const time = formatFeedTime(event.timestamp);
                const msg = `${event.eventType} — ${event.victimName} needs ${event.needType} in ${event.locationDistrict}, ${event.locationState}`;
                return (
                  <div key={event.key} className={i === 0 && highlightFirst ? "feed-item feed-new" : "feed-item"}
                    style={{ display: "flex", gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", flexShrink: 0, paddingTop: 1 }}>{time}</span>
                    <span style={{ fontSize: 12, color: feedColor(event.status), lineHeight: 1.5 }}>{msg}</span>
                  </div>
                );
              })}
            </div>
          )}
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
          {filteredMapRequests.length} request pins · {activeVolunteers.length} volunteer pins
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
          {filteredMapRequests.map(r => (
            <CircleMarker key={r.id} center={[r.latitude!, r.longitude!]}
              radius={r.severity === "Critical" ? 10 : 7}
              pathOptions={{ color: markerColor(r), fillColor: markerColor(r), fillOpacity: 0.85, weight: 1.5 }}
            >
              <Popup>
                <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 180 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0a0a0a", marginBottom: 8 }}>{r.id}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
                    <span style={{ color: "#6b7280" }}>Need</span><span style={{ fontWeight: 500 }}>{r.need_type}</span>
                    <span style={{ color: "#6b7280" }}>Location</span><span style={{ fontWeight: 500 }}>{r.location_district}, {r.location_state}</span>
                    <span style={{ color: "#6b7280" }}>People</span><span style={{ fontWeight: 500 }}>{r.people}</span>
                    <span style={{ color: "#6b7280" }}>Status</span><span style={{ fontWeight: 500, color: STATUS_COLOR[r.status] }}>{displayStatus(r.status)}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {/* Volunteer pins (blue) - shown when volunteer has a request with coordinates */}
          {activeVolunteers.map(v => {
            if (!v.task_id) return null;
            const req = requests.find(r => r.id === v.task_id);
            if (!req?.latitude || !req?.longitude) return null;
            return (
              <CircleMarker key={v.id} center={[req.latitude + 0.05, req.longitude + 0.05]}
                radius={5}
                pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.9, weight: 1.5 }}
              >
                <Popup>
                  <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 160 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0a0a0a", marginBottom: 6 }}>{v.id}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>Name</span><span style={{ fontWeight: 500 }}>{v.name}</span>
                      <span style={{ color: "#6b7280" }}>Skill</span><span style={{ fontWeight: 500 }}>{v.skill}</span>
                      <span style={{ color: "#6b7280" }}>Task</span><span style={{ fontWeight: 500, color: "#2563eb" }}>{v.task_id}</span>
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
        {filteredReqList.length === 0 ? (
          <div style={{ textAlign: "center", color: "#525252", fontSize: 13, padding: "48px 16px" }}>
            No requests found.
          </div>
        ) : filteredReqList.map(r => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr 1fr" : "90px 1fr 120px 60px 100px 80px", gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{r.id}</span>
            {isMobile ? (
              <>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{r.need_type}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.location_district}, {r.location_state}</div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{r.location_district}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.location_state}</div>
                </div>
                <Badge label={r.need_type} color={NEED_COLOR[r.need_type] || "#525252"} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", fontFamily: "monospace" }}>{r.people}</span>
                <Badge label={r.severity} color={SEVERITY_COLOR[r.severity] || "#525252"} />
              </>
            )}
            <Badge label={displayStatus(r.status)} color={STATUS_COLOR[r.status] || "#525252"} />
          </div>
        ))}
      </div>
    </div>
  );

  const volunteersContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 44, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{volunteers.length} registered volunteers</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>·</span>
        <span style={{ fontSize: 12, color: "#16a34a" }}>{activeVolunteers.length} active</span>
        <span style={{ fontSize: 12, color: "#d97706" }}>{volunteers.filter(v => v.status === "Available").length} available</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 140px 80px 100px 100px", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          {(isMobile ? ["Volunteer", "Status"] : ["Volunteer", "Location", "Skill", "Status", "Assigned Task"]).map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>
        {volunteers.length === 0 ? (
          <div style={{ textAlign: "center", color: "#525252", fontSize: 13, padding: "48px 16px" }}>
            No volunteers registered yet.
          </div>
        ) : volunteers.map(v => (
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
            <Badge label={v.status} color={VOL_STATUS_COLOR[v.status] || "#525252"} />
            {!isMobile && (
              <span style={{ fontFamily: "monospace", fontSize: 12, color: v.task_id ? "#2563eb" : "var(--text-muted)" }}>{v.task_id ?? "—"}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const resourcesContent = (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      {resources.length === 0 ? (
        <div style={{ textAlign: "center", color: "#525252", fontSize: 13, padding: "48px 0" }}>No resources loaded.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          {resources.map(r => {
            const pct = r.total > 0 ? Math.round((r.available / r.total) * 100) : 0;
            const color = RESOURCE_CATEGORY_COLOR[r.category] || "#525252";
            return (
              <div key={r.id} style={{ padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)" }}>
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
      )}
    </div>
  );

  const analyticsContent = (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Requests by need type */}
        <div style={{ marginBottom: isMobile ? 28 : 0 }}>
          <div style={sectionLabel}>Requests by Need Type</div>
          {analyticsNeed.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No data yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {analyticsNeed.map(d => {
                const max = Math.max(...analyticsNeed.map(x => x.count), 1);
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
          )}
        </div>

        {/* Requests by state */}
        <div style={{ marginBottom: isMobile ? 28 : 0 }}>
          <div style={sectionLabel}>Requests by State</div>
          {analyticsState.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No data yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {analyticsState.map(d => {
                const max = Math.max(...analyticsState.map(x => x.count), 1);
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
          )}
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
            { label: "Total Requests", value: requests.length },
            { label: "Pending / Unassigned", value: requests.filter(r => r.status === "Pending").length },
            { label: "Assigned / In Progress", value: requests.filter(r => r.status === "Assigned" || r.status === "In Progress").length },
            { label: "Resolved", value: resolvedRequests.length },
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
