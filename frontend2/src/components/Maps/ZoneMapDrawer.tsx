// src/components/Maps/ZoneMapDrawer.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, useMapEvents, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { PolygonCoordinate } from '../../lib/api';
import { 
  Trash2, 
  RotateCcw, 
  MapPin, 
  Search, 
  X, 
  Loader2, 
  Navigation, 
  CheckCircle,
  Target,
  Crosshair
} from 'lucide-react';

// Fix for default marker icons in Leaflet with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ==================== TYPES ====================
interface LocationSuggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

interface ZoneMapDrawerProps {
  initialCoordinates?: PolygonCoordinate[];
  onChange: (coordinates: PolygonCoordinate[]) => void;
  readOnly?: boolean;
  cityName?: string;
  onZoneNameSuggestion?: (name: string) => void;
}

// ==================== CUSTOM ICONS ====================

// Point marker icon with number
const createPointIcon = (index: number, isFirst: boolean = false, isLast: boolean = false) => {
  const bgColor = isFirst ? '#10b981' : isLast ? '#f59e0b' : '#6366f1';
  const size = isFirst || isLast ? 32 : 28;
  
  return L.divIcon({
    className: 'custom-point-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: linear-gradient(135deg, ${bgColor} 0%, ${adjustColor(bgColor, -20)} 100%);
        border: 3px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: ${isFirst || isLast ? '12px' : '11px'};
        font-weight: 700;
        box-shadow: 0 4px 12px ${bgColor}50, 0 2px 4px rgba(0,0,0,0.2);
        cursor: grab;
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
      ">
        ${isFirst ? '▶' : index + 1}
        ${isLast ? '<div style="position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; background: #ef4444; border-radius: 50%; border: 2px solid white;"></div>' : ''}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Search location marker icon
const createSearchIcon = () => {
  return L.divIcon({
    className: 'search-location-marker',
    html: `
      <div style="position: relative; width: 48px; height: 48px;">
        <div style="
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 12px;
          height: 12px;
          background: rgba(239, 68, 68, 0.3);
          border-radius: 50%;
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 40px;
          height: 40px;
        ">
          <svg viewBox="0 0 24 24" fill="none" style="width: 100%; height: 100%;">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444" stroke="white" stroke-width="1.5"/>
            <circle cx="12" cy="9" r="3" fill="white"/>
          </svg>
        </div>
      </div>
      <style>
        @keyframes ping {
          0% { transform: translateX(-50%) scale(1); opacity: 1; }
          75%, 100% { transform: translateX(-50%) scale(2.5); opacity: 0; }
        }
      </style>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
  });
};

// Helper function to adjust color brightness
function adjustColor(color: string, amount: number): string {
  const clamp = (num: number) => Math.min(255, Math.max(0, num));
  const hex = color.replace('#', '');
  const r = clamp(parseInt(hex.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(hex.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(hex.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ==================== MAP COMPONENTS ====================

// Map click handler component
function MapClickHandler({ 
  onMapClick, 
  readOnly 
}: { 
  onMapClick: (lat: number, lng: number) => void; 
  readOnly?: boolean;
}) {
  useMapEvents({
    click: (e) => {
      if (!readOnly) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to fly to location
function FlyToLocation({ 
  location, 
  zoom = 15 
}: { 
  location: { lat: number; lng: number } | null;
  zoom?: number;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], zoom, { duration: 1.5 });
    }
  }, [location, map, zoom]);
  
  return null;
}

// Component to fly to city
function FlyToCity({ cityName }: { cityName?: string }) {
  const map = useMap();
  
  useEffect(() => {
    if (!cityName) return;
    
    const geocodeCity = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1`
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          map.flyTo([parseFloat(lat), parseFloat(lon)], 12, { duration: 1.5 });
        }
      } catch (error) {
        console.error('Error geocoding city:', error);
      }
    };
    
    geocodeCity();
  }, [cityName, map]);
  
  return null;
}

// Draggable marker component
function DraggableMarker({ 
  position, 
  index, 
  total,
  onDrag, 
  onRemove, 
  readOnly 
}: {
  position: PolygonCoordinate;
  index: number;
  total: number;
  onDrag: (index: number, lat: number, lng: number) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
}) {
  const markerRef = useRef<L.Marker>(null);
  const isFirst = index === 0;
  const isLast = index === total - 1 && total > 1;
  
  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const latlng = marker.getLatLng();
        onDrag(index, latlng.lat, latlng.lng);
      }
    },
    contextmenu(e: L.LeafletMouseEvent) {
      e.originalEvent.preventDefault();
      if (!readOnly) {
        onRemove(index);
      }
    },
  };

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={createPointIcon(index, isFirst, isLast)}
      draggable={!readOnly}
      eventHandlers={eventHandlers}
    >
      {!readOnly && (
        <Popup>
          <div className="text-center p-1">
            <p className="font-semibold text-gray-800">Point {index + 1}</p>
            <p className="text-xs text-gray-500 mt-1">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </p>
            <button
              onClick={() => onRemove(index)}
              className="mt-2 px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
            >
              Remove Point
            </button>
          </div>
        </Popup>
      )}
    </Marker>
  );
}

