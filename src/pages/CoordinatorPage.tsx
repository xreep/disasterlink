import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Waves, Activity, Wind, Mountain, Sun, Factory, Flame, Thermometer, Moon, Lock, Shield, LogOut, Plus, Minus, WifiOff } from "lucide-react";
import { useDisaster, DISASTER_TYPES, DISASTER_CONFIG, type DisasterType } from "../DisasterContext";
import { useTheme } from "../ThemeContext";
import { supabase, type HelpRequest, type Volunteer, type Resource } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

// ─── Coordinator cache ────────────────────────────────────────────────────────

const COORD_CACHE_KEY = "disasterlink_coordinator_cache";

interface CoordCache {
  requests: HelpRequest[];
  volunteers: Volunteer[];
  resources: Resource[];
  cachedAt: number;
}

function saveCoordCache(data: Omit<CoordCache, "cachedAt">) {
  localStorage.setItem(COORD_CACHE_KEY, JSON.stringify({ ...data, cachedAt: Date.now() }));
}

function loadCoordCache(): CoordCache | null {
  try {
    const raw = localStorage.getItem(COORD_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CoordCache) : null;
  } catch { return null; }
}

function formatCacheTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
  "SOS - Emergency": "#ff0000",
};
const VOL_STATUS_COLOR: Record<string, string> = {
  Active: "#16a34a", Deployed: "#2563eb", Available: "#d97706", Completed: "#525252",
};
const RESOURCE_CATEGORIES = ["Food & Water", "Medical Supplies", "Rescue Equipment", "Shelter", "Vehicles"] as const;
type ResourceCategory = typeof RESOURCE_CATEGORIES[number];

