import { supabase } from "@/lib/supabase";
import { updateShipmentStatus } from "@/services/shipmentService";
import { addTrackingEvent } from "@/services/trackingService";
import { createNotification } from "@/services/notificationService";
import { uploadInvoice, generateInvoicePDF, uploadInvoiceToStorage } from "@/services/invoiceService";
import { optimizeContainerFill } from "@/services/containerAllocator";
import { sendEmail, sendInvoiceEmail } from "@/services/emailService";

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
    .update({
      status: "payment_completed",
      payment_status: "completed",
      payout_status: "pending",
    })
    .eq("id", bookingId);

  if (error) throw error;

  try {
    await updateShipmentStatus(bookingId, "payment_completed");
  } catch (err) {
    console.error("Shipment status update failed", err);
  }
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

/* ---------- Capacity + escrow helpers ---------- */

async function updateContainerCapacity(bookingId: string) {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, container_id, allocated_cbm, booking_mode, exporter_id, container_number")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) throw bookingError || new Error("Booking not found");
  if (!booking.container_id) return null;

  const { data: container } = await supabase
    .from("containers")
    .select("id, available_space_cbm, total_space_cbm, provider_id, status")
    .eq("id", booking.container_id)
    .maybeSingle();

  if (!container) return null;

  const allocated = booking.booking_mode === "partial"
    ? Math.max(0, booking.allocated_cbm || 0)
    : (container.total_space_cbm || 0);

  const newAvailable = Math.max(0, (container.available_space_cbm ?? container.total_space_cbm ?? 0) - allocated);
  const newStatus = newAvailable <= 0 ? "full" : (container.status as any) ?? "available";

  const { error: updateError } = await supabase
    .from("containers")
    .update({ available_space_cbm: newAvailable, status: newStatus })
    .eq("id", container.id);

  if (updateError) throw updateError;

  try {
    await optimizeContainerFill(container.id);
  } catch (err) {
    console.warn("Container optimization skipped", err);
  }

  try {
    await createNotification({
      user_id: container.provider_id,
      message: `Container ${booking.container_number ?? ""} capacity updated after payment`,
      type: "container_allocated",
    });
  } catch (err) {
    console.error("Capacity notification failed", err);
  }

  return { available_space_cbm: newAvailable, status: newStatus };
}

async function generateInvoice(bookingId: string) {
  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, origin, destination, price, allocated_cbm, container_number")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return null;

    const route = `${booking.origin} → ${booking.destination}`;
    const cbm = booking.allocated_cbm ?? 0;
    return uploadInvoice({
      bookingId: booking.id,
      containerNumber: booking.container_number,
      route,
      cbm,
      price: booking.price ?? 0,
    });
  } catch (err) {
    console.error("Invoice generation failed", err);
    return null;
  }
}

async function fetchExporterContact(bookingId: string, fallbackEmail?: string | null, fallbackName?: string | null) {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, exporter_id, origin, destination, price, allocated_cbm, container_number, container_id, container_type, container_size, booking_mode")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    console.warn("Invoice: booking fetch failed", bookingError);
    return null;
  }

  if (!booking) {
    console.warn("Invoice: booking not found", { bookingId });
    return null;
  }

  let email: string | null = fallbackEmail ?? null;
  let name: string | null = fallbackName ?? null;
  let providerName: string | null = null;

  if (booking.container_id) {
    const { data: container } = await supabase
      .from("containers")
      .select("provider_id")
      .eq("id", booking.container_id)
      .maybeSingle();

    if (container?.provider_id) {
      const { data: providerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", container.provider_id)
        .maybeSingle();
      if (providerProfile?.full_name) providerName = providerProfile.full_name;
    }
  }

  if (!email && booking.exporter_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", booking.exporter_id)
      .maybeSingle();
    if (profile?.email) email = profile.email;
    if (profile?.full_name) name = profile.full_name;
  }

  return { booking: { ...booking, provider_name: providerName }, email, name };
}

async function callSendInvoiceEdgeFunction(params: {
  orderId: string;
  exporterEmail?: string | null;
  companyName?: string | null;
  amount?: number | null;
  currency?: string | null;
}) {
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice`;
  const payload = {
    order_id: params.orderId,
    exporter_email: params.exporterEmail,
    company_name: params.companyName,
    amount: params.amount,
    currency: params.currency,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("Edge send-invoice returned non-OK", res.status, data);
    return null;
  }
  return data as { success?: boolean; invoice_id?: string; pdf_url?: string; email_error?: string | null };
}

export async function sendInvoiceToExporter(bookingId: string, fallbackEmail?: string | null, fallbackName?: string | null) {
  // Legacy path retained; now delegates to full invoice flow
  return processInvoiceAfterPayment(bookingId, { fallbackEmail, fallbackName });
}

export async function processInvoiceAfterPayment(
  bookingId: string,
  opts: { fallbackEmail?: string | null; fallbackName?: string | null } = {},
) {
  const contact = await fetchExporterContact(bookingId, opts.fallbackEmail, opts.fallbackName);
  if (!contact) {
    console.warn("Invoice skipped: booking contact not found", { bookingId });
    return null;
  }

  // If we still don't have an email, try current auth user as fallback
  let fallbackEmail = contact.email ?? opts.fallbackEmail ?? null;
  if (!fallbackEmail) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      fallbackEmail = user?.email ?? null;
    } catch (err) {
      console.warn("Auth user lookup for invoice email failed", err);
    }
  }

  // 1) fetch payment data
  const { data: paymentRow, error: paymentError } = await supabase
    .from("payments")
    .select("amount, currency, transaction_ref, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) {
    console.warn("Invoice: failed to fetch payment row", paymentError);
  }

  // Send invoice via Edge Function (generates PDF, sends email with attachment)
  try {
    const edgeResult = await callSendInvoiceEdgeFunction({
      orderId: bookingId,
      exporterEmail: contact.email ?? fallbackEmail,
      companyName: contact.name,
      amount: paymentRow?.amount ?? contact.booking.price,
      currency: paymentRow?.currency ?? "INR",
    });

    if (edgeResult?.success) {
      return { url: edgeResult.pdf_url ?? null, invoice_id: edgeResult.invoice_id };
    }
    console.warn("Edge send-invoice returned non-success", edgeResult);
  } catch (err) {
    console.warn("Edge send-invoice call failed", err);
  }

  return null;
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
