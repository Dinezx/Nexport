import { supabase } from "@/lib/supabase";

const BUCKET = "documents";

function buildPath(bookingId: string, docType: string, fileName: string) {
    return `${bookingId}/${docType}/${Date.now()}-${fileName}`;
}

export async function uploadDocument(params: {
    bookingId: string;
    file: File;
    type: "invoice" | "packing_list" | "bill_of_lading" | "customs";
}) {
    const { bookingId, file, type } = params;
    const path = buildPath(bookingId, type, file.name);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!urlData?.publicUrl) throw new Error("Unable to fetch document URL");

    // Persist reference in booking_documents table if it exists (best-effort)
    try {
        await supabase.from("booking_documents").insert({
            booking_id: bookingId,
            type,
            url: urlData.publicUrl,
        });
    } catch (err) {
        console.warn("booking_documents table insert skipped", err);
    }

    return urlData.publicUrl;
}

export async function getBookingDocuments(bookingId: string) {
    const prefix = `${bookingId}/`;
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
    });

    if (error) throw error;

    return (data || []).map((item) => {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`${prefix}${item.name}`);
        return {
            name: item.name,
            path: `${prefix}${item.name}`,
            url: urlData.publicUrl,
            created_at: item.created_at,
        };
    });
}
