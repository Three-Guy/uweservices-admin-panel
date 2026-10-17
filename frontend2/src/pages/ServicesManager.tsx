import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Eye, EyeOff, Filter, Star, Clock, X, DollarSign } from 'lucide-react';
import { servicesApi, categoriesApi, Service, Category } from '../lib/api';

const ServicesManager: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '', serviceId: '', categoryId: '', description: '', shortDescription: '',
    icon: '🔧', color: '#4F46E5', imageUrl: '', basePrice: 0, currency: 'INR',
    priceType: 'starting_from', durationMinutes: 60, durationText: '60 mins',
    isActive: true, isPopular: false, isFeatured: false, sortOrder: 0, tags: '',
  });

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchServices(); }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      if (response.success) setCategories(response.data || []);
    } catch (error) { console.error('Error:', error); }
  };

  const fetchServices = async () => {
    try {
      setLoading(true);
      const params = selectedCategory ? { categoryId: selectedCategory } : {};
      const response = await servicesApi.getAll(params);
      if (response.success) setServices(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        serviceId: formData.serviceId || formData.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
        category: formData.categoryId,
        description: formData.description,
        shortDescription: formData.shortDescription,
        icon: formData.icon,
        color: formData.color,
        image: formData.imageUrl ? { url: formData.imageUrl } : undefined,
        pricing: { basePrice: formData.basePrice, currency: formData.currency, priceType: formData.priceType },
        duration: { minutes: formData.durationMinutes, displayText: formData.durationText },
        isActive: formData.isActive,
        isPopular: formData.isPopular,
        isFeatured: formData.isFeatured,
        sortOrder: formData.sortOrder,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      if (editingService) {
        await servicesApi.update(editingService._id, payload);
      } else {
        await servicesApi.create(payload);
      }
      fetchServices();
      closeModal();
    } catch (error) { console.error('Error:', error); alert('Error saving service'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    try { await servicesApi.delete(id); fetchServices(); }
    catch (error) { console.error('Error:', error); }
  };

  const toggleStatus = async (service: Service, field: 'isActive' | 'isPopular' | 'isFeatured') => {
    try {
      await servicesApi.update(service._id, { [field]: !service[field] });
      fetchServices();
    } catch (error) { console.error('Error:', error); }
  };

  const openModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      const cat = typeof service.category === 'object' ? service.category._id : service.category;
      setFormData({
        name: service.name, serviceId: service.serviceId, categoryId: cat || '',
        description: service.description || '', shortDescription: service.shortDescription || '',
        icon: service.icon || '🔧', color: service.color || '#4F46E5',
        imageUrl: service.image?.url || '', basePrice: service.pricing?.basePrice || 0,
        currency: service.pricing?.currency || 'INR', priceType: service.pricing?.priceType || 'starting_from',
        durationMinutes: service.duration?.minutes || 60, durationText: service.duration?.displayText || '60 mins',
        isActive: service.isActive, isPopular: service.isPopular || false,
        isFeatured: service.isFeatured || false, sortOrder: service.sortOrder || 0,
        tags: service.tags?.join(', ') || '',
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '', serviceId: '', categoryId: selectedCategory || '', description: '', shortDescription: '',
        icon: '🔧', color: '#4F46E5', imageUrl: '', basePrice: 0, currency: 'INR',
        priceType: 'starting_from', durationMinutes: 60, durationText: '60 mins',
        isActive: true, isPopular: false, isFeatured: false, sortOrder: services.length, tags: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingService(null); };

  const getCurrencySymbol = (currency: string) => ({ USD: '$', INR: '₹', EUR: '€', GBP: '£' }[currency] || currency);

  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Services Manager</h1>
        <p className="text-gray-600">Manage services for each category</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Search services..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg bg-white min-w-[200px]">
              <option value="">All Categories</option>
              {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus className="w-5 h-5" /> Add Service
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredServices.map(service => (
              <tr key={service._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (service.color || '#4F46E5') + '20' }}>
                      {service.image?.url ? <img src={service.image.url} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="text-xl">{service.icon || '🔧'}</span>}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{service.name}</div>
                      <code className="text-xs text-gray-500">{service.serviceId}</code>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs bg-gray-100 rounded-full">
                    {typeof service.category === 'object' ? service.category.name : service.categoryName || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{getCurrencySymbol(service.pricing?.currency || 'INR')}{service.pricing?.basePrice || 0}</span>
                  </div>
                  <span className="text-xs text-gray-500">{service.pricing?.priceType?.replace('_', ' ')}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-3 h-3" />
                    {service.duration?.displayText || `${service.duration?.minutes || 60} mins`}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm">{service.rating?.average?.toFixed(1) || '0.0'}</span>
                    <span className="text-xs text-gray-500">({service.rating?.count || 0})</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => toggleStatus(service, 'isActive')} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${service.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {service.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {service.isActive ? 'Active' : 'Inactive'}
                    </button>
                    {service.isPopular && <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">Popular</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button onClick={() => openModal(service)} className="text-indigo-600 hover:text-indigo-900 p-1"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(service._id)} className="text-red-600 hover:text-red-900 p-1 ml-2"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredServices.length === 0 && <div className="text-center py-12"><p className="text-gray-500">No services found</p></div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingService ? 'Edit Service' : 'Add Service'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                    <option value="">Select Category</option>
                    {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <input type="text" value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-2xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price *</label>
                  <div className="flex gap-2">
                    <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="INR">₹ INR</option>
                      <option value="USD">$ USD</option>
                    </select>
                    <input type="number" value={formData.basePrice} onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" min="0" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
                  <select value={formData.priceType} onChange={(e) => setFormData({ ...formData, priceType: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="starting_from">Starting From</option>
                    <option value="fixed">Fixed</option>
                    <option value="hourly">Per Hour</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
                  <input type="number" value={formData.durationMinutes} onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration Text</label>
                  <input type="text" value={formData.durationText} onChange={(e) => setFormData({ ...formData, durationText: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g., 1-2 hours" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input type="url" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                  <input type="text" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="repair, maintenance" />
                </div>
                <div className="md:col-span-2 flex flex-wrap gap-6">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" /><span className="text-sm">Active</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.isPopular} onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" /><span className="text-sm">Popular</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" /><span className="text-sm">Featured</span></label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving...' : (editingService ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesManager;
