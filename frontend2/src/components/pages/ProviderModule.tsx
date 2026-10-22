// src/components/pages/ProviderModule.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { providersApi, ProviderStats, ProviderFilters, DetailedProvider, Pagination } from "../../lib/api";
import { format, formatDistanceToNow } from "date-fns";
import {
  Search, Filter, ChevronDown, ChevronUp, RefreshCw, Users,
  UserCheck, UserX, Clock, ShieldAlert, TrendingUp, Eye,
  Star, MapPin, Phone, Mail, CheckCircle2, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, Loader2, SlidersHorizontal, X
} from "lucide-react";

/* ───────── helpers ───────── */
const getVerificationBadge = (status?: string) => {
  switch (status) {
    case "verified":
    case "approved":
      return { label: "Verified", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    case "pending":
    case "incomplete":
      return { label: "Pending", cls: "bg-amber-100 text-amber-700 border-amber-200" };
    case "rejected":
      return { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" };
    default:
      return { label: "Unknown", cls: "bg-gray-100 text-gray-600 border-gray-200" };
  }
};

const getProfileImage = (p: any): string => {
  return (
    p.profilePicture ||
    p.profileImage ||
    p.profilePhoto ||
    p.selfieImage?.url ||
    ""
  );
};

const getRatingValue = (r: any): number => {
  if (typeof r === "number") return r;
  if (r && typeof r === "object" && typeof r.average === "number") return r.average;
  return 0;
};

/* ───────── component ───────── */
export default function ProviderModule() {
  const navigate = useNavigate();

  /* state */
  const [providers, setProviders] = useState<DetailedProvider[]>([]);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ProviderFilters>({
    page: 1,
    limit: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* fetch */
  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const params: ProviderFilters = { ...filters };
      if (search.trim()) params.search = search.trim();

      const [listRes, statsRes] = await Promise.allSettled([
        providersApi.getAll(params),
        providersApi.getStats(),
      ]);

      /* ── providers list (multi-shape) ── */
      if (listRes.status === "fulfilled") {
        const r: any = listRes.value;
        let items: DetailedProvider[] = [];
        let pag: Pagination | null = null;

        if (r?.data?.providers) {
          items = r.data.providers;
          pag = r.data.pagination ?? null;
        } else if (r?.data?.data && Array.isArray(r.data.data)) {
          items = r.data.data;
          pag = r.data.pagination ?? null;
        } else if (Array.isArray(r?.data)) {
          items = r.data;
        } else if (Array.isArray(r)) {
          items = r;
        }

        setProviders(items);
        if (pag) setPagination(pag);
      } else {
        console.error("Providers fetch failed:", listRes.reason);
      }

      /* ── stats ── */
      if (statsRes.status === "fulfilled") {
        const s: any = statsRes.value;
        setStats(s?.data ?? s ?? null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load providers");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* debounced search */
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, page: 1 }));
    }, 400);
  };

  /* row click → detail page */
  const handleRowClick = (providerId: string) => {
    console.log("[ProviderModule] navigating to /providers/" + providerId);
    navigate("/providers/" + providerId);
  };

  /* pagination */
  const goPage = (p: number) => setFilters((f) => ({ ...f, page: p }));

  /* ───────── render ───────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-gray-500">Loading providers…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={() => fetchData()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1;
  const currentPage = pagination?.page ?? filters.page ?? 1;

  return (
    <div className="space-y-6">
      {/* ── header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Providers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and monitor all registered service providers
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── stats row ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total", value: stats.total ?? providers.length, icon: Users, color: "text-emerald-600 bg-emerald-50" },
            { label: "Active", value: stats.active ?? 0, icon: UserCheck, color: "text-green-600 bg-green-50" },
            { label: "Inactive", value: stats.inactive ?? 0, icon: UserX, color: "text-gray-600 bg-gray-50" },
            { label: "Pending", value: stats.pending ?? 0, icon: Clock, color: "text-amber-600 bg-amber-50" },
            { label: "Blocked", value: stats.blocked ?? 0, icon: ShieldAlert, color: "text-red-600 bg-red-50" },
            { label: "Today", value: stats.todayNew ?? 0, icon: TrendingUp, color: "text-teal-600 bg-teal-50" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className={`inline-flex p-2 rounded-lg ${s.color} mb-2`}>
                <s.icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── search & filters ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, phone, city…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            {/* verification */}
            <select
              value={filters.verificationStatus || ""}
              onChange={(e) => setFilters((f) => ({ ...f, verificationStatus: e.target.value || undefined, page: 1 }))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Verification</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="incomplete">Incomplete</option>
            </select>

            {/* active */}
            <select
              value={filters.isActive === undefined ? "" : String(filters.isActive)}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  isActive: e.target.value === "" ? undefined : e.target.value === "true",
                  page: 1,
                }))
              }
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            {/* blocked */}
            <select
              value={filters.isBlocked === undefined ? "" : String(filters.isBlocked)}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  isBlocked: e.target.value === "" ? undefined : e.target.value === "true",
                  page: 1,
                }))
              }
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Block Status</option>
              <option value="true">Blocked</option>
              <option value="false">Not Blocked</option>
            </select>

            {/* sort */}
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split("-");
                setFilters((f) => ({ ...f, sortBy: by as any, sortOrder: order as any, page: 1 }));
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="rating-desc">Top Rated</option>
            </select>
          </div>
        )}
      </div>

      {/* ── table (desktop) ── */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Provider</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Services</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Verification</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Rating</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Joined</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {providers.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No providers found
                </td>
              </tr>
            )}
            {providers.map((p: any) => {
              const badge = getVerificationBadge(p.verificationStatus);
              const rating = getRatingValue(p.rating);
              const img = getProfileImage(p);
              return (
                <tr
                  key={p._id}
                  onClick={() => handleRowClick(p._id)}
                  className="hover:bg-emerald-50/40 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {img ? (
                        <img src={img} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                          {(p.name || "?")[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{p.name || "Unnamed"}</p>
                        <p className="text-xs text-gray-400">{p.profession || p.categoryName || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700">{p.email || "—"}</p>
                    <p className="text-xs text-gray-400">{p.phone || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(p.services) ? p.services : []).slice(0, 2).map((s: string) => (
                        <span key={s} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs">
                          {s}
                        </span>
                      ))}
                      {Array.isArray(p.services) && p.services.length > 2 && (
                        <span className="text-xs text-gray-400">+{p.services.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {rating > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Inactive
                        </span>
                      )}
                      {p.isBlocked && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Blocked</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.createdAt ? formatDistanceToNow(new Date(p.createdAt), { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(p._id);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── cards (mobile) ── */}
      <div className="lg:hidden space-y-3">
        {providers.length === 0 && (
          <div className="text-center py-12 text-gray-400">No providers found</div>
        )}
        {providers.map((p: any) => {
          const badge = getVerificationBadge(p.verificationStatus);
          const rating = getRatingValue(p.rating);
          const img = getProfileImage(p);
          return (
            <div
              key={p._id}
              onClick={() => handleRowClick(p._id)}
              className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm cursor-pointer hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                {img ? (
                  <img src={img} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    {(p.name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900 truncate">{p.name || "Unnamed"}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{p.profession || p.categoryName || "—"}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {p.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>}
                    {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {p.isActive ? (
                      <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                    {rating > 0 && (
                      <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
          <p className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
            {pagination && ` · ${pagination.total} total`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) page = i + 1;
              else if (currentPage <= 3) page = i + 1;
              else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
              else page = currentPage - 2 + i;
              return (
                <button
                  key={page}
                  onClick={() => goPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition ${
                    page === currentPage
                      ? "bg-emerald-600 text-white"
                      : "hover:bg-gray-100 text-gray-600"
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => goPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}