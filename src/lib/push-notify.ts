import { supabase } from "@/integrations/supabase/client";

export async function sendPushNotification(
  userIds: string[],
  title: string,
  body: string,
  url?: string,
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.functions.invoke("send-push-notification", {
      body: { user_ids: userIds, title, body, url },
    });
  } catch (err) {
    console.error("Push notification error:", err);
  }
}
