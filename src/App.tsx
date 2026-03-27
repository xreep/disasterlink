import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ReportPage from "@/pages/ReportPage";
import VolunteerPage from "@/pages/VolunteerPage";
import VolunteerLoginPage from "@/pages/VolunteerLoginPage";
import VolunteerRegisterPage from "@/pages/VolunteerRegisterPage";
import CoordinatorPage from "@/pages/CoordinatorPage";
import LandingPage from "@/pages/LandingPage";
import { getVolunteerSession } from "@/lib/volunteerAuth";

type OfflineStatus = "offline" | "restored" | null;

function RequireVolunteerAuth({ children }: { children: React.ReactNode }) {
  const session = getVolunteerSession();
  if (!session) return <Navigate to="/volunteer/login" replace />;
  return <>{children}</>;
}

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
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/volunteer/login" element={<VolunteerLoginPage />} />
          <Route path="/volunteer/register" element={<VolunteerRegisterPage />} />
          <Route path="/volunteer" element={
            <RequireVolunteerAuth>
              <VolunteerPage />
            </RequireVolunteerAuth>
          } />
          <Route path="/coordinator" element={<CoordinatorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
