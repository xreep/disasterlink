import { useEffect, useRef, useState, type CSSProperties } from "react";

interface Props {
  onFired: () => void;
  onCancelled: () => void;
}

function createAudioContext(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

function playTick(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(1100, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  } catch { /* ignore */ }
}

function playAlarm(ctx: AudioContext) {
  try {
    const totalDuration = 2.0;
    const pulseInterval = 0.25;
    const pulses = Math.ceil(totalDuration / pulseInterval);
    for (let i = 0; i < pulses; i++) {
      const t = ctx.currentTime + i * pulseInterval;
      const freq = i % 2 === 0 ? 880 : 1200;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + pulseInterval - 0.02);
      osc.start(t);
      osc.stop(t + pulseInterval);
    }
  } catch { /* ignore */ }
}

export function SOSCountdown({ onFired, onCancelled }: Props) {
  const [count, setCount] = useState(10);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const firedRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    audioCtxRef.current = createAudioContext();
    if (audioCtxRef.current) playTick(audioCtxRef.current);

    const interval = setInterval(() => {
      setCount((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(interval);
          if (!firedRef.current && !cancelledRef.current) {
            firedRef.current = true;
            if (audioCtxRef.current) playAlarm(audioCtxRef.current);
            setTimeout(() => {
              if (!cancelledRef.current) onFired();
            }, 600);
          }
          return 0;
        }
        if (audioCtxRef.current && !cancelledRef.current) {
          playTick(audioCtxRef.current);
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  function handleCancel() {
    cancelledRef.current = true;
    try {
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    } catch { /* ignore */ }
    onCancelled();
  }

  const ringStyle = (delay: string, _scale: string): CSSProperties => ({
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "2px solid #dc2626",
    animation: `ring-expand 1.8s ease-out ${delay} infinite`,
    transformOrigin: "center",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        background: "rgba(10, 0, 0, 0.94)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        backdropFilter: "blur(4px)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "#ff6b6b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 32 }}>
        ⚠ Emergency Alert Sending
      </div>

      <div style={{ position: "relative", width: 180, height: 180, marginBottom: 36 }}>
        <div style={ringStyle("0s", "2.2")} />
        <div style={ringStyle("0.6s", "2.2")} />
        <div style={ringStyle("1.2s", "2.2")} />

        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle, #991b1b 0%, #dc2626 60%, #b91c1c 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "countdown-glow 1s ease-in-out infinite",
          }}
        >
          <span
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "monospace",
              lineHeight: 1,
              textShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}
          >
            {count}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 8, textAlign: "center" }}>
        Sending SOS in {count} second{count !== 1 ? "s" : ""}…
      </div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 48, textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
        Stay still — your GPS coordinates will be captured and sent to emergency coordinators.
      </div>

      <button
        onClick={handleCancel}
        style={{
          width: 300,
          height: 58,
          borderRadius: 8,
          background: "#ffffff",
          color: "#0a0a0a",
          fontSize: 15,
          fontWeight: 700,
          border: "none",
          cursor: "pointer",
          letterSpacing: "0.01em",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = "0.85"; }}
        onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = "1"; }}
      >
        ✕ Cancel — I tapped by mistake
      </button>
    </div>
  );
}
