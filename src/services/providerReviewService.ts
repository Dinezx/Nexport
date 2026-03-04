import { supabase } from "@/lib/supabase";

export async function submitProviderReview(params: {
    booking_id: string;
    provider_id: string;
    rating: number;
    review?: string;
}) {
    const { booking_id, provider_id, rating, review } = params;
    const { data, error } = await supabase
        .from("provider_reviews")
        .insert({ booking_id, provider_id, rating, review: review ?? null })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function fetchProviderReviews(providerId: string) {
    const { data, error } = await supabase
        .from("provider_reviews")
        .select("id, booking_id, rating, review, created_at")
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
}
