import { useEffect, useRef } from "react";
import L from "leaflet";
import { Tutor } from "../data/tutors";

// @ts-ignore — Vite handles CSS imports at runtime; TS doesn't need to type-check this
import "leaflet/dist/leaflet.css";

interface MapProps {
  tutors: Tutor[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  flyTo?: [number, number];
}

function makePinIcon(tutor: Tutor, selected: boolean) {
  const badgeBg     = selected ? "#2563eb" : "#ffffff";
  const badgeColor  = selected ? "#ffffff" : "#111827";
  const badgeBorder = selected ? "#1d4ed8" : "#e5e7eb";
  const badgeShadow = selected ? "0 0 0 4px rgba(96,165,250,0.35)" : "none";
  const pinFill     = selected ? "#2563eb" : "#3b82f6";
  const pinStroke   = selected ? "#1d4ed8" : "#2563eb";
  const scale       = selected ? "scale(1.15)" : "scale(1)";

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;transform:${scale};transition:transform 0.2s;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))">
      <div style="padding:3px 10px;border-radius:9999px;border:2px solid ${badgeBorder};background:${badgeBg};color:${badgeColor};font-weight:700;font-size:13px;white-space:nowrap;box-shadow:${badgeShadow};font-family:sans-serif">
        $${tutor.hourlyRate}
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="${pinFill}" stroke="${pinStroke}" stroke-width="1.5">
        <path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3" fill="white" stroke="none"/>
      </svg>
    </div>`;

  return L.divIcon({ html, className: "", iconSize: [60, 52], iconAnchor: [30, 52] });
}

export function Map({ tutors, selectedId, onSelect, flyTo }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<Record<string, L.Marker>>({});
  const onSelectRef  = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Initialise the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      [47.6062, -122.3321],
      12
    );

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", () => onSelectRef.current(undefined));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // Sync markers whenever tutors or selectedId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove all existing markers
    Object.values(markersRef.current).forEach((m: L.Marker) => m.remove());
    markersRef.current = {};

    // Tutors without geocoded coords get spread around Seattle as a fallback
    const SEATTLE: [number, number] = [47.6062, -122.3321];
    tutors.forEach((tutor) => {
        const lat = tutor.lat ?? (SEATTLE[0] + (Math.random() - 0.5) * 0.08);
        const lng = tutor.lng ?? (SEATTLE[1] + (Math.random() - 0.5) * 0.08);
        const marker = L.marker([lat, lng], {
          icon: makePinIcon(tutor, selectedId === tutor.id),
          zIndexOffset: selectedId === tutor.id ? 1000 : 0,
        }).addTo(map);

        marker.on("click", (e) => {
          e.originalEvent.stopPropagation();
          onSelectRef.current(tutor.id);
        });

        markersRef.current[tutor.id] = marker;
      });
  }, [tutors, selectedId]);

  // Pan to selected tutor
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const tutor = tutors.find((t) => t.id === selectedId);
    if (tutor?.lat != null && tutor?.lng != null) {
      mapRef.current.panTo([tutor.lat, tutor.lng], { animate: true });
    }
  }, [selectedId, tutors]);

  // Fly to searched location
  useEffect(() => {
    if (!mapRef.current || !flyTo) return;
    mapRef.current.flyTo(flyTo, 13, { animate: true, duration: 1 });
  }, [flyTo]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
