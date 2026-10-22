"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { btnSecondary, inputClass } from "@/components/ui";
import { describeDistance } from "@/lib/geofence";
import type { Venue } from "@/types/database";

// Leaflet needs the browser (window), so the map is loaded client-side only.
const VenueMap = dynamic(() => import("@/components/VenueMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-lg bg-slate-100 sm:h-80" aria-hidden="true" />,
});

export const NEW_VENUE = "__new__";
export const SAME_VENUE = "__same__";

export interface VenueValue {
  choice: string; // a saved venue's id, NEW_VENUE or SAME_VENUE
  name: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
}

export function emptyVenue(choice: string = NEW_VENUE): VenueValue {
  return { choice, name: "", latitude: "", longitude: "", radiusMeters: "150" };
}

type VenuePayload =
  | { venueId: string }
  | { name: string; latitude: number; longitude: number; radiusMeters: number };

/** What the API expects, null for "same as the event", or a problem to show. */
export function venueToPayload(v: VenueValue): { ok: true; value: VenuePayload | null } | { ok: false; message: string } {
  if (v.choice === SAME_VENUE) return { ok: true, value: null };
  if (v.choice !== NEW_VENUE) return { ok: true, value: { venueId: v.choice } };
  const lat = Number(v.latitude);
  const lng = Number(v.longitude);
  if (!v.name.trim()) return { ok: false, message: "Give the new venue a name." };
  if (!v.latitude || !v.longitude || Number.isNaN(lat) || Number.isNaN(lng)) {
    return { ok: false, message: "Pick the venue on the map, or use your current location." };
  }
  return { ok: true, value: { name: v.name.trim(), latitude: lat, longitude: lng, radiusMeters: Number(v.radiusMeters) || 150 } };
}

function parseCoord(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Pick a saved venue (shown on the map) or set up a new one: name, pin on
// the map and sign-in radius. `allowSame` adds "Same as the event" for days.
export function VenuePicker({
  id,
  venues,
  value,
  onChange,
  allowSame = false,
}: {
  id: string;
  venues: Venue[];
  value: VenueValue;
  onChange: (next: VenueValue) => void;
  allowSame?: boolean;
}) {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const set = (patch: Partial<VenueValue>) => onChange({ ...value, ...patch });
  const selected = venues.find((v) => v.id === value.choice);

  function fillCurrentLocation() {
    setLocError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) });
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get your location. Allow location access, or tap the venue on the map.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
  }

  return (
    <div className="space-y-3">
      {(venues.length > 0 || allowSame) && (
        <select
          id={`${id}-choice`}
          value={value.choice}
          onChange={(e) => set({ choice: e.target.value })}
          className={inputClass}
          aria-label="Venue"
        >
          {allowSame && <option value={SAME_VENUE}>Same venue as the event</option>}
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.radius_meters} m)
            </option>
          ))}
          <option value={NEW_VENUE}>+ New venue…</option>
        </select>
      )}

      {selected && (
        <>
          <VenueMap latitude={selected.latitude} longitude={selected.longitude} radiusMeters={selected.radius_meters} />
          <p className="text-xs text-slate-500">
            Students can sign in anywhere inside the gold circle: within {selected.radius_meters} m (
            {describeDistance(selected.radius_meters)}).
          </p>
        </>
      )}

      {value.choice === NEW_VENUE && (
        <div className="space-y-3">
          <input
            id={`${id}-name`}
            placeholder="Venue name (e.g. CMAT Covered Court)"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            className={inputClass}
          />
          <div className="flex gap-3">
            <input
              id={`${id}-lat`}
              inputMode="decimal"
              placeholder="Latitude"
              value={value.latitude}
              onChange={(e) => set({ latitude: e.target.value })}
              className={inputClass}
            />
            <input
              id={`${id}-lng`}
              inputMode="decimal"
              placeholder="Longitude"
              value={value.longitude}
              onChange={(e) => set({ longitude: e.target.value })}
              className={inputClass}
            />
          </div>
          <button type="button" onClick={fillCurrentLocation} disabled={locating} className={btnSecondary}>
            {locating ? "Locating..." : "📍 Use my current location"}
          </button>
          {locError && <p className="text-xs text-red-600">{locError}</p>}

          <VenueMap
            editable
            latitude={parseCoord(value.latitude)}
            longitude={parseCoord(value.longitude)}
            radiusMeters={Number(value.radiusMeters) || 0}
            onChange={(pos) => set({ latitude: String(pos.latitude), longitude: String(pos.longitude) })}
          />
          <p className="text-xs text-slate-500">
            Tap the map or drag the pin to the middle of the venue. Switch to <strong>Satellite</strong> (top right)
            to see the buildings.
          </p>

          <div className="rounded-lg bg-gold-100/60 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor={`${id}-radius`} className="text-sm font-medium text-slate-700">
                Sign-in radius
              </label>
              <input
                id={`${id}-radius`}
                type="range"
                min={20}
                max={1000}
                step={10}
                value={Math.min(1000, Math.max(20, Number(value.radiusMeters) || 20))}
                onChange={(e) => set({ radiusMeters: e.target.value })}
                className="min-w-40 flex-1 accent-brand-700"
                aria-describedby={`${id}-radius-hint`}
              />
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="number"
                  min={20}
                  max={2000}
                  value={value.radiusMeters}
                  onChange={(e) => set({ radiusMeters: e.target.value })}
                  className={`${inputClass} w-24`}
                  aria-label="Radius in meters"
                />
                m
              </label>
            </div>
            <p id={`${id}-radius-hint`} className="mt-1.5 text-xs text-slate-600">
              {describeDistance(Number(value.radiusMeters))}. GPS drifts indoors, so keep it generous (150 m or more
              for gyms and covered courts).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
