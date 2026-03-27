import { toast } from "sonner";

export async function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((res) => {
    navigator.geolocation?.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { timeout: 10000 }
    );
  });
}

export async function vibrate(ms: number) {
  navigator.vibrate?.(ms);
}

export async function showNativeToast(msg: string) {
  toast(msg);
}

export function getPlatform(): "web" | "android" | "ios" {
  return "web";
}

export async function registerPush(_userId: string) {
  // noop on web — Capacitor will override in Phase 11
}
