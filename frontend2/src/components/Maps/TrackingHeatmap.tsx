import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

/* ───────── types ───────── */
export interface HeatmapPoint {
  lat: number;
  lng: number;
  type: 'provider' | 'customer' | 'lead';
  intensity?: number;
  active?: boolean;
  lastSeenAt?: string;
  deviceId?: string;
  platform?: string;
  appVersion?: string;
  /* optional enriched fields */
  name?: string;
  email?: string;
  phone?: string;
  profilePicture?: string;
  profileImage?: string;
  profession?: string;
  rating?: number;
  city?: string;
  providerId?: string;
  userId?: string;
  leadId?: string;
  [key: string]: any;          // allow any extra backend fields
}

interface Props {
  points: HeatmapPoint[];
  center?: [number, number];
  zoom?: number;
  showHeatmap?: boolean;
  showMarkers?: boolean;
  onMarkerClick?: (point: HeatmapPoint) => void;
}

/* ───────── helpers ───────── */
const typeColor: Record<string, string> = {
  provider: '#6366f1',
  customer: '#10b981',
  lead: '#f59e0b',
};
const typeEmoji: Record<string, string> = {
  provider: '🔧',
  customer: '👤',
  lead: '📧',
};

function buildTooltip(p: HeatmapPoint): string {
  const nm = p.name || p.fullName || p.userName || 'Unknown';
  const ph = p.phone || p.phoneNumber || p.mobile || '—';
  const em = p.email || '—';
  const ct = p.city || p.location || '—';
  const rt = p.rating ? `⭐ ${p.rating}` : '';
  const ls = p.lastSeenAt
    ? new Date(p.lastSeenAt).toLocaleString()
    : '—';
  return `
    <div style="font-family:system-ui;min-width:180px;padding:4px 0">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">
        ${typeEmoji[p.type] || '📍'} ${nm}
      </div>
      <div style="font-size:12px;color:#666">Type: <b>${p.type}</b></div>
      <div style="font-size:12px;color:#666">Phone: ${ph}</div>
      <div style="font-size:12px;color:#666">Email: ${em}</div>
      <div style="font-size:12px;color:#666">City: ${ct}</div>
      ${rt ? `<div style="font-size:12px;color:#666">Rating: ${rt}</div>` : ''}
      <div style="font-size:11px;color:#999;margin-top:4px">Last seen: ${ls}</div>
      <div style="font-size:11px;color:#6366f1;margin-top:4px;font-weight:600">
        👆 Click for full details
      </div>
    </div>`;
}

/* ───────── component ───────── */
const TrackingHeatmap: React.FC<Props> = ({
  points,
  center = [20.5937, 78.9629],
  zoom = 5,
  showHeatmap = true,
  showMarkers = true,
  onMarkerClick,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const heatRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);

  /* ── init map once ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  /* ── update layers when points change ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    /* clear old */
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    if (!points.length) return;

    /* heat layer */
    if (showHeatmap) {
      const heatData: [number, number, number][] = points.map((p) => [
        p.lat,
        p.lng,
        p.intensity ?? 0.6,
      ]);
      heatRef.current = (L as any)
        .heatLayer(heatData, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          gradient: {
            0.2: '#3b82f6',
            0.4: '#10b981',
            0.6: '#f59e0b',
            0.8: '#ef4444',
            1.0: '#dc2626',
          },
        })
        .addTo(map);
    }

    /* markers */
    if (showMarkers) {
      points.forEach((p) => {
        const color = typeColor[p.type] || '#6366f1';
        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              width:28px;height:28px;border-radius:50%;
              background:${color};border:3px solid #fff;
              box-shadow:0 2px 8px rgba(0,0,0,.35);
              display:flex;align-items:center;justify-content:center;
              font-size:14px;cursor:pointer;
            ">${typeEmoji[p.type] || '📍'}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);

        /* hover tooltip */
        marker.bindTooltip(buildTooltip(p), {
          direction: 'top',
          offset: [0, -16],
          opacity: 1,
          className: 'tracking-hover-tooltip',
        });

        /* click → parent */
        marker.on('click', () => {
          onMarkerClick?.(p);
        });

        markersRef.current.push(marker);
      });
    }

    /* fit bounds */
    if (points.length > 1) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [points, showHeatmap, showMarkers, onMarkerClick]);

  return (
    <>
      <style>{`
        .tracking-hover-tooltip {
          background: rgba(255,255,255,.97) !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 10px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,.18) !important;
          padding: 8px 12px !important;
        }
        .tracking-hover-tooltip::before {
          border-top-color: rgba(255,255,255,.97) !important;
        }
      `}</style>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 400, borderRadius: 12 }}
      />
    </>
  );
};

export default TrackingHeatmap;