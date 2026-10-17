// src/components/SDUI/TrendingCard.tsx
import React from 'react';
import { 
  GripVertical, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  FolderOpen, 
  Zap, 
  Flame,
  TrendingUp,
  MoreVertical,
} from 'lucide-react';

// ==================== BADGE TYPES ====================
export const BADGE_TYPES = [
  { value: '', label: 'No Badge', color: 'bg-gray-100 text-gray-800' },
  { value: 'HOT', label: '🔥 HOT', color: 'bg-red-100 text-red-700' },
  { value: 'NEW', label: '✨ NEW', color: 'bg-blue-100 text-blue-700' },
  { value: 'POPULAR', label: '⭐ POPULAR', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'TRENDING', label: '📈 TRENDING', color: 'bg-orange-100 text-orange-700' },
  { value: 'BEST_SELLER', label: '🏆 BEST SELLER', color: 'bg-purple-100 text-purple-700' },
  { value: 'LIMITED', label: '⏰ LIMITED', color: 'bg-pink-100 text-pink-700' },
];

// ==================== TYPES ====================
export interface TrendingServiceBadge {
  text: string;
  type: string;
}

export interface SDUITrendingService {
  _id: string;
  id?: string;
  serviceId: string;
  name: string;
  iconName: string;
  imageUrl: string | null;
  categoryId: string;
  categoryName: string;
  serviceSlug?: string;
  service?: string;
  badge: TrendingServiceBadge;
  bookingsToday: number;
  progress: number;
  sortOrder: number;
  isActive: boolean;
  autoSync: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TrendingCardProps {
  trending: SDUITrendingService;
  index: number;
  onEdit: (trending: SDUITrendingService) => void;
  onDelete: (trending: SDUITrendingService) => void;
  onToggleStatus: (trending: SDUITrendingService) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

// ==================== COMPONENT ====================
const TrendingCard: React.FC<TrendingCardProps> = ({
  trending,
  index,
  onEdit,
  onDelete,
  onToggleStatus,
  isDragging = false,
  dragHandleProps,
}) => {
  const badgeConfig = BADGE_TYPES.find((b) => b.value === trending.badge?.type);
  const badgeColor = badgeConfig?.color || 'bg-gray-100 text-gray-800';

  return (
    <div
      className={`bg-white rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
        isDragging
          ? 'shadow-2xl border-orange-400 scale-[1.02] rotate-1'
          : 'shadow-sm border-gray-100 hover:shadow-md hover:border-gray-200'
      } ${!trending.isActive ? 'opacity-60' : ''}`}
    >
      <div className="flex items-stretch">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex items-center justify-center w-12 bg-gradient-to-b from-gray-50 to-gray-100 cursor-grab active:cursor-grabbing hover:from-gray-100 hover:to-gray-150 transition-colors border-r border-gray-100"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        {/* Icon */}
        <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-500 m-3 rounded-xl shadow-lg shadow-orange-500/20">
          {trending.imageUrl ? (
            <img
              src={trending.imageUrl}
              alt={trending.name}
              className="w-full h-full rounded-xl object-cover"
            />
          ) : (
            <span className="text-3xl">{trending.iconName || '📦'}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 py-3 pr-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Title Row */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-orange-100 text-orange-600 rounded-full text-xs font-bold">
                  {index + 1}
                </span>
                <h3 className="font-bold text-gray-900 truncate">{trending.name}</h3>
              </div>

              {/* Badges Row */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {!trending.isActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                    <EyeOff className="w-3 h-3" />
                    Hidden
                  </span>
                )}

                {trending.badge?.text && trending.badge?.type && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>
                    {trending.badge.text}
                  </span>
                )}

                {trending.autoSync && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                    <Zap className="w-3 h-3" />
                    Auto-sync
                  </span>
                )}

                {/* Category Badge */}
                {trending.categoryName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                    <FolderOpen className="w-3 h-3" />
                    {trending.categoryName}
                  </span>
                )}
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm">
                    <span className="font-semibold text-gray-900">{trending.bookingsToday}</span>
                    <span className="text-gray-500 ml-1">bookings today</span>
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, trending.progress)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 min-w-[36px] text-right">
                    {trending.progress}%
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onToggleStatus(trending)}
                className={`p-2 rounded-lg transition-all duration-150 ${
                  trending.isActive
                    ? 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                    : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }`}
                title={trending.isActive ? 'Hide from trending' : 'Show in trending'}
              >
                {trending.isActive ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
              <button
                onClick={() => onEdit(trending)}
                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-all duration-150"
                title="Edit"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => onDelete(trending)}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-150"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingCard;