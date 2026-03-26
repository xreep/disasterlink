import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeContext";
import ReportPage from "@/pages/ReportPage";
import VolunteerPage from "@/pages/VolunteerPage";
import CoordinatorPage from "@/pages/CoordinatorPage";
import LandingPage from "@/pages/LandingPage";

function ThemeToggle({ offset }: { offset: number }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        width: 40,
        height: 40,
        borderRadius: 6,
        border: isDark ? "1px solid #1f1f1f" : "1px solid #e5e5e5",
        background: isDark ? "#111111" : "#ffffff",
        color: isDark ? "#ffffff" : "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        top: offset > 0 ? `calc(100vh - 64px + ${offset}px)` : undefined,
      }}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

type OfflineStatus = "offline" | "restored" | null;

export default function App() {
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>(null);
  const [restoredText, setRestoredText] = useState("Connection restored — syncing data...");

  useEffect(() => {
    function handleOffline() {
      setOfflineStatus("offline");
      document.documentElement.style.setProperty("--banner-h", "36px");
    }
    function handleOnline() {
      const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
      const text = queue.length > 0
        ? `Connection restored — syncing ${queue.length} pending request${queue.length === 1 ? "" : "s"}...`
        : "Connection restored — syncing data...";
      setRestoredText(text);
      setOfflineStatus("restored");
      setTimeout(() => {
        localStorage.removeItem("offlineQueue");
        setOfflineStatus(null);
        document.documentElement.style.setProperty("--banner-h", "0px");
      }, 3000);
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const bannerVisible = !!offlineStatus;

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {bannerVisible && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          zIndex: 10000,
          background: offlineStatus === "offline" ? "#dc2626" : "#16a34a",
          color: "#ffffff",
          fontSize: 12,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 16px",
        }}>
          {offlineStatus === "offline"
            ? "You are offline — requests will sync automatically when connection restores"
            : restoredText}
        </div>
      )}
      <div style={{ paddingTop: bannerVisible ? 36 : 0 }}>
        <ThemeToggle offset={bannerVisible ? 36 : 0} />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/volunteer" element={<VolunteerPage />} />
          <Route path="/coordinator" element={<CoordinatorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