// Search marker component
function SearchMarker({ position }: { position: { lat: number; lng: number } | null }) {
  if (!position) return null;
  
  return (
    <Marker position={[position.lat, position.lng]} icon={createSearchIcon()}>
      <Popup>
        <div className="text-center p-1">
          <p className="font-semibold text-red-600 flex items-center gap-1 justify-center">
            <Target size={14} />
            Search Location
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Draw your zone boundary around this area
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

// ==================== MAIN COMPONENT ====================
export default function ZoneMapDrawer({ 
  initialCoordinates = [], 
  onChange, 
  readOnly = false, 
  cityName,
  onZoneNameSuggestion
}: ZoneMapDrawerProps) {
  const [coordinates, setCoordinates] = useState<PolygonCoordinate[]>(initialCoordinates);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Default center (India)
  const defaultCenter: [number, number] = [23.2599, 77.4126];
  
  // Update parent when coordinates change
  useEffect(() => {
    onChange(coordinates);
  }, [coordinates, onChange]);

  // Initialize with initial coordinates
  useEffect(() => {
    if (initialCoordinates.length > 0) {
      setCoordinates(initialCoordinates);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        
        // Build search query with city name for better results
        const query = cityName ? `${searchQuery}, ${cityName}` : searchQuery;
        
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'en',
            },
          }
        );
        
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, cityName]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle location selection
  const handleLocationSelect = (suggestion: LocationSuggestion) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    
    setSearchLocation({ lat, lng });
    setFlyToLocation({ lat, lng });
    setSearchQuery(suggestion.display_name.split(',')[0]);
    setShowSuggestions(false);
    setSuggestions([]);
    
    // Suggest zone name
    if (onZoneNameSuggestion) {
      onZoneNameSuggestion(suggestion.display_name.split(',')[0]);
    }
  };

  // Handle map click to add point
  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (readOnly) return;
    
    const newCoord: PolygonCoordinate = { 
      lat: parseFloat(lat.toFixed(6)), 
      lng: parseFloat(lng.toFixed(6)) 
    };
    setCoordinates(prev => [...prev, newCoord]);
  }, [readOnly]);

  // Handle marker drag
  const handleMarkerDrag = useCallback((index: number, lat: number, lng: number) => {
    setCoordinates(prev => {
      const updated = [...prev];
      updated[index] = { 
        lat: parseFloat(lat.toFixed(6)), 
        lng: parseFloat(lng.toFixed(6)) 
      };
      return updated;
    });
  }, []);

  // Remove a point
  const handleRemovePoint = useCallback((index: number) => {
    setCoordinates(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all points
  const handleClearAll = useCallback(() => {
    setCoordinates([]);
    setSearchLocation(null);
    setSearchQuery('');
  }, []);

  // Remove last point
  const handleRemoveLast = useCallback(() => {
    setCoordinates(prev => prev.slice(0, -1));
  }, []);

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchLocation(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Calculate center of polygon for initial view
  const getPolygonCenter = (): [number, number] => {
    if (coordinates.length === 0) return defaultCenter;
    
    const latSum = coordinates.reduce((sum, coord) => sum + coord.lat, 0);
    const lngSum = coordinates.reduce((sum, coord) => sum + coord.lng, 0);
    
    return [latSum / coordinates.length, lngSum / coordinates.length];
  };

  // Convert coordinates to Leaflet format
  const polygonPositions: [number, number][] = coordinates.map(c => [c.lat, c.lng]);
  
  // Check if polygon is valid (at least 3 points)
  const isValidPolygon = coordinates.length >= 3;

  return (
    <div className="relative">
      {/* Search Bar */}
      {!readOnly && (
        <div className="absolute top-3 left-3 right-16 z-[1000]">
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder={cityName ? `Search area in ${cityName}...` : "Search for a location..."}
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm shadow-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" size={18} />
              )}
              {!isSearching && searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div 
                ref={suggestionsRef}
                className="absolute w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="max-h-64 overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.place_id}
                      onClick={() => handleLocationSelect(suggestion)}
                      className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-indigo-50 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="mt-0.5">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                          <MapPin size={16} className="text-red-500" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {suggestion.display_name.split(',')[0]}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {suggestion.display_name.split(',').slice(1, 4).join(',')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Navigation size={10} />
                    Powered by OpenStreetMap
                  </p>
                </div>
              </div>
            )}

            {/* No Results */}
            {showSuggestions && searchQuery.length >= 3 && suggestions.length === 0 && !isSearching && (
              <div className="absolute w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-center">
                <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No locations found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!readOnly && (
        <div className="absolute top-3 right-3 z-[1000] flex gap-2">
          <button
            type="button"
            onClick={handleRemoveLast}
            disabled={coordinates.length === 0}
            className="p-2.5 bg-white rounded-xl shadow-lg hover:bg-amber-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-100"
            title="Undo last point"
          >
            <RotateCcw size={18} className="text-amber-600" />
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            disabled={coordinates.length === 0 && !searchLocation}
            className="p-2.5 bg-white rounded-xl shadow-lg hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-100"
            title="Clear all"
          >
            <Trash2 size={18} className="text-red-500" />
          </button>
        </div>
      )}

      {/* Point Counter Badge */}
      <div className="absolute bottom-20 left-3 z-[1000]">
        <div className={`px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3 ${
          isValidPolygon 
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
            : 'bg-white border border-gray-200 text-gray-700'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isValidPolygon ? 'bg-white/20' : 'bg-indigo-100'
          }`}>
            {isValidPolygon ? (
              <CheckCircle size={18} className="text-white" />
            ) : (
              <Crosshair size={18} className="text-indigo-600" />
            )}
          </div>
          <div>
            <p className="font-bold text-sm">
              {coordinates.length} {coordinates.length === 1 ? 'Point' : 'Points'}
            </p>
            <p className={`text-xs ${isValidPolygon ? 'text-green-100' : 'text-gray-500'}`}>
              {isValidPolygon ? '✓ Valid zone' : `Need ${3 - coordinates.length} more`}
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      {!readOnly && (
        <div className="absolute bottom-3 left-3 right-3 z-[1000]">
          <div className={`px-4 py-3 rounded-xl shadow-lg text-sm ${
            coordinates.length === 0 
              ? 'bg-white border border-gray-200 text-gray-600'
              : coordinates.length < 3
              ? 'bg-indigo-600 text-white'
              : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
          }`}>
            <div className="flex items-center gap-2">
              <MapPin size={16} />
              <span className="font-medium">
                {coordinates.length === 0 
                  ? 'Search for a location or click on the map to start drawing'
                  : coordinates.length < 3
                  ? `Click to add ${3 - coordinates.length} more point${3 - coordinates.length > 1 ? 's' : ''} to complete zone`
                  : '✓ Zone boundary complete! You can add more points or drag to adjust'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <MapContainer
        center={coordinates.length > 0 ? getPolygonCenter() : defaultCenter}
        zoom={coordinates.length > 0 ? 14 : 12}
        style={{ height: '450px', width: '100%' }}
        className="rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Fly to city when selected */}
        {!flyToLocation && <FlyToCity cityName={cityName} />}
        
        {/* Fly to search location */}
        <FlyToLocation location={flyToLocation} zoom={16} />
        
        {/* Click handler */}
        <MapClickHandler onMapClick={handleMapClick} readOnly={readOnly} />
        
        {/* Search location marker */}
        <SearchMarker position={searchLocation} />
        
        {/* Polygon for valid zones */}
        {coordinates.length >= 3 && (
          <Polygon
            positions={polygonPositions}
            pathOptions={{
              color: '#6366f1',
              fillColor: '#6366f1',
              fillOpacity: 0.15,
              weight: 3,
            }}
          />
        )}
        
        {/* Polyline for incomplete zones */}
        {coordinates.length >= 2 && coordinates.length < 3 && (
          <Polyline
            positions={polygonPositions}
            pathOptions={{
              color: '#6366f1',
              weight: 3,
              dashArray: '10, 10',
            }}
          />
        )}
        
        {/* Markers for each point */}
        {coordinates.map((coord, index) => (
          <DraggableMarker
            key={`${coord.lat}-${coord.lng}-${index}`}
            position={coord}
            index={index}
            total={coordinates.length}
            onDrag={handleMarkerDrag}
            onRemove={handleRemovePoint}
            readOnly={readOnly}
          />
        ))}
      </MapContainer>

      {/* Points List - Collapsible */}
      {!readOnly && coordinates.length > 0 && (
        <div className="mt-3">
          <details className="group">
            <summary className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin size={16} className="text-indigo-500" />
                View All Points ({coordinates.length})
              </span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="mt-2 p-3 bg-white border border-gray-200 rounded-xl max-h-48 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {coordinates.map((coord, idx) => (
                  <div 
                    key={idx} 
                    className={`relative group flex items-center gap-2 p-2 rounded-lg border transition-all ${
                      idx === 0 
                        ? 'bg-green-50 border-green-200' 
                        : idx === coordinates.length - 1 
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                      idx === 0 
                        ? 'bg-green-500' 
                        : idx === coordinates.length - 1 
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-500 truncate">
                        {coord.lat.toFixed(4)}, {coord.lng.toFixed(4)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemovePoint(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                      title="Remove point"
                    >
                      <X size={12} className="text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Legend */}
      {!readOnly && coordinates.length > 0 && (
        <div className="mt-2 flex items-center gap-4 px-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Start Point</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
            <span>Middle Points</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span>Last Point</span>
          </div>
          {searchLocation && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>Search Location</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}