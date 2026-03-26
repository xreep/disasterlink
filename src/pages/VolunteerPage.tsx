import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation, ArrowLeft, Clock } from "lucide-react";

type Severity = "Critical" | "Urgent" | "Moderate";
type Tab = "Assigned" | "Open";

interface Task {
  id: string;
  needType: string;
  location: string;
  severity: Severity;
  people: number;
  timeAgo: string;
  assigned: boolean;
  completed: boolean;
}

const INITIAL_TASKS: Task[] = [
  { id: "DL-48291", needType: "Rescue", location: "Mahendrughat, Patna", severity: "Critical", people: 8, timeAgo: "2h ago", assigned: true, completed: false },
  { id: "DL-48304", needType: "Medical", location: "Lal Darwaja, Muzaffarpur", severity: "Critical", people: 3, timeAgo: "45m ago", assigned: false, completed: false },
  { id: "DL-48317", needType: "Food", location: "Laheriasarai, Darbhanga", severity: "Urgent", people: 22, timeAgo: "1h ago", assigned: false, completed: false },
  { id: "DL-48329", needType: "Water", location: "Riga, Sitamarhi", severity: "Urgent", people: 15, timeAgo: "3h ago", assigned: true, completed: false },
  { id: "DL-48341", needType: "Shelter", location: "Chhapra, Saran", severity: "Moderate", people: 40, timeAgo: "4h ago", assigned: false, completed: false },
  { id: "DL-48355", needType: "Food", location: "Hajipur, Vaishali", severity: "Urgent", people: 11, timeAgo: "5h ago", assigned: false, completed: false },
  { id: "DL-48368", needType: "Medical", location: "Katra, Muzaffarpur", severity: "Critical", people: 2, timeAgo: "6h ago", assigned: true, completed: false },
  { id: "DL-48382", needType: "Rescue", location: "Bagaha, Pashchim Champaran", severity: "Moderate", people: 6, timeAgo: "7h ago", assigned: false, completed: false },
];

const SEVERITY_COLOR: Record<Severity, string> = {
  Critical: "#dc2626",
  Urgent: "#d97706",
  Moderate: "#16a34a",
};

export default function VolunteerPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Assigned");
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [statusOn, setStatusOn] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 480);

  const completedCount = tasks.filter(t => t.completed).length;

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 768);
      setIsNarrow(window.innerWidth < 480);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleAccept(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, assigned: true } : t));
  }

  function handleComplete(id: string) {
    setTasks(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, completed: true } : t);
      return [
        ...updated.filter(t => !t.completed),
        ...updated.filter(t => t.completed),
      ];
    });
  }

  const displayed = tasks.filter(t => tab === "Assigned" ? t.assigned : !t.assigned);

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
            <button onClick={() => navigate("/")} style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
              <ArrowLeft size={14} /> Home
            </button>
          </div>
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Arjun M.</span>
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
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{completedCount + 7} done</span>
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
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Arjun M.</span>
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
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{completedCount + 7} done</span>
          </div>
          <button onClick={() => navigate("/")} style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
            <ArrowLeft size={14} /> Home
          </button>
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
        Active deployment zone: Bihar Flood Response
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
              {t}
            </button>
          ))}
        </div>

        {/* Task list */}
        {displayed.length === 0 ? (
          <div style={{ textAlign: "center", color: "#525252", fontSize: 14, padding: "48px 16px" }}>
            No tasks in this queue.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: isMobile ? "0" : "0" }}>
            {displayed.map(task => (
              <div
                key={task.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${task.completed ? "var(--border)" : SEVERITY_COLOR[task.severity]}`,
                  borderRadius: isMobile ? 0 : 6,
                  padding: "14px 16px",
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#525252" }}>{task.id}</span>
                  {!task.completed && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: SEVERITY_COLOR[task.severity], textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {task.severity}
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#525252" }}>
                    <Clock size={12} /> {task.timeAgo}
                  </span>
                </div>

                {/* Middle row */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: task.completed ? "#525252" : "var(--text)",
                    textDecoration: task.completed ? "line-through" : "none",
                    marginBottom: 2,
                  }}>
                    {task.needType}
                  </div>
                  <div style={{ fontSize: 13, color: task.completed ? "#525252" : "var(--text-muted)" }}>
                    {task.location}
                  </div>
                </div>

                {/* Bottom row */}
                <div style={{ display: "flex", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 8 : 0 }}>
                  <span style={{ fontSize: 12, color: "#525252" }}>{task.people} people</span>
                  <div style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
                    <button
                      onClick={() => window.open(`https://www.google.com/maps/search/${encodeURIComponent(task.location)}`, "_blank")}
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
                    {task.completed ? (
                      <span style={{ fontSize: 12, color: "#525252", padding: "6px 14px", textAlign: "center" }}>Completed</span>
                    ) : (
                      <button
                        onClick={() => task.assigned ? handleComplete(task.id) : handleAccept(task.id)}
                        style={{
                          fontSize: 12, fontWeight: 600,
                          color: "var(--bg)", background: "var(--text)",
                          border: "none", borderRadius: 4,
                          padding: isMobile ? "0 14px" : "6px 14px",
                          height: isMobile ? 40 : "auto",
                          cursor: "pointer",
                        }}
                      >
                        {task.assigned ? "Complete" : "Accept"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
