export const PROFILE_KEY = "disasterlink_emergency_profile";
export const PROFILE_SETUP_DONE_KEY = "disasterlink_profile_setup_done";

export interface EmergencyProfile {
  name: string;
  phone: string;
  contactName: string;
  contactPhone: string;
}

export function getProfile(): EmergencyProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as EmergencyProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: EmergencyProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  localStorage.setItem(PROFILE_SETUP_DONE_KEY, "1");
}

export function isSetupDone(): boolean {
  return !!localStorage.getItem(PROFILE_SETUP_DONE_KEY);
}

export function markSetupDone(): void {
  localStorage.setItem(PROFILE_SETUP_DONE_KEY, "1");
}

export function parseDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone User";
  if (/iPad/.test(ua)) return "iPad User";
  if (/Android/.test(ua)) return "Android User";
  if (/Windows/.test(ua)) return "Windows User";
  if (/Mac/.test(ua)) return "Mac User";
  if (/Linux/.test(ua)) return "Linux User";
  return "";
}

export function shortUserAgent(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) {
    const os = /OS ([\d_]+)/.exec(ua);
    return `iPhone / iOS ${os ? os[1].replace(/_/g, ".") : ""}`;
  }
  if (/iPad/.test(ua)) return "iPad / iOS";
  if (/Android/.test(ua)) {
    const ver = /Android ([\d.]+)/.exec(ua);
    const browser = /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : "Browser";
    return `Android ${ver ? ver[1] : ""} / ${browser}`;
  }
  if (/Windows/.test(ua)) {
    const browser = /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Edge/.test(ua) ? "Edge" : "Browser";
    return `Windows / ${browser}`;
  }
  if (/Mac/.test(ua)) {
    const browser = /Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Browser";
    return `Mac / ${browser}`;
  }
  return ua.slice(0, 60);
}
