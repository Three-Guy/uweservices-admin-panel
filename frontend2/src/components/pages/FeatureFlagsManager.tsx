import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, ToggleLeft, ToggleRight, Info } from 'lucide-react';

interface FeatureFlag {
  _id: string;
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  type: string;
  value: any;
  conditions: {
    platform?: string[];
    appVersion?: string;
    userSegment?: string[];
  };
  createdAt: string;
  updatedAt: string;
}

const FeatureFlagsManager: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    isEnabled: false,
    type: 'boolean',
    value: '',
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/sdui/feature-flags`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setFlags(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching feature flags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingFlag 
        ? `${API_URL}/admin/sdui/feature-flags/${editingFlag._id}`
        : `${API_URL}/admin/sdui/feature-flags`;
      
      const payload = {
        ...formData,
        value: formData.type === 'boolean' ? formData.isEnabled : formData.value,
      };

      const response = await fetch(url, {
        method: editingFlag ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        fetchFlags();
        closeModal();
      } else {
        alert(data.message || 'Error saving feature flag');
      }
    } catch (error) {
      console.error('Error saving feature flag:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feature flag?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/admin/sdui/feature-flags/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchFlags();
    } catch (error) {
      console.error('Error deleting feature flag:', error);
    }
  };

  const toggleFlag = async (flag: FeatureFlag) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/admin/sdui/feature-flags/${flag._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isEnabled: !flag.isEnabled }),
      });
      fetchFlags();
    } catch (error) {
      console.error('Error toggling flag:', error);
    }
  };

  const openModal = (flag?: FeatureFlag) => {
    if (flag) {
      setEditingFlag(flag);
      setFormData({
        key: flag.key,
        name: flag.name,
        description: flag.description || '',
        isEnabled: flag.isEnabled,
        type: flag.type || 'boolean',
        value: typeof flag.value === 'object' ? JSON.stringify(flag.value) : String(flag.value),
      });
    } else {
      setEditingFlag(null);
      setFormData({
        key: '',
        name: '',
        description: '',
        isEnabled: false,
        type: 'boolean',
        value: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFlag(null);
  };

  const filteredFlags = flags.filter(flag =>
    flag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    flag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
        <p className="text-gray-600">Control feature availability in the mobile app</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search flags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          Add Flag
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flag</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredFlags.map(flag => (
              <tr key={flag._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-start gap-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{flag.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{flag.key}</div>
                      {flag.description && (
                        <div className="text-xs text-gray-400 mt-1">{flag.description}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                    {flag.type || 'boolean'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600 font-mono">
                    {typeof flag.value === 'object' ? JSON.stringify(flag.value) : String(flag.value)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleFlag(flag)}
                    className={`inline-flex items-center gap-2 ${
                      flag.isEnabled ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {flag.isEnabled ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                    <span className="text-sm">{flag.isEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button onClick={() => openModal(flag)} className="text-indigo-600 hover:text-indigo-900 p-1">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(flag._id)} className="text-red-600 hover:text-red-900 p-1 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredFlags.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No feature flags found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold mb-4">
              {editingFlag ? 'Edit Feature Flag' : 'Add Feature Flag'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                    placeholder="feature_new_checkout"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="New Checkout Flow"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="boolean">Boolean (On/Off)</option>
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                {formData.type !== 'boolean' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                    <input
                      type={formData.type === 'number' ? 'number' : 'text'}
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isEnabled"
                    checked={formData.isEnabled}
                    onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor="isEnabled" className="ml-2 text-sm text-gray-900">Enabled</label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                  {editingFlag ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagsManager;