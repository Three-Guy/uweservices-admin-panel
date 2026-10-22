import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, CircleMarker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { HeatmapPoint } from '../../lib/api';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TYPE_COLORS: Record<string, string> = {
  customer: '#10b981',
  provider: '#3b82f6',
  lead: '#f59e0b',
};

const TYPE_LABELS: Record<string, string> = {
  customer: 'Customer',
  provider: 'Provider',
  lead: 'Lead',
};

interface Props {
  points: HeatmapPoint[];
}

const HeatmapLayer: React.FC<{ points: HeatmapPoint[] }> = ({ points }) => {
  const map = useMap();
  const heatRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const mod = await import('leaflet.heat');
        if (cancelled) return;
        const heatLayer = (mod as any).default || mod;

        if (heatRef.current) {
          map.removeLayer(heatRef.current);
        }

        if (points.length === 0) return;

        const heatData = points
          .filter((p) => p.lat != null && p.lng != null)
          .map((p) => [p.lat, p.lng, p.weight || 1] as [number, number, number]);

        if (heatData.length === 0) return;

        const layer = (heatLayer as any)(heatData, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          max: 1.0,
          gradient: {
            0.2: '#3b82f6',
            0.4: '#10b981',
            0.6: '#f59e0b',
            0.8: '#ef4444',
            1.0: '#dc2626',
          },
        });

        layer.addTo(map);
        heatRef.current = layer;
      } catch (err) {
        console.warn('leaflet.heat not installed, skipping heat layer:', err);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (heatRef.current) {
        map.removeLayer(heatRef.current);
        heatRef.current = null;
      }
    };
  }, [map, points]);

  return null;
};

const FitBounds: React.FC<{ points: HeatmapPoint[] }> = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    const valid = points.filter((p) => p.lat != null && p.lng != null);
    if (valid.length === 0) return;

    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 13);
      return;
    }

    const bounds = L.latLngBounds(valid.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);

  return null;
};

const TrackingHeatmap: React.FC<Props> = ({ points }) => {
  const [showMarkers, setShowMarkers] = useState(true);

  useEffect(() => {
    setShowMarkers(points.length <= 300);
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-gray-50 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📍</div>
          <p className="font-medium">No location data available</p>
          <p className="text-sm text-gray-400 mt-1">Devices will appear here once they report their location</p>
        </div>
      </div>
    );
  }

  const validPoints = points.filter((p) => p.lat != null && p.lng != null);
  const center: [number, number] = validPoints.length > 0
    ? [validPoints[0].lat, validPoints[0].lng]
    : [23.2526771, 77.4767853];

  return (
    <div className="relative">
      <MapContainer
        center={center}
        zoom={12}
        className="h-[500px] w-full z-0"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <HeatmapLayer points={validPoints} />
        <FitBounds points={validPoints} />

        {showMarkers && validPoints.map((p, i) => (
          <CircleMarker
            key={`${p.deviceId}-${i}`}
            center={[p.lat, p.lng]}
            radius={6}
            pathOptions={{
              color: TYPE_COLORS[p.type] || '#6b7280',
              fillColor: TYPE_COLORS[p.type] || '#6b7280',
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Popup>
              <div className="text-xs">
                <div className="font-bold mb-1" style={{ color: TYPE_COLORS[p.type] }}>
                  {TYPE_LABELS[p.type] || p.type}
                </div>
                {p.deviceId && <div>Device: {p.deviceId}</div>}
                {p.city && <div>City: {p.city}</div>}
                {p.lastSeenAt && <div>Last seen: {new Date(p.lastSeenAt).toLocaleString()}</div>}
                <div>Status: {p.active ? '🟢 Active' : '⚪ Idle'}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg shadow-lg p-3 z-[1000] text-xs">
        <div className="font-semibold text-gray-700 mb-2">Legend</div>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            <span className="text-gray-600">{TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      {/* Count badge */}
      <div className="absolute top-4 right-4 bg-emerald-600 text-white px-3 py-1.5 rounded-full shadow-lg z-[1000] text-sm font-medium">
        {validPoints.length} points
      </div>
    </div>
  );
};

export default TrackingHeatmap;