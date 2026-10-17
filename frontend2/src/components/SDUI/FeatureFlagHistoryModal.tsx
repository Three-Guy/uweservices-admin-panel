// src/components/SDUI/FeatureFlagHistoryModal.tsx
import React, { useState, useEffect } from 'react';
import { X, History, Loader2, User, Clock, AlertCircle } from 'lucide-react';
import { sduiFeatureFlagApi } from '../../lib/sduiApi';

interface HistoryEntry {
  action: string;
  performedBy: string;
  performedByName: string;
  performedAt: string;
  previousValue: any;
  newValue: any;
  notes: string;
}

interface FeatureFlagHistoryModalProps {
  flagId: string;
  onClose: () => void;
}

const FeatureFlagHistoryModal: React.FC<FeatureFlagHistoryModalProps> = ({
  flagId,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flagName, setFlagName] = useState('');
  const [flagKey, setFlagKey] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await sduiFeatureFlagApi.getHistory(flagId, 50);
        
        if (response.success) {
          setFlagName(response.data.name);
          setFlagKey(response.data.key);
          setHistory(response.data.history || []);
        }
      } catch (err: any) {
        console.error('Error fetching history:', err);
        setError(err.message || 'Failed to fetch history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [flagId]);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-blue-100 text-blue-700';
      case 'enabled':
        return 'bg-green-100 text-green-700';
      case 'disabled':
        return 'bg-gray-100 text-gray-700';
      case 'updated':
        return 'bg-amber-100 text-amber-700';
      case 'deleted':
        return 'bg-red-100 text-red-700';
      case 'restored':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <History className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Change History</h2>
              {flagName && (
                <p className="text-sm text-gray-500">
                  {flagName} <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{flagKey}</code>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="mt-2 text-gray-500">Loading history...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-500">
              <AlertCircle className="w-8 h-8" />
              <p className="mt-2">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <History className="w-12 h-12 text-gray-300" />
              <p className="mt-2">No history available</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

              {/* History entries */}
              <div className="space-y-6">
                {history.map((entry, index) => (
                  <div key={index} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className="absolute left-2.5 w-3 h-3 bg-white border-2 border-purple-500 rounded-full" />

                    {/* Entry card */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${getActionColor(entry.action)}`}>
                            {entry.action}
                          </span>
                          
                          {entry.notes && (
                            <p className="mt-2 text-sm text-gray-600">{entry.notes}</p>
                          )}
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <User className="w-3.5 h-3.5" />
                            {entry.performedByName || 'System'}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(entry.performedAt)}
                          </div>
                        </div>
                      </div>

                      {/* Show changes for update actions */}
                      {entry.action === 'updated' && entry.newValue && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-500 mb-1">Changes:</p>
                          <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                            {JSON.stringify(entry.newValue, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeatureFlagHistoryModal;