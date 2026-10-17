import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Image, Calendar, X, BarChart3, MousePointer } from 'lucide-react';
import { bannersApi, Banner } from '../lib/api';

const BannersManager: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'action' | 'schedule' | 'display'>('basic');

  const [formData, setFormData] = useState({
    title: '', description: '', imageUrl: '', darkModeUrl: '', altText: '', mobileImageUrl: '',
    actionType: 'none', actionTarget: '', promoCode: '', animationType: 'slide',
    animationDuration: 500, autoPlayDelay: 5000, isScheduled: false, startDate: '', endDate: '',
    position: 'hero', sortOrder: 0, backgroundColor: '#000000',
    overlayEnabled: false, overlayTitle: '', overlaySubtitle: '', overlayButtonText: '', overlayTextColor: '#FFFFFF',
    isActive: true, campaignName: '', campaignSource: '', platforms: ['all'] as string[],
  });

  useEffect(() => { fetchBanners(); }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const response = await bannersApi.getAll();
      if (response.success) setBanners(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        image: { url: formData.imageUrl, darkModeUrl: formData.darkModeUrl || null, altText: formData.altText },
        mobileImage: formData.mobileImageUrl ? { url: formData.mobileImageUrl } : undefined,
        action: { type: formData.actionType, target: formData.actionTarget, promoCode: formData.promoCode },
        animation: { type: formData.animationType, duration: formData.animationDuration, autoPlayDelay: formData.autoPlayDelay },
        schedule: { isScheduled: formData.isScheduled, startDate: formData.startDate || null, endDate: formData.endDate || null },
        targeting: { platforms: formData.platforms },
        display: {
          sortOrder: formData.sortOrder, position: formData.position, backgroundColor: formData.backgroundColor,
          overlay: { enabled: formData.overlayEnabled, title: formData.overlayTitle, subtitle: formData.overlaySubtitle, buttonText: formData.overlayButtonText, textColor: formData.overlayTextColor },
        },
        isActive: formData.isActive,
        campaign: { name: formData.campaignName, source: formData.campaignSource },
      };

      if (editingBanner) {
        await bannersApi.update(editingBanner._id, payload);
      } else {
        await bannersApi.create(payload);
      }
      fetchBanners();
      closeModal();
    } catch (error) { console.error('Error:', error); alert('Error saving banner'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    await bannersApi.delete(id);
    fetchBanners();
  };

  const toggleStatus = async (banner: Banner) => {
    await bannersApi.toggleStatus(banner._id, !banner.isActive);
    fetchBanners();
  };

  const openModal = (banner?: Banner) => {
    setActiveTab('basic');
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title, description: banner.description || '', imageUrl: banner.image?.url || '',
        darkModeUrl: banner.image?.darkModeUrl || '', altText: banner.image?.altText || '',
        mobileImageUrl: banner.mobileImage?.url || '', actionType: banner.action?.type || 'none',
        actionTarget: banner.action?.target || '', promoCode: banner.action?.promoCode || '',
        animationType: banner.animation?.type || 'slide', animationDuration: banner.animation?.duration || 500,
        autoPlayDelay: banner.animation?.autoPlayDelay || 5000, isScheduled: banner.schedule?.isScheduled || false,
        startDate: banner.schedule?.startDate?.split('T')[0] || '', endDate: banner.schedule?.endDate?.split('T')[0] || '',
        position: banner.display?.position || 'hero', sortOrder: banner.display?.sortOrder || 0,
        backgroundColor: banner.display?.backgroundColor || '#000000',
        overlayEnabled: banner.display?.overlay?.enabled || false, overlayTitle: banner.display?.overlay?.title || '',
        overlaySubtitle: banner.display?.overlay?.subtitle || '', overlayButtonText: banner.display?.overlay?.buttonText || '',
        overlayTextColor: banner.display?.overlay?.textColor || '#FFFFFF', isActive: banner.isActive,
        campaignName: banner.campaign?.name || '', campaignSource: banner.campaign?.source || '',
        platforms: banner.targeting?.platforms || ['all'],
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: '', description: '', imageUrl: '', darkModeUrl: '', altText: '', mobileImageUrl: '',
        actionType: 'none', actionTarget: '', promoCode: '', animationType: 'slide',
        animationDuration: 500, autoPlayDelay: 5000, isScheduled: false, startDate: '', endDate: '',
        position: 'hero', sortOrder: banners.length, backgroundColor: '#000000',
        overlayEnabled: false, overlayTitle: '', overlaySubtitle: '', overlayButtonText: '', overlayTextColor: '#FFFFFF',
        isActive: true, campaignName: '', campaignSource: '', platforms: ['all'],
      });
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingBanner(null); };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banners Manager</h1>
        <p className="text-gray-600">Manage promotional banners</p>
      </div>

      <div className="flex justify-end mb-6">
        <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          <Plus className="w-5 h-5" /> Add Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {banners.map(banner => (
          <div key={banner._id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative h-48 bg-gray-200">
              {banner.image?.url ? (
                <img src={banner.image.url} alt={banner.title} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full"><Image className="w-16 h-16 text-gray-400" /></div>
              )}
              <div className="absolute top-2 left-2 flex flex-col gap-1">
                <span className={`px-2 py-0.5 text-xs rounded-full ${banner.isActive ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                  {banner.isActive ? 'Active' : 'Inactive'}
                </span>
                {banner.schedule?.isScheduled && (
                  <span className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Scheduled
                  </span>
                )}
              </div>
              <span className="absolute top-2 right-2 px-2 py-0.5 text-xs bg-black bg-opacity-50 text-white rounded">{banner.display?.position}</span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 truncate">{banner.title}</h3>
              {banner.description && <p className="text-sm text-gray-500 truncate mt-1">{banner.description}</p>}
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <div className="flex items-center gap-1"><Eye className="w-3 h-3" />{banner.analytics?.impressions || 0}</div>
                <div className="flex items-center gap-1"><MousePointer className="w-3 h-3" />{banner.analytics?.clicks || 0}</div>
                <div className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{(banner.analytics?.ctr || 0).toFixed(1)}%</div>
              </div>
              <div className="flex justify-between items-center mt-4 pt-4 border-t">
                <button onClick={() => toggleStatus(banner)} className={`p-2 rounded-lg ${banner.isActive ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-50'}`}>
                  {banner.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => openModal(banner)} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(banner._id)} className="text-red-600 p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {banners.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No banners found</p>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">{editingBanner ? 'Edit Banner' : 'Add Banner'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>

            <div className="flex border-b px-6">
              {(['basic', 'action', 'schedule', 'display'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Title *</label><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Image URL *</label><input type="url" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />{formData.imageUrl && <img src={formData.imageUrl} alt="Preview" className="mt-2 h-32 rounded-lg object-cover" />}</div>
                  <div className="flex items-center"><input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="h-4 w-4 text-indigo-600 rounded" /><label htmlFor="isActive" className="ml-2 text-sm">Active</label></div>
                </div>
              )}

              {activeTab === 'action' && (
                <div className="space-y-6">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
                    <select value={formData.actionType} onChange={(e) => setFormData({ ...formData, actionType: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                      <option value="none">None</option><option value="service">Service</option><option value="category">Category</option><option value="url">URL</option><option value="promo">Promo Code</option>
                    </select>
                  </div>
                  {formData.actionType !== 'none' && <div><label className="block text-sm font-medium text-gray-700 mb-1">Action Target</label><input type="text" value={formData.actionTarget} onChange={(e) => setFormData({ ...formData, actionTarget: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>}
                </div>
              )}

              {activeTab === 'schedule' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"><input type="checkbox" id="isScheduled" checked={formData.isScheduled} onChange={(e) => setFormData({ ...formData, isScheduled: e.target.checked })} className="h-5 w-5 text-indigo-600 rounded" /><label htmlFor="isScheduled" className="font-medium">Enable Scheduling</label></div>
                  {formData.isScheduled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label><input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
                      <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date</label><input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'display' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                      <select value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                        <option value="hero">Hero (Top)</option><option value="middle">Middle</option><option value="bottom">Bottom</option><option value="popup">Popup</option>
                      </select>
                    </div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label><input type="number" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" min="0" /></div>
                  </div>
                </div>
              )}
            </form>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-white border rounded-lg">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{saving ? 'Saving...' : (editingBanner ? 'Update' : 'Create')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BannersManager;
