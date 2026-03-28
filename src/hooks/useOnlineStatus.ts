import { useState, useEffect } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setRestoredAt(Date.now());
    }
    function handleOffline() {
      setIsOnline(false);
      setRestoredAt(null);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, restoredAt };
}
