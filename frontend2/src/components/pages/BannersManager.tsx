import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Image, Calendar } from 'lucide-react';

interface Banner {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: string;
  linkValue: string;
  position: string;
  sortOrder: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

const BannersManager: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    linkType: 'none',
    linkValue: '',
    position: 'home_top',
    isActive: true,
    startDate: '',
    endDate: '',
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/sdui/banners`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setBanners(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingBanner 
        ? `${API_URL}/admin/sdui/banners/${editingBanner._id}`
        : `${API_URL}/admin/sdui/banners`;
      
      const response = await fetch(url, {
        method: editingBanner ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        fetchBanners();
        closeModal();
      } else {
        alert(data.message || 'Error saving banner');
      }
    } catch (error) {
      console.error('Error saving banner:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/admin/sdui/banners/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchBanners();
    } catch (error) {
      console.error('Error deleting banner:', error);
    }
  };

  const toggleStatus = async (banner: Banner) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/admin/sdui/banners/${banner._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      fetchBanners();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const openModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title,
        subtitle: banner.subtitle || '',
        imageUrl: banner.imageUrl,
        linkType: banner.linkType,
        linkValue: banner.linkValue || '',
        position: banner.position,
        isActive: banner.isActive,
        startDate: banner.startDate?.split('T')[0] || '',
        endDate: banner.endDate?.split('T')[0] || '',
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: '',
        subtitle: '',
        imageUrl: '',
        linkType: 'none',
        linkValue: '',
        position: 'home_top',
        isActive: true,
        startDate: '',
        endDate: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBanner(null);
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Banners Manager</h1>
        <p className="text-gray-600">Manage promotional banners for the mobile app</p>
      </div>

      <div className="flex justify-end mb-6">
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          Add Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map(banner => (
          <div key={banner._id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="relative h-40 bg-gray-200">
              {banner.imageUrl ? (
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Image className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => toggleStatus(banner)}
                  className={`p-1 rounded ${banner.isActive ? 'bg-green-500' : 'bg-gray-500'} text-white`}
                >
                  {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900">{banner.title}</h3>
              {banner.subtitle && (
                <p className="text-sm text-gray-500 mt-1">{banner.subtitle}</p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                <span>{banner.position}</span>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => openModal(banner)}
                  className="text-indigo-600 hover:text-indigo-900 p-1"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(banner._id)}
                  className="text-red-600 hover:text-red-900 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg">
          <Image className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No banners found</p>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {editingBanner ? 'Edit Banner' : 'Add Banner'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL *</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="home_top">Home Top</option>
                    <option value="home_middle">Home Middle</option>
                    <option value="category_top">Category Top</option>
                    <option value="service_detail">Service Detail</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link Type</label>
                  <select
                    value={formData.linkType}
                    onChange={(e) => setFormData({ ...formData, linkType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="none">None</option>
                    <option value="category">Category</option>
                    <option value="service">Service</option>
                    <option value="url">External URL</option>
                  </select>
                </div>
                {formData.linkType !== 'none' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link Value</label>
                    <input
                      type="text"
                      value={formData.linkValue}
                      onChange={(e) => setFormData({ ...formData, linkValue: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder={formData.linkType === 'url' ? 'https://...' : 'ID or slug'}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm text-gray-900">Active</label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                  {editingBanner ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannersManager;