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
  initialCenter?: [number, number];
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

// Spread markers that share the same location in a small circle so all are visible.
const SEATTLE: [number, number] = [47.6062, -122.3321];

function spreadOverlapping(tutors: Tutor[]): Record<string, [number, number]> {
  const result: Record<string, [number, number]> = {};

  // Assign base coords (fallback for ungeocoded tutors stays random per call)
  const base: Record<string, [number, number]> = {};
  tutors.forEach(t => {
    base[t.id] = [
      t.lat ?? (SEATTLE[0] + (Math.random() - 0.5) * 0.08),
      t.lng ?? (SEATTLE[1] + (Math.random() - 0.5) * 0.08),
    ];
  });

  // Group by rounded coords (4 dp ≈ 11 m — catches same-address duplicates)
  const groups: Record<string, string[]> = {};
  tutors.forEach(t => {
    const [lat, lng] = base[t.id];
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    (groups[key] ??= []).push(t.id);
  });

  Object.values(groups).forEach(ids => {
    if (ids.length === 1) {
      result[ids[0]] = base[ids[0]];
      return;
    }
    // Place in a circle; radius grows slightly with group size
    const [cLat, cLng] = base[ids[0]];
    const radius = 0.0003 + ids.length * 0.00004;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
      result[id] = [cLat + radius * Math.cos(angle), cLng + radius * Math.sin(angle)];
    });
  });

  return result;
}

export function Map({ tutors, selectedId, onSelect, flyTo, initialCenter }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<Record<string, L.Marker>>({});
  const onSelectRef  = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Initialise the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true }).setView(
      initialCenter ?? [47.6062, -122.3321],
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

    Object.values(markersRef.current).forEach((m: L.Marker) => m.remove());
    markersRef.current = {};

    const coords = spreadOverlapping(tutors);

    tutors.forEach((tutor) => {
      const [lat, lng] = coords[tutor.id];
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
