import { supabase } from "@/lib/supabase";
import type { ContainerRecord } from "@/services/bookingService";

export type ContainerInput = {
  provider_id: string;
  container_number: string;
  type: "normal" | "dry" | "reefer";
  size: "20ft" | "40ft";
  total_space_cbm: number;
  available_space_cbm: number;
  current_location: string;
  transport_mode: "sea" | "road" | "air";
  status: "available" | "allocated" | "in_transit" | "full";
};

export function generateContainerNumber(): string {
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `CNT-${randomDigits}`;
}

export async function generateUniqueContainerNumber(): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateContainerNumber();
    const { data } = await supabase
      .from("containers")
      .select("id")
      .eq("container_number", candidate)
      .maybeSingle();

    if (!data) return candidate;
  }
  throw new Error("Unable to generate unique container number");
}

export async function getProviderContainers(userId: string): Promise<ContainerRecord[]> {
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .or(`provider_id.eq.${userId},provider_id.is.null`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as ContainerRecord[];
}

export async function createContainer(payload: ContainerInput) {
  const { data, error } = await supabase
    .from("containers")
    .insert(payload)
    .select()
    .single();

  if (error || !data) throw error || new Error("Container creation failed");
  return data;
}

export async function updateContainer(id: string, payload: Partial<ContainerInput>) {
  const { data, error } = await supabase
    .from("containers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) throw error || new Error("Container update failed");
  return data;
}

export async function deleteContainer(id: string) {
  const { error } = await supabase
    .from("containers")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
