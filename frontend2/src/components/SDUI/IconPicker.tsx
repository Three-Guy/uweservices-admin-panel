// src/components/SDUI/IconPicker.tsx
import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

interface IconPickerProps {
  currentIcon: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = {
  'Services': ['🧹', '🔧', '⚡', '🔨', '🎨', '🪠', '❄️', '🔥', '💧', '🪟', '🛠️', '⚙️'],
  'Home': ['🏠', '🛋️', '🛏️', '🚿', '🚽', '🍳', '🧺', '🪴', '🏡', '🧸', '🖼️', '💡'],
  'Beauty': ['💅', '💇', '💆', '🧖', '💄', '✨', '🌸', '🧴', '💐', '🪷', '🌺', '💎'],
  'Health': ['💊', '🏥', '🩺', '💉', '🩹', '🧘', '🏃', '💪', '🧠', '❤️', '🫀', '🦷'],
  'Transport': ['🚗', '🏍️', '🚚', '✈️', '🚢', '🚲', '🛵', '🚕', '🚙', '🛻', '🚌', '⛽'],
  'Tech': ['💻', '📱', '🖥️', '📺', '🎮', '📷', '🔌', '💾', '🖨️', '⌨️', '🖱️', '📡'],
  'Food': ['🍕', '🍔', '🍱', '🍜', '🍰', '☕', '🥗', '🍳', '🥐', '🍣', '🌮', '🥘'],
  'General': ['📦', '🎁', '⭐', '🔔', '📌', '🎯', '🏆', '🎪', '🎭', '🎨', '🔑', '📍'],
};

const IconPicker: React.FC<IconPickerProps> = ({
  currentIcon,
  onSelect,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const allIcons = Object.values(EMOJI_CATEGORIES).flat();

  const filteredIcons = searchQuery
    ? allIcons.filter(icon => icon.includes(searchQuery))
    : activeCategory
    ? EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES]
    : allIcons;

  return (
    <div className="mt-3 bg-white border border-gray-200 rounded-xl shadow-lg p-4 max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">Select Icon</h4>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setActiveCategory(null);
          }}
          placeholder="Search icons..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`px-2 py-1 text-xs rounded-full transition-colors ${
            !activeCategory ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {Object.keys(EMOJI_CATEGORIES).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => {
              setActiveCategory(category);
              setSearchQuery('');
            }}
            className={`px-2 py-1 text-xs rounded-full transition-colors ${
              activeCategory === category
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Icons Grid */}
      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
        {filteredIcons.map((icon, index) => (
          <button
            key={`${icon}-${index}`}
            type="button"
            onClick={() => onSelect(icon)}
            className={`w-8 h-8 text-xl flex items-center justify-center rounded-lg transition-all ${
              currentIcon === icon
                ? 'bg-blue-100 ring-2 ring-blue-500'
                : 'hover:bg-gray-100'
            }`}
          >
            {icon}
          </button>
        ))}
      </div>

      {filteredIcons.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">
          No icons found
        </p>
      )}
    </div>
  );
};

export default IconPicker;
