// src/pages/SDUI/NotificationSender.tsx
import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  Save,
  Clock,
  Users,
  Briefcase,
  Globe,
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle,
  Loader2,
  Image as ImageIcon,
  Link as LinkIcon,
  Tag,
  ChevronDown,
  X,
  Smartphone,
  Mail,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { apiClient } from '../../lib/api'; // ✅ Use shared apiClient (single source of truth)

// ==================== TYPES ====================
interface NotificationForm {
  title: string;
  body: string;
  type: 'push' | 'sms' | 'email' | 'in_app' | 'all';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  targetAudience: 'all' | 'all_users' | 'all_providers' | 'specific_users' | 'specific_providers' | 'by_city' | 'by_zone';
  targetIds: string[];
  targetCities: string[];
  targetZones: string[];
  scheduledAt: string;
  actionUrl: string;
  imageUrl: string;
  tags: string[];
}

interface City {
  _id: string;
  name: string;
  cityName?: string;
}

interface Zone {
  _id: string;
  name: string;
  zoneName?: string;
  cityId: string;
}

const initialForm: NotificationForm = {
  title: '',
  body: '',
  type: 'push',
  priority: 'normal',
  targetAudience: 'all',
  targetIds: [],
  targetCities: [],
  targetZones: [],
  scheduledAt: '',
  actionUrl: '',
  imageUrl: '',
  tags: [],
};

