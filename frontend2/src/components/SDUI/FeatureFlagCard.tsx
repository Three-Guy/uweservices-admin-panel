// src/components/SDUI/FeatureFlagCard.tsx
import React, { useState } from 'react';
import {
  Flag,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  Copy,
  History,
  MoreVertical,
  Clock,
  Users,
  Globe,
  Smartphone,
  Zap,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Code,
  Percent,
  Calendar,
} from 'lucide-react';
import {
  SDUIFeatureFlag,
  FEATURE_FLAG_CATEGORIES,
  FEATURE_FLAG_TYPES,
} from '../../lib/sduiApi';

interface FeatureFlagCardProps {
  flag: SDUIFeatureFlag;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onViewHistory: () => void;
}

const FeatureFlagCard: React.FC<FeatureFlagCardProps> = ({
  flag,
  isSelected,
  onSelect,
  onEdit,
  onToggle,
  onDelete,
  onDuplicate,
  onViewHistory,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Get category info
  const category = FEATURE_FLAG_CATEGORIES.find(c => c.value === flag.category);
  const typeInfo = FEATURE_FLAG_TYPES.find(t => t.value === flag.type);

  // Status badges
  const getStatusBadge = () => {
    if (!flag.enabled) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 flex items-center gap-1">
          <ToggleLeft className="w-3 h-3" />
          Disabled
        </span>
      );
    }
    if (flag.isExpired) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Expired
        </span>
      );
    }
    if (flag.isSchedulePending) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-600 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Scheduled
        </span>
      );
    }
    if (flag.isCurrentlyActive) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-600 flex items-center gap-1">
          <Zap className="w-3 h-3" />
          Active
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-600 flex items-center gap-1">
        <ToggleRight className="w-3 h-3" />
        Enabled
      </span>
    );
  };

  // Get type icon
  const getTypeIcon = () => {
    switch (flag.type) {
      case 'percentage':
        return <Percent className="w-4 h-4" />;
      case 'user_list':
        return <Users className="w-4 h-4" />;
      case 'date_range':
        return <Calendar className="w-4 h-4" />;
      case 'json':
        return <Code className="w-4 h-4" />;
      default:
        return <ToggleRight className="w-4 h-4" />;
    }
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-purple-500 border-purple-300' : 'border-gray-200'
      }`}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="mt-1 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />

          {/* Flag Icon */}
          <div className={`p-2.5 rounded-xl ${category?.color || 'bg-gray-100'} flex-shrink-0`}>
            <span className="text-lg">{category?.icon || '🚩'}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {/* Title & Key */}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">{flag.name}</h3>
                  {getStatusBadge()}
                </div>
                
                {/* Key */}
                <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                  {flag.key}
                </code>

                {/* Description */}
                {flag.description && (
                  <p className="text-sm text-gray-500 mt-2 line-clamp-1">{flag.description}</p>
                )}

                {/* Meta Info */}
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-400">
                  {/* Type */}
                  <span className="flex items-center gap-1">
                    {getTypeIcon()}
                    {typeInfo?.label || flag.type}
                  </span>

                  {/* Environment */}
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    {flag.environment}
                  </span>

                  {/* Platforms */}
                  {flag.targeting.platforms && flag.targeting.platforms.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5" />
                      {flag.targeting.platforms.join(', ')}
                    </span>
                  )}

                  {/* Percentage (for percentage type) */}
                  {flag.type === 'percentage' && (
                    <span className="flex items-center gap-1 text-purple-500">
                      <Percent className="w-3.5 h-3.5" />
                      {flag.value.percentage}% rollout
                    </span>
                  )}

                  {/* User count (for user_list type) */}
                  {flag.type === 'user_list' && flag.value.userIds?.length > 0 && (
                    <span className="flex items-center gap-1 text-blue-500">
                      <Users className="w-3.5 h-3.5" />
                      {flag.value.userIds.length} user(s)
                    </span>
                  )}

                  {/* Schedule */}
                  {flag.schedule.isScheduled && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <Clock className="w-3.5 h-3.5" />
                      {flag.schedule.startDate && formatDate(flag.schedule.startDate)}
                      {flag.schedule.endDate && ` - ${formatDate(flag.schedule.endDate)}`}
                    </span>
                  )}
                </div>

                {/* Tags */}
                {flag.tags && flag.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {flag.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                    {flag.tags.length > 3 && (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                        +{flag.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Toggle Switch */}
                <button
                  onClick={onToggle}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    flag.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                      flag.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>

                {/* Edit */}
                <button
                  onClick={onEdit}
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                {/* More Options */}
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowDropdown(false)}
                      />
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            onViewHistory();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <History className="w-4 h-4" />
                          View History
                        </button>
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            onDuplicate();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate
                        </button>
                        <hr className="my-1" />
                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            onDelete();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Expand/Collapse */}
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {expanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {/* Targeting */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Users className="w-4 h-4" />
                Targeting
              </h4>
              <div className="space-y-1 text-gray-500">
                <p>Platforms: {flag.targeting.platforms?.join(', ') || 'All'}</p>
                <p>Segments: {flag.targeting.userSegments?.join(', ') || 'All'}</p>
                {flag.targeting.cities?.length > 0 && (
                  <p>Cities: {flag.targeting.cities.join(', ')}</p>
                )}
                {flag.targeting.minAppVersion && (
                  <p>Min Version: {flag.targeting.minAppVersion}</p>
                )}
              </div>
            </div>

            {/* Value */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
                {getTypeIcon()}
                Value
              </h4>
              <div className="text-gray-500">
                {flag.type === 'boolean' && (
                  <p>{flag.enabled ? 'True' : 'False'}</p>
                )}
                {flag.type === 'percentage' && (
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${flag.value.percentage}%` }}
                        />
                      </div>
                      <span className="font-medium">{flag.value.percentage}%</span>
                    </div>
                  </div>
                )}
                {flag.type === 'user_list' && (
                  <p>{flag.value.userIds?.length || 0} users targeted</p>
                )}
                {flag.type === 'json' && flag.value.jsonValue && (
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-20">
                    {JSON.stringify(flag.value.jsonValue, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            {/* History */}
            <div>
              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-1">
                <History className="w-4 h-4" />
                Recent Activity
              </h4>
              <div className="space-y-1 text-gray-500 text-xs">
                {flag.history?.slice(0, 3).map((entry, idx) => (
                  <p key={idx}>
                    <span className="capitalize">{entry.action}</span>
                    {' by '}
                    <span className="font-medium">{entry.performedByName}</span>
                    {' • '}
                    {new Date(entry.performedAt).toLocaleDateString()}
                  </p>
                ))}
                {(!flag.history || flag.history.length === 0) && (
                  <p className="text-gray-400 italic">No history available</p>
                )}
              </div>
            </div>
          </div>

          {/* Dependencies */}
          {flag.dependencies && flag.dependencies.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                <strong>Dependencies:</strong> {flag.dependencies.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeatureFlagCard;