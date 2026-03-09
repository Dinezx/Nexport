import { supabase } from "@/lib/supabase";
import { isSupabaseReachable } from "@/lib/offlineAuth";
import { getOfflineBookings, saveOfflineBooking } from "@/services/bookingService";
import { predictEtaAndRisk } from "@/lib/prediction";

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

export function saveOfflineMessage(conversationId: string, msg: Message) {
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

  // Try loading from conversations table first
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`exporter_id.eq.${userId},provider_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (!error && data && data.length > 0) {
    const conversations = data as Conversation[];

    // Enrich with booking details and last message
    const enriched: ConversationWithDetails[] = await Promise.all(
      conversations.map(async (conv) => {
        const enrichedConv: ConversationWithDetails = { ...conv };

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

  // Fallback: build conversations from user's bookings when conversations table is empty/blocked by RLS
  try {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, origin, destination, status, container_id, exporter_id, created_at, transport_mode, cargo_type, cargo_weight, price, allocated_cbm, container_number")
      .eq("exporter_id", userId)
      .order("created_at", { ascending: false });

    if (bookings && bookings.length > 0) {
      // Cache bookings in localStorage so offline AI generators can access them
      for (const b of bookings) {
        const existing = getOfflineBookings().find((ob) => ob.id === b.id);
        if (!existing) {
          saveOfflineBooking({
            id: b.id,
            exporter_id: b.exporter_id,
            origin: b.origin || "",
            destination: b.destination || "",
            transport_mode: b.transport_mode || "sea",
            container_type: "",
            container_size: "",
            booking_mode: "full",
            space_cbm: b.allocated_cbm,
            price: b.price,
            status: b.status || "pending",
            created_at: b.created_at,
            cargo_type: b.cargo_type,
            cargo_weight: b.cargo_weight,
            container_id: b.container_id,
            container_number: b.container_number,
            allocated_cbm: b.allocated_cbm,
          });
        }
      }

      return bookings.map((b) => {
        const convId = `conv-offline-${b.id}`;
        const msgs = getOfflineMessages(convId);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

        return {
          id: convId,
          booking_id: b.id,
          container_id: b.container_id || "",
          exporter_id: b.exporter_id,
          provider_id: "provider",
          booking_origin: b.origin,
          booking_destination: b.destination,
          booking_status: b.status,
          last_message: lastMsg?.content,
          last_message_at: lastMsg?.created_at || b.created_at,
        } as ConversationWithDetails;
      });
    }
  } catch (e) {
    console.error("Failed to build conversations from bookings:", e);
  }

  // Last resort: offline bookings
  const offlineConvos = ensureOfflineConversations(userId);
  const offlineBookings = getOfflineBookings(userId);
  const allOfflineBookings = getOfflineBookings();

  return offlineConvos.map((conv) => {
    const booking = offlineBookings.find((b) => b.id === conv.booking_id)
      || allOfflineBookings.find((b) => b.id === conv.booking_id);
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
  const isOfflineConv = params.conversationId.startsWith("conv-offline-") ||
    params.conversationId.startsWith("provider-conv-offline-") ||
    params.bookingId.startsWith("offline-");

  // Provider mode — conversation ID prefixed with "provider-"
  const isProviderMode = params.conversationId.startsWith("provider-");

  if (isOfflineConv) {
    if (isProviderMode) {
      // Provider mode — always generate provider reply
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
    try {
      const prediction = predictEtaAndRisk({
        origin: booking?.origin || "Chennai Port, India",
        destination: booking?.destination || "Singapore Port, Singapore",
        transport: mode as "sea" | "road" | "air",
        bookingMode: (booking?.booking_mode || "full") as "full" | "partial",
        cbm: booking?.space_cbm ? Number(booking.space_cbm) : 0,
      });
      const b = prediction.breakdown;
      return `Based on real-time shipment data for your ${mode} freight from ${booking?.origin || "origin"} to ${booking?.destination || "destination"}:\n\n📦 **Estimated Delivery: ${prediction.etaDays} days** (range: ${prediction.etaRange.min}–${prediction.etaRange.max} days)\n📊 Confidence: ${prediction.etaConfidence}\n\n**Breakdown:**\n• Transit time: ${b.transitDays} days\n• Origin handling: ${b.originHandling} days\n• Destination handling: ${b.destHandling} days\n• Customs clearance: ${b.customsClearance} days\n${b.weatherImpact > 0 ? `• Weather impact: +${b.weatherImpact}%\n` : ""}• Port congestion: ${b.congestionImpact}\n\n⚠️ Delay risk: ${prediction.delayRisk.toUpperCase()} — ${prediction.delayReason}`;
    } catch (_) { /* fallback below */ }
    const days = mode === "air" ? "3-5" : mode === "road" ? "5-10" : "15-25";
    return `Based on your ${mode} freight booking from ${booking?.origin || "origin"} to ${booking?.destination || "destination"}, the estimated delivery time is approximately ${days} days.`;
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

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOfflineProviderResponse(message: string, bookingId: string): string {
  const lower = message.toLowerCase();
  const bookings = getOfflineBookings();
  const booking = bookings.find((b) => b.id === bookingId);
  const origin = booking?.origin || "origin";
  const destination = booking?.destination || "destination";
  const mode = booking?.transport_mode || "sea";

  if (lower.includes("eta") || lower.includes("delivery") || lower.includes("when") || lower.includes("arrive")) {
    const days = mode === "air" ? "3-5" : mode === "road" ? "5-10" : "15-25";
    return pickRandom([
      `For your ${mode} freight from ${origin} to ${destination}, the expected transit time is ${days} business days. The shipment is on track and I'll update you if anything changes.`,
      `The estimated arrival is within ${days} business days. Currently everything is moving smoothly on the ${origin} → ${destination} route.`,
      `Your cargo should reach ${destination} in approximately ${days} business days. No delays reported so far — I'll keep you posted!`,
      `Transit time for this ${mode} shipment is typically ${days} days. Your shipment from ${origin} is progressing well.`,
    ]);
  }

  if (lower.includes("customs") || lower.includes("clearance") || lower.includes("documentation") || lower.includes("document")) {
    return pickRandom([
      `For customs clearance, please ensure you have the following documents ready:\n\n1. Commercial Invoice\n2. Packing List\n3. Bill of Lading\n4. Certificate of Origin\n5. Insurance Certificate\n\nI'll handle the clearance process from our end. Let me know if you need any specific document templates.`,
      `I'll take care of the customs clearance process. Just make sure your Commercial Invoice, Packing List, and Bill of Lading are up to date. I'll reach out if I need anything else from your side.`,
      `The customs documentation is being processed. Please have your export/import licenses ready. I'll coordinate the clearance and keep you informed of the progress.`,
    ]);
  }

  if (lower.includes("price") || lower.includes("cost") || lower.includes("charge") || lower.includes("fee")) {
    const price = booking?.price ? `₹${booking.price.toLocaleString("en-IN")}` : "the agreed amount";
    return pickRandom([
      `The total cost for your shipment is ${price}. This covers container charges, freight charges, and terminal handling. Additional charges for customs brokerage may apply separately.`,
      `Your shipment is billed at ${price} which includes freight, container, and handling fees. Let me know if you need a detailed cost breakdown.`,
      `The agreed rate is ${price}. This is all-inclusive for the ${mode} freight. Any extra charges like demurrage or customs fees will be communicated beforehand.`,
    ]);
  }

  if (lower.includes("delay") || lower.includes("late") || lower.includes("problem") || lower.includes("issue")) {
    return pickRandom([
      `I understand your concern. As of now, there are no reported delays on the ${origin} to ${destination} route. I'll notify you immediately if any issues arise.`,
      `Let me check on that for you. Everything looks good on our end — no disruptions reported. I'm monitoring the route closely.`,
      `No worries, I'm keeping a close eye on your shipment. Currently there are no delays. If anything comes up, you'll be the first to know.`,
      `I've checked with the operations team — your shipment is moving on schedule. No issues reported at this time.`,
    ]);
  }

  if (lower.includes("thank") || lower.includes("thanks")) {
    return pickRandom([
      `You're welcome! Don't hesitate to reach out if you have any more questions.`,
      `Happy to help! Let me know if there's anything else you need.`,
      `Anytime! I'm here if you need anything regarding your shipment.`,
      `Glad I could help! Feel free to message me anytime.`,
    ]);
  }

  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("hii")) {
    return pickRandom([
      `Hello! How can I assist you with your shipment today?`,
      `Hey there! What can I help you with regarding your ${mode} freight?`,
      `Hi! Everything is on track with your shipment from ${origin}. What would you like to know?`,
      `Hello! I'm here to help. Feel free to ask about your shipment status, ETA, documentation, or anything else.`,
      `Hey! Your ${origin} → ${destination} shipment is progressing well. What's on your mind?`,
    ]);
  }

  if (lower.includes("update") || lower.includes("status") || lower.includes("track") || lower.includes("where")) {
    return pickRandom([
      `Your shipment from ${origin} to ${destination} is currently in transit. Status: ${booking?.status?.replace("_", " ") || "in progress"}. I'll share updates as it moves through each checkpoint.`,
      `Here's the latest: your ${mode} freight is on schedule. Current status is "${booking?.status?.replace("_", " ") || "processing"}". I'll push you updates at each milestone.`,
      `The shipment is moving as planned. You can also track it on the Tracking page for real-time updates. Let me know if you need more details!`,
    ]);
  }

  // General / unmatched messages — varied responses
  return pickRandom([
    `Got it, noted. Let me know if there's anything specific you need help with regarding your shipment.`,
    `Sure, I'll look into that. Is there anything else I can help you with?`,
    `Understood. Your shipment from ${origin} to ${destination} is on track. Feel free to ask anything!`,
    `Thanks for the message! Everything is going smoothly with your ${mode} freight. Let me know if you have any questions.`,
    `Noted! I'm monitoring your shipment closely. Don't hesitate to ask if you need any details.`,
    `I'm on it. Your ${origin} → ${destination} shipment is progressing as expected. Is there anything specific you'd like to know?`,
  ]);
}
