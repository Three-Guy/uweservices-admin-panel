import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  User,
  Phone,
  Mail,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  ZoomIn,
} from 'lucide-react';
import { verificationsApi } from '../../lib/api';
import { ProviderVerification, Pagination } from '../../types';

export default function ProviderVerificationsModule() {
  const [verifications, setVerifications] = useState<ProviderVerification[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState<ProviderVerification | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchVerifications();
  }, [pagination.page, statusFilter]);

  const fetchVerifications = async () => {
    try {
      setIsLoading(true);
      const response = await verificationsApi.getAll({
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
      });
      setVerifications(response.data.verifications);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to fetch verifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (providerId: string) => {
    try {
      setActionLoading(true);
      await verificationsApi.approve(providerId);
      fetchVerifications();
      setSelectedVerification(null);
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('Failed to approve verification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVerification || !rejectReason.trim()) return;

    try {
      setActionLoading(true);
      await verificationsApi.reject(
        typeof selectedVerification.providerId === 'string'
          ? selectedVerification.providerId
          : selectedVerification.providerId._id,
        rejectReason
      );
      fetchVerifications();
      setSelectedVerification(null);
      setShowRejectModal(false);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('Failed to reject verification');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const getProviderData = (verification: ProviderVerification) => {
    const provider = verification.providerId;
    if (typeof provider === 'string') {
      return { name: 'Unknown', email: '', phone: '', profession: '' };
    }
    return provider;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Provider Verifications</h1>
        <p className="text-gray-600 mt-1">Review and manage provider verification requests</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Status:</span>
          </div>
          <div className="flex gap-2">
            {['pending', 'approved', 'rejected', ''].map((status) => (
              <button
                key={status || 'all'}
                onClick={() => {
                  setStatusFilter(status);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Verifications Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : verifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <CheckCircle size={48} className="mb-4 text-gray-300" />
            <p>No verifications found</p>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Documents
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {verifications.map((verification) => {
                  const provider = getProviderData(verification);
                  return (
                    <tr key={verification._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <User size={20} className="text-indigo-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {provider.name}
                            </div>
                            <div className="text-sm text-gray-500">{provider.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          {verification.selfieImage && (
                            <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden cursor-pointer">
                              <img
                                src={verification.selfieImage}
                                alt="Selfie"
                                className="h-full w-full object-cover"
                                onClick={() => setImagePreview(verification.selfieImage)}
                              />
                            </div>
                          )}
                          {verification.panCardImage && (
                            <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden cursor-pointer">
                              <img
                                src={verification.panCardImage}
                                alt="PAN"
                                className="h-full w-full object-cover"
                                onClick={() => setImagePreview(verification.panCardImage)}
                              />
                            </div>
                          )}
                          {verification.aadhaarCardImage && (
                            <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden cursor-pointer">
                              <img
                                src={verification.aadhaarCardImage}
                                alt="Aadhaar"
                                className="h-full w-full object-cover"
                                onClick={() => setImagePreview(verification.aadhaarCardImage)}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                            verification.verificationStatus
                          )}`}
                        >
                          {verification.verificationStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {verification.submittedAt
                          ? new Date(verification.submittedAt).toLocaleDateString()
                          : 'Not submitted'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedVerification(verification)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Eye size={18} />
                          </button>
                          {verification.verificationStatus === 'pending' && (
                            <>
                              <button
                                onClick={() =>
                                  handleApprove(
                                    typeof verification.providerId === 'string'
                                      ? verification.providerId
                                      : verification.providerId._id
                                  )
                                }
                                className="text-green-600 hover:text-green-900"
                                disabled={actionLoading}
                              >
                                <CheckCircle size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedVerification(verification);
                                  setShowRejectModal(true);
                                }}
                                className="text-red-600 hover:text-red-900"
                                disabled={actionLoading}
                              >
                                <XCircle size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Verification Detail Modal */}
      {selectedVerification && !showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Verification Details</h2>
              <button
                onClick={() => setSelectedVerification(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {/* Provider Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Provider Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User size={18} className="text-gray-400" />
                      <span className="text-gray-600">
                        {getProviderData(selectedVerification).name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail size={18} className="text-gray-400" />
                      <span className="text-gray-600">
                        {getProviderData(selectedVerification).email}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-gray-400" />
                      <span className="text-gray-600">
                        {getProviderData(selectedVerification).phone || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Briefcase size={18} className="text-gray-400" />
                      <span className="text-gray-600">
                        {getProviderData(selectedVerification).profession || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Verification Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Status:</span>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          selectedVerification.verificationStatus
                        )}`}
                      >
                        {selectedVerification.verificationStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-gray-400" />
                      <span className="text-gray-600">
                        Submitted:{' '}
                        {selectedVerification.submittedAt
                          ? new Date(selectedVerification.submittedAt).toLocaleString()
                          : 'Not submitted'}
                      </span>
                    </div>
                    <div className="text-gray-600">
                      Attempts: {selectedVerification.attempts}
                    </div>
                    {selectedVerification.rejectionReason && (
                      <div className="bg-red-50 p-3 rounded-lg">
                        <span className="text-red-800 font-medium">Rejection Reason:</span>
                        <p className="text-red-600 mt-1">
                          {selectedVerification.rejectionReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Documents */}
              <h3 className="text-lg font-medium text-gray-900 mb-4">Uploaded Documents</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Selfie</p>
                  {selectedVerification.selfieImage ? (
                    <div
                      className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 cursor-pointer group"
                      onClick={() => setImagePreview(selectedVerification.selfieImage)}
                    >
                      <img
                        src={selectedVerification.selfieImage}
                        alt="Selfie"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                        <ZoomIn
                          className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          size={24}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[3/4] rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                      Not uploaded
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">PAN Card</p>
                  {selectedVerification.panCardImage ? (
                    <div
                      className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 cursor-pointer group"
                      onClick={() => setImagePreview(selectedVerification.panCardImage)}
                    >
                      <img
                        src={selectedVerification.panCardImage}
                        alt="PAN Card"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                        <ZoomIn
                          className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          size={24}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[3/4] rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                      Not uploaded
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Aadhaar Card</p>
                  {selectedVerification.aadhaarCardImage ? (
                    <div
                      className="relative aspect-[3/4] rounded-lg overflow-hidden bg-gray-100 cursor-pointer group"
                      onClick={() => setImagePreview(selectedVerification.aadhaarCardImage)}
                    >
                      <img
                        src={selectedVerification.aadhaarCardImage}
                        alt="Aadhaar Card"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                        <ZoomIn
                          className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          size={24}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[3/4] rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                      Not uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedVerification.verificationStatus === 'pending' && (
                <div className="mt-6 flex gap-4 justify-end">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      handleApprove(
                        typeof selectedVerification.providerId === 'string'
                          ? selectedVerification.providerId
                          : selectedVerification.providerId._id
                      )
                    }
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Approve'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Reject Verification</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Please provide a reason for rejecting this verification. This will be shown to the
                provider.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setImagePreview(null)}
        >
          <button
            onClick={() => setImagePreview(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X size={32} />
          </button>
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain"
          />
        </div>
      )}
    </div>
  );
}

