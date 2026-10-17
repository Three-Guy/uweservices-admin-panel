import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, ToggleLeft, ToggleRight, History, X, Users, Smartphone, Zap } from 'lucide-react';
import { featureFlagsApi, FeatureFlag } from '../lib/api';

const CATEGORIES = [
  { value: 'ui', label: 'UI Features', icon: '🎨' },
  { value: 'feature', label: 'App Features', icon: '⚡' },
  { value: 'experiment', label: 'Experiments', icon: '🧪' },
  { value: 'promotion', label: 'Promotions', icon: '🎉' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'other', label: 'Other', icon: '📦' },
];

const ENVIRONMENTS = [
  { value: 'all', label: 'All Environments' },
  { value: 'development', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

const USER_SEGMENTS = [
  { value: 'all', label: 'All Users' },
  { value: 'new_users', label: 'New Users' },
  { value: 'returning_users', label: 'Returning Users' },
  { value: 'premium_users', label: 'Premium Users' },
];

const FeatureFlagsManager: React.FC = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterEnvironment, setFilterEnvironment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'targeting' | 'schedule'>('basic');

  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    enabled: false,
    type: 'boolean' as 'boolean' | 'percentage' | 'user_list' | 'date_range',
    percentage: 0,
    jsonValue: '',
    isScheduled: false,
    startDate: '',
    endDate: '',
    platforms: ['all'] as string[],
    minAppVersion: '',
    maxAppVersion: '',
    userSegments: ['all'] as string[],
    environment: 'all',
    category: 'feature',
    tags: '',
    dependencies: '',
  });

  useEffect(() => { fetchFlags(); }, []);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await featureFlagsApi.getAll();
      if (response.success) setFlags(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        key: formData.key.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        name: formData.name,
        description: formData.description,
        enabled: formData.enabled,
        type: formData.type,
        value: {
          percentage: formData.type === 'percentage' ? formData.percentage : 0,
          jsonValue: formData.jsonValue ? JSON.parse(formData.jsonValue) : null,
        },
        schedule: {
          isScheduled: formData.isScheduled,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
        },
        targeting: {
          platforms: formData.platforms,
          minAppVersion: formData.minAppVersion,
          maxAppVersion: formData.maxAppVersion,
          userSegments: formData.userSegments,
        },
        environment: formData.environment,
        category: formData.category,
        tags: formData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
        dependencies: formData.dependencies.split(',').map(d => d.trim()).filter(Boolean),
      };

      if (editingFlag) {
        await featureFlagsApi.update(editingFlag._id, payload);
      } else {
        await featureFlagsApi.create(payload);
      }
      fetchFlags();
      closeModal();
    } catch (error: any) {
      console.error('Error:', error);
      if (error instanceof SyntaxError) {
        alert('Invalid JSON in value field');
      } else {
        alert('Error saving feature flag');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this feature flag?')) return;
    try {
      await featureFlagsApi.delete(id);
      fetchFlags();
    } catch (error) { console.error('Error:', error); }
  };

  const toggleFlag = async (flag: FeatureFlag) => {
    try {
      await featureFlagsApi.toggle(flag._id, !flag.enabled);
      fetchFlags();
    } catch (error) { console.error('Error:', error); }
  };

  const openModal = (flag?: FeatureFlag) => {
    setActiveTab('basic');
    if (flag) {
      setEditingFlag(flag);
      setFormData({
        key: flag.key,
        name: flag.name,
        description: flag.description || '',
        enabled: flag.enabled,
        type: flag.type,
        percentage: flag.value?.percentage || 0,
        jsonValue: flag.value?.jsonValue ? JSON.stringify(flag.value.jsonValue, null, 2) : '',
        isScheduled: flag.schedule?.isScheduled || false,
        startDate: flag.schedule?.startDate?.split('T')[0] || '',
        endDate: flag.schedule?.endDate?.split('T')[0] || '',
        platforms: flag.targeting?.platforms || ['all'],
        minAppVersion: flag.targeting?.minAppVersion || '',
        maxAppVersion: flag.targeting?.maxAppVersion || '',
        userSegments: flag.targeting?.userSegments || ['all'],
        environment: flag.environment || 'all',
        category: flag.category || 'feature',
        tags: flag.tags?.join(', ') || '',
        dependencies: flag.dependencies?.join(', ') || '',
      });
    } else {
      setEditingFlag(null);
      setFormData({
        key: '', name: '', description: '', enabled: false, type: 'boolean',
        percentage: 0, jsonValue: '', isScheduled: false, startDate: '', endDate: '',
        platforms: ['all'], minAppVersion: '', maxAppVersion: '', userSegments: ['all'],
        environment: 'all', category: 'feature', tags: '', dependencies: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingFlag(null); };

  const getCategoryInfo = (category: string) => CATEGORIES.find(c => c.value === category) || CATEGORIES[5];

  const filteredFlags = flags.filter(flag => {
    const matchesSearch = flag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || flag.category === filterCategory;
    const matchesEnvironment = !filterEnvironment || flag.environment === filterEnvironment || flag.environment === 'all';
    return matchesSearch && matchesCategory && matchesEnvironment;
  });

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
        <p className="text-gray-600">Control feature rollouts and experiments</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{flags.length}</div>
          <div className="text-sm text-gray-500">Total Flags</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-green-600">{flags.filter(f => f.enabled).length}</div>
          <div className="text-sm text-gray-500">Enabled</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-orange-600">{flags.filter(f => f.schedule?.isScheduled).length}</div>
          <div className="text-sm text-gray-500">Scheduled</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-2xl font-bold text-purple-600">{flags.filter(f => f.type === 'percentage').length}</div>
          <div className="text-sm text-gray-500">Rollouts</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search flags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
            ))}
          </select>
          <select
            value={filterEnvironment}
            onChange={(e) => setFilterEnvironment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
          >
            {ENVIRONMENTS.map(env => (
              <option key={env.value} value={env.value}>{env.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-5 h-5" />
          Add Flag
        </button>
      </div>

      {/* Flags Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flag</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Targeting</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredFlags.map(flag => {
              const categoryInfo = getCategoryInfo(flag.category);
              return (
                <React.Fragment key={flag._id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{categoryInfo.icon}</span>
                        <div>
                          <div className="font-medium text-gray-900">{flag.name}</div>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{flag.key}</code>
                          {flag.description && (
                            <p className="text-xs text-gray-500 mt-1 max-w-md truncate">{flag.description}</p>
                          )}
                          {flag.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {flag.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">{tag}</span>
                              ))}
                              {flag.tags.length > 3 && (
                                <span className="text-xs text-gray-500">+{flag.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${
                        flag.type === 'boolean' ? 'bg-blue-100 text-blue-800' :
                        flag.type === 'percentage' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {flag.type === 'boolean' ? 'Boolean' :
                         flag.type === 'percentage' ? `${flag.value?.percentage || 0}% Rollout` :
                         flag.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {flag.targeting?.platforms?.length > 0 && !flag.targeting.platforms.includes('all') && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Smartphone className="w-3 h-3" />
                            {flag.targeting.platforms.join(', ')}
                          </span>
                        )}
                        {flag.targeting?.userSegments?.length > 0 && !flag.targeting.userSegments.includes('all') && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Users className="w-3 h-3" />
                            {flag.targeting.userSegments.length} segments
                          </span>
                        )}
                        {(!flag.targeting?.platforms?.length || flag.targeting.platforms.includes('all')) && (
                          <span className="text-xs text-gray-400">All users</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        flag.environment === 'production' ? 'bg-red-100 text-red-800' :
                        flag.environment === 'staging' ? 'bg-yellow-100 text-yellow-800' :
                        flag.environment === 'development' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {flag.environment}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleFlag(flag)}
                        className={`inline-flex items-center gap-2 transition-colors ${
                          flag.enabled ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {flag.enabled ? (
                          <ToggleRight className="w-8 h-8" />
                        ) : (
                          <ToggleLeft className="w-8 h-8" />
                        )}
                        <span className="text-sm font-medium">
                          {flag.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setShowHistory(showHistory === flag._id ? null : flag._id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="View history"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openModal(flag)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(flag._id)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* History Row */}
                  {showHistory === flag._id && flag.history?.length > 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                        <div className="max-h-40 overflow-y-auto">
                          <h4 className="text-sm font-medium text-gray-900 mb-2">Change History</h4>
                          <div className="space-y-2">
                            {flag.history.slice(0, 10).map((entry, i) => (
                              <div key={i} className="flex items-center gap-3 text-sm">
                                <span className={`w-2 h-2 rounded-full ${
                                  entry.action === 'enabled' ? 'bg-green-500' :
                                  entry.action === 'disabled' ? 'bg-red-500' :
                                  'bg-blue-500'
                                }`}></span>
                                <span className="text-gray-900">{entry.action}</span>
                                <span className="text-gray-400">
                                  {new Date(entry.performedAt).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {filteredFlags.length === 0 && (
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No feature flags found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">{editingFlag ? 'Edit Feature Flag' : 'Create Feature Flag'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b px-6">
              {(['basic', 'targeting', 'schedule'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
              {/* Basic Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Key *</label>
                      <input
                        type="text"
                        value={formData.key}
                        onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                        placeholder="feature_new_checkout"
                        required
                        disabled={!!editingFlag}
                      />
                      <p className="text-xs text-gray-500 mt-1">Lowercase, underscores only</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="New Checkout Flow"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="boolean">Boolean (On/Off)</option>
                        <option value="percentage">Percentage Rollout</option>
                        <option value="user_list">User List</option>
                        <option value="date_range">Date Range</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {formData.type === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rollout Percentage: {formData.percentage}%
                      </label>
                      <input
                        type="range"
                        value={formData.percentage}
                        onChange={(e) => setFormData({ ...formData, percentage: parseInt(e.target.value) })}
                        className="w-full"
                        min="0" max="100" step="1"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Environment</label>
                    <select
                      value={formData.environment}
                      onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      {ENVIRONMENTS.map(env => (
                        <option key={env.value} value={env.value}>{env.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="checkout, payment, experiment"
                    />
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="h-5 w-5 text-indigo-600 rounded"
                    />
                    <label htmlFor="enabled" className="font-medium">
                      Enable this flag
                      <p className="text-sm text-gray-500 font-normal">Flag will be active immediately</p>
                    </label>
                  </div>
                </div>
              )}

              {/* Targeting Tab */}
              {activeTab === 'targeting' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
                    <div className="flex flex-wrap gap-2">
                      {['all', 'ios', 'android', 'web'].map(platform => (
                        <label
                          key={platform}
                          className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                            formData.platforms.includes(platform)
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.platforms.includes(platform)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (platform === 'all') {
                                  setFormData({ ...formData, platforms: ['all'] });
                                } else {
                                  setFormData({ ...formData, platforms: [...formData.platforms.filter(p => p !== 'all'), platform] });
                                }
                              } else {
                                setFormData({ ...formData, platforms: formData.platforms.filter(p => p !== platform) });
                              }
                            }}
                            className="sr-only"
                          />
                          <Smartphone className="w-4 h-4" />
                          <span className="text-sm capitalize">{platform}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">User Segments</label>
                    <div className="flex flex-wrap gap-2">
                      {USER_SEGMENTS.map(segment => (
                        <label
                          key={segment.value}
                          className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                            formData.userSegments.includes(segment.value)
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.userSegments.includes(segment.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (segment.value === 'all') {
                                  setFormData({ ...formData, userSegments: ['all'] });
                                } else {
                                  setFormData({ ...formData, userSegments: [...formData.userSegments.filter(s => s !== 'all'), segment.value] });
                                }
                              } else {
                                setFormData({ ...formData, userSegments: formData.userSegments.filter(s => s !== segment.value) });
                              }
                            }}
                            className="sr-only"
                          />
                          <Users className="w-4 h-4" />
                          <span className="text-sm">{segment.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min App Version</label>
                      <input
                        type="text"
                        value={formData.minAppVersion}
                        onChange={(e) => setFormData({ ...formData, minAppVersion: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="1.0.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max App Version</label>
                      <input
                        type="text"
                        value={formData.maxAppVersion}
                        onChange={(e) => setFormData({ ...formData, maxAppVersion: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="2.0.0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Schedule Tab */}
              {activeTab === 'schedule' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="isScheduled"
                      checked={formData.isScheduled}
                      onChange={(e) => setFormData({ ...formData, isScheduled: e.target.checked })}
                      className="h-5 w-5 text-indigo-600 rounded"
                    />
                    <label htmlFor="isScheduled" className="font-medium">
                      Enable Scheduling
                      <p className="text-sm text-gray-500 font-normal">Flag will only be active during the scheduled period</p>
                    </label>
                  </div>

                  {formData.isScheduled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                          type="datetime-local"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                          type="datetime-local"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dependencies (flag keys, comma separated)</label>
                    <input
                      type="text"
                      value={formData.dependencies}
                      onChange={(e) => setFormData({ ...formData, dependencies: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                      placeholder="feature_base, feature_parent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Other flags that must be enabled for this flag to work</p>
                  </div>
                </div>
              )}
            </form>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : (editingFlag ? 'Update Flag' : 'Create Flag')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureFlagsManager;
