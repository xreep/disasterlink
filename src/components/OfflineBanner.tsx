import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";

interface Props {
  isOnline: boolean;
  restoredAt: number | null;
}

export function OfflineBanner({ isOnline, restoredAt }: Props) {
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (!restoredAt) return;
    setShowRestored(true);
    const t = setTimeout(() => setShowRestored(false), 3000);
    return () => clearTimeout(t);
  }, [restoredAt]);

  if (isOnline && !showRestored) return null;

  const offline = !isOnline;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: offline ? "#dc2626" : "#16a34a",
        color: "#ffffff",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {offline ? <WifiOff size={14} /> : <Wifi size={14} />}
      {offline
        ? "You are offline — requests will be saved and submitted when connection is restored"
        : "Connection restored — syncing your data"}
    </div>
  );
}
