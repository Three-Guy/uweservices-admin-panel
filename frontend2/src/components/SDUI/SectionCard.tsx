// src/components/SDUI/SectionCard.tsx
import React from 'react';
import { 
  GripVertical, 
  Settings, 
  Eye, 
  EyeOff, 
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SDUISection, SECTION_TYPES } from '../../lib/sduiApi';

interface SectionCardProps {
  section: SDUISection;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onConfigure: () => void;
  onDelete: () => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

const SectionCard: React.FC<SectionCardProps> = ({
  section,
  index,
  isExpanded,
  onToggleExpand,
  onToggleEnabled,
  onConfigure,
  onDelete,
  isDragging,
  dragHandleProps,
}) => {
  const sectionType = SECTION_TYPES.find(t => t.value === section.type);
  const icon = sectionType?.icon || '📦';
  const label = sectionType?.label || section.type;

  return (
    <div
      className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
        isDragging 
          ? 'shadow-2xl border-indigo-400 scale-[1.02]' 
          : section.enabled 
            ? 'border-gray-200 hover:border-indigo-300 shadow-sm' 
            : 'border-gray-200 bg-gray-50 opacity-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="flex items-center justify-center w-8 h-8 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        {/* Order Number */}
        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
          {index + 1}
        </div>

        {/* Icon & Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <h3 className="font-semibold text-gray-900 truncate">{label}</h3>
            {!section.enabled && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
                Hidden
              </span>
            )}
          </div>
          {section.title && (
            <p className="text-sm text-gray-500 truncate mt-0.5">
              "{section.title}"
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleEnabled}
            className={`p-2 rounded-lg transition-colors ${
              section.enabled 
                ? 'text-green-600 hover:bg-green-50' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={section.enabled ? 'Hide section' : 'Show section'}
          >
            {section.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          
          <button
            onClick={onConfigure}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            title="Configure section"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            title="Delete section"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleExpand}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t bg-gray-50">
          <div className="pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Type:</span>
              <p className="font-medium text-gray-900">{section.type}</p>
            </div>
            <div>
              <span className="text-gray-500">Data Source:</span>
              <p className="font-medium text-gray-900">{section.dataSource || 'None'}</p>
            </div>
            <div>
              <span className="text-gray-500">Layout:</span>
              <p className="font-medium text-gray-900">{section.layout?.style || 'Default'}</p>
            </div>
            <div>
              <span className="text-gray-500">Items:</span>
              <p className="font-medium text-gray-900">{section.layout?.itemsToShow || 'All'}</p>
            </div>
          </div>
          
          {section.showViewAll && section.viewAllTarget && (
            <div className="mt-2 text-sm">
              <span className="text-gray-500">View All:</span>
              <span className="ml-1 font-medium text-indigo-600">{section.viewAllTarget}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SectionCard;
