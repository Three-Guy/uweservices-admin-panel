import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Eye, EyeOff, Filter } from 'lucide-react';

interface Subservice {
  _id: string;
  name: string;
  slug: string;
  serviceId: { _id: string; name: string };
  description: string;
  price: number;
  duration: number;
  unit: string;
  isActive: boolean;
}

interface Service {
  _id: string;
  name: string;
}

const SubservicesManager: React.FC = () => {
  const [subservices, setSubservices] = useState<Subservice[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSubservice, setEditingSubservice] = useState<Subservice | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    serviceId: '',
    description: '',
    price: 0,
    duration: 60,
    unit: 'per_service',
    isActive: true,
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchServices();
    fetchSubservices();
  }, [selectedService]);

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/sdui/services`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setServices(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchSubservices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let url = `${API_URL}/admin/sdui/subservices`;
      if (selectedService) {
        url += `?serviceId=${selectedService}`;
      }
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSubservices(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching subservices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingSubservice 
        ? `${API_URL}/admin/sdui/subservices/${editingSubservice._id}`
        : `${API_URL}/admin/sdui/subservices`;
      
      const response = await fetch(url, {
        method: editingSubservice ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        fetchSubservices();
        closeModal();
      } else {
        alert(data.message || 'Error saving subservice');
      }
    } catch (error) {
      console.error('Error saving subservice:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subservice?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/admin/sdui/subservices/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchSubservices();
    } catch (error) {
      console.error('Error deleting subservice:', error);
    }
  };

  const toggleStatus = async (subservice: Subservice) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/admin/sdui/subservices/${subservice._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !subservice.isActive }),
      });
      fetchSubservices();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const openModal = (subservice?: Subservice) => {
    if (subservice) {
      setEditingSubservice(subservice);
      setFormData({
        name: subservice.name,
        slug: subservice.slug,
        serviceId: subservice.serviceId?._id || '',
        description: subservice.description,
        price: subservice.price,
        duration: subservice.duration,
        unit: subservice.unit,
        isActive: subservice.isActive,
      });
    } else {
      setEditingSubservice(null);
      setFormData({
        name: '',
        slug: '',
        serviceId: selectedService || '',
        description: '',
        price: 0,
        duration: 60,
        unit: 'per_service',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSubservice(null);
  };

  const filteredSubservices = subservices.filter(sub =>
    sub.name.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h1 className="text-2xl font-bold text-gray-900">Subservices Manager</h1>
        <p className="text-gray-600">Manage individual service items with pricing</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search subservices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
            >
              <option value="">All Services</option>
              {services.map(service => (
                <option key={service._id} value={service._id}>{service.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          Add Subservice
        </button>
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
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSubservices.map(subservice => (
              <tr key={subservice._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{subservice.name}</div>
                  <div className="text-sm text-gray-500">{subservice.slug}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {subservice.serviceId?.name || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900">₹{subservice.price}</span>
                  <span className="text-xs text-gray-500 ml-1">/{subservice.unit}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {subservice.duration} mins
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => toggleStatus(subservice)}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                      subservice.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {subservice.isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {subservice.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button onClick={() => openModal(subservice)} className="text-indigo-600 hover:text-indigo-900 p-1">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(subservice._id)} className="text-red-600 hover:text-red-900 p-1 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSubservices.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No subservices found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {editingSubservice ? 'Edit Subservice' : 'Add Subservice'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
                  <select
                    value={formData.serviceId}
                    onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select Service</option>
                    {services.map(service => (
                      <option key={service._id} value={service._id}>{service.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="per_service">Per Service</option>
                    <option value="per_hour">Per Hour</option>
                    <option value="per_sqft">Per Sq.Ft</option>
                    <option value="per_unit">Per Unit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
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
                  {editingSubservice ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubservicesManager;