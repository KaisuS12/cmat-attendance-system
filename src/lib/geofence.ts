const EARTH_RADIUS_METERS = 6371000;

// Haversine distance between two lat/lng points, in meters.
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function isWithinVenue(
  studentLat: number,
  studentLon: number,
  venueLat: number,
  venueLon: number,
  radiusMeters: number
): boolean {
  return distanceMeters(studentLat, studentLon, venueLat, venueLon) <= radiusMeters;
}

const FOOTBALL_FIELD_METERS = 100;
const WALK_METERS_PER_MINUTE = 80;

function halves(n: number): string {
  const rounded = Math.round(n * 2) / 2;
  const whole = Math.floor(rounded);
  const half = rounded - whole === 0.5;
  if (whole === 0) return half ? "½" : "0";
  return half ? `${whole}½` : String(whole);
}

// Plain-language sense of a radius, e.g. for 150:
// "about 1½ football fields · about a 2-minute walk from the center".
export function describeDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "";
  const fields = meters / FOOTBALL_FIELD_METERS;
  const fieldText =
    fields < 0.75 ? "less than a football field" : `about ${halves(fields)} football field${halves(fields) === "1" ? "" : "s"}`;
  const minutes = Math.max(1, Math.round(meters / WALK_METERS_PER_MINUTE));
  return `${fieldText} · about a ${minutes}-minute walk from the center`;
}
