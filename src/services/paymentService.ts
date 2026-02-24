import { supabase } from "@/lib/supabase";

/* ---------- Razorpay type declarations ---------- */
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description: string;
  order_id?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

/* ---------- Open Razorpay Checkout ---------- */
export function openRazorpayCheckout(params: {
  amount: number; // in INR (we convert to paise)
  bookingId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<RazorpayResponse> {
  return new Promise((resolve, reject) => {
    const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
    console.log("[Razorpay] Key ID:", keyId ? "present" : "MISSING");
    console.log("[Razorpay] SDK loaded:", !!window.Razorpay);
    console.log("[Razorpay] Amount (INR):", params.amount, "→ paise:", Math.round(params.amount * 100));

    if (!keyId) {
      reject(new Error("Razorpay Key ID not configured. Check VITE_RAZORPAY_KEY_ID in .env"));
      return;
    }

    if (typeof window.Razorpay !== "function") {
      reject(new Error("Razorpay SDK not loaded. Check checkout.js script in index.html"));
      return;
    }

    const options: RazorpayOptions = {
      key: keyId,
      amount: Math.round(params.amount * 100), // INR → paise
      currency: "INR",
      name: "Nexport",
      description: `Booking BK-${params.bookingId.slice(0, 8).toUpperCase()}`,
      prefill: {
        name: params.customerName ?? "",
        email: params.customerEmail ?? "",
        contact: params.customerPhone ?? "",
      },
      theme: { color: "#2563eb" },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error("Payment cancelled by user")) },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  });
}

/* ---------- Record payment in DB ---------- */
export async function recordPayment(params: {
  booking_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_ref: string;
}) {
  const { booking_id, amount, currency, payment_method, transaction_ref } = params;

  const { error } = await supabase.from("payments").insert({
    booking_id,
    amount,
    currency,
    payment_status: "success",
    provider: "razorpay",
    payment_method,
    transaction_ref,
  });

  if (error) throw error;
}

export async function markBookingPaid(bookingId: string) {
  const { error } = await supabase
    .from("bookings")
    .update({ status: "paid" })
    .eq("id", bookingId);

  if (error) throw error;
}

export async function createTrackingEvents(bookingId: string) {
  const { error } = await supabase.from("tracking_events").insert([
    {
      booking_id: bookingId,
      title: "Booking Confirmed",
      description: "Payment received and booking confirmed.",
      status: "completed",
      location: "System",
    },
    {
      booking_id: bookingId,
      title: "Container Assigned",
      description: "Container has been assigned to this booking.",
      status: "completed",
      location: "System",
    },
  ]);

  if (error) throw error;
}

export async function ensureConversation(bookingId: string) {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, exporter_id, container_id")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking || !booking.container_id) {
    throw bookingError || new Error("Booking data missing for conversation");
  }

  const { data: container, error: containerError } = await supabase
    .from("containers")
    .select("provider_id")
    .eq("id", booking.container_id)
    .single();

  if (containerError || !container?.provider_id) {
    throw containerError || new Error("Container provider missing");
  }

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({
      booking_id: booking.id,
      container_id: booking.container_id,
      exporter_id: booking.exporter_id,
      provider_id: container.provider_id,
    })
    .select()
    .single();

  if (convError || !conversation) throw convError || new Error("Conversation creation failed");

  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    sender_id: booking.exporter_id,
    sender_role: "system",
    content: `Booking ${booking.id.slice(0, 8).toUpperCase()} has been paid. You can coordinate shipment details here.`,
  });

  return conversation.id;
}

/* ---------- Release booking hold (cancel pending booking) ---------- */
export async function releaseBookingHold(bookingId: string) {
  // 1. Fetch booking to get container info
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, container_id, allocated_cbm, booking_mode, status")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) throw bookingError || new Error("Booking not found");

  // Only release hold for pending_payment bookings
  if (booking.status !== "pending_payment") {
    throw new Error("Can only cancel pending bookings");
  }

  // 2. Restore container space
  if (booking.container_id) {
    const { data: container } = await supabase
      .from("containers")
      .select("available_space_cbm, total_space_cbm")
      .eq("id", booking.container_id)
      .single();

    if (container) {
      let restoredSpace = container.available_space_cbm;
      if (booking.booking_mode === "full") {
        restoredSpace = container.total_space_cbm;
      } else if (booking.allocated_cbm) {
        restoredSpace = Math.min(
          container.total_space_cbm,
          container.available_space_cbm + booking.allocated_cbm
        );
      }

      await supabase
        .from("containers")
        .update({
          available_space_cbm: restoredSpace,
          status: restoredSpace > 0 ? "available" : "full",
        })
        .eq("id", booking.container_id);
    }
  }

  // 3. Mark booking as cancelled
  const { error: cancelError } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);

  if (cancelError) throw cancelError;
}
