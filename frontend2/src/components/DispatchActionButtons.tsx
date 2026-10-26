// src/components/DispatchActionButtons.tsx
import { useState } from 'react';
import { RefreshCw, UserPlus, Zap, Loader2 } from 'lucide-react';
import { dispatchApi, EligibleProvider } from '../lib/api';
import toast from 'react-hot-toast';

interface Props {
  bookingId: string;
  currentStatus: string;
  currentProviderId?: string;
  onActionDone?: () => void;
}

export default function DispatchActionButtons({
  bookingId,
  currentStatus,
  currentProviderId,
  onActionDone,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showManualAssign, setShowManualAssign] = useState(false);
  const [eligibleProviders, setEligibleProviders] = useState<EligibleProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [radiusKm, setRadiusKm] = useState(12);
  const [reassignReason, setReassignReason] = useState('');

  const canReassign = ['confirmed', 'searching', 'no_provider_found', 'assigned'].includes(currentStatus);
  const canTrigger = ['confirmed', 'no_provider_found'].includes(currentStatus) && !currentProviderId;

  const handleTriggerDispatch = async () => {
    if (!confirm('Trigger automatic dispatch for this booking?')) return;
    setLoading('trigger');
    try {
      const res = await dispatchApi.triggerDispatch(bookingId);
      if (res.success) {
        toast.success('✅ Dispatch triggered');
        onActionDone?.();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Trigger failed');
    } finally {
      setLoading(null);
    }
  };

  const handleReassign = async () => {
    if (!confirm('Reassign this booking to a new provider? Current provider will be removed.')) return;
    setLoading('reassign');
    try {
      const res = await dispatchApi.reassignBooking(bookingId, reassignReason || 'Manual admin reassignment');
      if (res.success) {
        toast.success('✅ Reassignment triggered');
        setReassignReason('');
        onActionDone?.();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Reassignment failed');
    } finally {
      setLoading(null);
    }
  };

  const loadEligibleProviders = async () => {
    setLoadingProviders(true);
    try {
      const res = await dispatchApi.getEligibleProviders(bookingId, radiusKm);
      if (res.success) setEligibleProviders(res.data.providers);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to load providers');
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleManualAssign = async (providerId: string, providerName: string) => {
    if (!confirm(`Assign booking manually to ${providerName}?`)) return;
    setLoading(`assign-${providerId}`);
    try {
      const res = await dispatchApi.assignProviderManually(bookingId, providerId);
      if (res.success) {
        toast.success(`✅ Assigned to ${providerName}`);
        setShowManualAssign(false);
        onActionDone?.();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Assignment failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canTrigger && (
          <button
            onClick={handleTriggerDispatch}
            disabled={!!loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold shadow-sm"
          >
            {loading === 'trigger' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Trigger Auto-Dispatch
          </button>
        )}

        {canReassign && (
          <button
            onClick={handleReassign}
            disabled={!!loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-semibold shadow-sm"
          >
            {loading === 'reassign' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Reassign
          </button>
        )}

        <button
          onClick={() => {
            setShowManualAssign(!showManualAssign);
            if (!showManualAssign) loadEligibleProviders();
          }}
          disabled={!!loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-semibold shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Manual Assign
        </button>
      </div>

      {canReassign && (
        <input
          type="text"
          placeholder="Reason for reassignment (optional)"
          value={reassignReason}
          onChange={(e) => setReassignReason(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      )}

      {showManualAssign && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-gray-900">Select Provider</h4>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Radius:</label>
              <select
                value={radiusKm}
                onChange={(e) => {
                  setRadiusKm(Number(e.target.value));
                }}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value={5}>5 km</option>
                <option value={8}>8 km</option>
                <option value={12}>12 km</option>
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
              </select>
              <button
                onClick={loadEligibleProviders}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Refresh
              </button>
            </div>
          </div>

          {loadingProviders && (
            <div className="text-center py-6 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
              Loading providers...
            </div>
          )}

          {!loadingProviders && eligibleProviders.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-4">
              No eligible providers found within {radiusKm}km
            </p>
          )}

          {!loadingProviders && eligibleProviders.length > 0 && (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {eligibleProviders.map((p) => (
                <div
                  key={p._id}
                  className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                      {p.isOnline && (
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.categoryName} • {p.phone} • {p.city}
                    </div>
                    <div className="flex gap-3 text-[11px] text-gray-500 mt-1">
                      {p.distanceKm !== null && <span>📍 {p.distanceKm.toFixed(2)}km</span>}
                      <span>⭐ {p.rating.toFixed(1)}</span>
                      <span>✓ {p.completedJobs} jobs</span>
                      {!p.hasFcmToken && <span className="text-red-500">⚠ No FCM</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleManualAssign(p.providerId, p.name)}
                    disabled={!!loading}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
                  >
                    {loading === `assign-${p.providerId}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Assign'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}