// src/pages/SDUI/BannersPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle,
  X,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  ExternalLink,
  Calendar,
  Clock,
  MousePointer,
  BarChart3,
  ArrowLeft,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Copy,
  Link,
  Star,
  Play,
  Film,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiClient } from '../../lib/api';

// ==================== TYPES ====================
interface BannerImage {
  url: string;
  publicId: string | null;
  darkModeUrl: string | null;
  altText: string;
}

interface BannerAction {
  type: 'none' | 'service' | 'category' | 'url' | 'screen' | 'promo';
  target: string;
  serviceRef?: string;
  categoryRef?: string;
  promoCode?: string;
}

interface BannerSchedule {
  isScheduled: boolean;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
}

interface BannerDisplay {
  sortOrder: number;
  position: 'hero' | 'middle' | 'bottom' | 'popup';
  backgroundColor: string;
}

interface BannerAnalytics {
  impressions: number;
  clicks: number;
  ctr: number;
}

interface Banner {
  _id: string;
  id: string;
  bannerId: string;
  title: string;
  description: string;
  image: BannerImage;
  mobileImage: {
    url: string | null;
    publicId: string | null;
  };
  action: BannerAction;
  schedule: BannerSchedule;
  display: BannerDisplay;
  isActive: boolean;
  analytics: BannerAnalytics;
  mediaType?: 'image' | 'video';
  createdAt: string;
  updatedAt: string;
}

