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
