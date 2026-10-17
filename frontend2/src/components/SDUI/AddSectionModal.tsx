// src/components/SDUI/AddSectionModal.tsx
import React, { useState } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { SECTION_TYPES } from '../../lib/sduiApi';

interface AddSectionModalProps {
  onAdd: (sectionType: string) => void;
  onClose: () => void;
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({ onAdd, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTypes = SECTION_TYPES.filter(type =>
    type.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    type.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Section</h2>
            <p className="text-sm text-gray-500">Choose a section type to add to your layout</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search section types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
          </div>
        </div>

        {/* Section Types Grid */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => onAdd(type.value)}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group text-left"
              >
                <span className="text-3xl">{type.icon}</span>
                <div className="text-center">
                  <p className="font-medium text-gray-900 group-hover:text-indigo-700">
                    {type.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {type.dataSource ? `Data: ${type.dataSource}` : 'Static'}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {filteredTypes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No section types match "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddSectionModal;
