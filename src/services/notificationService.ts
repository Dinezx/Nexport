import { supabase } from "@/lib/supabase";

export type NotificationPayload = {
    user_id: string;
    message: string;
    type: string;
};

export async function createNotification(payload: NotificationPayload) {
    const { user_id, message, type } = payload;
    if (!user_id) return null;

    const { data, error } = await supabase
        .from("notifications")
        .insert({
            user_id,
            message,
            type,
            read: false,
            created_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function markNotificationRead(id: string) {
    const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);

    if (error) throw error;
}
