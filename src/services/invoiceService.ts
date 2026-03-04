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
