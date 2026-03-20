import { supabase } from "@/lib/supabase";

export type NotificationPayload = {
    user_id: string;
    message: string;
    type: string;
};

export type NotificationItem = {
    id: string;
    user_id: string;
    message: string;
    type: string;
    read: boolean;
    created_at: string;
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

export async function fetchNotifications(userId: string, limit: number = 8) {
    if (!userId) return [] as NotificationItem[];
    const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, message, type, read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data || []) as NotificationItem[];
}

export async function markAllNotificationsRead(userId: string) {
    if (!userId) return;
    const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);

    if (error) throw error;
}
