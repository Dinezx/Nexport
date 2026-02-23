import { supabase } from "@/lib/supabase";

export type BookingMode = "full" | "partial";
export type TransportMode = "sea" | "road" | "air";
export type ContainerType = "normal" | "dry" | "reefer";
export type ContainerSize = "20ft" | "40ft";

export type ContainerRecord = {
  id: string;
  container_number: string | null;
  provider_id: string | null;
  type: ContainerType;
  size: ContainerSize;
  total_space_cbm: number;
  available_space_cbm: number;
  current_location: string;
  transport_mode: TransportMode;
  status: "available" | "allocated" | "in_transit" | "full";
  created_at: string;
};

export type BookingInsert = {
  exporter_id: string;
  booking_date: string;
  origin: string;
  destination: string;
  transport_mode: TransportMode;
  cargo_type: string;
  cargo_weight: number | null;
  container_id: string | null;
  container_number: string | null;
  allocated_cbm: number | null;
  booking_mode: BookingMode;
  price: number;
  status: "pending_payment" | "paid" | "in_transit" | "completed";
};

export function normalizeContainerSize(size: "20" | "40" | "20ft" | "40ft"): ContainerSize {
  return size === "20" ? "20ft" : size === "40" ? "40ft" : size;
}

export function getBookingSuggestion(cbm: number): BookingMode {
  if (cbm > 18) return "full";
  if (cbm < 10) return "partial";
  return "partial";
}

export async function fetchAvailableContainers(params: {
  origin: string;
  transport: TransportMode;
  type: ContainerType;
  size: ContainerSize;
  bookingMode: BookingMode;
  requestedCbm: number;
}): Promise<ContainerRecord[]> {
  const { origin, transport, type, size, bookingMode, requestedCbm } = params;

  let query = supabase
    .from("containers")
    .select("*")
    .eq("current_location", origin)
    .eq("transport_mode", transport)
    .eq("type", type)
    .eq("size", size)
    .eq("status", "available")
    .order("created_at", { ascending: false });

  if (bookingMode === "partial" && requestedCbm > 0) {
    query = query.gte("available_space_cbm", requestedCbm);
  }

  const { data, error } = await query;
  if (error) throw error;

  const containers = (data || []) as ContainerRecord[];
  const filtered = containers.filter((c) => {
    if (bookingMode === "partial") {
      return requestedCbm > 0 ? c.available_space_cbm >= requestedCbm : c.available_space_cbm > 0;
    }
    return c.available_space_cbm >= c.total_space_cbm;
  });

  const requiredCbm = bookingMode === "partial" ? requestedCbm : filtered[0]?.total_space_cbm || 0;
  filtered.sort((a, b) => {
    const diffA = Math.abs((a.available_space_cbm || 0) - requiredCbm);
    const diffB = Math.abs((b.available_space_cbm || 0) - requiredCbm);
    if (diffA !== diffB) return diffA - diffB;
    const effA = (a.available_space_cbm || 0) / (a.total_space_cbm || 1);
    const effB = (b.available_space_cbm || 0) / (b.total_space_cbm || 1);
    return effB - effA;
  });

  return filtered;
}

export async function createBooking(payload: BookingInsert) {
  const { data, error } = await supabase
    .from("bookings")
    .insert(payload)
    .select()
    .single();

  if (error || !data) throw error || new Error("Booking creation failed");
  return data;
}

export async function updateContainerAllocation(params: {
  containerId: string;
  bookingMode: BookingMode;
  allocatedCbm: number | null;
}) {
  const { containerId, bookingMode, allocatedCbm } = params;

  const { data: currentContainer, error: fetchError } = await supabase
    .from("containers")
    .select("available_space_cbm, total_space_cbm")
    .eq("id", containerId)
    .single();

  if (fetchError || !currentContainer) throw fetchError || new Error("Container not found");

  if (bookingMode === "partial" && allocatedCbm !== null && allocatedCbm > currentContainer.available_space_cbm) {
    throw new Error("Requested CBM exceeds available space");
  }

  let newAvailable = currentContainer.available_space_cbm;
  if (bookingMode === "partial" && allocatedCbm !== null) {
    newAvailable = Math.max(0, currentContainer.available_space_cbm - allocatedCbm);
  } else if (bookingMode === "full") {
    newAvailable = 0;
  }

  const newStatus = newAvailable === 0 ? "allocated" : "available";

  let updateQuery = supabase
    .from("containers")
    .update({
      available_space_cbm: newAvailable,
      status: newStatus,
    })
    .eq("id", containerId)
    .select("id");

  if (bookingMode === "partial" && allocatedCbm !== null) {
    updateQuery = updateQuery.gte("available_space_cbm", allocatedCbm);
  }

  const { data: updatedRows, error: updateError } = await updateQuery;
  if (updateError) throw updateError;
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error("Container allocation failed due to concurrent update");
  }

  return { available_space_cbm: newAvailable, status: newStatus };
}
