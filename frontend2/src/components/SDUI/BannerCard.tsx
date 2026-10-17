import React from 'react';
import { 
  GripVertical, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Calendar,
  Link,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import { SDUIBanner } from '../../lib/sduiApi';

interface BannerCardProps {
  banner: SDUIBanner;
  index: number;
  onEdit: (banner: SDUIBanner) => void;
  onDelete: (banner: SDUIBanner) => void;
  onToggleStatus: (banner: SDUIBanner) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

const BannerCard: React.FC<BannerCardProps> = ({
  banner,
  index,
  onEdit,
  onDelete,
  onToggleStatus,
  isDragging,
  dragHandleProps,
}) => {
  const isScheduled = banner.schedule?.isScheduled;
  const isExpired = isScheduled && banner.schedule.endDate && new Date(banner.schedule.endDate) < new Date();
  const isPending = isScheduled && banner.schedule.startDate && new Date(banner.schedule.startDate) > new Date();

  const getStatusBadge = () => {
    if (!banner.isActive) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Inactive</span>;
    }
    if (isExpired) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-600">Expired</span>;
    }
    if (isPending) {
      return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-600">Scheduled</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600">Active</span>;
  };

  const getActionLabel = () => {
    switch (banner.action?.type) {
      case 'service': return 'Service';
      case 'category': return 'Category';
      case 'url': return 'URL';
      case 'promo': return 'Promo';
      case 'screen': return 'Screen';
      default: return 'None';
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
        isDragging ? 'shadow-xl border-blue-300 scale-[1.02]' : 'hover:shadow-md'
      }`}
    >
      <div className="flex">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex items-center justify-center w-10 bg-gray-50 cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        {/* Image */}
        <div className="w-48 h-28 flex-shrink-0 relative">
          <img
            src={banner.image?.url || '/placeholder-banner.jpg'}
            alt={banner.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 text-xs font-medium bg-black/50 text-white rounded">
              #{index + 1}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 truncate">{banner.title}</h3>
                {getStatusBadge()}
              </div>
              <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                {banner.description || 'No description'}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Link className="w-3 h-3" />
                  {getActionLabel()}
                  {banner.action?.target && (
                    <span className="text-gray-500 max-w-[100px] truncate">
                      : {banner.action.target}
                    </span>
                  )}
                </span>
                <span className="capitalize">{banner.display?.position || 'hero'}</span>
                {isScheduled && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Scheduled
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleStatus(banner)}
                className={`p-2 rounded-lg transition-colors ${
                  banner.isActive 
                    ? 'text-green-600 hover:bg-green-50' 
                    : 'text-gray-400 hover:bg-gray-100'
                }`}
                title={banner.isActive ? 'Deactivate' : 'Activate'}
              >
                {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onEdit(banner)}
                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(banner)}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Bar */}
      {banner.analytics && (banner.analytics.impressions > 0 || banner.analytics.clicks > 0) && (
        <div className="px-4 py-2 bg-gray-50 border-t flex items-center gap-6 text-xs">
          <span className="text-gray-500">
            <strong className="text-gray-700">{banner.analytics.impressions.toLocaleString()}</strong> impressions
          </span>
          <span className="text-gray-500">
            <strong className="text-gray-700">{banner.analytics.clicks.toLocaleString()}</strong> clicks
          </span>
          <span className="text-gray-500">
            <strong className="text-gray-700">{banner.analytics.ctr.toFixed(2)}%</strong> CTR
          </span>
        </div>
      )}
    </div>
  );
};

export default BannerCard;