export default function NotificationSender() {
  const [form, setForm] = useState<NotificationForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showScheduler, setShowScheduler] = useState(false);

  // ==================== FETCH CITIES & ZONES ====================
  useEffect(() => {
    fetchCities();
    fetchZones();
  }, []);

  const fetchCities = async () => {
    try {
      const response = await apiClient.get('/admin/cities');
      const data = response.data;
      if (data.success) {
        setCities(data.data.cities || data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch cities:', err);
    }
  };

  const fetchZones = async () => {
    try {
      const response = await apiClient.get('/admin/zones');
      const data = response.data;
      if (data.success) {
        setZones(data.data.zones || data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch zones:', err);
    }
  };

  // ==================== FORM HANDLERS ====================
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleMultiSelectChange = (name: string, value: string) => {
    setForm(prev => {
      const currentValues = prev[name as keyof NotificationForm] as string[];
      if (currentValues.includes(value)) {
        return { ...prev, [name]: currentValues.filter(v => v !== value) };
      } else {
        return { ...prev, [name]: [...currentValues, value] };
      }
    });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  // ==================== SAVE DRAFT ====================
  const handleSaveDraft = async () => {
    if (!form.title || !form.body) {
      setError('Title and body are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/admin/notifications', form);
      const data = response.data;

      if (data.success) {
        setSuccess('Notification saved as draft!');
        setForm(initialForm);
      } else {
        setError(data.message || 'Failed to save notification');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save notification');
    } finally {
      setLoading(false);
    }
  };

  // ==================== SEND NOW ====================
  const handleSendNow = async () => {
    if (!form.title || !form.body) {
      setError('Title and body are required');
      return;
    }

    setSendingNow(true);
    setError(null);

    try {
      const response = await apiClient.post('/admin/notifications/send-now', form);
      const data = response.data;

      if (data.success) {
        setSuccess(`Notification sent successfully! Delivered to ${data.data.notification.stats?.delivered || 0} recipients.`);
        setForm(initialForm);
      } else {
        setError(data.message || 'Failed to send notification');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to send notification');
    } finally {
      setSendingNow(false);
    }
  };

  // ==================== SCHEDULE ====================
  const handleSchedule = async () => {
    if (!form.title || !form.body) {
      setError('Title and body are required');
      return;
    }

    if (!form.scheduledAt) {
      setError('Please select a scheduled time');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/admin/notifications', form);
      const data = response.data;

      if (data.success) {
        setSuccess(`Notification scheduled for ${new Date(form.scheduledAt).toLocaleString()}`);
        setForm(initialForm);
        setShowScheduler(false);
      } else {
        setError(data.message || 'Failed to schedule notification');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to schedule notification');
    } finally {
      setLoading(false);
    }
  };

  // ==================== HELPER ICONS ====================
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'push': return <Smartphone size={18} />;
      case 'sms': return <MessageSquare size={18} />;
      case 'email': return <Mail size={18} />;
      case 'in_app': return <Bell size={18} />;
      case 'all': return <Globe size={18} />;
      default: return <Bell size={18} />;
    }
  };

  const getAudienceIcon = (audience: string) => {
    switch (audience) {
      case 'all': return <Globe size={18} />;
      case 'all_users': return <Users size={18} />;
      case 'all_providers': return <Briefcase size={18} />;
      case 'by_city': return <Building2 size={18} />;
      case 'by_zone': return <MapPin size={18} />;
      default: return <Users size={18} />;
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
            <Bell size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Send Notification</h1>
            <p className="text-gray-500">Create and send notifications to users and providers</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
            <X size={18} />
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto p-1 hover:bg-green-100 rounded">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bell size={20} className="text-indigo-600" />
              Notification Content
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Enter notification title..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  maxLength={200}
                />
                <p className="mt-1 text-xs text-gray-500">{form.title.length}/200 characters</p>
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="body"
                  value={form.body}
                  onChange={handleChange}
                  placeholder="Enter notification message..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  maxLength={1000}
                />
                <p className="mt-1 text-xs text-gray-500">{form.body.length}/1000 characters</p>
              </div>

              {/* Type & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <div className="relative">
                    <select
                      name="type"
                      value={form.type}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                    >
                      <option value="push">Push Notification</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="in_app">In-App</option>
                      <option value="all">All Channels</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <div className="relative">
                    <select
                      name="priority"
                      value={form.priority}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Target Audience */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              Target Audience
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Audience</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { value: 'all', label: 'Everyone', icon: Globe },
                    { value: 'all_users', label: 'All Users', icon: Users },
                    { value: 'all_providers', label: 'All Providers', icon: Briefcase },
                    { value: 'by_city', label: 'By City', icon: Building2 },
                    { value: 'by_zone', label: 'By Zone', icon: MapPin },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, targetAudience: option.value as any }))}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        form.targetAudience === option.value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <option.icon size={18} />
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* City Selection */}
              {form.targetAudience === 'by_city' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Cities</label>
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl max-h-40 overflow-y-auto">
                    {cities.map(city => (
                      <button
                        key={city._id}
                        type="button"
                        onClick={() => handleMultiSelectChange('targetCities', city._id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          form.targetCities.includes(city._id)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {city.cityName || city.name}
                      </button>
                    ))}
                    {cities.length === 0 && (
                      <p className="text-gray-500 text-sm">No cities available</p>
                    )}
                  </div>
                </div>
              )}

              {/* Zone Selection */}
              {form.targetAudience === 'by_zone' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Zones</label>
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl max-h-40 overflow-y-auto">
                    {zones.map(zone => (
                      <button
                        key={zone._id}
                        type="button"
                        onClick={() => handleMultiSelectChange('targetZones', zone._id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          form.targetZones.includes(zone._id)
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {zone.zoneName || zone.name}
                      </button>
                    ))}
                    {zones.length === 0 && (
                      <p className="text-gray-500 text-sm">No zones available</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Additional Options */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap size={20} className="text-indigo-600" />
              Additional Options
            </h2>

            <div className="space-y-4">
              {/* Action URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <LinkIcon size={14} className="inline mr-1" />
                  Action URL (optional)
                </label>
                <input
                  type="url"
                  name="actionUrl"
                  value={form.actionUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/page"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ImageIcon size={14} className="inline mr-1" />
                  Image URL (optional)
                </label>
                <input
                  type="url"
                  name="imageUrl"
                  value={form.imageUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Tag size={14} className="inline mr-1" />
                  Tags (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add a tag..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {form.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="p-0.5 hover:bg-indigo-200 rounded-full"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Preview & Actions */}
        <div className="space-y-6">
          {/* Preview */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Smartphone size={20} className="text-indigo-600" />
              Preview
            </h2>

            {/* Mobile Preview */}
            <div className="bg-gray-900 rounded-3xl p-4 mx-auto" style={{ maxWidth: '280px' }}>
              <div className="bg-gray-800 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-600 rounded-lg shrink-0">
                    {getTypeIcon(form.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      {form.title || 'Notification Title'}
                    </p>
                    <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                      {form.body || 'Notification message will appear here...'}
                    </p>
                    <p className="text-gray-500 text-xs mt-2">Just now</p>
                  </div>
                </div>
                {form.imageUrl && (
                  <div className="mt-3 rounded-lg overflow-hidden">
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      className="w-full h-24 object-cover"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span>Type:</span>
                <span className="font-medium flex items-center gap-1">
                  {getTypeIcon(form.type)}
                  {form.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Priority:</span>
                <span className={`font-medium px-2 py-0.5 rounded ${
                  form.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                  form.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  form.priority === 'normal' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {form.priority}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Audience:</span>
                <span className="font-medium flex items-center gap-1">
                  {getAudienceIcon(form.targetAudience)}
                  {form.targetAudience.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>

            <div className="space-y-3">
              {/* Send Now Button */}
              <button
                onClick={handleSendNow}
                disabled={sendingNow || !form.title || !form.body}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {sendingNow ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Send Now
                  </>
                )}
              </button>

              {/* Schedule Button */}
              <button
                onClick={() => setShowScheduler(!showScheduler)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-100 text-amber-700 rounded-xl font-semibold hover:bg-amber-200 transition-all"
              >
                <Clock size={20} />
                Schedule
              </button>

              {showScheduler && (
                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                  <input
                    type="datetime-local"
                    name="scheduledAt"
                    value={form.scheduledAt}
                    onChange={handleChange}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={handleSchedule}
                    disabled={loading || !form.scheduledAt}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50 transition-all"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Clock size={18} />}
                    Confirm Schedule
                  </button>
                </div>
              )}

              {/* Save Draft Button */}
              <button
                onClick={handleSaveDraft}
                disabled={loading || !form.title || !form.body}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Save as Draft
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
            <h3 className="font-semibold mb-3">Estimated Reach</h3>
            <div className="text-4xl font-bold mb-2">
              {form.targetAudience === 'all' ? '~1,000+' :
               form.targetAudience === 'all_users' ? '~800+' :
               form.targetAudience === 'all_providers' ? '~200+' :
               form.targetAudience === 'by_city' ? `~${form.targetCities.length * 100}` :
               form.targetAudience === 'by_zone' ? `~${form.targetZones.length * 50}` :
               '~0'}
            </div>
            <p className="text-indigo-200 text-sm">
              {form.targetAudience.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}