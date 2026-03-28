import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation, ArrowLeft, Clock, Sun, Moon, LogOut, WifiOff } from "lucide-react";
import { useDisaster } from "../DisasterContext";
import { useTheme } from "../ThemeContext";
import { supabase, type HelpRequest } from "../lib/supabase";
import { getVolunteerSession, clearVolunteerSession } from "../lib/volunteerAuth";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

const VOLUNTEER_CACHE_KEY = "disasterlink_volunteer_requests";

interface VolunteerCache {
  requests: HelpRequest[];
  cachedAt: number;
}

function saveCache(requests: HelpRequest[]) {
  const cache: VolunteerCache = { requests, cachedAt: Date.now() };
  localStorage.setItem(VOLUNTEER_CACHE_KEY, JSON.stringify(cache));
}

function loadCache(): VolunteerCache | null {
  try {
    const raw = localStorage.getItem(VOLUNTEER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VolunteerCache;
  } catch {
    return null;
  }
}

function formatCacheTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type Severity = "Critical" | "Urgent" | "Moderate";
type Tab = "Assigned" | "Open";

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "#dc2626",
  Urgent: "#d97706",
  Moderate: "#16a34a",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function VolunteerPage() {
  const navigate = useNavigate();
  const { disasterName } = useDisaster();
  const { theme, toggleTheme } = useTheme();
  const { isOnline } = useOnlineStatus();
  const session = getVolunteerSession();
  const [tab, setTab] = useState<Tab>("Assigned");
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusOn, setStatusOn] = useState(true);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 480);

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768);
      setIsNarrow(window.innerWidth < 480);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      const cache = loadCache();
      if (cache) {
        setRequests(cache.requests);
        setCachedAt(cache.cachedAt);
      }
      setLoading(false);
      return;
    }
    setLoading(true);
    setCachedAt(null);
    supabase
      .from("help_requests")
      .select("*")
      .in("status", ["Pending", "Assigned", "In Progress"])
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          const rows = data as HelpRequest[];
          setRequests(rows);
          saveCache(rows);
        }
        setLoading(false);
      })
      .catch(() => {
        const cache = loadCache();
        if (cache) { setRequests(cache.requests); setCachedAt(cache.cachedAt); }
        setLoading(false);
      });

    const channel = supabase
      .channel("volunteer-requests")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "help_requests" },
        (payload) => {
          const row = payload.new as HelpRequest;
          if (["Pending", "Assigned", "In Progress"].includes(row.status)) {
            setRequests((prev) => [row, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "help_requests" },
        (payload) => {
          const row = payload.new as HelpRequest;
          setRequests((prev) => {
            if (row.status === "Resolved") {
              return prev.filter((r) => r.id !== row.id);
            }
            const exists = prev.find((r) => r.id === row.id);
            if (exists) return prev.map((r) => (r.id === row.id ? row : r));
            if (["Pending", "Assigned", "In Progress"].includes(row.status)) {
              return [row, ...prev];
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOnline]);

  async function handleAccept(id: string) {
    await supabase
      .from("help_requests")
      .update({ status: "Assigned" })
      .eq("id", id);
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "Assigned" } : r))
    );
  }

  async function handleComplete(id: string) {
    await supabase
      .from("help_requests")
      .update({ status: "Resolved" })
      .eq("id", id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  function handleLogout() {
    clearVolunteerSession();
    navigate("/volunteer/login");
  }

  const assigned = requests.filter((r) => r.status === "Assigned" || r.status === "In Progress");
  const open = requests.filter((r) => r.status === "Pending");
  const displayed = tab === "Assigned" ? assigned : open;

  const themeBtn = (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
    >
      {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  );

  const logoutBtn = (
    <button
      onClick={handleLogout}
      style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
    >
      <LogOut size={12} /> Logout
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Inter', sans-serif", color: "var(--text)" }}>
      {/* Top bar */}
      {isNarrow ? (
        <div style={{
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "0 16px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>
              DisasterLink
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => navigate("/")} style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
                <ArrowLeft size={14} /> Home
              </button>
              {themeBtn}
            </div>
          </div>
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                {session?.name ?? "Volunteer"}
              </span>
              <button
                onClick={() => setStatusOn(s => !s)}
                style={{
                  fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20,
                  border: statusOn ? "none" : "1px solid var(--border)",
                  background: statusOn ? "var(--text)" : "transparent",
                  color: statusOn ? "var(--bg)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {statusOn ? "On Duty" : "Off Duty"}
              </button>
            </div>
            {logoutBtn}
          </div>
        </div>
      ) : (
        <div style={{
          height: 48,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.3px" }}>
            DisasterLink
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
              {session?.name ?? "Volunteer"}
            </span>
            <button
              onClick={() => setStatusOn(s => !s)}
              style={{
                fontSize: 12, fontWeight: 500, padding: "4px 12px", borderRadius: 20,
                border: statusOn ? "none" : "1px solid var(--border)",
                background: statusOn ? "var(--text)" : "transparent",
                color: statusOn ? "var(--bg)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {statusOn ? "On Duty" : "Off Duty"}
            </button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{assigned.length} assigned</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => navigate("/")} style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
              <ArrowLeft size={14} /> Home
            </button>
            {logoutBtn}
            {themeBtn}
          </div>
        </div>
      )}

      {/* Deployment banner */}
      <div style={{
        width: "100%",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        textAlign: "center",
        fontSize: 11,
        color: "#525252",
        padding: "6px 0",
      }}>
        Active deployment zone: {disasterName}
      </div>

      {/* Content */}
      <div style={{ maxWidth: isMobile ? "100%" : 600, margin: "0 auto", padding: isMobile ? "20px 0 48px" : "24px 16px 48px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 16, padding: isMobile ? "0 16px" : "0" }}>
          {(["Assigned", "Open"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 500,
                color: tab === t ? "var(--text)" : "var(--text-muted)",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === t ? "var(--text)" : "transparent"}`,
                marginBottom: -1,
                cursor: "pointer",
              }}
            >
              {t} {t === "Open" ? `(${open.length})` : `(${assigned.length})`}
            </button>
          ))}
        </div>

        {/* Cached data notice */}
        {!isOnline && cachedAt && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", marginBottom: 10,
            background: "#92400e14", border: "1px solid #d97706",
            borderRadius: 6, fontSize: 12, color: "#d97706",
          }}>
            <WifiOff size={12} />
            Cached data — last updated {formatCacheTime(cachedAt)}
          </div>
        )}
        {!isOnline && !cachedAt && !loading && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", marginBottom: 10,
            background: "#92400e14", border: "1px solid #d97706",
            borderRadius: 6, fontSize: 12, color: "#d97706",
          }}>
            <WifiOff size={12} />
            You are offline — no cached data available yet
          </div>
        )}

        {/* Task list */}
        {loading ? (
          <div style={{ textAlign: "center", color: "#525252", fontSize: 14, padding: "48px 16px" }}>
            Loading requests…
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: "center", color: "#525252", fontSize: 14, padding: "48px 16px" }}>
            {tab === "Open" ? "No pending requests right now." : "No assigned tasks."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {displayed.map(req => {
              const sev = req.severity as Severity;
              return (
                <div
                  key={req.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderLeft: `3px solid ${SEVERITY_COLOR[sev] || "#525252"}`,
                    borderRadius: isMobile ? 0 : 6,
                    padding: "14px 16px",
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: "#525252" }}>{req.id}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: SEVERITY_COLOR[sev] || "#525252", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {req.severity}
                    </span>
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#525252" }}>
                      <Clock size={12} /> {timeAgo(req.created_at)}
                    </span>
                  </div>

                  {/* Middle row */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                      {req.need_type}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {req.location_district}, {req.location_state}
                      {req.description ? ` — ${req.description}` : ""}
                    </div>
                  </div>

                  {/* Bottom row */}
                  <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 0 }}>
                    <span style={{ fontSize: 12, color: "#525252" }}>{req.people} {req.people === 1 ? "person" : "people"}</span>
                    <div style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
                      <button
                        onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(`${req.location_district}, ${req.location_state}`)}`, "_blank")}
                        style={{
                          fontSize: 12, fontWeight: 500, color: "var(--text-muted)",
                          background: "none", border: "1px solid var(--border)", borderRadius: 4,
                          padding: isMobile ? "0 12px" : "6px 12px",
                          height: isMobile ? 40 : "auto",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                        }}
                      >
                        <Navigation size={12} /> Directions
                      </button>
                      <button
                        onClick={() => {
                          if (!isOnline) return;
                          if (req.status === "Pending") handleAccept(req.id);
                          else handleComplete(req.id);
                        }}
                        disabled={!isOnline}
                        title={!isOnline ? "Internet required to accept tasks" : undefined}
                        style={{
                          fontSize: 12, fontWeight: 600,
                          color: !isOnline ? "var(--text-muted)" : "var(--bg)",
                          background: !isOnline ? "var(--surface)" : "var(--text)",
                          border: !isOnline ? "1px solid var(--border)" : "none",
                          borderRadius: 4,
                          padding: isMobile ? "0 14px" : "6px 14px",
                          height: isMobile ? 40 : "auto",
                          cursor: !isOnline ? "not-allowed" : "pointer",
                          opacity: !isOnline ? 0.6 : 1,
                        }}
                      >
                        {req.status === "Pending" ? "Accept" : "Complete"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
