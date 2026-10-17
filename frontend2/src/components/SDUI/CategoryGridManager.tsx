// src/pages/SDUI/components/CategoryGridManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Grid3X3,
  GripVertical,
  Settings,
  Eye,
  EyeOff,
  Plus,
  X,
  Edit,
  RefreshCw,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Smartphone,
} from 'lucide-react';
import { sduiCategoryApi, SDUICategory } from '../../../lib/sduiApi';
import MoreServicesConfigModal from './MoreServicesConfigModal';

// ==================== TYPES ====================

interface GridCategory {
  _id: string;
  id: string;
  categoryId: string;
  name: string;
  description: string;
  icon: string;
  image: {
    url: string | null;
    publicId: string | null;
  };
  color: string;
  colorClass: string;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  isMoreServicesSection?: boolean;
  subservicesCount?: number;
  servicesCount?: number;
}

interface CategoryGridManagerProps {
  onEditCategory?: (category: GridCategory) => void;
  onRefresh?: () => void;
}

// ==================== SORTABLE CATEGORY CARD ====================

interface SortableCategoryCardProps {
  category: GridCategory;
  index: number;
  isInGrid: boolean;
  onEdit?: (category: GridCategory) => void;
  onRemoveFromGrid?: (category: GridCategory) => void;
  onAddToGrid?: (category: GridCategory) => void;
  onToggleActive?: (category: GridCategory) => void;
  disabled?: boolean;
}

