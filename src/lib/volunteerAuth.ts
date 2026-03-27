const SESSION_KEY = "volunteerSession";

export interface VolunteerSession {
  id: string;
  name: string;
  phone: string;
}

export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getVolunteerSession(): VolunteerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as VolunteerSession) : null;
  } catch {
    return null;
  }
}

export function setVolunteerSession(session: VolunteerSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearVolunteerSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function generateVolunteerId(): string {
  return `VOL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
