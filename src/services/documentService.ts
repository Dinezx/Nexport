import { supabase } from "@/lib/supabase";

const BUCKET = "documents";
const DOC_TYPES = ["invoice", "packing_list", "bill_of_lading", "customs"] as const;
export type DocumentType = (typeof DOC_TYPES)[number];

function buildPath(bookingId: string, docType: DocumentType, fileName: string) {
    return `${bookingId}/${docType}/${Date.now()}-${fileName}`;
}

export async function uploadDocument(params: {
    bookingId: string;
    file: File;
    type: DocumentType;
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
    const results: any[] = [];

    for (const type of DOC_TYPES) {
        const prefix = `${bookingId}/${type}`;
        const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
            limit: 50,
            offset: 0,
            sortBy: { column: "created_at", order: "desc" },
        });

        if (error) {
            // Skip this type but continue others
            console.warn("Document list failed for", prefix, error.message);
            continue;
        }

        (data || []).forEach((item) => {
            const path = `${prefix}/${item.name}`;
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
            results.push({
                name: item.name,
                path,
                url: urlData.publicUrl,
                created_at: item.created_at,
            });
        });
    }

    // Newest first across all types
    return results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