interface BannerStats {
  totalBanners: number;
  activeBanners: number;
  inactiveBanners: number;
  scheduledBanners: number;
  expiredBanners: number;
  positionDistribution: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ==================== MEDIA HELPERS ====================
const VIDEO_EXTENSIONS = ['.webm', '.mp4', '.ogg', '.mov', '.avi', '.mkv'];
const VIDEO_MIME_TYPES = [
  'video/webm',
  'video/mp4',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
];
const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

// All accepted file types for the file input
const ACCEPTED_FILE_TYPES = [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES].join(',');

// Max file sizes
const MAX_IMAGE_SIZE_MB = 5;
const MAX_VIDEO_SIZE_MB = 50;

/**
 * Detect if a URL points to a video file based on extension or known patterns.
 * Also checks the optional `mediaType` field from backend.
 */
const isVideoUrl = (url: string | null | undefined, mediaType?: string): boolean => {
  if (mediaType === 'video') return true;
  if (!url) return false;

  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();

  // Check extension
  if (VIDEO_EXTENSIONS.some((ext) => cleanUrl.endsWith(ext))) return true;

  // Check for common video CDN patterns
  if (cleanUrl.includes('/video/') || cleanUrl.includes('video/upload')) return true;

  // Check for Cloudinary video resource type
  if (cleanUrl.includes('cloudinary') && cleanUrl.includes('/video/')) return true;

  return false;
};

/**
 * Detect if a File object is a video
 */
const isVideoFile = (file: File): boolean => {
  return file.type.startsWith('video/') || VIDEO_MIME_TYPES.includes(file.type);
};

/**
 * Get a human-readable file type label
 */
const getMediaTypeLabel = (
  url: string | null | undefined,
  mediaType?: string
): { label: string; color: string; icon: 'video' | 'image' } => {
  if (isVideoUrl(url, mediaType)) {
    return { label: 'Video', color: 'bg-purple-100 text-purple-700', icon: 'video' };
  }
  return { label: 'Image', color: 'bg-blue-100 text-blue-700', icon: 'image' };
};

/**
 * Format file size for display
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ==================== API ====================
const bannersApi = {
  getAll: async (params?: Record<string, any>) => {
    const response = await apiClient.get('/admin/sdui/banners', { params });
    return response.data;
  },
  getStats: async () => {
    const response = await apiClient.get('/admin/sdui/banners/stats');
    return response.data;
  },
  getById: async (id: string) => {
    const response = await apiClient.get(`/admin/sdui/banners/${id}`);
    return response.data;
  },
  create: async (formData: FormData) => {
    const response = await apiClient.post('/admin/sdui/banners', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 min timeout for video uploads
    });
    return response.data;
  },
  update: async (id: string, formData: FormData) => {
    const response = await apiClient.put(`/admin/sdui/banners/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },
  delete: async (id: string) => {
    const response = await apiClient.delete(`/admin/sdui/banners/${id}`);
    return response.data;
  },
  reorder: async (banners: { id: string; sortOrder: number }[]) => {
    const response = await apiClient.post('/admin/sdui/banners/reorder', { banners });
    return response.data;
  },
};

// ==================== CONSTANTS ====================
const POSITIONS = [
  { value: 'hero', label: 'Hero (Top)', color: 'bg-purple-100 text-purple-700' },
  { value: 'middle', label: 'Middle', color: 'bg-blue-100 text-blue-700' },
  { value: 'bottom', label: 'Bottom', color: 'bg-green-100 text-green-700' },
  { value: 'popup', label: 'Popup', color: 'bg-orange-100 text-orange-700' },
];

const ACTION_TYPES = [
  { value: 'none', label: 'No Action' },
  { value: 'service', label: 'Open Service' },
  { value: 'category', label: 'Open Category' },
  { value: 'url', label: 'External URL' },
  { value: 'screen', label: 'App Screen' },
  { value: 'promo', label: 'Promo Code' },
];

// ==================== MEDIA PREVIEW COMPONENT ====================
interface MediaPreviewProps {
  url: string;
  alt?: string;
  mediaType?: string;
  className?: string;
  showControls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  onError?: () => void;
  fallbackElement?: React.ReactNode;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({
  url,
  alt = 'Banner',
  mediaType,
  className = 'w-full h-full object-cover',
  showControls = false,
  autoPlay = false,
  muted = true,
  loop = true,
  onError,
  fallbackElement,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      fallbackElement || (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <ImageIcon className="w-8 h-8 text-gray-400" />
        </div>
      )
    );
  }

  if (isVideoUrl(url, mediaType)) {
    return (
      <div className="relative w-full h-full group">
        <video
          ref={videoRef}
          src={url}
          className={className}
          autoPlay={autoPlay}
          muted={isMuted}
          loop={loop}
          playsInline
          controls={showControls}
          onError={handleError}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        {/* Video overlay controls (only when showControls is false) */}
        {!showControls && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) {
                  if (isPlaying) {
                    videoRef.current.pause();
                  } else {
                    videoRef.current.play();
                  }
                }
              }}
              className="p-2 bg-white/90 rounded-full shadow-lg hover:bg-white transition-colors"
            >
              {isPlaying ? (
                <div className="w-4 h-4 flex items-center justify-center">
                  <div className="flex gap-1">
                    <div className="w-1 h-4 bg-gray-700 rounded" />
                    <div className="w-1 h-4 bg-gray-700 rounded" />
                  </div>
                </div>
              ) : (
                <Play className="w-4 h-4 text-gray-700 ml-0.5" />
              )}
            </button>
          </div>
        )}
        {/* Video badge */}
        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 text-white text-[10px] font-bold rounded flex items-center gap-1">
          <Film className="w-3 h-3" />
          VIDEO
        </div>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onError={(e) => {
        (e.target as HTMLImageElement).src =
          'https://via.placeholder.com/320x200?text=Banner';
        handleError();
      }}
    />
  );
};

