import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── fix default marker icons ───────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── dynamically load leaflet.heat ──────────────────────────────────
const loadHeatPlugin = (): Promise<void> =>
  new Promise((resolve) => {
    if ((L as any).heatLayer) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });

/* ────────────────────────────────────────────────────────────────────
   THEME DEFINITIONS
   Using standard OpenStreetMap for maximum street detail (100% Free).
   We use `isDark` to apply a smart CSS filter that turns the map dark
   while keeping all street names perfectly readable.
   ──────────────────────────────────────────────────────────────────── */
interface ThemeColors {
  isDark: boolean;
  primary: string;
  primaryDark: string;
  primaryGlow: string;
  secondary: string;
  secondaryDark: string;
  secondaryGlow: string;
  accent: string;
  accentDark: string;
  accentGlow: string;
  bg: string;
  bgCard: string;
  bgPopupHeader: string;
  bgPopupBody: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  heatGradient: Record<number, string>;
  legendBg: string;
  legendBorder: string;
}

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const THEME_MAP: Record<string, ThemeColors> = {
  light: {
    isDark: false,
    primary: '#6366f1',    primaryDark: '#4f46e5',    primaryGlow: '#818cf8',
    secondary: '#10b981',  secondaryDark: '#059669',  secondaryGlow: '#34d399',
    accent: '#f59e0b',     accentDark: '#d97706',     accentGlow: '#fbbf24',
    bg: '#f8fafc',         bgCard: '#ffffff',
    bgPopupHeader: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    bgPopupBody: '#ffffff',
    textPrimary: '#1e293b', textSecondary: '#64748b',
    border: '#e2e8f0',
    heatGradient: { 0.1: '#dbeafe', 0.2: '#93c5fd', 0.3: '#6366f1', 0.4: '#818cf8', 0.5: '#10b981', 0.6: '#34d399', 0.7: '#f59e0b', 0.8: '#ef4444', 0.9: '#dc2626', 1.0: '#ff0040' },
    legendBg: 'rgba(255,255,255,0.95)',
    legendBorder: '#e2e8f0',
  },
  dark: {
    isDark: true,
    primary: '#818cf8',    primaryDark: '#6366f1',    primaryGlow: '#a5b4fc',
    secondary: '#34d399',  secondaryDark: '#10b981',  secondaryGlow: '#6ee7b7',
    accent: '#fbbf24',     accentDark: '#f59e0b',     accentGlow: '#fde68a',
    bg: '#0f172a',         bgCard: '#1e293b',
    bgPopupHeader: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    bgPopupBody: '#1e293b',
    textPrimary: '#f1f5f9', textSecondary: '#94a3b8',
    border: '#334155',
    heatGradient: { 0.1: '#0d1b2a', 0.2: '#1b263b', 0.3: '#6366f1', 0.4: '#818cf8', 0.5: '#34d399', 0.6: '#6ee7b7', 0.7: '#fbbf24', 0.8: '#ef4444', 0.9: '#dc2626', 1.0: '#ff0040' },
    legendBg: 'rgba(15,23,42,0.95)',
    legendBorder: '#334155',
  },
  purple: {
    isDark: true,
    primary: '#a855f7',    primaryDark: '#9333ea',    primaryGlow: '#c084fc',
    secondary: '#ec4899',  secondaryDark: '#db2777',  secondaryGlow: '#f472b6',
    accent: '#f59e0b',     accentDark: '#d97706',     accentGlow: '#fbbf24',
    bg: '#0c0515',         bgCard: '#1a0a2e',
    bgPopupHeader: 'linear-gradient(135deg, #9333ea, #ec4899)',
    bgPopupBody: '#1a0a2e',
    textPrimary: '#f5f3ff', textSecondary: '#a78bfa',
    border: '#581c87',
    heatGradient: { 0.1: '#0c0515', 0.2: '#1a0a2e', 0.3: '#7c3aed', 0.4: '#a855f7', 0.5: '#ec4899', 0.6: '#f472b6', 0.7: '#fbbf24', 0.8: '#ef4444', 0.9: '#dc2626', 1.0: '#ff0040' },
    legendBg: 'rgba(12,5,21,0.95)',
    legendBorder: '#581c87',
  },
  ocean: {
    isDark: true,
    primary: '#06b6d4',    primaryDark: '#0891b2',    primaryGlow: '#22d3ee',
    secondary: '#0ea5e9',  secondaryDark: '#0284c7',  secondaryGlow: '#38bdf8',
    accent: '#f59e0b',     accentDark: '#d97706',     accentGlow: '#fbbf24',
    bg: '#021526',         bgCard: '#0a2540',
    bgPopupHeader: 'linear-gradient(135deg, #0891b2, #0ea5e9)',
    bgPopupBody: '#0a2540',
    textPrimary: '#e0f2fe', textSecondary: '#7dd3fc',
    border: '#164e63',
    heatGradient: { 0.1: '#021526', 0.2: '#0a2540', 0.3: '#0891b2', 0.4: '#06b6d4', 0.5: '#0ea5e9', 0.6: '#38bdf8', 0.7: '#fbbf24', 0.8: '#ef4444', 0.9: '#dc2626', 1.0: '#ff0040' },
    legendBg: 'rgba(2,21,38,0.95)',
    legendBorder: '#164e63',
  },
  forest: {
    isDark: true,
    primary: '#22c55e',    primaryDark: '#16a34a',    primaryGlow: '#4ade80',
    secondary: '#84cc16',  secondaryDark: '#65a30d',  secondaryGlow: '#a3e635',
    accent: '#f59e0b',     accentDark: '#d97706',     accentGlow: '#fbbf24',
    bg: '#052e16',         bgCard: '#14532d',
    bgPopupHeader: 'linear-gradient(135deg, #16a34a, #22c55e)',
    bgPopupBody: '#14532d',
    textPrimary: '#f0fdf4', textSecondary: '#86efac',
    border: '#166534',
    heatGradient: { 0.1: '#052e16', 0.2: '#14532d', 0.3: '#16a34a', 0.4: '#22c55e', 0.5: '#84cc16', 0.6: '#a3e635', 0.7: '#fbbf24', 0.8: '#ef4444', 0.9: '#dc2626', 1.0: '#ff0040' },
    legendBg: 'rgba(5,46,22,0.95)',
    legendBorder: '#166534',
  },
  sunset: {
    isDark: true,
    primary: '#f97316',    primaryDark: '#ea580c',    primaryGlow: '#fb923c',
    secondary: '#ef4444',  secondaryDark: '#dc2626',  secondaryGlow: '#f87171',
    accent: '#eab308',     accentDark: '#ca8a04',     accentGlow: '#facc15',
    bg: '#1c0a00',         bgCard: '#3b1506',
    bgPopupHeader: 'linear-gradient(135deg, #ea580c, #ef4444)',
    bgPopupBody: '#3b1506',
    textPrimary: '#fff7ed', textSecondary: '#fdba74',
    border: '#7c2d12',
    heatGradient: { 0.1: '#1c0a00', 0.2: '#3b1506', 0.3: '#ea580c', 0.4: '#f97316', 0.5: '#ef4444', 0.6: '#f87171', 0.7: '#facc15', 0.8: '#dc2626', 0.9: '#b91c1c', 1.0: '#ff0040' },
    legendBg: 'rgba(28,10,0,0.95)',
    legendBorder: '#7c2d12',
  },
};

