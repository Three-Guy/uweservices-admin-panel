// src/pages/SDUI/SDUIDashboard.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layout, 
  Image as ImageIcon, 
  Grid, 
  TrendingUp, 
  Settings,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Clock,
  Smartphone,
  RefreshCw,
  Loader2,
  Star,
  Eye,
  Zap,
  Globe,
  Users,
  BarChart3,
  Sparkles,
  Layers
} from 'lucide-react';
import { 
  sduiBannerApi, 
  sduiCategoryApi, 
  sduiTrendingApi, 
  sduiLayoutApi,
  BannerStats,
  CategoryStats,
  SDUILayout
} from '../../lib/sduiApi';

interface DashboardStats {
  banners: BannerStats | null;
  categories: CategoryStats | null;
  trendingCount: number;
  layout: SDUILayout | null;
}

const SDUIDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    banners: null,
    categories: null,
    trendingCount: 0,
    layout: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const [bannersResponse, categoriesResponse, trendingResponse, layoutResponse] = await Promise.all([
        sduiBannerApi.getStats().catch(() => ({ success: false, data: null })),
        sduiCategoryApi.getStats().catch(() => ({ success: false, data: null })),
        sduiTrendingApi.getAll().catch(() => ({ success: false, data: [] })),
        sduiLayoutApi.getByPage('home').catch(() => ({ success: false, data: null })),
      ]);

      setStats({
        banners: bannersResponse.success ? bannersResponse.data : null,
        categories: categoriesResponse.success ? categoriesResponse.data : null,
        trendingCount: trendingResponse.success && Array.isArray(trendingResponse.data) ? trendingResponse.data.length : 0,
        layout: layoutResponse.success ? layoutResponse.data : null,
      });
    } catch (err: any) {
      console.error('Error fetching SDUI stats:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const quickActions = [
    {
      title: 'Banner Management',
      description: 'Create and manage promotional banners',
      icon: ImageIcon,
      path: '/sdui/banners',
      gradient: 'from-blue-500 to-indigo-600',
      bgGradient: 'from-blue-50 to-indigo-50',
      stats: stats.banners ? `${stats.banners.activeBanners} active` : '...',
    },
    {
      title: 'Category Management',
      description: 'Organize service categories',
      icon: Grid,
      path: '/sdui/categories',
      gradient: 'from-purple-500 to-pink-600',
      bgGradient: 'from-purple-50 to-pink-50',
      stats: stats.categories ? `${stats.categories.activeCategories} active` : '...',
    },
    {
      title: 'Trending Services',
      description: 'Showcase popular services',
      icon: TrendingUp,
      path: '/sdui/trending',
      gradient: 'from-orange-500 to-red-600',
      bgGradient: 'from-orange-50 to-red-50',
      stats: `${stats.trendingCount} items`,
    },
    {
      title: 'Layout Editor',
      description: 'Customize home page layout',
      icon: Layout,
      path: '/sdui/layout-editor',
      gradient: 'from-indigo-500 to-purple-600',
      bgGradient: 'from-indigo-50 to-purple-50',
      stats: stats.layout ? `v${stats.layout.version}` : '...',
    },
  ];

  const features = [
    {
      icon: Zap,
      title: 'Instant Updates',
      description: 'Changes go live in seconds without app store approval',
      gradient: 'from-yellow-400 to-orange-500',
    },
    {
      icon: Globe,
      title: 'Remote Control',
      description: 'Manage app content from anywhere',
      gradient: 'from-blue-400 to-cyan-500',
    },
    {
      icon: Users,
      title: 'User Targeting',
      description: 'Show different content to different user segments',
      gradient: 'from-purple-400 to-pink-500',
    },
    {
      icon: BarChart3,
      title: 'A/B Testing Ready',
      description: 'Test different layouts and content variations',
      gradient: 'from-green-400 to-emerald-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-16 h-16 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600"></div>
        <p className="mt-4 text-gray-500 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/25">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Server-Driven UI
                </h1>
                <p className="text-gray-500 mt-1">
                  Control your mobile app's UI without code changes
                </p>
              </div>
            </div>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-5 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-white/80 rounded-xl transition-all flex items-center gap-2 border border-gray-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Banners */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-6 hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl group-hover:scale-110 transition-transform">
                <ImageIcon className="w-6 h-6 text-blue-600" />
              </div>
              <Link 
                to="/sdui/banners" 
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">
              {stats.banners?.totalBanners || 0}
            </h3>
            <p className="text-gray-500 text-sm font-medium">Total Banners</p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                {stats.banners?.activeBanners || 0} active
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <Clock className="w-4 h-4" />
                {stats.banners?.scheduledBanners || 0} scheduled
              </span>
            </div>
          </div>

          {/* Categories */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-6 hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl group-hover:scale-110 transition-transform">
                <Grid className="w-6 h-6 text-purple-600" />
              </div>
              <Link 
                to="/sdui/categories" 
                className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">
              {stats.categories?.totalCategories || 0}
            </h3>
            <p className="text-gray-500 text-sm font-medium">Categories</p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                {stats.categories?.activeCategories || 0} active
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <Star className="w-4 h-4" />
                {stats.categories?.featuredCategories || 0} featured
              </span>
            </div>
          </div>

          {/* Trending */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-6 hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <Link 
                to="/sdui/trending" 
                className="text-orange-600 hover:text-orange-700 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                View <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">
              {stats.trendingCount}
            </h3>
            <p className="text-gray-500 text-sm font-medium">Trending Services</p>
            <div className="mt-3 text-sm text-gray-500">
              Max 5 shown to users
            </div>
          </div>

          {/* Layout */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-6 hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-xl group-hover:scale-110 transition-transform">
                <Layout className="w-6 h-6 text-indigo-600" />
              </div>
              <Link 
                to="/sdui/layout-editor" 
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Edit <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">
              {stats.layout?.sections?.length || 0}
            </h3>
            <p className="text-gray-500 text-sm font-medium">Home Page Sections</p>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className={`flex items-center gap-1 ${stats.layout?.isPublished ? 'text-emerald-600' : 'text-amber-600'}`}>
                {stats.layout?.isPublished ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Published
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    Draft
                  </>
                )}
              </span>
              <span className="text-gray-500">
                v{stats.layout?.version || 1}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.path}
                to={action.path}
                className={`bg-gradient-to-br ${action.bgGradient} rounded-2xl border border-white/50 shadow-lg p-6 hover:shadow-xl transition-all duration-300 group`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-4 bg-gradient-to-br ${action.gradient} rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 text-lg group-hover:text-indigo-600 transition-colors">
                        {action.title}
                      </h3>
                      <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                    <p className="text-sm font-semibold text-gray-800 mt-2 bg-white/60 rounded-lg px-3 py-1 inline-block">
                      {action.stats}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Features Info */}
        <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border border-indigo-100/50 p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            What is Server-Driven UI?
          </h2>
          <p className="text-gray-600 mb-6 max-w-3xl">
            Server-Driven UI (SDUI) allows you to control your mobile app's appearance and layout directly 
            from this admin panel. No app store approval needed – changes go live instantly!
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-lg hover:shadow-xl transition-all group">
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Layout Preview Section */}
        {stats.layout && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg overflow-hidden">
            <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-gray-100/50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Current Home Page Layout</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Version {stats.layout.version} • {stats.layout.sections?.filter(s => s.enabled).length || 0} visible sections
                  </p>
                </div>
                <Link
                  to="/sdui/layout-editor"
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/25"
                >
                  <Settings className="w-4 h-4" />
                  Edit Layout
                </Link>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.layout.sections
                  ?.sort((a, b) => a.order - b.order)
                  .map((section, index) => (
                    <div
                      key={section.sectionId}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        section.enabled 
                          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50' 
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {section.title || section.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        </div>
                        {section.enabled ? (
                          <Eye className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Hidden</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Type: {section.type} {section.dataSource ? `• Data: ${section.dataSource}` : ''}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Getting Started */}
        <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            Getting Started
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Create Banners</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Upload promotional images and configure actions for your banner carousel.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Organize Categories</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Add and arrange service categories with custom icons and colors.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white font-bold text-lg">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Customize Layout</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Drag and drop sections to design the perfect home page experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SDUIDashboard;