const RESOURCE_CATEGORY_COLOR: Record<string, string> = {
  "Food & Water": "#2563eb",
  "Medical Supplies": "#dc2626",
  "Rescue Equipment": "#ea580c",
  "Shelter": "#7c3aed",
  "Vehicles": "#0891b2",
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

function isSOSRequest(req: HelpRequest): boolean {
  return req.need_type === "SOS - Emergency";
}

function markerColor(req: HelpRequest): string {
  if (isSOSRequest(req) && req.status !== "Resolved") return "#ff0000";
  if (req.status === "Resolved") return "#16a34a";
  if (req.status === "Assigned" || req.status === "In Progress") return "#d97706";
  return "#dc2626";
}

function markerRadius(req: HelpRequest): number {
  if (isSOSRequest(req) && req.status !== "Resolved") return 14;
  if (req.severity === "Critical") return 10;
  return 7;
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

// ─── Coordinator Login Modal ───────────────────────────────────────────────────

function CoordinatorLoginModal({
  onClose,
  onLogin,
}: {
  onClose: () => void;
  onLogin: (user: User) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError(null);

    console.log("[CoordinatorAuth] Attempting login for:", email.trim());

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    console.log("[CoordinatorAuth] Result:", {
      user: data?.user?.email ?? null,
      errorCode: authError?.code ?? null,
      errorMessage: authError?.message ?? null,
      errorStatus: authError?.status ?? null,
    });

    if (authError) {
      let msg = authError.message || "Authentication failed.";
      if (authError.message?.toLowerCase().includes("email not confirmed")) {
        msg = "Email not confirmed. Please check your inbox and confirm the account before logging in.";
      } else if (authError.message?.toLowerCase().includes("invalid login")) {
        msg = "Invalid email or password. Check credentials and try again.";
      } else if (authError.status === 400) {
        msg = `Login failed: ${authError.message}`;
      }
      setError(msg);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Login succeeded but no user was returned. Check Supabase Auth settings.");
      setLoading(false);
      return;
    }

    console.log("[CoordinatorAuth] Logged in as:", data.user.email);
    onLogin(data.user);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, background: "var(--bg)",
    border: "1px solid var(--border)", borderRadius: 5,
    padding: "0 12px", fontSize: 13, color: "var(--text)",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
        padding: 28, width: "100%", maxWidth: 360,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Shield size={16} color="#2563eb" />
          <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
            Coordinator Login
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          Sign in with your EOC coordinator credentials to enable management actions.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
            <input type="email" placeholder="coordinator@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
            <input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          </div>
          {error && (
            <div style={{ fontSize: 12, color: "#dc2626", background: "#dc262610", border: "1px solid #dc262630", borderRadius: 4, padding: "10px 12px", lineHeight: 1.5 }}>
              {error}
              {error.includes("not confirmed") && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#dc2626", borderTop: "1px solid #dc262630", paddingTop: 8 }}>
                  Fix: Go to Supabase Dashboard → Authentication → Users → find your account → "Send confirmation email", or disable "Enable email confirmations" in Authentication → Settings.
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 38, background: "none", border: "1px solid var(--border)", borderRadius: 5, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ flex: 1, height: 38, background: "#2563eb", border: "none", borderRadius: 5, fontSize: 13, fontWeight: 600, color: "#fff", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Signing in…" : "Login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Resource Modal ───────────────────────────────────────────────────────

function AddResourceModal({ onClose, onAdded }: { onClose: () => void; onAdded: (r: Resource) => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(RESOURCE_CATEGORIES[0]);
  const [location, setLocation] = useState("");
  const [total, setTotal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(total, 10);
    if (!name.trim()) { setError("Resource name is required."); return; }
    if (!location.trim()) { setError("Location is required."); return; }
    if (!qty || qty < 1) { setError("Total quantity must be at least 1."); return; }
    setLoading(true);
    setError(null);
    const { data, error: dbErr } = await supabase
      .from("resources")
      .insert({ name: name.trim(), category, location: location.trim(), total: qty, available: qty, deployed: 0 })
      .select()
      .single();
    if (dbErr || !data) {
      setError(dbErr?.message ?? "Failed to add resource.");
      setLoading(false);
      return;
    }
    onAdded(data as Resource);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 40, background: "var(--bg)",
    border: "1px solid var(--border)", borderRadius: 5,
    padding: "0 12px", fontSize: 13, color: "var(--text)",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
    display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 28, width: "100%", maxWidth: 400 }}>
        <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Add Resource</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Add a new resource to track and deploy in the field.</p>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Resource Name</label>
            <input type="text" placeholder="e.g. Life Jackets" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, padding: "0 8px" }}>
              {RESOURCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Location / Storage Base</label>
            <input type="text" placeholder="e.g. SDRF Camp, Patna" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Total Quantity</label>
            <input type="number" placeholder="e.g. 100" min="1" value={total} onChange={(e) => setTotal(e.target.value)} style={inputStyle} />
          </div>
          {error && (
            <div style={{ fontSize: 12, color: "#dc2626", background: "#dc262610", border: "1px solid #dc262630", borderRadius: 4, padding: "8px 10px" }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, height: 38, background: "none", border: "1px solid var(--border)", borderRadius: 5, fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ flex: 1, height: 38, background: "var(--text)", border: "none", borderRadius: 5, fontSize: 13, fontWeight: 600, color: "var(--bg)", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Adding…" : "Add Resource"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoordinatorPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isOnline } = useOnlineStatus();
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
  const [coordCachedAt, setCoordCachedAt] = useState<number | null>(null);

  // ── Coordinator auth state ────────────────────────────────────────────────
  const [coordinator, setCoordinator] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCoordinator(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCoordinator(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleCoordinatorLogout() {
    await supabase.auth.signOut();
    setCoordinator(null);
  }

  // ── Action handlers (coordinator only) ──────────────────────────────────
  async function handleResolveRequest(id: string) {
    await supabase.from("help_requests").update({ status: "Resolved" }).eq("id", id);
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "Resolved" } : r));
  }

  async function handleReleaseVolunteer(id: string) {
    await supabase.from("volunteers").update({ status: "Available", task_id: null }).eq("id", id);
    setVolunteers((prev) => prev.map((v) => v.id === id ? { ...v, status: "Available", task_id: null } : v));
  }

  async function handleUpdateResource(id: number, delta: number) {
    const resource = resources.find((r) => r.id === id);
    if (!resource) return;
    const newDeployed = Math.max(0, Math.min(resource.total, resource.deployed + delta));
    const newAvailable = resource.total - newDeployed;
    await supabase.from("resources").update({ deployed: newDeployed, available: newAvailable }).eq("id", id);
    setResources((prev) => prev.map((r) => r.id === id ? { ...r, deployed: newDeployed, available: newAvailable } : r));
  }

  // ── Resize handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Supabase fetch + real-time subscriptions ─────────────────────────────────
  useEffect(() => {
    if (!isOnline) {
      const cache = loadCoordCache();
      if (cache) {
        setRequests(cache.requests);
        setVolunteers(cache.volunteers);
        setResources(cache.resources);
        setFeed(cache.requests.map(r => requestToFeedEvent(r)));
        setCoordCachedAt(cache.cachedAt);
        setLastSync(formatCacheTime(cache.cachedAt));
      }
      return;
    }
    setCoordCachedAt(null);
    Promise.all([
      supabase.from("help_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("volunteers").select("*"),
      supabase.from("resources").select("*"),
    ]).then(([reqRes, volRes, resRes]) => {
      const reqs = (reqRes.data ?? []) as HelpRequest[];
      const vols = (volRes.data ?? []) as Volunteer[];
      const ress = (resRes.data ?? []) as Resource[];
      setRequests(reqs);
      setFeed(reqs.map(r => requestToFeedEvent(r)));
      setVolunteers(vols);
      setResources(ress);
      saveCoordCache({ requests: reqs, volunteers: vols, resources: ress });
      setLastSync("just now");
    }).catch(() => {
      const cache = loadCoordCache();
      if (cache) {
        setRequests(cache.requests);
        setVolunteers(cache.volunteers);
        setResources(cache.resources);
        setFeed(cache.requests.map(r => requestToFeedEvent(r)));
        setCoordCachedAt(cache.cachedAt);
        setLastSync(formatCacheTime(cache.cachedAt));
      }
    });

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "resources" }, (payload) => {
        setResources((prev) => [...prev, payload.new as Resource]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "resources" }, (payload) => {
        const row = payload.new as Resource;
        setResources((prev) => prev.map((r) => (r.id === row.id ? row : r)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "resources" }, (payload) => {
        setResources((prev) => prev.filter((r) => r.id !== (payload.old as Resource).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOnline]);

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

  const groupedResources = useMemo(() => {
    const groups = new Map<string, Resource[]>();
    for (const cat of RESOURCE_CATEGORIES) groups.set(cat, []);
    for (const r of resources) {
      const key = RESOURCE_CATEGORIES.includes(r.category as ResourceCategory) ? r.category : "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries())
      .filter(([, items]) => items.length > 0)
      .map(([cat, items]) => ({ cat, items }));
  }, [resources]);

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

  // ── Disaster type selector ────────────────────────────────────────────────

  const disasterSelector = (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ ...sectionLabel, marginBottom: 0 }}>Active Disaster Type</span>
        {!coordinator && <Lock size={10} color="var(--text-muted)" />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {DISASTER_TYPES.map((type: DisasterType) => {
          const Icon = DISASTER_ICONS[type];
          const meta = DISASTER_CONFIG[type];
          const isActive = disasterType === type;
          return (
            <button
              key={type}
              onClick={() => coordinator ? setDisasterType(type) : setShowLoginModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "7px 9px", borderRadius: 5,
                cursor: coordinator ? "pointer" : "pointer",
                border: `1px solid ${isActive ? meta.color : "transparent"}`,
                background: isActive ? `${meta.color}22` : "transparent",
                textAlign: "left", width: "100%",
                opacity: coordinator ? 1 : 0.6,
              }}
            >
              <Icon size={13} color={isActive ? meta.color : "#525252"} />
              <div>
                <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? meta.color : "var(--text-muted)", lineHeight: 1.2 }}>{type}</div>
                <div style={{ fontSize: 10, color: "#525252", lineHeight: 1.3, marginTop: 1 }}>{meta.description}</div>
              </div>
            </button>
          );
        })}
      </div>
      {!coordinator && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <Lock size={9} /> Coordinator login required to change
        </div>
      )}
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
        {[{ label: "Pending", color: "#dc2626" }, { label: "Assigned", color: "#d97706" }, { label: "Resolved", color: "#16a34a" }, { label: "Volunteer", color: "#3b82f6" }].map(l => (
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
              radius={markerRadius(r)}
              pathOptions={{ color: markerColor(r), fillColor: markerColor(r), fillOpacity: isSOSRequest(r) ? 1 : 0.85, weight: isSOSRequest(r) ? 3 : 1.5 }}
            >
              <Popup>
                <div style={{ fontFamily: "'Inter', sans-serif", minWidth: 190 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#0a0a0a", marginBottom: 8 }}>{r.id}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
                    {r.victim_name && <><span style={{ color: "#6b7280" }}>Name</span><span style={{ fontWeight: 500 }}>{r.victim_name}</span></>}
                    <span style={{ color: "#6b7280" }}>Need</span><span style={{ fontWeight: 500 }}>{r.need_type}</span>
                    <span style={{ color: "#6b7280" }}>District</span><span style={{ fontWeight: 500 }}>{r.location_district}</span>
                    <span style={{ color: "#6b7280" }}>State</span><span style={{ fontWeight: 500 }}>{r.location_state}</span>
                    <span style={{ color: "#6b7280" }}>Status</span><span style={{ fontWeight: 500, color: STATUS_COLOR[r.status] }}>{displayStatus(r.status)}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
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

  const reqCols = coordinator
    ? (isMobile ? "1fr 1fr 1fr" : "90px 1fr 120px 60px 100px 80px 80px")
    : (isMobile ? "1fr 1fr 1fr" : "90px 1fr 120px 60px 100px 80px");
  const reqHeaders = coordinator
    ? (isMobile ? ["ID", "Need / Location", "Status"] : ["ID", "Location", "Need Type", "People", "Severity", "Status", "Action"])
    : (isMobile ? ["ID", "Need / Location", "Status"] : ["ID", "Location", "Need Type", "People", "Severity", "Status"]);

  const requestsContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: reqCols, gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          {reqHeaders.map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>
        {filteredReqList.length === 0 ? (
          <div style={{ textAlign: "center", color: "#525252", fontSize: 13, padding: "48px 16px" }}>
            No requests found.
          </div>
        ) : filteredReqList.map(r => (
          <div key={r.id} style={{ display: "grid", gridTemplateColumns: reqCols, gap: 8, padding: "12px 16px", borderBottom: `1px solid ${isSOSRequest(r) && r.status !== "Resolved" ? "#ff000030" : "var(--border)"}`, alignItems: "center", background: isSOSRequest(r) && r.status !== "Resolved" ? "#ff000008" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text)", fontWeight: 600 }}>{r.id}</span>
              {isSOSRequest(r) && <Badge label="SOS" color="#ff0000" />}
            </div>
            {isMobile ? (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{r.need_type}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.location_district}, {r.location_state}</div>
              </div>
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
            {coordinator && !isMobile && (
              r.status !== "Resolved" ? (
                <button
                  onClick={() => handleResolveRequest(r.id)}
                  style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 4, background: "#16a34a18", border: "1px solid #16a34a", color: "#16a34a", cursor: "pointer" }}
                >
                  Resolve
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const volCols = coordinator
    ? (isMobile ? "1fr 1fr" : "1fr 140px 80px 100px 100px 80px")
    : (isMobile ? "1fr 1fr" : "1fr 140px 80px 100px 100px");
  const volHeaders = coordinator
    ? (isMobile ? ["Volunteer", "Status"] : ["Volunteer", "Location", "Skill", "Status", "Assigned Task", "Action"])
    : (isMobile ? ["Volunteer", "Status"] : ["Volunteer", "Location", "Skill", "Status", "Assigned Task"]);

  const volunteersContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: 44, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{volunteers.length} registered volunteers</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>·</span>
        <span style={{ fontSize: 12, color: "#16a34a" }}>{activeVolunteers.length} active</span>
        <span style={{ fontSize: 12, color: "#d97706" }}>{volunteers.filter(v => v.status === "Available").length} available</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: volCols, gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
          {volHeaders.map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>
        {volunteers.length === 0 ? (
          <div style={{ textAlign: "center", color: "#525252", fontSize: 13, padding: "48px 16px" }}>
            No volunteers registered yet.
          </div>
        ) : volunteers.map(v => (
          <div key={v.id} style={{ display: "grid", gridTemplateColumns: volCols, gap: 8, padding: "12px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
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
            {coordinator && !isMobile && (
              v.task_id ? (
                <button
                  onClick={() => handleReleaseVolunteer(v.id)}
                  style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 4, background: "#d9770618", border: "1px solid #d97706", color: "#d97706", cursor: "pointer" }}
                >
                  Release
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );

  function resourceStatus(r: Resource): { label: string; color: string } {
    if (r.available === 0) return { label: "Depleted", color: "#dc2626" };
    if (r.total > 0 && r.available / r.total < 0.2) return { label: "Low", color: "#d97706" };
    return { label: "Available", color: "#16a34a" };
  }

  const resourcesContent = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ height: 52, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {resources.length} resource{resources.length !== 1 ? "s" : ""} tracked
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>·</span>
        <span style={{ fontSize: 12, color: "#16a34a" }}>{resources.reduce((s, r) => s + r.available, 0)} total available</span>
        <span style={{ fontSize: 12, color: "#d97706" }}>{resources.reduce((s, r) => s + r.deployed, 0)} deployed</span>
        {!coordinator && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
            <Lock size={10} /> Login to manage
          </span>
        )}
        {coordinator && (
          <button
            onClick={() => setShowAddResourceModal(true)}
            style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 5, background: "var(--text)", border: "none", color: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            <Plus size={13} /> Add Resource
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {resources.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 24px" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>No resources added yet</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 320, margin: "0 auto", lineHeight: 1.6 }}>
              Add resources to track their availability and deployment in the field.
              {coordinator && (
                <span> Click <strong>Add Resource</strong> above to get started.</span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {groupedResources.map(({ cat, items }) => {
              const catColor = RESOURCE_CATEGORY_COLOR[cat] || "#525252";
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 3, height: 16, borderRadius: 2, background: catColor, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{cat}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({items.length})</span>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  </div>

                  {/* Resource cards grid */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                    {items.map(r => {
                      const pct = r.total > 0 ? Math.round((r.available / r.total) * 100) : 0;
                      const status = resourceStatus(r);
                      const barColor = pct === 0 ? "#dc2626" : pct < 20 ? "#d97706" : catColor;
                      return (
                        <div key={r.id} style={{
                          padding: "14px 16px",
                          border: "1px solid var(--border)",
                          borderLeft: `3px solid ${catColor}`,
                          borderRadius: 6,
                          background: "var(--surface)",
                        }}>
                          {/* Name + status */}
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>{r.name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{r.location}</div>
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 3, flexShrink: 0,
                              border: `1px solid ${status.color}`, color: status.color, background: `${status.color}18`,
                            }}>
                              {status.label}
                            </span>
                          </div>

                          {/* Quantities row */}
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontFamily: "monospace", lineHeight: 1 }}>{r.available}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Available</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 600, color: "#d97706", fontFamily: "monospace", lineHeight: 1 }}>{r.deployed}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Deployed</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text-muted)", fontFamily: "monospace", lineHeight: 1 }}>{r.total}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Total</div>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 2, transition: "width 0.3s ease" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{pct}% available</span>

                            {/* Deploy controls (coordinator only) */}
                            {coordinator && (
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <button
                                  onClick={() => handleUpdateResource(r.id, -1)}
                                  disabled={r.deployed <= 0}
                                  title="Mark one returned"
                                  style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: r.deployed <= 0 ? "not-allowed" : "pointer", color: "var(--text-muted)", opacity: r.deployed <= 0 ? 0.35 : 1 }}
                                >
                                  <Minus size={11} />
                                </button>
                                <span style={{ fontSize: 10, color: "var(--text-muted)", padding: "0 2px" }}>Deploy</span>
                                <button
                                  onClick={() => handleUpdateResource(r.id, 1)}
                                  disabled={r.available <= 0}
                                  title="Deploy one unit"
                                  style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: r.available <= 0 ? "not-allowed" : "pointer", color: "var(--text-muted)", opacity: r.available <= 0 ? 0.35 : 1 }}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const analyticsContent = (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
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
        <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px", marginRight: 16 }}>
          DisasterLink
        </span>
        <span style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 500, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: disasterColor, flexShrink: 0, display: "inline-block" }} />
          {disasterName} — Active Incident
        </span>
        {!isMobile && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 12, fontFamily: "monospace" }}>
            Sync: {lastSync}
          </span>
        )}

        {coordinator ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 3, background: "#2563eb18", border: "1px solid #2563eb", color: "#2563eb", display: "flex", alignItems: "center", gap: 4 }}>
              <Shield size={10} /> {isMobile ? "Coord." : "Coordinator Mode"}
            </span>
            <button
              onClick={handleCoordinatorLogout}
              style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
            >
              <LogOut size={12} /> {isMobile ? "" : "Logout"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowLoginModal(true)}
            style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 12px", cursor: "pointer", marginRight: 8, display: "flex", alignItems: "center", gap: 4 }}
          >
            <Shield size={12} /> {isMobile ? "Login" : "Coordinator Login"}
          </button>
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
        {!isMobile && (
          <div style={{ width: 240, borderRight: "1px solid var(--border)", padding: "16px", overflowY: "auto", flexShrink: 0, background: "var(--bg)" }}>
            {disasterSelector}
            {systemStatus}
          </div>
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {tabBar}

          {/* ── Offline notice ── */}
          {!isOnline && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "7px 16px",
              background: "#92400e18",
              borderBottom: "1px solid #d97706",
              fontSize: 12, fontWeight: 500, color: "#d97706",
              flexShrink: 0,
            }}>
              <WifiOff size={12} />
              Offline mode — showing last known data
              {coordCachedAt && <span style={{ opacity: 0.75 }}>· last updated {formatCacheTime(coordCachedAt)}</span>}
            </div>
          )}

          {TABS.map(tab => {
            if (tab === "Map") {
              return activeTab === "Map" ? (
                <div key="Map" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {tabContent["Map"]}
                </div>
              ) : null;
            }
            return (
              <div key={tab} style={{ flex: 1, overflow: "hidden", display: activeTab === tab ? "flex" : "none", flexDirection: "column" }}>
                {tabContent[tab]}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Coordinator Login Modal ── */}
      {showLoginModal && (
        <CoordinatorLoginModal
          onClose={() => setShowLoginModal(false)}
          onLogin={(user) => { setCoordinator(user); setShowLoginModal(false); }}
        />
      )}

      {/* ── Add Resource Modal ── */}
      {showAddResourceModal && (
        <AddResourceModal
          onClose={() => setShowAddResourceModal(false)}
          onAdded={(r) => {
            setResources((prev) => {
              if (prev.find(x => x.id === r.id)) return prev;
              return [...prev, r];
            });
            setShowAddResourceModal(false);
          }}
        />
      )}
    </div>
  );
}
