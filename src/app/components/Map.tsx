import { useEffect, useRef } from "react";
import L from "leaflet";
import { Tutor } from "../data/tutors";

// @ts-ignore — Vite handles CSS imports at runtime; TS doesn't need to type-check this
import "leaflet/dist/leaflet.css";

export interface GroupLessonPin {
  id:               string
  title:            string
  subject:          string
  scheduled_at:     string
  price:            number
  max_students:     number
  enrollment_count: number
  tutor_id:         string
  tutor_name:       string
  lat:              number | null
  lng:              number | null
}

interface MapProps {
  tutors: Tutor[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  flyTo?: [number, number];
  initialCenter?: [number, number];
  groupLessons?: GroupLessonPin[];
  selectedGroupId?: string;
  onSelectGroup?: (id: string | undefined) => void;
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

function makeGroupPinIcon(lesson: GroupLessonPin, selected: boolean) {
  const badgeBg     = selected ? "#7c3aed" : "#ffffff";
  const badgeColor  = selected ? "#ffffff" : "#4c1d95";
  const badgeBorder = selected ? "#6d28d9" : "#ddd6fe";
  const badgeShadow = selected ? "0 0 0 4px rgba(167,139,250,0.35)" : "none";
  const pinFill     = selected ? "#7c3aed" : "#8b5cf6";
  const pinStroke   = selected ? "#6d28d9" : "#7c3aed";
  const scale       = selected ? "scale(1.15)" : "scale(1)";
  const label       = lesson.price > 0 ? `$${lesson.price}` : "Free";

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;transform:${scale};transition:transform 0.2s;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))">
      <div style="padding:2px 8px;border-radius:9999px;border:2px solid ${badgeBorder};background:${badgeBg};color:${badgeColor};font-weight:700;font-size:12px;white-space:nowrap;box-shadow:${badgeShadow};font-family:sans-serif;display:flex;align-items:center;gap:3px">
        <svg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5'><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg>
        ${label}
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="${pinFill}" stroke="${pinStroke}" stroke-width="1.5">
        <path d="M20 10c0 6-8 13-8 13s-8-7-8-13a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3" fill="white" stroke="none"/>
      </svg>
    </div>`;

  return L.divIcon({ html, className: "", iconSize: [60, 50], iconAnchor: [30, 50] });
}

// Spread markers that share the same location in a small circle so all are visible.
const SEATTLE: [number, number] = [47.6062, -122.3321];

function spreadOverlapping<T extends { id: string; lat: number | null; lng: number | null }>(
  items: T[]
): Record<string, [number, number]> {
  const result: Record<string, [number, number]> = {};

  const base: Record<string, [number, number]> = {};
  items.forEach(t => {
    base[t.id] = [
      t.lat ?? (SEATTLE[0] + (Math.random() - 0.5) * 0.08),
      t.lng ?? (SEATTLE[1] + (Math.random() - 0.5) * 0.08),
    ];
  });

  const groups: Record<string, string[]> = {};
  items.forEach(t => {
    const [lat, lng] = base[t.id];
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    (groups[key] ??= []).push(t.id);
  });

  Object.values(groups).forEach(ids => {
    if (ids.length === 1) {
      result[ids[0]] = base[ids[0]];
      return;
    }
    const [cLat, cLng] = base[ids[0]];
    const radius = 0.0003 + ids.length * 0.00004;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
      result[id] = [cLat + radius * Math.cos(angle), cLng + radius * Math.sin(angle)];
    });
  });

  return result;
}

export function Map({ tutors, selectedId, onSelect, flyTo, initialCenter, groupLessons = [], selectedGroupId, onSelectGroup }: MapProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const markersRef      = useRef<Record<string, L.Marker>>({});
  const groupMarkersRef = useRef<Record<string, L.Marker>>({});
  const onSelectRef     = useRef(onSelect);
  const onSelectGroupRef = useRef(onSelectGroup);
  onSelectRef.current      = onSelect;
  onSelectGroupRef.current = onSelectGroup;

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
      groupMarkersRef.current = {};
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

  // Sync group lesson markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(groupMarkersRef.current).forEach((m: L.Marker) => m.remove());
    groupMarkersRef.current = {};

    const coords = spreadOverlapping(groupLessons);

    groupLessons.forEach((lesson) => {
      const [lat, lng] = coords[lesson.id];
      const marker = L.marker([lat, lng], {
        icon: makeGroupPinIcon(lesson, selectedGroupId === lesson.id),
        zIndexOffset: selectedGroupId === lesson.id ? 900 : 0,
      }).addTo(map);

      marker.on("click", (e) => {
        e.originalEvent.stopPropagation();
        onSelectGroupRef.current?.(lesson.id);
      });

      groupMarkersRef.current[lesson.id] = marker;
    });
  }, [groupLessons, selectedGroupId]);

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
