import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Wifi, WifiOff } from "lucide-react";
import ReportPage from "@/pages/ReportPage";
import VolunteerPage from "@/pages/VolunteerPage";
import VolunteerLoginPage from "@/pages/VolunteerLoginPage";
import VolunteerRegisterPage from "@/pages/VolunteerRegisterPage";
import CoordinatorPage from "@/pages/CoordinatorPage";
import LandingPage from "@/pages/LandingPage";
import { getVolunteerSession } from "@/lib/volunteerAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getQueue, dequeueItem } from "@/lib/offlineQueue";
import { supabase } from "@/lib/supabase";

function RequireVolunteerAuth({ children }: { children: React.ReactNode }) {
  const session = getVolunteerSession();
  if (!session) return <Navigate to="/volunteer/login" replace />;
  return <>{children}</>;
}

interface Banner {
  msg: string;
  type: "offline" | "online";
}

export default function App() {
  const { isOnline } = useOnlineStatus();
  const [banner, setBanner] = useState<Banner | null>(
    !navigator.onLine
      ? { msg: "You are offline — requests will be saved and submitted when connection is restored", type: "offline" }
      : null
  );
  const wasOfflineRef = useRef(!navigator.onLine);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setBanner({ msg: "You are offline — requests will be saved and submitted when connection is restored", type: "offline" });
      return;
    }

    const queue = getQueue();
    const hadQueue = queue.length > 0;

    if (!wasOfflineRef.current && !hadQueue) return;

    const initMsg = hadQueue
      ? `Connection restored — submitting ${queue.length} saved request${queue.length > 1 ? "s" : ""}…`
      : "Connection restored — syncing your data";

    setBanner({ msg: initMsg, type: "online" });

    if (hadQueue) {
      (async () => {
        let count = 0;
        for (const item of queue) {
          try {
            const { error } = await supabase.from("help_requests").insert(item.data);
            if (!error) {
              dequeueItem(item.queueId);
              count++;
            }
          } catch {
          }
        }
        const finalMsg = count > 0
          ? `${count} saved request${count > 1 ? "s" : ""} submitted successfully`
          : "Connection restored — syncing your data";
        setBanner({ msg: finalMsg, type: "online" });
        bannerTimerRef.current = setTimeout(() => setBanner(null), 4000);
      })();
    } else {
      bannerTimerRef.current = setTimeout(() => setBanner(null), 3000);
    }
  }, [isOnline]);

  const bannerH = banner ? 36 : 0;

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {banner && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: bannerH,
            zIndex: 10000,
            background: banner.type === "offline" ? "#dc2626" : "#16a34a",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            textAlign: "center",
            padding: "0 16px",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {banner.type === "offline" ? <WifiOff size={13} /> : <Wifi size={13} />}
          {banner.msg}
        </div>
      )}
      <div style={{ paddingTop: bannerH }}>
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
