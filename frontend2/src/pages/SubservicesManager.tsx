import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Eye, EyeOff, Filter, Star, Clock, X } from 'lucide-react';
import { subservicesApi, servicesApi, Subservice, Service } from '../lib/api';

const SubservicesManager: React.FC = () => {
  const [subservices, setSubservices] = useState<Subservice[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Subservice | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '', subserviceId: '', serviceId: '', description: '', icon: '🔧',
    price: 0, originalPrice: '', currency: 'INR', priceType: 'starting_from', unit: '',
    durationMinutes: 60, durationText: '60 mins', isActive: true, isPopular: false,
    sortOrder: 0, includes: '', excludes: '',
  });

  useEffect(() => { fetchServices(); }, []);
  useEffect(() => { fetchSubservices(); }, [selectedService]);

  const fetchServices = async () => {
    try {
      const response = await servicesApi.getAll();
      if (response.success) setServices(response.data || []);
    } catch (error) { console.error('Error:', error); }
  };

  const fetchSubservices = async () => {
    try {
      setLoading(true);
      const params = selectedService ? { serviceId: selectedService } : {};
      const response = await subservicesApi.getAll(params);
      if (response.success) setSubservices(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const selectedServiceObj = services.find(s => s._id === formData.serviceId);
      const payload = {
        name: formData.name,
        subserviceId: formData.subserviceId || `${selectedServiceObj?.serviceId || 'service'}-${formData.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`,
        service: formData.serviceId,
        serviceId: selectedServiceObj?.serviceId,
        description: formData.description,
        icon: formData.icon,
        pricing: {
          price: formData.price,
          originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
          currency: formData.currency,
          priceType: formData.priceType,
          unit: formData.unit,
        },
        duration: { minutes: formData.durationMinutes, displayText: formData.durationText },
        isActive: formData.isActive,
        isPopular: formData.isPopular,
        sortOrder: formData.sortOrder,
        includes: formData.includes.split('\n').map(s => s.trim()).filter(Boolean),
        excludes: formData.excludes.split('\n').map(s => s.trim()).filter(Boolean),
      };

      if (editingItem) {
        await subservicesApi.update(editingItem._id, payload);
      } else {
        await subservicesApi.create(payload);
      }
      fetchSubservices();
      closeModal();
    } catch (error) { console.error('Error:', error); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete?')) return;
    await subservicesApi.delete(id);
    fetchSubservices();
  };

  const toggleStatus = async (item: Subservice, field: 'isActive' | 'isPopular') => {
    await subservicesApi.update(item._id, { [field]: !item[field] });
    fetchSubservices();
  };

  const openModal = (item?: Subservice) => {
    if (item) {
      setEditingItem(item);
      const serviceRef = typeof item.service === 'object' ? item.service._id : item.service;
      setFormData({
        name: item.name, subserviceId: item.subserviceId, serviceId: serviceRef || '',
        description: item.description || '', icon: item.icon || '🔧',
        price: item.pricing?.price || 0, originalPrice: item.pricing?.originalPrice?.toString() || '',
        currency: item.pricing?.currency || 'INR', priceType: item.pricing?.priceType || 'starting_from',
        unit: item.pricing?.unit || '', durationMinutes: item.duration?.minutes || 60,
        durationText: item.duration?.displayText || '60 mins', isActive: item.isActive,
        isPopular: item.isPopular || false, sortOrder: item.sortOrder || 0,
        includes: item.includes?.join('\n') || '', excludes: item.excludes?.join('\n') || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '', subserviceId: '', serviceId: selectedService, description: '', icon: '🔧',
        price: 0, originalPrice: '', currency: 'INR', priceType: 'starting_from', unit: '',
        durationMinutes: 60, durationText: '60 mins', isActive: true, isPopular: false,
        sortOrder: subservices.length, includes: '', excludes: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingItem(null); };
  const getCurrencySymbol = (currency: string) => ({ USD: '$', INR: '₹', EUR: '€' }[currency] || currency);
  const filteredItems = subservices.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subservices Manager</h1>
        <p className="text-gray-600">Manage individual service items with pricing</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
          </div>
          <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg bg-white min-w-[200px]">
            <option value="">All Services</option>
            {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg"><Plus className="w-5 h-5" /> Add Subservice</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subservice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredItems.map(item => (
              <tr key={item._id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <span className="text-xl mr-3">{item.icon || '🔧'}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <code className="text-xs text-gray-500">{item.subserviceId}</code>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{typeof item.service === 'object' ? item.service.name : 'N/A'}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{getCurrencySymbol(item.pricing?.currency || 'INR')}{item.pricing?.price}</span>
                    {item.pricing?.originalPrice && <span className="text-xs text-gray-500 line-through">{getCurrencySymbol(item.pricing?.currency || 'INR')}{item.pricing.originalPrice}</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-sm text-gray-500"><Clock className="w-3 h-3" />{item.duration?.displayText || `${item.duration?.minutes} mins`}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => toggleStatus(item, 'isActive')} className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {item.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {item.isActive ? 'Active' : 'Inactive'}
                    </button>
                    {item.isPopular && <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded-full">Popular</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => openModal(item)} className="text-indigo-600 p-1"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(item._id)} className="text-red-600 p-1 ml-2"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredItems.length === 0 && <div className="text-center py-12 text-gray-500">No subservices found</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingItem ? 'Edit Subservice' : 'Add Subservice'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
                  <select value={formData.serviceId} onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required>
                    <option value="">Select Service</option>
                    {services.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <input type="text" value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-center text-2xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input type="number" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Original Price</label>
                  <input type="number" value={formData.originalPrice} onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="For discount" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
                  <input type="number" value={formData.durationMinutes} onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price Type</label>
                  <select value={formData.priceType} onChange={(e) => setFormData({ ...formData, priceType: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="fixed">Fixed</option>
                    <option value="starting_from">Starting From</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Includes (one per line)</label>
                  <textarea value={formData.includes} onChange={(e) => setFormData({ ...formData, includes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Excludes (one per line)</label>
                  <textarea value={formData.excludes} onChange={(e) => setFormData({ ...formData, excludes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={3} />
                </div>
                <div className="md:col-span-2 flex gap-6">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" /><span className="text-sm">Active</span></label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={formData.isPopular} onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" /><span className="text-sm">Popular</span></label>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
                <button type="button" onClick={closeModal} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving...' : (editingItem ? 'Update' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubservicesManager;
