import { supabase } from "@/lib/supabase";

const BUCKET = "documents";
const DOC_TYPES = ["invoice", "packing_list", "bill_of_lading", "customs"] as const;
export type DocumentType = (typeof DOC_TYPES)[number];

function buildPath(bookingId: string, docType: DocumentType, fileName: string) {
    return `${bookingId}/${docType}/${Date.now()}-${fileName}`;
}

async function getSignedUrl(path: string, expiresIn = 60 * 60 * 24) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) throw error || new Error("Unable to generate signed URL");
    return data.signedUrl;
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

    const signedUrl = await getSignedUrl(path);

    // Persist reference in booking_documents table if it exists (best-effort)
    try {
        await supabase.from("booking_documents").insert({
            booking_id: bookingId,
            type,
            url: path,
        });
    } catch (err) {
        console.warn("booking_documents table insert skipped", err);
    }

    return signedUrl;
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

        for (const item of data || []) {
            const path = `${prefix}/${item.name}`;
            try {
                const signedUrl = await getSignedUrl(path);
                results.push({
                    name: item.name,
                    path,
                    url: signedUrl,
                    created_at: item.created_at,
                });
            } catch (err) {
                console.warn("Signed URL generation failed for", path, err);
            }
        }
    }

    // Newest first across all types
    return results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
