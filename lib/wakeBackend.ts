// lib/wakeBackend.ts

const WAKE_INTERVAL = 10 * 60 * 1000; // 10 minutos
const STORAGE_KEY = 'lastBackendWake';

export async function wakeBackend() {
  if (typeof window === 'undefined') return;

  try {
    const lastWake = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();

    if (lastWake && now - Number(lastWake) < WAKE_INTERVAL) {
      return; // No hacer nada si ya despertó recientemente
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) return;

    await fetch(`${backendUrl}/api/health`, {
      method: 'HEAD',
      cache: 'no-store',
    });

    localStorage.setItem(STORAGE_KEY, now.toString());
  } catch {
    // Silencioso: nunca romper la app
  }
}
