// src/components/SDUI/CategoryCard.tsx
import React from 'react';
import { 
  GripVertical, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Star,
  Hash,
  Layers,
  Settings
} from 'lucide-react';
import { SDUICategory } from '../../lib/sduiApi';

interface CategoryCardProps {
  category: SDUICategory;
  index: number;
  onEdit: (category: SDUICategory) => void;
  onDelete: (category: SDUICategory) => void;
  onToggleStatus: (category: SDUICategory) => void;
  onToggleFeatured: (category: SDUICategory) => void;
  onConfigureMoreServices?: (category: SDUICategory) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  index,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleFeatured,
  onConfigureMoreServices,
  isDragging,
  dragHandleProps,
}) => {
  return (
    <div
      className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
        isDragging ? 'shadow-xl border-purple-300 scale-[1.02]' : 'hover:shadow-md'
      } ${category.isMoreServicesSection ? 'ring-2 ring-blue-200' : ''}`}
    >
      <div className="flex items-center">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex items-center justify-center w-10 bg-gray-50 self-stretch cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        {/* Image */}
        <div 
          className="w-20 h-20 flex-shrink-0 flex items-center justify-center relative"
          style={{ backgroundColor: category.color + '20' }}
        >
          {category.image?.url ? (
            <img
              src={category.image.url}
              alt={category.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl">{category.icon}</span>
          )}
          {category.isMoreServicesSection && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <Layers className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xl">{category.icon}</span>
                <h3 className="font-semibold text-gray-900 truncate">{category.name}</h3>
                {!category.isActive && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                )}
                {category.isFeatured && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                    <Star className="w-3 h-3" /> Featured
                  </span>
                )}
                {category.isMoreServicesSection && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> More Services
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                {category.isMoreServicesSection 
                  ? (category.moreServicesConfig?.displaySettings?.subtitle || 'Explore all services')
                  : (category.description || 'No description')
                }
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {category.categoryId}
                </span>
                {!category.isMoreServicesSection && (
                  <span>{category.servicesCount || 0} services</span>
                )}
                <span 
                  className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: category.color }}
                  title={category.color}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Configure More Services Button */}
              {category.isMoreServicesSection && onConfigureMoreServices && (
                <button
                  onClick={() => onConfigureMoreServices(category)}
                  className="p-2 rounded-lg text-purple-600 hover:bg-purple-50 transition-colors"
                  title="Configure More Services"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              
              {/* Featured Toggle - hide for More Services section */}
              {!category.isMoreServicesSection && (
                <button
                  onClick={() => onToggleFeatured(category)}
                  className={`p-2 rounded-lg transition-colors ${
                    category.isFeatured 
                      ? 'text-yellow-600 hover:bg-yellow-50' 
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={category.isFeatured ? 'Remove from featured' : 'Add to featured'}
                >
                  <Star className={`w-4 h-4 ${category.isFeatured ? 'fill-current' : ''}`} />
                </button>
              )}
              
              <button
                onClick={() => onToggleStatus(category)}
                className={`p-2 rounded-lg transition-colors ${
                  category.isActive 
                    ? 'text-green-600 hover:bg-green-50' 
                    : 'text-gray-400 hover:bg-gray-100'
                }`}
                title={category.isActive ? 'Deactivate' : 'Activate'}
              >
                {category.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onEdit(category)}
                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(category)}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryCard;