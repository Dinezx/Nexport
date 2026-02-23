import { supabase } from "@/lib/supabase";

export type SenderRole = "exporter" | "provider" | "ai" | "system";

export type Conversation = {
  id: string;
  booking_id: string;
  container_id: string;
  exporter_id: string;
  provider_id: string;
};

export type Message = {
  id: string;
  sender_id: string;
  sender_role: SenderRole;
  content: string;
  created_at: string;
};

export async function fetchLatestConversation(userId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`exporter_id.eq.${userId},provider_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0] as Conversation;
}

export type ConversationWithDetails = Conversation & {
  other_party_email?: string;
  booking_origin?: string;
  booking_destination?: string;
  booking_status?: string;
  last_message?: string;
  last_message_at?: string;
};

export async function fetchAllConversations(userId: string): Promise<ConversationWithDetails[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`exporter_id.eq.${userId},provider_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return [];

  const conversations = data as Conversation[];

  // Enrich with booking details and last message
  const enriched: ConversationWithDetails[] = await Promise.all(
    conversations.map(async (conv) => {
      const enrichedConv: ConversationWithDetails = { ...conv };

      // Fetch booking details
      try {
        const { data: booking } = await supabase
          .from("bookings")
          .select("origin, destination, status")
          .eq("id", conv.booking_id)
          .single();
        if (booking) {
          enrichedConv.booking_origin = booking.origin;
          enrichedConv.booking_destination = booking.destination;
          enrichedConv.booking_status = booking.status;
        }
      } catch { /* ignore */ }

      // Fetch last message
      try {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lastMsg) {
          enrichedConv.last_message = lastMsg.content;
          enrichedConv.last_message_at = lastMsg.created_at;
        }
      } catch { /* ignore */ }

      return enrichedConv;
    })
  );

  return enriched;
}

export async function fetchConversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");

  if (error) throw error;
  return (data || []) as Message[];
}

export function subscribeToMessages(conversationId: string, onInsert: (msg: Message) => void) {
  const channel = supabase
    .channel(`messages-conversation-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: { new: Message }) => onInsert(payload.new),
    )
    .subscribe();

  return channel;
}

export async function insertMessage(payload: {
  conversationId: string;
  senderId: string;
  senderRole: SenderRole;
  content: string;
}) {
  const { conversationId, senderId, senderRole, content } = payload;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      content,
    })
    .select()
    .single();

  if (error || !data) throw error || new Error("Failed to send message");
  return data as Message;
}

export async function sendAiMessage(params: {
  message: string;
  bookingId: string;
  conversationId: string;
}) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `AI service error: ${res.status}`);
  }

  return res.json().catch(() => ({}));
}