// ==================== BANNER CARD COMPONENT ====================
interface BannerCardProps {
  banner: Banner;
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onToggleStatus: (banner: Banner) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

const BannerCard: React.FC<BannerCardProps> = ({
  banner,
  onEdit,
  onDelete,
  onToggleStatus,
  isDragging,
  dragHandleProps,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const position =
    POSITIONS.find((p) => p.value === banner.display?.position) || POSITIONS[0];
  const isScheduled = banner.schedule?.isScheduled;
  const isExpired =
    isScheduled &&
    banner.schedule?.endDate &&
    new Date(banner.schedule.endDate) < new Date();

  const mediaInfo = getMediaTypeLabel(banner.image?.url, banner.mediaType);

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-300 ${
        isDragging
          ? 'shadow-2xl border-cyan-300 scale-[1.02] ring-2 ring-cyan-500/20'
          : 'border-gray-200 shadow-sm hover:shadow-lg'
      }`}
    >
      <div className="p-4">
        <div className="flex gap-4">
          {/* Drag Handle */}
          <div
            {...dragHandleProps}
            className="mt-2 p-2 rounded-lg hover:bg-gray-100 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
          >
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>

          {/* Banner Image/Video */}
          <div className="w-32 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 relative">
            {banner.image?.url ? (
              <MediaPreview
                url={banner.image.url}
                alt={banner.title}
                mediaType={banner.mediaType}
                className="w-full h-full object-cover"
                autoPlay={false}
                muted={true}
                loop={true}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Banner Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900 truncate">
                    {banner.title || 'Untitled Banner'}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${position.color}`}
                  >
                    {position.label}
                  </span>
                  {/* Media type badge */}
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${mediaInfo.color} flex items-center gap-1`}
                  >
                    {mediaInfo.icon === 'video' ? (
                      <Film className="w-3 h-3" />
                    ) : (
                      <ImageIcon className="w-3 h-3" />
                    )}
                    {mediaInfo.label}
                  </span>
                  {!banner.isActive && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                      Inactive
                    </span>
                  )}
                  {isExpired && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-600">
                      Expired
                    </span>
                  )}
                </div>
                <code className="text-xs text-gray-400 font-mono">
                  {banner.bannerId}
                </code>
                {banner.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                    {banner.description}
                  </p>
                )}
              </div>

              {/* Actions Menu */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <MoreVertical className="w-5 h-5 text-gray-500" />
                </button>

                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20">
                      <button
                        onClick={() => {
                          onEdit(banner);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                      >
                        <Edit2 className="w-4 h-4 text-gray-400" />
                        Edit Banner
                      </button>
                      <button
                        onClick={() => {
                          onToggleStatus(banner);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                      >
                        {banner.isActive ? (
                          <>
                            <EyeOff className="w-4 h-4 text-gray-400" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 text-gray-400" />
                            Activate
                          </>
                        )}
                      </button>
                      {banner.image?.url && (
                        <a
                          href={banner.image.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                          onClick={() => setShowMenu(false)}
                        >
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                          {isVideoUrl(banner.image.url, banner.mediaType)
                            ? 'View Video'
                            : 'View Image'}
                        </a>
                      )}
                      <hr className="my-2 border-gray-100" />
                      <button
                        onClick={() => {
                          onDelete(banner);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Banner
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Eye className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-gray-700">
                  {(banner.analytics?.impressions || 0).toLocaleString()}
                </span>
                <span>views</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <MousePointer className="w-4 h-4 text-green-500" />
                <span className="font-medium text-gray-700">
                  {(banner.analytics?.clicks || 0).toLocaleString()}
                </span>
                <span>clicks</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <span className="font-medium text-gray-700">
                  {((banner.analytics?.ctr || 0) * 100).toFixed(1)}%
                </span>
                <span>CTR</span>
              </div>
              {isScheduled && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Calendar className="w-4 h-4 text-orange-500" />
                  <span>Scheduled</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => onToggleStatus(banner)}
              className={`p-2 rounded-lg transition-colors ${
                banner.isActive
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title={banner.isActive ? 'Deactivate' : 'Activate'}
            >
              {banner.isActive ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => onEdit(banner)}
              className="p-2 rounded-lg bg-cyan-100 text-cyan-700 hover:bg-cyan-200 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== SORTABLE ITEM WRAPPER ====================
const SortableBannerItem: React.FC<{
  banner: Banner;
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onToggleStatus: (banner: Banner) => void;
}> = ({ banner, onEdit, onDelete, onToggleStatus }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: banner._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BannerCard
        banner={banner}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};

// ==================== BANNER FORM MODAL ====================
interface BannerFormProps {
  banner: Banner | null;
  onSubmit: (formData: FormData) => Promise<void>;
  onClose: () => void;
  isLoading: boolean;
}

const BannerForm: React.FC<BannerFormProps> = ({
  banner,
  onSubmit,
  onClose,
  isLoading,
}) => {
  const [formData, setFormData] = useState({
    title: banner?.title || '',
    description: banner?.description || '',
    imageUrl: banner?.image?.url || '',
    position: banner?.display?.position || 'hero',
    actionType: banner?.action?.type || 'none',
    actionTarget: banner?.action?.target || '',
    isActive: banner?.isActive ?? true,
    isScheduled: banner?.schedule?.isScheduled || false,
    startDate: banner?.schedule?.startDate
      ? banner.schedule.startDate.split('T')[0]
      : '',
    endDate: banner?.schedule?.endDate
      ? banner.schedule.endDate.split('T')[0]
      : '',
    backgroundColor: banner?.display?.backgroundColor || '#FFFFFF',
    sortOrder: banner?.display?.sortOrder || 0,
  });

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(
    banner?.image?.url || null
  );
  const [isPreviewVideo, setIsPreviewVideo] = useState<boolean>(
    isVideoUrl(banner?.image?.url, banner?.mediaType)
  );
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFileInfo, setSelectedFileInfo] = useState<{
    name: string;
    size: string;
    type: string;
  } | null>(null);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    // Validate file type
    const isVideo = isVideoFile(file);
    const isImage = IMAGE_MIME_TYPES.includes(file.type);

    if (!isVideo && !isImage) {
      setFileError(
        `Unsupported file type: ${file.type || 'unknown'}. Accepted: PNG, JPG, WebP, GIF, WebM, MP4, OGG, MOV`
      );
      e.target.value = '';
      return;
    }

    // Validate file size
    const maxSizeMB = isVideo ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB;
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB > maxSizeMB) {
      setFileError(
        `File too large: ${fileSizeMB.toFixed(1)}MB. Maximum for ${isVideo ? 'videos' : 'images'}: ${maxSizeMB}MB`
      );
      e.target.value = '';
      return;
    }

    setMediaFile(file);
    setIsPreviewVideo(isVideo);
    setSelectedFileInfo({
      name: file.name,
      size: formatFileSize(file.size),
      type: isVideo ? 'Video' : 'Image',
    });

    // Generate preview
    if (isVideo) {
      // For video, create object URL for preview
      const objectUrl = URL.createObjectURL(file);
      setMediaPreview(objectUrl);
    } else {
      // For image, use FileReader
      const reader = new FileReader();
      reader.onloadend = () => {
        setMediaPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearMedia = () => {
    // Revoke object URL if it was a video preview
    if (mediaPreview && isPreviewVideo && mediaFile) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setIsPreviewVideo(false);
    setSelectedFileInfo(null);
    setFileError(null);
    setFormData({ ...formData, imageUrl: '' });
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (mediaPreview && isPreviewVideo && mediaFile) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = new FormData();
    submitData.append('title', formData.title);
    submitData.append('description', formData.description);
    submitData.append('position', formData.position);
    submitData.append('actionType', formData.actionType);
    submitData.append('actionTarget', formData.actionTarget);
    submitData.append('isActive', String(formData.isActive));
    submitData.append('isScheduled', String(formData.isScheduled));
    submitData.append('backgroundColor', formData.backgroundColor);
    submitData.append('sortOrder', String(formData.sortOrder));

    if (formData.isScheduled) {
      if (formData.startDate) submitData.append('startDate', formData.startDate);
      if (formData.endDate) submitData.append('endDate', formData.endDate);
    }

    if (mediaFile) {
      // Append file under 'image' key (backend expects this field name)
      submitData.append('image', mediaFile);
      // Tell backend what type of media this is
      submitData.append(
        'mediaType',
        isVideoFile(mediaFile) ? 'video' : 'image'
      );
    } else if (formData.imageUrl && !banner?.image?.url) {
      submitData.append('imageUrl', formData.imageUrl);
      // Detect media type from URL
      submitData.append(
        'mediaType',
        isVideoUrl(formData.imageUrl) ? 'video' : 'image'
      );
    }

    await onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gradient-to-r from-cyan-50 to-blue-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {banner ? 'Edit Banner' : 'Create New Banner'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {banner
                ? 'Update banner details'
                : 'Add a new promotional banner (image or video)'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Banner title"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                rows={2}
                placeholder="Optional description"
              />
            </div>

            {/* Media Upload (Image OR Video) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banner Media <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Supports images (PNG, JPG, WebP, GIF) and videos (WebM, MP4,
                OGG, MOV)
              </p>

              {/* File error */}
              {fileError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{fileError}</p>
                  </div>
                </div>
              )}

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-cyan-400 transition-colors">
                {mediaPreview ? (
                  <div className="relative">
                    {isPreviewVideo ? (
                      // Video preview
                      <div className="relative rounded-lg overflow-hidden bg-black">
                        <video
                          src={mediaPreview}
                          className="w-full h-48 object-contain bg-black"
                          controls
                          muted
                          playsInline
                          preload="metadata"
                        />
                        {/* Video info overlay */}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          VIDEO
                        </div>
                      </div>
                    ) : (
                      // Image preview
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="w-full h-40 object-cover rounded-lg"
                      />
                    )}

                    {/* File info bar */}
                    {selectedFileInfo && (
                      <div className="mt-2 flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 text-sm">
                          {selectedFileInfo.type === 'Video' ? (
                            <Film className="w-4 h-4 text-purple-500" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-blue-500" />
                          )}
                          <span className="font-medium text-gray-700 truncate max-w-[200px]">
                            {selectedFileInfo.name}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span className="text-gray-500">
                            {selectedFileInfo.size}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                              selectedFileInfo.type === 'Video'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {selectedFileInfo.type}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={clearMedia}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center py-6 cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-blue-50 rounded-xl">
                        <ImageIcon className="w-8 h-8 text-blue-400" />
                      </div>
                      <div className="text-gray-300 text-2xl font-light">
                        /
                      </div>
                      <div className="p-3 bg-purple-50 rounded-xl">
                        <Film className="w-8 h-8 text-purple-400" />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      Click to upload image or video
                    </span>
                    <div className="flex flex-col items-center mt-2 space-y-1">
                      <span className="text-xs text-gray-400">
                        Images: PNG, JPG, WebP, GIF — up to {MAX_IMAGE_SIZE_MB}
                        MB
                      </span>
                      <span className="text-xs text-gray-400">
                        Videos: WebM, MP4, OGG, MOV — up to {MAX_VIDEO_SIZE_MB}
                        MB
                      </span>
                    </div>
                    <input
                      type="file"
                      accept={ACCEPTED_FILE_TYPES}
                      onChange={handleMediaChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* URL fallback (only when no file is selected) */}
              {!mediaPreview && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">
                    Or enter media URL (image or video):
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => {
                      const url = e.target.value;
                      setFormData({ ...formData, imageUrl: url });
                      if (url) {
                        setMediaPreview(url);
                        setIsPreviewVideo(isVideoUrl(url));
                        setSelectedFileInfo(null);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                    placeholder="https://example.com/banner.webm or .jpg"
                  />
                  {formData.imageUrl && (
                    <p className="mt-1 text-xs text-gray-400">
                      Detected type:{' '}
                      <span
                        className={`font-medium ${
                          isVideoUrl(formData.imageUrl)
                            ? 'text-purple-600'
                            : 'text-blue-600'
                        }`}
                      >
                        {isVideoUrl(formData.imageUrl) ? '🎬 Video' : '🖼️ Image'}
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Position & Action */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <select
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos.value} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action Type
                </label>
                <select
                  value={formData.actionType}
                  onChange={(e) =>
                    setFormData({ ...formData, actionType: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                >
                  {ACTION_TYPES.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Target */}
            {formData.actionType !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.actionType === 'url'
                    ? 'URL'
                    : formData.actionType === 'promo'
                      ? 'Promo Code'
                      : formData.actionType === 'screen'
                        ? 'Screen Name'
                        : 'Target ID'}
                </label>
                <input
                  type="text"
                  value={formData.actionTarget}
                  onChange={(e) =>
                    setFormData({ ...formData, actionTarget: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                  placeholder={
                    formData.actionType === 'url'
                      ? 'https://example.com'
                      : formData.actionType === 'promo'
                        ? 'SUMMER20'
                        : formData.actionType === 'screen'
                          ? 'profile'
                          : 'Enter target ID'
                  }
                />
              </div>
            )}

            {/* Schedule */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isScheduled}
                  onChange={(e) =>
                    setFormData({ ...formData, isScheduled: e.target.checked })
                  }
                  className="w-4 h-4 text-cyan-600 rounded"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    Schedule this banner
                  </span>
                  <p className="text-xs text-gray-500">
                    Set start and end dates
                  </p>
                </div>
              </label>

              {formData.isScheduled && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) =>
                        setFormData({ ...formData, endDate: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-green-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4"></div>
                </div>
                <span className="text-sm font-medium text-gray-700">
                  Active
                </span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 font-medium transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mediaFile && isVideoFile(mediaFile)
                    ? 'Uploading video...'
                    : 'Saving...'}
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {banner ? 'Update Banner' : 'Create Banner'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const BannersPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [banners, setBanners] = useState<Banner[]>([]);
  const [stats, setStats] = useState<BannerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Banner | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [positionFilter, setPositionFilter] = useState<string>('');
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ==================== FETCH DATA ====================
  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, any> = { page: currentPage, limit: 20 };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter) params.isActive = statusFilter;
      if (positionFilter) params.position = positionFilter;

      const response = await bannersApi.getAll(params);

      if (response.success) {
        const bannersData = Array.isArray(response.data)
          ? response.data
          : response.data?.data || response.data?.banners || [];
        setBanners(bannersData);

        const paginationData =
          response.pagination || response.data?.pagination;
        if (paginationData) setPagination(paginationData);
      }
    } catch (err: any) {
      console.error('Error fetching banners:', err);
      setError(err.message || 'Failed to fetch banners');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, positionFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await bannersApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
    fetchStats();
  }, [fetchBanners, fetchStats]);

  // Auto-hide success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // ==================== HANDLERS ====================
  const handleSubmit = async (formData: FormData) => {
    try {
      setSaving(true);
      setError(null);

      let response;
      if (editingBanner) {
        response = await bannersApi.update(editingBanner._id, formData);
      } else {
        response = await bannersApi.create(formData);
      }

      if (response.success) {
        setSuccessMessage(
          editingBanner
            ? 'Banner updated successfully!'
            : 'Banner created successfully!'
        );
        setShowForm(false);
        setEditingBanner(null);
        fetchBanners();
        fetchStats();
      } else {
        setError(response.message || 'Failed to save banner');
      }
    } catch (err: any) {
      console.error('Error saving banner:', err);
      setError(
        err.response?.data?.message || err.message || 'Failed to save banner'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (banner: Banner) => {
    try {
      setSaving(true);
      const response = await bannersApi.delete(banner._id);

      if (response.success) {
        setSuccessMessage('Banner deleted successfully!');
        setDeleteConfirm(null);
        fetchBanners();
        fetchStats();
      }
    } catch (err: any) {
      console.error('Error deleting banner:', err);
      setError(err.message || 'Failed to delete banner');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (banner: Banner) => {
    try {
      const formData = new FormData();
      formData.append('isActive', String(!banner.isActive));

      const response = await bannersApi.update(banner._id, formData);

      if (response.success) {
        setSuccessMessage(
          banner.isActive ? 'Banner deactivated!' : 'Banner activated!'
        );
        fetchBanners();
        fetchStats();
      }
    } catch (err: any) {
      console.error('Error toggling status:', err);
      setError(err.message || 'Failed to toggle status');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = banners.findIndex((b) => b._id === active.id);
    const newIndex = banners.findIndex((b) => b._id === over.id);

    const newBanners = arrayMove(banners, oldIndex, newIndex);
    setBanners(newBanners);

    try {
      const reorderedBanners = newBanners.map((banner, index) => ({
        id: banner._id,
        sortOrder: index,
      }));

      await bannersApi.reorder(reorderedBanners);
      setSuccessMessage('Banners reordered successfully!');
    } catch (err: any) {
      console.error('Error reordering banners:', err);
      setError('Failed to save new order');
      fetchBanners();
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPositionFilter('');
  };

  const hasFilters = searchQuery || statusFilter || positionFilter;

  // ==================== RENDER ====================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-blue-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/sdui')}
                className="p-2 hover:bg-white rounded-xl transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/25">
                <ImageIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Banner Management
                </h1>
                <p className="text-gray-500 mt-1">
                  Create and manage promotional banners — images & videos
                  (WebM, MP4)
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingBanner(null);
                setShowForm(true);
              }}
              className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-cyan-500/25"
            >
              <Plus className="w-5 h-5" />
              Create Banner
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-cyan-100 to-cyan-200 rounded-xl">
                    <ImageIcon className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">
                      {stats.totalBanners}
                    </p>
                    <p className="text-sm text-gray-500 font-medium">
                      Total Banners
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl">
                    <Eye className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-600">
                      {stats.activeBanners}
                    </p>
                    <p className="text-sm text-gray-500 font-medium">Active</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl">
                    <EyeOff className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-600">
                      {stats.inactiveBanners}
                    </p>
                    <p className="text-sm text-gray-500 font-medium">
                      Inactive
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl">
                    <Calendar className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-orange-600">
                      {stats.scheduledBanners}
                    </p>
                    <p className="text-sm text-gray-500 font-medium">
                      Scheduled
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-xl">
                    <Clock className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-600">
                      {stats.expiredBanners}
                    </p>
                    <p className="text-sm text-gray-500 font-medium">
                      Expired
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search banners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="px-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20"
            >
              <option value="">All Positions</option>
              {POSITIONS.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                {banners.length} result(s) found
              </span>
              <button
                onClick={clearFilters}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-5 py-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="p-1 hover:bg-green-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Banners List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 border-4 border-cyan-200 rounded-full animate-spin border-t-cyan-600"></div>
            <p className="mt-4 text-gray-500 font-medium">
              Loading banners...
            </p>
          </div>
        ) : banners.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ImageIcon className="w-10 h-10 text-cyan-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No banners yet
            </h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              {hasFilters
                ? 'No banners match your filters.'
                : 'Create your first banner to promote services — supports images & WebM videos'}
            </p>
            {hasFilters ? (
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 inline-flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                Create First Banner
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
                Drag banners to reorder • Changes are saved automatically
              </p>
              <button
                onClick={() => {
                  fetchBanners();
                  fetchStats();
                }}
                disabled={loading}
                className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-2 font-medium px-3 py-1.5 rounded-lg hover:bg-cyan-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={banners.map((b) => b._id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-4">
                  {banners.map((banner) => (
                    <SortableBannerItem
                      key={banner._id}
                      banner={banner}
                      onEdit={(b) => {
                        setEditingBanner(b);
                        setShowForm(true);
                      }}
                      onDelete={(b) => setDeleteConfirm(b)}
                      onToggleStatus={handleToggleStatus}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev}
                  className="p-2 rounded-lg border disabled:opacity-50 hover:bg-white"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!pagination.hasNext}
                  className="p-2 rounded-lg border disabled:opacity-50 hover:bg-white"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Form Modal */}
        {showForm && (
          <BannerForm
            banner={editingBanner}
            onSubmit={handleSubmit}
            onClose={() => {
              setShowForm(false);
              setEditingBanner(null);
            }}
            isLoading={saving}
          />
        )}

        {/* Delete Confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Banner
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete "{deleteConfirm.title}"? This
                action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={saving}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium disabled:opacity-50"
                >
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== DEFAULT EXPORT ====================
export default BannersPage;