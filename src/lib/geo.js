// ─── Free geocoding (Nominatim) & routing (OSRM) ─────────────────────────────
// No API keys required. Nominatim rate limit: 1 req/sec.

const geocodeCache = {};
let lastNominatimCall = 0;

async function throttledFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, 1050 - (now - lastNominatimCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
  const res = await fetch(url, {
    headers: { "User-Agent": "FinanceSuiteApp/1.0" },
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Geocode an address to { lat, lng } using Nominatim (OSM).
 * Results are cached in memory so the same address is never fetched twice.
 */
export async function geocodeAddress(address) {
  if (!address?.trim()) return null;
  const key = address.trim().toLowerCase();
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const data = await throttledFetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
    );
    if (data && data[0]) {
      const loc = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache[key] = loc;
      return loc;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get route distance & duration between two coordinates using OSRM.
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} dest
 * @param {"car"|"foot"|"bike"} profile — OSRM profile (no transit support)
 * @returns {{ duration: string, distance: string } | null}
 */
export async function getRouteDistance(origin, dest, profile) {
  if (!origin || !dest) return null;
  // router.project-osrm.org only hosts the car/driving profile.
  // Foot and bike need their own OSRM servers hosted by OSM.
  const url =
    profile === "car"
      ? `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`
      : profile === "foot"
      ? `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`
      : `https://routing.openstreetmap.de/routed-bike/route/v1/bike/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) return null;
    const route = data.routes[0];
    const mins = Math.round(route.duration / 60);
    const km = route.distance / 1000;
    const duration =
      mins >= 60
        ? `${Math.floor(mins / 60)} hr ${mins % 60} min`
        : `${mins} min`;
    const distance = km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(route.distance)} m`;
    return { duration, distance, distanceKm: km };
  } catch {
    return null;
  }
}

/**
 * Straight-line distance between two coords in km (Haversine formula).
 */
export function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

/**
 * Build a Google Maps directions URL (free public link, not an API call).
 */
export function mapsDirectionUrl(origin, dest, mode) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}
