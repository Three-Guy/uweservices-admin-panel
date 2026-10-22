import { useState, useEffect, useCallback, useRef } from "react";
import {
  MapPin,
  Users,
  Radio,
  Mail,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  Smartphone,
  Filter,
  Loader2,
  AlertCircle,
  BarChart3,
  Navigation,
  Globe,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  trackingApi,
  type TrackingStats,
  type TrackingDevice,
  type TrackingLead,
  type HeatmapPoint,
} from "../lib/api";
import TrackingHeatmap from "../components/Maps/TrackingHeatmap";

type TabKey = "heatmap" | "devices" | "leads";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "heatmap", label: "Heatmap", icon: <MapPin className="w-4 h-4" /> },
  { key: "devices", label: "Devices", icon: <Smartphone className="w-4 h-4" /> },
  { key: "leads", label: "Email Leads", icon: <Mail className="w-4 h-4" /> },
];

function formatTime(epochMs: number | undefined | null): string {
  if (!epochMs) return "—";
  const d = new Date(epochMs);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(epochMs: number | undefined | null): string {
  if (!epochMs) return "—";
  const diff = Date.now() - epochMs;
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function maskFcm(token: string | undefined | null): string {
  if (!token) return "—";
  if (token.length <= 12) return "••••••";
  return token.slice(0, 6) + "••••" + token.slice(-4);
}

export default function LiveTracking() {
  const [activeTab, setActiveTab] = useState<TabKey>("heatmap");
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [devices, setDevices] = useState<TrackingDevice[]>([]);
  const [leads, setLeads] = useState<TrackingLead[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);

  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);

  const [devicePage, setDevicePage] = useState(1);
  const [leadPage, setLeadPage] = useState(1);
  const [deviceTotalPages, setDeviceTotalPages] = useState(1);
  const [leadTotalPages, setLeadTotalPages] = useState(1);
  const PAGE_SIZE = 25;

  const [deviceSearch, setDeviceSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<"all" | "customer" | "provider">("all");
  const [devicePlatformFilter, setDevicePlatformFilter] = useState("");
  const [deviceActiveFilter, setDeviceActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [cityFilter, setCityFilter] = useState("");

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await trackingApi.getStats();
      if (res.success && res.data) {
        setStats(res.data);
        setError(null);
      }
    } catch (err: any) {
      console.error("Failed to fetch tracking stats:", err);
      setError("Could not load tracking stats");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      const params: Record<string, any> = {
        type: deviceTypeFilter,
        page: devicePage,
        limit: PAGE_SIZE,
      };
      if (cityFilter) params.city = cityFilter;
      if (devicePlatformFilter) params.platform = devicePlatformFilter;
      if (deviceActiveFilter !== "all") params.active = deviceActiveFilter === "active";
      if (deviceSearch.trim()) params.search = deviceSearch.trim();

      const res = await trackingApi.getDevices(params);
      if (res.success && res.data) {
        const d = res.data as any;
        setDevices(d.devices || d.data || []);
        setDeviceTotalPages(d.totalPages || Math.ceil((d.total || 0) / PAGE_SIZE) || 1);
      }
    } catch (err: any) {
      console.error("Failed to fetch devices:", err);
    } finally {
      setLoadingDevices(false);
    }
  }, [deviceTypeFilter, devicePlatformFilter, deviceActiveFilter, cityFilter, deviceSearch, devicePage]);

  const fetchLeads = useCallback(async () => {
    try {
      setLoadingLeads(true);
      const params: Record<string, any> = {
        page: leadPage,
        limit: PAGE_SIZE,
      };
      if (cityFilter) params.city = cityFilter;
      if (leadSearch.trim()) params.search = leadSearch.trim();

      const res = await trackingApi.getLeads(params);
      if (res.success && res.data) {
        const d = res.data as any;
        setLeads(d.leads || d.data || []);
        setLeadTotalPages(d.totalPages || Math.ceil((d.total || 0) / PAGE_SIZE) || 1);
      }
    } catch (err: any) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  }, [cityFilter, leadSearch, leadPage]);

  const fetchHeatmap = useCallback(async () => {
    try {
      setLoadingHeatmap(true);
      const params: Record<string, any> = { type: "all" };
      if (cityFilter) params.city = cityFilter;

      const res = await trackingApi.getHeatmap(params);
      if (res.success && res.data) {
        const d = res.data as any;
        setHeatmapPoints(d.points || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch heatmap:", err);
    } finally {
      setLoadingHeatmap(false);
    }
  }, [cityFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === "devices") fetchDevices();
  }, [activeTab, fetchDevices]);

  useEffect(() => {
    if (activeTab === "leads") fetchLeads();
  }, [activeTab, fetchLeads]);

  useEffect(() => {
    if (activeTab === "heatmap") fetchHeatmap();
  }, [activeTab, fetchHeatmap]);

  useEffect(() => {
    if (autoRefresh) {
      refreshTimer.current = setInterval(() => {
        fetchStats();
        if (activeTab === "heatmap") fetchHeatmap();
        if (activeTab === "devices") fetchDevices();
        if (activeTab === "leads") fetchLeads();
        setLastRefresh(new Date());
      }, 30000);
    }
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [autoRefresh, activeTab, fetchStats, fetchHeatmap, fetchDevices, fetchLeads]);

  const handleManualRefresh = () => {
    fetchStats();
    fetchHeatmap();
    fetchDevices();
    fetchLeads();
    setLastRefresh(new Date());
  };

  const topCities = stats?.byCity
    ? Object.entries(stats.byCity)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
        .map(([city]) => city)
    : [];

  const StatCard = ({
    icon,
    label,
    value,
    highlight,
    color,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    highlight?: boolean;
    color: string;
  }) => (
    <div
      className={`rounded-xl p-4 border ${
        highlight
          ? "bg-emerald-50 border-emerald-300 shadow-md shadow-emerald-100"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-emerald-700" : "text-gray-900"}`}>
        {loadingStats ? "…" : value}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white px-6 py-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl">
              <Navigation className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Live Tracking</h1>
              <p className="text-emerald-100 text-sm">
                Real-time device & lead monitoring across all databases
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-emerald-300 w-4 h-4"
              />
              Auto-refresh (30s)
            </label>
            <button
              onClick={handleManualRefresh}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm transition"
            >
              <RefreshCw className={`w-4 h-4 ${loadingStats ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {lastRefresh && (
              <span className="text-xs text-emerald-200 hidden sm:inline">
                <Clock className="w-3 h-3 inline mr-1" />
                {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            icon={<Smartphone className="w-4 h-4" />}
            label="Total Devices"
            value={stats?.totalDevices ?? 0}
            color="text-blue-500"
          />
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Active Now"
            value={stats?.activeNow ?? 0}
            highlight
            color="text-emerald-600"
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Customers"
            value={stats?.totalCustomers ?? 0}
            color="text-emerald-500"
          />
          <StatCard
            icon={<Globe className="w-4 h-4" />}
            label="Providers"
            value={stats?.totalProviders ?? 0}
            color="text-blue-600"
          />
          <StatCard
            icon={<Mail className="w-4 h-4" />}
            label="Email Leads"
            value={stats?.totalLeads ?? 0}
            color="text-amber-500"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={cityFilter}
            onChange={(e) => {
              setCityFilter(e.target.value);
              setDevicePage(1);
              setLeadPage(1);
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          >
            <option value="">All Cities</option>
            {topCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {topCities.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {topCities.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCityFilter(c);
                    setDevicePage(1);
                    setLeadPage(1);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    cityFilter === c
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "heatmap" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loadingHeatmap && heatmapPoints.length === 0 ? (
              <div className="flex items-center justify-center h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : (
              <TrackingHeatmap points={heatmapPoints} />
            )}
          </div>
        )}

        {activeTab === "devices" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by device ID or user ID…"
                  value={deviceSearch}
                  onChange={(e) => {
                    setDeviceSearch(e.target.value);
                    setDevicePage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                />
              </div>
              <select
                value={deviceTypeFilter}
                onChange={(e) => {
                  setDeviceTypeFilter(e.target.value as any);
                  setDevicePage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="all">All Types</option>
                <option value="customer">Customer</option>
                <option value="provider">Provider</option>
              </select>
              <select
                value={devicePlatformFilter}
                onChange={(e) => {
                  setDevicePlatformFilter(e.target.value);
                  setDevicePage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">All Platforms</option>
                <option value="android">Android</option>
                <option value="ios">iOS</option>
              </select>
              <select
                value={deviceActiveFilter}
                onChange={(e) => {
                  setDeviceActiveFilter(e.target.value as any);
                  setDevicePage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {loadingDevices ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No devices found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Device ID</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">User / Provider</th>
                      <th className="px-4 py-3 font-medium">City</th>
                      <th className="px-4 py-3 font-medium">Platform</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Last Seen</th>
                      <th className="px-4 py-3 font-medium">FCM Token</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {devices.map((dev) => {
                      const isCustomer = !!(dev as any).userId;
                      return (
                        <tr key={dev._id || dev.deviceId} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {dev.deviceId?.slice(0, 12)}…
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                isCustomer
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {isCustomer ? "Customer" : "Provider"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                            {(dev as any).userId || (dev as any).providerId || "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{dev.city || "—"}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                              {dev.platform || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                            {dev.lat && dev.lng
                              ? `${Number(dev.lat).toFixed(4)}, ${Number(dev.lng).toFixed(4)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {dev.isActive ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                <Wifi className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <WifiOff className="w-3 h-3" /> Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            <span title={formatTime(dev.lastSeenAt)}>{timeAgo(dev.lastSeenAt)}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                            {maskFcm(dev.fcmToken)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {devices.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500">
                  Page {devicePage} of {deviceTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={devicePage <= 1}
                    onClick={() => setDevicePage((p) => p - 1)}
                    className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={devicePage >= deviceTotalPages}
                    onClick={() => setDevicePage((p) => p + 1)}
                    className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "leads" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by email or device ID…"
                  value={leadSearch}
                  onChange={(e) => {
                    setLeadSearch(e.target.value);
                    setLeadPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            {loadingLeads ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Mail className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No email leads found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Device ID</th>
                      <th className="px-4 py-3 font-medium">City</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.map((lead, idx) => (
                      <tr key={lead._id || idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {(leadPage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-800">{lead.email || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {lead.deviceId?.slice(0, 16)}…
                        </td>
                        <td className="px-4 py-3 text-gray-600">{lead.city || "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {formatTime(lead.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {leads.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                <span className="text-xs text-gray-500">
                  Page {leadPage} of {leadTotalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={leadPage <= 1}
                    onClick={() => setLeadPage((p) => p - 1)}
                    className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={leadPage >= leadTotalPages}
                    onClick={() => setLeadPage((p) => p + 1)}
                    className="p-1.5 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}