function getActiveTheme(): string {
  try {
    const stored = localStorage.getItem('admin-theme');
    if (stored && THEME_MAP[stored]) return stored;
  } catch {}
  return 'dark';
}

function getTheme(): ThemeColors {
  return THEME_MAP[getActiveTheme()] || THEME_MAP.dark;
}

/* ──────────────────────────────────────────────────────────────────── */

export interface HeatmapPoint {
  lat: number;
  lng: number;
  type: 'customer' | 'provider' | 'lead';
  weight?: number;
  city?: string;
  deviceId?: string;
  lastSeenAt?: number | null;
  active?: boolean;
  userId?: string;
  providerId?: string;
  platform?: string;
  appVersion?: string;
  createdAt?: number | null;
  isServiceable?: boolean;
  isActive?: boolean;
  fcmToken?: string;
  email?: string;
}

interface TrackingHeatmapProps {
  points: HeatmapPoint[];
  loading?: boolean;
  activeFilter?: string;
  onMarkerClick?: (point: HeatmapPoint) => void;
}

const DEFAULT_CENTER: L.LatLngTuple = [23.2526771, 77.4767853]; // Bhopal
const DEFAULT_ZOOM = 13; // Zoomed in a bit more to show street details
const MAX_MARKERS = 500;

/* ── helper: format epoch ms ────────────────────────────────────── */
function fmtDate(v?: number | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function timeAgo(v?: number | null): string {
  if (!v) return '';
  const sec = Math.floor((Date.now() - v) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

/* ════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════ */
const TrackingHeatmap: React.FC<TrackingHeatmapProps> = ({
  points,
  loading = false,
  activeFilter = 'all',
  onMarkerClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const heatLayerRef = useRef<any>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [theme, setTheme] = useState<ThemeColors>(getTheme());

  /* ── listen for theme changes ──────────────────────────────────── */
  useEffect(() => {
    const onStorage = () => setTheme(getTheme());
    window.addEventListener('storage', onStorage);

    // also poll for same-tab changes
    const iv = setInterval(() => {
      const t = getTheme();
      setTheme((prev) => (prev.bg !== t.bg ? t : prev));
    }, 1000);

    return () => { window.removeEventListener('storage', onStorage); clearInterval(iv); };
  }, []);

  /* ── type → colours using current theme ─────────────────────── */
  const typeColor = useCallback((type: string) => {
    switch (type) {
      case 'provider': return { fill: theme.primary, dark: theme.primaryDark, glow: theme.primaryGlow, label: 'Provider', icon: '🔧' };
      case 'lead':     return { fill: theme.accent,  dark: theme.accentDark,  glow: theme.accentGlow,  label: 'Lead',     icon: '📧' };
      default:         return { fill: theme.secondary, dark: theme.secondaryDark, glow: theme.secondaryGlow, label: 'Customer', icon: '👤' };
    }
  }, [theme]);

  /* ── init map ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Using standard highly detailed OSM map
    tileLayerRef.current = L.tileLayer(OSM_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19, // Supports very deep zoom for street details
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setMapReady(true);

    return () => { map.remove(); mapRef.current = null; setMapReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── build popup HTML ──────────────────────────────────────────── */
  const buildPopup = useCallback((p: HeatmapPoint): string => {
    const c = typeColor(p.type);
    const isActive = p.active ?? false;
    const statusDot = isActive
      ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#00ff88;box-shadow:0 0 6px #00ff88;margin-right:6px;"></span><span style="color:#00ff88;font-weight:600;">LIVE</span>`
      : `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-right:6px;"></span><span style="color:#ef4444;font-weight:600;">Offline</span>`;

    const rows: string[] = [];
    const addRow = (label: string, val?: string | null) => {
      if (val) rows.push(`<tr><td style="padding:4px 8px;color:${theme.textSecondary};font-size:11px;white-space:nowrap;">${label}</td><td style="padding:4px 8px;color:${theme.textPrimary};font-size:11px;font-weight:500;">${val}</td></tr>`);
    };

    if (p.type === 'lead') {
      addRow('Email', p.email);
      addRow('Device ID', p.deviceId);
      addRow('City', p.city);
      addRow('Registered', fmtDate(p.createdAt));
    } else {
      addRow(p.type === 'provider' ? 'Provider ID' : 'User ID', p.type === 'provider' ? p.providerId : p.userId);
      addRow('Device ID', p.deviceId);
      addRow('City', p.city);
      addRow('Platform', p.platform);
      addRow('App Version', p.appVersion);
      addRow('Last Seen', p.lastSeenAt ? `${fmtDate(p.lastSeenAt)} (${timeAgo(p.lastSeenAt)})` : '—');
      addRow('Registered', fmtDate(p.createdAt));
      addRow('Serviceable', p.isServiceable != null ? (p.isServiceable ? '✅ Yes' : '❌ No') : undefined);
      addRow('Is Active', p.isActive != null ? (p.isActive ? '✅ Yes' : '❌ No') : undefined);
      addRow('FCM Token', p.fcmToken ? `${p.fcmToken.slice(0, 6)}...${p.fcmToken.slice(-4)}` : undefined);
      if (p.lat && p.lng) addRow('Coordinates', `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);
    }

    return `
      <div style="min-width:260px;max-width:320px;border-radius:12px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid ${theme.border};font-family:system-ui,sans-serif;">
        <div style="background:${theme.bgPopupHeader};padding:12px 14px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:20px;">${c.icon}</span>
          <div style="flex:1;">
            <div style="color:#fff;font-weight:700;font-size:13px;">${c.label} Device</div>
            <div style="color:rgba(255,255,255,0.8);font-size:11px;">${p.deviceId || '—'}</div>
          </div>
          <div>${statusDot}</div>
        </div>
        <div style="background:${theme.bgPopupBody};padding:8px 0;">
          <table style="width:100%;border-collapse:collapse;">${rows.join('')}</table>
        </div>
      </div>
    `;
  }, [theme, typeColor]);

  /* ── render heat + markers ─────────────────────────────────────── */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;

    // clear old heat layer
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    // clear old markers
    if (markerLayerRef.current) markerLayerRef.current.clearLayers();

    if (!points.length) return;

    // filter by activeFilter
    const filtered = activeFilter === 'all'
      ? points
      : points.filter((p) => p.type === activeFilter);

    if (!filtered.length) return;

    /* ── heatmap ──────────────────────────────────────────────────── */
    if (showHeat && (L as any).heatLayer) {
      const heatData = filtered
        .filter((p) => p.lat && p.lng)
        .map((p) => {
          let w = p.weight ?? 1;
          if (p.active) w *= 2.5;
          if (p.type === 'provider') w *= 1.8;
          else if (p.type === 'customer') w *= 1.4;
          return [p.lat, p.lng, w] as [number, number, number];
        });

      if (heatData.length) {
        heatLayerRef.current = (L as any)
          .heatLayer(heatData, {
            radius: 30,
            blur: 20,
            maxZoom: 17,
            max: 6,
            minOpacity: 0.4,
            gradient: theme.heatGradient,
          })
          .addTo(map);
      }
    }

    /* ── markers ───────────────────────────────────────────────────── */
    if (showMarkers && markerLayerRef.current) {
      const markable = filtered.filter((p) => p.lat && p.lng).slice(0, MAX_MARKERS);

      markable.forEach((p) => {
        const c = typeColor(p.type);
        const isActive = p.active ?? false;
        const baseR = p.type === 'provider' ? (isActive ? 10 : 7) : (isActive ? 8 : 6);

        const marker = L.circleMarker([p.lat!, p.lng!], {
          radius: baseR,
          fillColor: c.fill,
          color: c.dark,
          weight: isActive ? 3 : 1.5,
          opacity: 1,
          fillOpacity: isActive ? 0.95 : 0.6,
        });

        // hover effects
        marker.on('mouseover', function (this: L.CircleMarker) {
          this.setStyle({
            radius: baseR + 4,
            weight: 4,
            fillOpacity: 1,
            color: c.glow,
          });
          this.openPopup();
        });
        marker.on('mouseout', function (this: L.CircleMarker) {
          this.setStyle({
            radius: baseR,
            weight: isActive ? 3 : 1.5,
            fillOpacity: isActive ? 0.95 : 0.6,
            color: c.dark,
          });
          this.closePopup();
        });

        // popup
        marker.bindPopup(buildPopup(p), {
          className: 'tracking-popup-custom',
          maxWidth: 340,
          closeButton: false,
          autoPan: true,
        });

        // click handler
        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(p));
        }

        markerLayerRef.current!.addLayer(marker);
      });
    }

    /* ── fit bounds ────────────────────────────────────────────────── */
    const withCoords = filtered.filter((p) => p.lat && p.lng);
    if (withCoords.length > 1) {
      const bounds = L.latLngBounds(withCoords.map((p) => [p.lat!, p.lng!] as L.LatLngTuple));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 }); // Allows closer auto-zoom
    } else if (withCoords.length === 1) {
      map.setView([withCoords[0].lat!, withCoords[0].lng!], 15);
    }
  }, [points, mapReady, showHeat, showMarkers, activeFilter, theme, typeColor, buildPopup, onMarkerClick]);

  /* ── load heat plugin on mount ─────────────────────────────────── */
  useEffect(() => {
    loadHeatPlugin();
  }, []);

  /* ── counts ─────────────────────────────────────────────────────── */
  const counts = {
    customer: points.filter((p) => p.type === 'customer').length,
    provider: points.filter((p) => p.type === 'provider').length,
    lead: points.filter((p) => p.type === 'lead').length,
    active: points.filter((p) => p.active).length,
  };

  /* ── render ─────────────────────────────────────────────────────── */
  return (
    <div 
      className={`relative w-full rounded-2xl overflow-hidden ${theme.isDark ? 'dark-map-container' : ''}`} 
      style={{ height: '600px', background: theme.bg, border: `1px solid ${theme.border}` }}
    >
      {/* map container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center" style={{ background: `${theme.bg}cc` }}>
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: `${theme.primary}33`, borderTopColor: theme.primary }} />
            <span style={{ color: theme.textSecondary, fontSize: 13 }}>Loading map data…</span>
          </div>
        </div>
      )}

      {/* floating legend — top left */}
      <div className="absolute top-3 left-3 z-20 rounded-xl p-3 backdrop-blur-sm" style={{
        background: theme.legendBg,
        border: `1px solid ${theme.legendBorder}`,
        minWidth: 180,
      }}>
        <div style={{ color: theme.textPrimary, fontWeight: 700, fontSize: 12, marginBottom: 8, letterSpacing: 0.5 }}>MAP LEGEND</div>

        {/* type rows */}
        {([
          { key: 'customer', label: 'Customers', icon: '👤', color: theme.secondary },
          { key: 'provider', label: 'Providers', icon: '🔧', color: theme.primary },
          { key: 'lead',     label: 'Leads',     icon: '📧', color: theme.accent },
        ] as const).map((r) => (
          <div key={r.key} className="flex items-center gap-2 py-1">
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: r.color, boxShadow: `0 0 6px ${r.color}` }} />
            <span style={{ color: theme.textSecondary, fontSize: 11, flex: 1 }}>{r.icon} {r.label}</span>
            <span style={{ color: theme.textPrimary, fontWeight: 700, fontSize: 12 }}>{counts[r.key]}</span>
          </div>
        ))}

        <div style={{ borderTop: `1px solid ${theme.border}`, margin: '6px 0' }} />
        <div className="flex items-center gap-2">
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
          <span style={{ color: theme.textSecondary, fontSize: 11, flex: 1 }}>Active Now</span>
          <span style={{ color: '#00ff88', fontWeight: 700, fontSize: 12 }}>{counts.active}</span>
        </div>
        <div style={{ color: theme.textSecondary, fontSize: 10, marginTop: 6 }}>Total: {points.length}</div>
      </div>

      {/* toggle controls — top right */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <button
          onClick={() => setShowHeat((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: showHeat ? theme.primary : `${theme.bgCard}cc`,
            color: showHeat ? '#fff' : theme.textSecondary,
            border: `1px solid ${showHeat ? theme.primaryDark : theme.border}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          🌡️ Heatmap
        </button>
        <button
          onClick={() => setShowMarkers((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: showMarkers ? theme.secondary : `${theme.bgCard}cc`,
            color: showMarkers ? '#fff' : theme.textSecondary,
            border: `1px solid ${showMarkers ? theme.secondaryDark : theme.border}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          📍 Markers
        </button>
      </div>

      {/* performance warning */}
      {points.length > MAX_MARKERS && (
        <div className="absolute bottom-3 left-3 z-20 px-3 py-1.5 rounded-lg text-xs font-medium" style={{
          background: `${theme.accentDark}dd`,
          color: '#fff',
          backdropFilter: 'blur(8px)',
        }}>
          ⚡ Showing {MAX_MARKERS} of {points.length} markers for performance
        </div>
      )}

      {/* custom popup + scrollbar + DARK MODE MAP FILTER styles */}
      <style>{`
        /* 
          MAGIC DARK MODE FILTER FOR OPENSTREETMAP 
          This turns the highly detailed OSM into a beautiful dark map 
          while keeping all text readable and free!
        */
        .dark-map-container .leaflet-tile-pane {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }

        .tracking-popup-custom .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 12px !important;
        }
        .tracking-popup-custom .leaflet-popup-content {
          margin: 0 !important;
        }
        .tracking-popup-custom .leaflet-popup-tip {
          background: ${theme.bgPopupBody} !important;
        }
        .leaflet-control-attribution {
          background: ${theme.bg}cc !important;
          color: ${theme.textSecondary} !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a {
          color: ${theme.primary} !important;
        }
        .leaflet-control-zoom a {
          background: ${theme.bgCard} !important;
          color: ${theme.textPrimary} !important;
          border-color: ${theme.border} !important;
        }
        .leaflet-control-zoom a:hover {
          background: ${theme.primary} !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  );
};

export default TrackingHeatmap;