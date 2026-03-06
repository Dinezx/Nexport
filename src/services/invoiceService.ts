import { supabase } from "@/lib/supabase";

const BUCKET = "invoices";

export type InvoiceData = {
    bookingId: string;
    containerNumber?: string | null;
    route: string;
    cbm: number;
    price: number;
    taxRate?: number;
};

export type BookingInvoicePayload = {
    id: string;
    origin: string;
    destination: string;
    container_type?: string | null;
    container_size?: string | null;
    booking_mode?: string | null;
    allocated_cbm?: number | null;
    price?: number | null;
    exporter_name?: string | null;
    provider_name?: string | null;
};

export type PaymentInvoicePayload = {
    transaction_ref?: string | null;
    amount?: number | null;
    currency?: string | null;
    created_at?: string | null;
};

export async function generateInvoicePdf(data: InvoiceData) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    const taxRate = typeof data.taxRate === "number" ? data.taxRate : 0.18;
    const tax = Math.round(data.price * taxRate);
    const total = data.price + tax;

    doc.setFontSize(16);
    doc.text("Nexport Invoice", 14, 20);

    doc.setFontSize(11);
    doc.text(`Booking ID: ${data.bookingId}`, 14, 32);
    doc.text(`Container: ${data.containerNumber ?? "N/A"}`, 14, 40);
    doc.text(`Route: ${data.route}`, 14, 48);
    doc.text(`CBM: ${data.cbm}`, 14, 56);

    doc.text(`Price: ₹${data.price.toLocaleString("en-IN")}`, 14, 70);
    doc.text(`Tax (${Math.round(taxRate * 100)}%): ₹${tax.toLocaleString("en-IN")}`, 14, 78);
    doc.text(`Total: ₹${total.toLocaleString("en-IN")}`, 14, 86);

    const pdfBlob = doc.output("blob");
    return { blob: pdfBlob, total };
}

// New API: full invoice content
export async function generateInvoicePDF(booking: BookingInvoicePayload, payment: PaymentInvoicePayload) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    const price = payment.amount ?? booking.price ?? 0;
    const taxRate = 0.18;
    const tax = Math.round(price * taxRate);
    const total = price + tax;
    const invoiceNumber = `INV-${booking.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const route = `${booking.origin} → ${booking.destination}`;
    const paymentDate = payment.created_at ? new Date(payment.created_at) : new Date();

    doc.setFontSize(16);
    doc.text("NEXPORT Logistics", 14, 18);
    doc.setFontSize(12);
    doc.text(`Invoice # ${invoiceNumber}`, 14, 26);
    doc.text(`Booking ID: ${booking.id}`, 14, 32);
    doc.text(`Payment Date: ${paymentDate.toLocaleString()}`, 14, 38);

    doc.text(`Exporter: ${booking.exporter_name ?? "N/A"}`, 14, 48);
    doc.text(`Provider: ${booking.provider_name ?? "N/A"}`, 14, 54);
    doc.text(`Route: ${route}`, 14, 60);
    doc.text(`Container: ${booking.container_type ?? ""} ${booking.container_size ?? ""}`.trim(), 14, 66);
    doc.text(`Mode: ${booking.booking_mode ?? ""} | CBM: ${booking.allocated_cbm ?? ""}`, 14, 72);

    doc.text(`Freight Price: ₹${price.toLocaleString("en-IN")}`, 14, 86);
    doc.text(`Tax (18%): ₹${tax.toLocaleString("en-IN")}`, 14, 92);
    doc.setFontSize(13);
    doc.text(`Total: ₹${total.toLocaleString("en-IN")}`, 14, 102);
    doc.setFontSize(10);
    doc.text(`Transaction Ref: ${payment.transaction_ref ?? "N/A"}`, 14, 110);
    doc.text(`Currency: ${payment.currency ?? "INR"}`, 14, 116);

    const pdfBytes = doc.output("arraybuffer");
    return new Uint8Array(pdfBytes);
}

export async function uploadInvoice(params: InvoiceData) {
    const { blob, total } = await generateInvoicePdf(params);
    const path = `${params.bookingId}/invoice-${Date.now()}.pdf`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
    });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData?.publicUrl ?? null;

    if (publicUrl) {
        try {
            await supabase.from("bookings").update({ invoice_url: publicUrl }).eq("id", params.bookingId);
        } catch (err) {
            console.error("Failed to store invoice URL", err);
        }
    }

    return { url: publicUrl, total };
}

export async function uploadInvoiceToStorage(file: Blob | Uint8Array, bookingId: string) {
    const path = `${bookingId}/invoice-${Date.now()}.pdf`;
    const payload = file instanceof Blob ? file : new Blob([file], { type: "application/pdf" });

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, payload, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
    });

    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData?.publicUrl ?? null;
}
