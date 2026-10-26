// src/components/OfferTrailPanel.tsx
import { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  RefreshCw,
  User,
  MapPin,
  Phone,
} from 'lucide-react';
import { providerOffersApi, ProviderOffer } from '../lib/api';
import { onEvent } from '../lib/socket';

interface Props {
  bookingId: string;
}

export default function OfferTrailPanel({ bookingId }: Props) {
  const [offers, setOffers] = useState<ProviderOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOffers = async () => {
    try {
      const res = await providerOffersApi.getByBooking(bookingId);
      if (res.success) setOffers(res.data.offers);
    } catch (e) {
      console.error('Fetch offers error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOffers();
    const poll = setInterval(fetchOffers, 10000);
    return () => clearInterval(poll);
  }, [bookingId]);

  // Live update on offer events
  useEffect(() => {
    const off1 = onEvent('dispatch:offer_sent', (p: any) => {
      if (p.bookingId === bookingId) fetchOffers();
    });
    const off2 = onEvent('booking:status_changed', (p: any) => {
      if (p.bookingId === bookingId) fetchOffers();
    });
    const off3 = onEvent('dispatch:assigned', (p: any) => {
      if (p.bookingId === bookingId) fetchOffers();
    });
    return () => {
      off1();
      off2();
      off3();
    };
  }, [bookingId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'superseded':
        return <RefreshCw className="w-4 h-4 text-gray-400" />;
      case 'sent':
      case 'delivered':
      case 'viewed':
        return <Send className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      timeout: 'bg-amber-100 text-amber-700 border-amber-200',
      failed: 'bg-red-100 text-red-700 border-red-200',
      superseded: 'bg-gray-100 text-gray-600 border-gray-200',
      sent: 'bg-blue-100 text-blue-700 border-blue-200',
      delivered: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      viewed: 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return map[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const stats = {
    total: offers.length,
    accepted: offers.filter((o) => o.status === 'accepted').length,
    rejected: offers.filter((o) => o.status === 'rejected').length,
    timeout: offers.filter((o) => o.status === 'timeout').length,
    pending: offers.filter((o) => ['sent', 'delivered', 'viewed'].includes(o.status)).length,
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
        Loading offer history...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Provider Offer Trail</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Complete history of all providers notified for this booking
          </p>
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchOffers();
          }}
          className="p-1.5 hover:bg-white rounded-lg transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2 p-3 bg-gray-50 border-b border-gray-200">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{stats.total}</div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold">Total</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-600">{stats.accepted}</div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold">Accepted</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">{stats.rejected}</div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold">Rejected</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-amber-600">{stats.timeout}</div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold">Timeout</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{stats.pending}</div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold">Pending</div>
        </div>
      </div>

      {/* Offers list */}
      <div className="max-h-[500px] overflow-y-auto">
        {offers.length === 0 && (
          <div className="p-10 text-center text-gray-500">
            <Send className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">No offers sent yet for this booking</p>
          </div>
        )}

        {offers.map((offer, idx) => (
          <div
            key={offer._id}
            className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              offer.status === 'accepted' ? 'bg-emerald-50/40' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-sm">
                #{offers.length - idx}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {offer.providerName || offer.providerId}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                          offer.status
                        )}`}
                      >
                        {getStatusIcon(offer.status)}
                        {offer.status.toUpperCase()}
                      </span>
                      {offer.isCurrentOffer && (
                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded uppercase">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-gray-500">
                      {offer.providerPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {offer.providerPhone}
                        </span>
                      )}
                      {offer.providerCity && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {offer.providerCity}
                        </span>
                      )}
                      {offer.distanceKm > 0 && <span>📍 {offer.distanceKm.toFixed(2)} km away</span>}
                      <span>
                        Cycle #{offer.dispatchCycle} • Batch #{offer.batchNumber}
                      </span>
                      <span>Radius: {offer.radiusKm}km</span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      <div className="flex items-center gap-1 text-gray-600">
                        <span className="font-semibold">Sent:</span> {formatDateTime(offer.offeredAt)}
                      </div>
                      {offer.respondedAt && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <span className="font-semibold">Responded:</span>{' '}
                          {formatDateTime(offer.respondedAt)}
                        </div>
                      )}
                      {offer.expiresAt && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <span className="font-semibold">Expires:</span>{' '}
                          {formatDateTime(offer.expiresAt)}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-gray-600">
                        <span className="font-semibold">FCM:</span>
                        {offer.fcmSent ? (
                          <span className="text-emerald-600 font-semibold">✓ Delivered</span>
                        ) : (
                          <span className="text-red-600 font-semibold">✗ Failed</span>
                        )}
                      </div>
                    </div>

                    {offer.fcmError && (
                      <div className="mt-2 px-2 py-1 bg-red-50 border border-red-200 rounded text-[10px] text-red-700">
                        FCM Error: {offer.fcmError}
                      </div>
                    )}

                    {offer.reason && (
                      <div className="mt-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
                        Reason: {offer.reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}