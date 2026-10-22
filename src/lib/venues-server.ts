import type { SupabaseClient } from "@supabase/supabase-js";
import type { VenueInput } from "@/lib/schemas";

// A saved venue's id as-is, or a new venue (picked on the map) saved first.
export async function saveVenue(admin: SupabaseClient, venue: VenueInput): Promise<string | null> {
  if ("venueId" in venue) return venue.venueId;
  const { data, error } = await admin
    .from("venues")
    .insert({ name: venue.name, latitude: venue.latitude, longitude: venue.longitude, radius_meters: venue.radiusMeters })
    .select("id")
    .single();
  return error || !data ? null : (data.id as string);
}
