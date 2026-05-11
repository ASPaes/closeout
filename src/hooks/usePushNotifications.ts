import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!user || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      })
      .catch(() => {});
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const { data: vapidData } = await supabase.functions.invoke("get-vapid-key");
      const vapidKey = (vapidData as any)?.publicKey;
      if (!vapidKey) throw new Error("VAPID key not found");

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(base64);
        return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
      };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = sub.toJSON();

      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh_key: subJson.keys!.p256dh!,
          auth_key: subJson.keys!.auth!,
          user_agent: navigator.userAgent,
        } as any,
        { onConflict: "user_id,endpoint" },
      );

      setIsSubscribed(true);
      setPermission("granted");
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      setLoading(false);
      return false;
    }
  }, [user]);

  const requestPermissionAndSubscribe = useCallback(async () => {
    if (!("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      return await subscribe();
    }
    return false;
  }, [subscribe]);

  return { permission, isSubscribed, loading, requestPermissionAndSubscribe };
}