const SortableCategoryCard: React.FC<SortableCategoryCardProps> = ({
  category,
  index,
  isInGrid,
  onEdit,
  onRemoveFromGrid,
  onAddToGrid,
  onToggleActive,
  disabled = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category._id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative bg-white rounded-xl border-2 overflow-hidden
        ${isDragging ? 'border-indigo-500 shadow-xl z-50' : 'border-gray-200'}
        ${!category.isActive ? 'opacity-60' : ''}
        transition-all duration-200
      `}
    >
      {/* Grid Position Badge */}
      {isInGrid && (
        <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
          #{index + 1}
        </div>
      )}

      {/* Drag Handle */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-100 transition-colors"
        >
          <GripVertical size={16} className="text-gray-500" />
        </div>
      )}

      {/* Category Image */}
      <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 relative">
        {category.image?.url ? (
          <img
            src={category.image.url}
            alt={category.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-4xl"
            style={{ backgroundColor: category.color + '20' }}
          >
            {category.icon}
          </div>
        )}
        
        {/* Inactive Overlay */}
        {!category.isActive && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded">
              Inactive
            </span>
          </div>
        )}
      </div>

      {/* Category Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">{category.name}</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {category.subservicesCount || category.servicesCount || 0} services
            </p>
          </div>
          <div
            className="w-6 h-6 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
          {isInGrid ? (
            <button
              onClick={() => onRemoveFromGrid?.(category)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X size={14} />
              Remove
            </button>
          ) : (
            <button
              onClick={() => onAddToGrid?.(category)}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Add to Grid
            </button>
          )}
          
          <button
            onClick={() => onEdit?.(category)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Edit size={14} />
          </button>
          
          <button
            onClick={() => onToggleActive?.(category)}
            className={`p-1.5 rounded-lg transition-colors ${
              category.isActive 
                ? 'text-green-600 hover:bg-green-50' 
                : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            {category.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== DRAG OVERLAY CARD ====================

const DragOverlayCard: React.FC<{ category: GridCategory }> = ({ category }) => (
  <div className="bg-white rounded-xl border-2 border-indigo-500 shadow-2xl overflow-hidden w-48">
    <div className="h-24 bg-gradient-to-br from-gray-100 to-gray-200">
      {category.image?.url ? (
        <img
          src={category.image.url}
          alt={category.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-3xl"
          style={{ backgroundColor: category.color + '20' }}
        >
          {category.icon}
        </div>
      )}
    </div>
    <div className="p-2">
      <h4 className="font-semibold text-gray-900 truncate text-sm">{category.name}</h4>
    </div>
  </div>
);

// ==================== MORE SERVICES CARD ====================

interface MoreServicesCardProps {
  config: GridCategory | null;
  totalRemaining: number;
  onConfigure: () => void;
}

const MoreServicesCard: React.FC<MoreServicesCardProps> = ({
  config,
  totalRemaining,
  onConfigure,
}) => (
  <div className="relative bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-dashed border-indigo-300 overflow-hidden">
    {/* Badge */}
    <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full">
      #4
    </div>

    {/* Content */}
    <div className="h-32 flex items-center justify-center">
      {config?.image?.url ? (
        <img
          src={config.image.url}
          alt="More Services"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="text-center">
          <div className="text-4xl mb-1">
            {config?.icon || '🔧'}
          </div>
          <span className="text-indigo-600 font-medium text-sm">
            +{totalRemaining} More
          </span>
        </div>
      )}
    </div>

    {/* Info */}
    <div className="p-3">
      <h4 className="font-semibold text-gray-900">
        {config?.name || 'More Services'}
      </h4>
      <p className="text-xs text-gray-500 mt-0.5">
        Shows remaining {totalRemaining} categories
      </p>

      {/* Configure Button */}
      <button
        onClick={onConfigure}
        className="w-full mt-3 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Settings size={14} />
        Configure
      </button>
    </div>
  </div>
);

// ==================== MOBILE PREVIEW ====================

interface MobilePreviewProps {
  gridCategories: GridCategory[];
  moreServicesConfig: GridCategory | null;
  totalRemaining: number;
}

const MobilePreview: React.FC<MobilePreviewProps> = ({
  gridCategories,
  moreServicesConfig,
  totalRemaining,
}) => (
  <div className="bg-gray-900 rounded-3xl p-2 w-64 mx-auto shadow-2xl">
    {/* Phone Notch */}
    <div className="bg-black rounded-t-2xl pt-2">
      <div className="w-20 h-5 bg-gray-900 rounded-full mx-auto" />
    </div>

    {/* Screen */}
    <div className="bg-white rounded-b-2xl p-3 min-h-[320px]">
      {/* Header */}
      <div className="text-center mb-3">
        <h4 className="font-semibold text-gray-900 text-sm">Our Services</h4>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        {gridCategories.slice(0, 3).map((cat) => (
          <div
            key={cat._id}
            className="aspect-square rounded-xl overflow-hidden relative"
          >
            {cat.image?.url ? (
              <img
                src={cat.image.url}
                alt={cat.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl"
                style={{ backgroundColor: cat.color + '30' }}
              >
                {cat.icon}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="absolute bottom-1 left-1 right-1 text-white text-xs font-medium truncate">
              {cat.name}
            </span>
          </div>
        ))}

        {/* More Services Card */}
        {totalRemaining > 0 && (
          <div className="aspect-square rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex flex-col items-center justify-center border border-indigo-200">
            <span className="text-xl">{moreServicesConfig?.icon || '🔧'}</span>
            <span className="text-xs font-medium text-indigo-700 mt-1">
              +{totalRemaining} More
            </span>
          </div>
        )}
      </div>

      {/* Bottom indicator */}
      <div className="mt-4 flex justify-center">
        <div className="w-24 h-1 bg-gray-300 rounded-full" />
      </div>
    </div>
  </div>
);

// ==================== MAIN COMPONENT ====================

const CategoryGridManager: React.FC<CategoryGridManagerProps> = ({
  onEditCategory,
  onRefresh,
}) => {
  // State
  const [gridCategories, setGridCategories] = useState<GridCategory[]>([]);
  const [remainingCategories, setRemainingCategories] = useState<GridCategory[]>([]);
  const [moreServicesConfig, setMoreServicesConfig] = useState<GridCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showRemaining, setShowRemaining] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch data
  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await sduiCategoryApi.getAll({
        sortBy: 'sortOrder',
        sortOrder: 'asc',
        limit: 100,
      });

      if (response.success) {
        const allCategories = response.data || [];

        // Separate More Services from regular categories
        const moreServices = allCategories.find((cat: SDUICategory) => cat.isMoreServicesSection) || null;
        const regular = allCategories.filter((cat: SDUICategory) => !cat.isMoreServicesSection && cat.isActive);

        // Sort by sortOrder
        regular.sort((a: SDUICategory, b: SDUICategory) => a.sortOrder - b.sortOrder);

        // First 3 go to grid
        setGridCategories(regular.slice(0, 3) as GridCategory[]);
        setRemainingCategories(regular.slice(3) as GridCategory[]);
        setMoreServicesConfig(moreServices as GridCategory | null);
        setHasChanges(false);
      } else {
        setError('Failed to fetch categories');
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError(err.message || 'Failed to fetch categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    // Find which list the items are in
    const activeInGrid = gridCategories.some(c => c._id === active.id);
    const overInGrid = gridCategories.some(c => c._id === over.id);

    if (activeInGrid && overInGrid) {
      // Reordering within grid
      const oldIndex = gridCategories.findIndex(c => c._id === active.id);
      const newIndex = gridCategories.findIndex(c => c._id === over.id);

      setGridCategories(arrayMove(gridCategories, oldIndex, newIndex));
      setHasChanges(true);
    }
  };

  // Add category to grid
  const handleAddToGrid = (category: GridCategory) => {
    if (gridCategories.length >= 3) {
      // Remove last from grid, add to remaining
      const lastInGrid = gridCategories[2];
      const newGrid = [...gridCategories.slice(0, 2), category];
      const newRemaining = [lastInGrid, ...remainingCategories.filter(c => c._id !== category._id)];

      setGridCategories(newGrid);
      setRemainingCategories(newRemaining);
    } else {
      setGridCategories([...gridCategories, category]);
      setRemainingCategories(remainingCategories.filter(c => c._id !== category._id));
    }
    setHasChanges(true);
  };

  // Remove category from grid
  const handleRemoveFromGrid = (category: GridCategory) => {
    setGridCategories(gridCategories.filter(c => c._id !== category._id));
    setRemainingCategories([...remainingCategories, category]);
    setHasChanges(true);
  };

  // Toggle category active status
  const handleToggleActive = async (category: GridCategory) => {
    try {
      await sduiCategoryApi.update(category._id, { isActive: !category.isActive });
      fetchCategories();
    } catch (err: any) {
      console.error('Error toggling status:', err);
      setError(err.message || 'Failed to update category');
    }
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Build ordered list: grid categories first, then remaining
      const allOrdered = [...gridCategories, ...remainingCategories];
      const orderData = allOrdered.map((cat, index) => ({
        id: cat._id,
        sortOrder: index,
      }));

      await sduiCategoryApi.reorder(orderData);
      setHasChanges(false);
      onRefresh?.();
    } catch (err: any) {
      console.error('Error saving order:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Discard changes
  const handleDiscard = () => {
    fetchCategories();
  };

  // Get active category for drag overlay
  const activeCategory = activeId
    ? [...gridCategories, ...remainingCategories].find(c => c._id === activeId)
    : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        <span className="ml-3 text-gray-600">Loading categories...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Grid3X3 className="text-indigo-600" size={24} />
            Category Grid Manager
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Drag and drop to reorder. First 3 categories appear in the home grid.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCategories}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={20} />
          </button>

          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showPreview
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Smartphone size={18} />
            Preview
          </button>

          {hasChanges && (
            <>
              <button
                onClick={handleDiscard}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <Check size={18} />
                )}
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-red-100 rounded"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
        {/* Grid Editor */}
        <div className={showPreview ? 'lg:col-span-2' : ''}>
          {/* Grid Categories (First 3) */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">
                  {gridCategories.length}
                </span>
                Home Grid Categories
                <span className="text-xs text-gray-400 font-normal">(Max 3)</span>
              </h3>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={gridCategories.map(c => c._id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Grid Categories */}
                  {gridCategories.map((category, index) => (
                    <SortableCategoryCard
                      key={category._id}
                      category={category}
                      index={index}
                      isInGrid={true}
                      onEdit={onEditCategory}
                      onRemoveFromGrid={handleRemoveFromGrid}
                      onToggleActive={handleToggleActive}
                    />
                  ))}

                  {/* More Services Card */}
                  <MoreServicesCard
                    config={moreServicesConfig}
                    totalRemaining={remainingCategories.length}
                    onConfigure={() => setShowConfigModal(true)}
                  />
                </div>
              </SortableContext>

              {/* Drag Overlay */}
              <DragOverlay>
                {activeCategory ? (
                  <DragOverlayCard category={activeCategory} />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Remaining Categories */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <button
              onClick={() => setShowRemaining(!showRemaining)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                  {remainingCategories.length}
                </span>
                Other Categories
                <span className="text-xs text-gray-400 font-normal">
                  (Shown in "More Services")
                </span>
              </h3>
              {showRemaining ? (
                <ChevronUp size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>

            {showRemaining && remainingCategories.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                {remainingCategories.map((category) => (
                  <SortableCategoryCard
                    key={category._id}
                    category={category}
                    index={-1}
                    isInGrid={false}
                    onEdit={onEditCategory}
                    onAddToGrid={handleAddToGrid}
                    onToggleActive={handleToggleActive}
                    disabled
                  />
                ))}
              </div>
            )}

            {showRemaining && remainingCategories.length === 0 && (
              <p className="text-center text-gray-500 py-8 mt-4 border-t border-gray-100">
                All categories are in the grid. Add more categories to see them here.
              </p>
            )}
          </div>
        </div>

        {/* Mobile Preview */}
        {showPreview && (
          <div className="lg:col-span-1">
            <div className="bg-gray-100 rounded-xl p-6 sticky top-4">
              <h3 className="font-semibold text-gray-900 text-center mb-4">
                Mobile Preview
              </h3>
              <MobilePreview
                gridCategories={gridCategories}
                moreServicesConfig={moreServicesConfig}
                totalRemaining={remainingCategories.length}
              />
              <p className="text-xs text-gray-500 text-center mt-4">
                This is how it will appear on the user's home screen
              </p>
            </div>
          </div>
        )}
      </div>

      {/* More Services Config Modal */}
      {showConfigModal && (
        <MoreServicesConfigModal
          config={moreServicesConfig}
          categories={[...gridCategories, ...remainingCategories]}
          onClose={() => setShowConfigModal(false)}
          onSave={async () => {
            await fetchCategories();
            setShowConfigModal(false);
          }}
        />
      )}
    </div>
  );
};

export default CategoryGridManager;