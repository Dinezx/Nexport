import { supabase } from "@/lib/supabase";

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
    provider: "demo",
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
