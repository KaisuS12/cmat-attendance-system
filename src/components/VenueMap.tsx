"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Default view before a venue is placed: the KCC campus gym.
const DEFAULT_CENTER: L.LatLngTuple = [9.9823, 122.8195];

const pinIcon = L.divIcon({
  className: "",
  html: '<div class="venue-pin"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const CIRCLE_STYLE: L.CircleMarkerOptions = {
  color: "#e8b100",
  weight: 2,
  fillColor: "#f9cb1e",
  fillOpacity: 0.25,
};

function isValid(lat: number | null, lng: number | null): lat is number {
  return lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Map of a venue and its sign-in radius: the gold circle is exactly the area
// students can generate a QR code from. When editable, tapping the map or
// dragging the pin moves the venue.
export default function VenueMap({
  latitude,
  longitude,
  radiusMeters,
  editable = false,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  editable?: boolean;
  onChange?: (pos: { latitude: number; longitude: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  // Position last reported by the map itself; when props echo it back we
  // don't re-fit the view (that would jump while the officer is working).
  const lastEmittedRef = useRef<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Imagery &copy; Esri" }
    );

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 17,
      layers: [satellite],
      scrollWheelZoom: false, // don't hijack page scrolling; use +/- or pinch
    });
    L.control.layers({ Satellite: satellite, Map: streets }, undefined, { position: "topright" }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);

    if (editable) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        const pos = { latitude: Number(e.latlng.lat.toFixed(6)), longitude: Number(e.latlng.lng.toFixed(6)) };
        lastEmittedRef.current = `${pos.latitude},${pos.longitude}`;
        onChangeRef.current?.(pos);
      });
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, [editable]);

  // Keep the pin and circle in sync with the form.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!isValid(latitude, longitude)) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }

    const latlng: L.LatLngTuple = [latitude, longitude!];
    const radius = Math.max(1, radiusMeters || 0);

    if (!circleRef.current) {
      circleRef.current = L.circle(latlng, { ...CIRCLE_STYLE, radius }).addTo(map);
    } else {
      circleRef.current.setLatLng(latlng);
      circleRef.current.setRadius(radius);
    }

    if (!markerRef.current) {
      const marker = L.marker(latlng, { icon: pinIcon, draggable: editable, keyboard: false }).addTo(map);
      marker.on("drag", () => circleRef.current?.setLatLng(marker.getLatLng()));
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        const pos = { latitude: Number(p.lat.toFixed(6)), longitude: Number(p.lng.toFixed(6)) };
        lastEmittedRef.current = `${pos.latitude},${pos.longitude}`;
        onChangeRef.current?.(pos);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(latlng);
    }

    const key = `${latitude},${longitude}`;
    if (lastEmittedRef.current === key) {
      // Change came from the map itself; just make sure the circle fits.
      lastEmittedRef.current = null;
      if (!map.getBounds().contains(circleRef.current.getBounds())) {
        map.fitBounds(circleRef.current.getBounds(), { padding: [24, 24] });
      }
    } else {
      map.fitBounds(circleRef.current.getBounds(), { padding: [24, 24], maxZoom: 19 });
    }
  }, [latitude, longitude, radiusMeters, editable]);

  const placed = isValid(latitude, longitude);

  return (
    <div className="relative isolate overflow-hidden rounded-lg border border-slate-200">
      <div ref={containerRef} className="h-64 w-full sm:h-80" aria-label="Venue map" role="application" />
      {editable && !placed && (
        <p className="pointer-events-none absolute inset-x-0 top-2 z-[1000] mx-auto w-fit rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-brand-800 shadow">
          Tap the map to place the venue
        </p>
      )}
    </div>
  );
}
