import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Eye, EyeOff, GripVertical, Star, X } from 'lucide-react';
import { categoriesApi, citiesApi, Category, City } from '../lib/api';

const CategoriesManager: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    description: '',
    icon: '📦',
    color: '#FF8C42',
    colorClass: 'bg-orange-100',
    sortOrder: 0,
    isActive: true,
    isFeatured: false,
    availableCities: [] as string[],
    imageUrl: '',
  });

  useEffect(() => {
    fetchCategories();
    fetchCities();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await categoriesApi.getAll();
      if (response.success) {
        setCategories(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCities = async () => {
    try {
      const response = await citiesApi.getActive();
      if (response.success) {
        setCities(response.data?.cities || []);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        categoryId: formData.categoryId || generateSlug(formData.name),
        description: formData.description,
        icon: formData.icon,
        color: formData.color,
        colorClass: formData.colorClass,
        sortOrder: formData.sortOrder,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
        availableCities: formData.availableCities,
        image: formData.imageUrl ? { url: formData.imageUrl } : undefined,
      };

      if (editingCategory) {
        await categoriesApi.update(editingCategory._id, payload);
      } else {
        await categoriesApi.create(payload);
      }
      
      fetchCategories();
      closeModal();
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Error saving category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await categoriesApi.delete(id);
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const toggleStatus = async (category: Category, field: 'isActive' | 'isFeatured') => {
    try {
      if (field === 'isActive') {
        await categoriesApi.toggleStatus(category._id, !category.isActive);
      } else {
        await categoriesApi.toggleFeatured(category._id, !category.isFeatured);
      }
      fetchCategories();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const openModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        categoryId: category.categoryId,
        description: category.description || '',
        icon: category.icon || '📦',
        color: category.color || '#FF8C42',
        colorClass: category.colorClass || 'bg-orange-100',
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive,
        isFeatured: category.isFeatured || false,
        availableCities: category.availableCities || [],
        imageUrl: category.image?.url || '',
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '', categoryId: '', description: '', icon: '📦',
        color: '#FF8C42', colorClass: 'bg-orange-100', sortOrder: categories.length,
        isActive: true, isFeatured: false, availableCities: [], imageUrl: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim();
  };

  const colorOptions = [
    { value: '#FF8C42', class: 'bg-orange-100' },
    { value: '#4F46E5', class: 'bg-indigo-100' },
    { value: '#10B981', class: 'bg-green-100' },
    { value: '#EF4444', class: 'bg-red-100' },
    { value: '#8B5CF6', class: 'bg-purple-100' },
    { value: '#F59E0B', class: 'bg-yellow-100' },
    { value: '#06B6D4', class: 'bg-cyan-100' },
    { value: '#EC4899', class: 'bg-pink-100' },
  ];

  const emojiOptions = ['📦', '🏠', '🔧', '💇', '🧹', '🔌', '🚗', '💻', '📱', '🎨', '🛠️', '🏥', '📸', '🎓', '🍳', '👔'];

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.categoryId?.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h1 className="text-2xl font-bold text-gray-900">Categories Manager</h1>
        <p className="text-gray-600">Manage service categories for the mobile app</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search categories..."
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
          Add Category
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Services</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Featured</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCategories.map((category) => (
              <tr key={category._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                    <span className="text-sm text-gray-500">{category.sortOrder}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div 
                      className="flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: (category.color || '#FF8C42') + '20' }}
                    >
                      {category.image?.url ? (
                        <img src={category.image.url} alt="" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <span className="text-xl">{category.icon}</span>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{category.name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">{category.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{category.categoryId}</code>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                    {category.servicesCount || 0} services
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleStatus(category, 'isActive')}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                      category.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {category.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {category.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleStatus(category, 'isFeatured')}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                      category.isFeatured ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${category.isFeatured ? 'fill-current' : ''}`} />
                    {category.isFeatured ? 'Featured' : 'Normal'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button onClick={() => openModal(category)} className="text-indigo-600 hover:text-indigo-900 p-1">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(category._id)} className="text-red-600 hover:text-red-900 p-1 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCategories.length === 0 && (
          <div className="text-center py-12"><p className="text-gray-500">No categories found</p></div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, categoryId: editingCategory ? formData.categoryId : generateSlug(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category ID *</label>
                  <input
                    type="text"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                    required
                    disabled={!!editingCategory}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-lg">
                    {emojiOptions.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: emoji })}
                        className={`text-2xl p-1 rounded hover:bg-gray-100 ${formData.icon === emoji ? 'bg-indigo-100 ring-2 ring-indigo-500' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: color.value, colorClass: color.class })}
                        className={`w-8 h-8 rounded-full border-2 ${formData.color === color.value ? 'ring-2 ring-offset-2 ring-indigo-500' : 'border-transparent'}`}
                        style={{ backgroundColor: color.value }}
                      />
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                </div>

                <div className="md:col-span-2 flex gap-6">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" />
                    <span className="text-sm">Featured</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Saving...' : (editingCategory ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesManager;
