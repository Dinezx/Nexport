import { supabase } from "@/lib/supabase";
import { isSupabaseReachable } from "@/lib/offlineAuth";
import { getOfflineBookings } from "@/services/bookingService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";

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

/* ------------------------------------------------------------------ */
/*  Offline conversation & message storage (localStorage)             */
/* ------------------------------------------------------------------ */

const OFFLINE_CONVERSATIONS_KEY = "nexport_offline_conversations";
const OFFLINE_MESSAGES_KEY = "nexport_offline_messages";

export type OfflineConversation = Conversation & {
  created_at: string;
};

function getOfflineConversations(): OfflineConversation[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_CONVERSATIONS_KEY) || "[]");
  } catch { return []; }
}

function saveOfflineConversation(conv: OfflineConversation) {
  const all = getOfflineConversations();
  if (!all.find((c) => c.id === conv.id)) {
    all.unshift(conv);
    localStorage.setItem(OFFLINE_CONVERSATIONS_KEY, JSON.stringify(all));
  }
}

function getOfflineMessages(conversationId: string): Message[] {
  try {
    const all: Record<string, Message[]> = JSON.parse(
      localStorage.getItem(OFFLINE_MESSAGES_KEY) || "{}"
    );
    return all[conversationId] || [];
  } catch { return []; }
}

function saveOfflineMessage(conversationId: string, msg: Message) {
  try {
    const all: Record<string, Message[]> = JSON.parse(
      localStorage.getItem(OFFLINE_MESSAGES_KEY) || "{}"
    );
    if (!all[conversationId]) all[conversationId] = [];
    all[conversationId].push(msg);
    localStorage.setItem(OFFLINE_MESSAGES_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

/**
 * Ensure every offline booking has a corresponding offline conversation.
 * Returns all offline conversations for the given user.
 */
function ensureOfflineConversations(userId: string): OfflineConversation[] {
  // Get bookings for this user first, then try ALL bookings as fallback
  let bookings = getOfflineBookings(userId);
  if (bookings.length === 0) {
    // User ID might not match — get all offline bookings
    bookings = getOfflineBookings();
  }
  const existing = getOfflineConversations();

  for (const booking of bookings) {
    const hasConv = existing.some((c) => c.booking_id === booking.id);
    if (!hasConv) {
      const conv: OfflineConversation = {
        id: `conv-${booking.id}`,
        booking_id: booking.id,
        container_id: booking.container_id || "",
        exporter_id: booking.exporter_id,
        provider_id: "offline-provider",
        created_at: booking.created_at,
      };
      saveOfflineConversation(conv);
      existing.unshift(conv);
    }
  }

  return existing.filter(
    (c) => c.exporter_id === userId || c.provider_id === userId || c.exporter_id.startsWith("offline-")
  );
}

/* ------------------------------------------------------------------ */

export async function fetchLatestConversation(userId: string) {
  const online = await isSupabaseReachable(SUPABASE_URL, 3000);
  if (!online) {
    const convos = ensureOfflineConversations(userId);
    return convos.length > 0 ? convos[0] : null;
  }

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
  const online = await isSupabaseReachable(SUPABASE_URL, 3000);

  if (!online) {
    // Build conversations from offline bookings
    const convos = ensureOfflineConversations(userId);
    const bookings = getOfflineBookings(userId);
    const allBookings = getOfflineBookings(); // fallback: all bookings

    return convos.map((conv) => {
      const booking = bookings.find((b) => b.id === conv.booking_id)
        || allBookings.find((b) => b.id === conv.booking_id);
      const msgs = getOfflineMessages(conv.id);
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

      return {
        ...conv,
        booking_origin: booking?.origin,
        booking_destination: booking?.destination,
        booking_status: booking?.status,
        last_message: lastMsg?.content,
        last_message_at: lastMsg?.created_at,
      } as ConversationWithDetails;
    });
  }

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
  // Offline conversation
  if (conversationId.startsWith("conv-offline-")) {
    return getOfflineMessages(conversationId);
  }

  const online = await isSupabaseReachable(SUPABASE_URL, 3000);
  if (!online) {
    return getOfflineMessages(conversationId);
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");

  if (error) throw error;
  return (data || []) as Message[];
}

export function subscribeToMessages(conversationId: string, onInsert: (msg: Message) => void) {
  // No realtime for offline conversations
  if (conversationId.startsWith("conv-offline-")) return null;

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
}): Promise<Message> {
  const { conversationId, senderId, senderRole, content } = payload;

  // Offline conversation — save to localStorage
  if (conversationId.startsWith("conv-offline-")) {
    const msg: Message = {
      id: `msg-${crypto.randomUUID()}`,
      sender_id: senderId,
      sender_role: senderRole,
      content,
      created_at: new Date().toISOString(),
    };
    saveOfflineMessage(conversationId, msg);
    return msg;
  }

  const online = await isSupabaseReachable(SUPABASE_URL, 3000);
  if (!online) {
    const msg: Message = {
      id: `msg-${crypto.randomUUID()}`,
      sender_id: senderId,
      sender_role: senderRole,
      content,
      created_at: new Date().toISOString(),
    };
    saveOfflineMessage(conversationId, msg);
    return msg;
  }

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
}): Promise<any> {
  // For offline conversations, generate a local AI response
  if (params.conversationId.startsWith("conv-offline-") || params.bookingId.startsWith("offline-")) {
    // Check if provider has joined this conversation
    const existingMsgs = getOfflineMessages(params.conversationId);
    const providerJoined = existingMsgs.some((m) => m.sender_role === "provider");

    if (providerJoined) {
      // Provider is in the conversation — simulate provider reply
      const providerReply = generateOfflineProviderResponse(params.message, params.bookingId);
      const msg: Message = {
        id: `msg-${crypto.randomUUID()}`,
        sender_id: "offline-provider",
        sender_role: "provider",
        content: providerReply,
        created_at: new Date().toISOString(),
      };
      saveOfflineMessage(params.conversationId, msg);
      return { reply: providerReply, offlineMessage: msg };
    }

    // No provider yet — AI responds
    const aiReply = generateOfflineAiResponse(params.message, params.bookingId);
    const msg: Message = {
      id: `msg-${crypto.randomUUID()}`,
      sender_id: "ai",
      sender_role: "ai",
      content: aiReply,
      created_at: new Date().toISOString(),
    };
    saveOfflineMessage(params.conversationId, msg);
    return { reply: aiReply, offlineMessage: msg };
  }

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

/* ---------- Offline AI response generator ---------- */

function generateOfflineAiResponse(message: string, bookingId: string): string {
  const lower = message.toLowerCase();
  const bookings = getOfflineBookings();
  const booking = bookings.find((b) => b.id === bookingId);

  if (lower.includes("eta") || lower.includes("delivery") || lower.includes("when")) {
    const mode = booking?.transport_mode || "sea";
    const days = mode === "air" ? "3-5" : mode === "road" ? "5-10" : "15-25";
    return `Based on your ${mode} freight booking from ${booking?.origin || "origin"} to ${booking?.destination || "destination"}, the estimated delivery time is approximately ${days} days. Please note this is an estimate and may vary based on weather, customs clearance, and port congestion.`;
  }

  if (lower.includes("price") || lower.includes("cost") || lower.includes("payment")) {
    const price = booking?.price ? `₹${booking.price.toLocaleString("en-IN")}` : "the quoted amount";
    return `Your booking is priced at ${price}. This includes container charges, freight, and basic handling. Additional charges may apply for customs clearance and last-mile delivery.`;
  }

  if (lower.includes("status") || lower.includes("track")) {
    return `Your booking status is currently: ${booking?.status?.replace("_", " ") || "pending"}. You can track your shipment in real-time from the Tracking page.`;
  }

  if (lower.includes("container") || lower.includes("size")) {
    return `Your booking uses a ${booking?.container_size || "standard"} ${booking?.container_type || "dry"} container via ${booking?.transport_mode || "sea"} freight.`;
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return `Hello! I'm the NEXPORT AI assistant. I can help you with information about your shipment, ETA, pricing, and more. What would you like to know?`;
  }

  return `Thank you for your message. Your ${booking?.transport_mode || "sea"} freight booking from ${booking?.origin || "origin"} to ${booking?.destination || "destination"} is being processed. Feel free to ask about ETA, pricing, container details, or tracking status.`;
}

/* ---------- Offline Provider response generator ---------- */

function generateOfflineProviderResponse(message: string, bookingId: string): string {
  const lower = message.toLowerCase();
  const bookings = getOfflineBookings();
  const booking = bookings.find((b) => b.id === bookingId);
  const origin = booking?.origin || "origin";
  const destination = booking?.destination || "destination";
  const mode = booking?.transport_mode || "sea";

  if (lower.includes("eta") || lower.includes("delivery") || lower.includes("when") || lower.includes("arrive")) {
    const days = mode === "air" ? "3-5" : mode === "road" ? "5-10" : "15-25";
    return `Hi! For your ${mode} freight from ${origin} to ${destination}, the expected transit time is ${days} business days. I'll keep you updated if there are any changes to the schedule. The shipment is on track.`;
  }

  if (lower.includes("customs") || lower.includes("clearance") || lower.includes("documentation") || lower.includes("document")) {
    return `For customs clearance, please ensure you have the following documents ready:\n\n1. Commercial Invoice\n2. Packing List\n3. Bill of Lading\n4. Certificate of Origin\n5. Insurance Certificate\n\nI'll handle the clearance process from our end. Let me know if you need any specific document templates.`;
  }

  if (lower.includes("price") || lower.includes("cost") || lower.includes("charge") || lower.includes("fee")) {
    const price = booking?.price ? `₹${booking.price.toLocaleString("en-IN")}` : "the agreed amount";
    return `The total cost for your shipment is ${price}. This covers:\n- Container charges\n- Freight charges\n- Terminal handling\n\nAdditional charges for customs brokerage and last-mile delivery will be billed separately if applicable.`;
  }

  if (lower.includes("delay") || lower.includes("late") || lower.includes("problem") || lower.includes("issue")) {
    return `I understand your concern. Let me check the current status of your shipment. As of now, there are no reported delays on the ${origin} to ${destination} route. I'll immediately notify you if any issues arise.`;
  }

  if (lower.includes("thank") || lower.includes("thanks")) {
    return `You're welcome! Don't hesitate to reach out if you have any more questions about your shipment. I'm here to help throughout the entire shipping process.`;
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return `Hi there! I'm managing your ${mode} freight shipment from ${origin} to ${destination}. How can I help you today?`;
  }

  return `Thank you for reaching out. I'm overseeing your shipment from ${origin} to ${destination} via ${mode} freight. Everything is progressing as planned. Is there anything specific you'd like to know about your shipment?`;
}
