// frontend2/src/pages/checkout/CheckoutSettings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  DollarSign,
  Percent,
  CreditCard,
  Smartphone,
  Clock,
  Plus,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  Edit2,
  Calculator,
  Receipt,
  Wallet,
  Building,
  ShoppingBag,
  Banknote,
} from 'lucide-react';
import { checkoutApi } from '../../lib/api';
import type { CheckoutSettings, FeeConfig, TaxConfig, PaymentMethodsConfig } from '../../types/checkout';

// ==================== FEE CARD ====================
const FeeCard = ({
  title,
  description,
  icon: Icon,
  fee,
  onUpdate,
  loading,
  color,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  fee: FeeConfig;
  onUpdate: (data: FeeConfig) => void;
  loading: boolean;
  color: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localFee, setLocalFee] = useState(fee);

  useEffect(() => {
    setLocalFee(fee);
  }, [fee]);

  const handleSave = () => {
    onUpdate(localFee);
    setIsEditing(false);
  };

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-6 shadow-sm`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
            <Icon size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Edit2 size={18} className="text-gray-500" />
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          {/* Fee Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Fee Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setLocalFee(prev => ({ ...prev, type: 'fixed' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                  localFee.type === 'fixed'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign size={18} />
                Fixed
              </button>
              <button
                onClick={() => setLocalFee(prev => ({ ...prev, type: 'percentage' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                  localFee.type === 'percentage'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Percent size={18} />
                Percentage
              </button>
            </div>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                {localFee.type === 'fixed' ? '₹' : '%'}
              </span>
              <input
                type="number"
                value={localFee.value}
                onChange={(e) => setLocalFee(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                min="0"
                step="0.01"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Max Amount (for percentage) */}
          {localFee.type === 'percentage' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Amount (Optional)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  value={localFee.maxAmount || ''}
                  onChange={(e) => setLocalFee(prev => ({ 
                    ...prev, 
                    maxAmount: e.target.value ? parseFloat(e.target.value) : null 
                  }))}
                  placeholder="No limit"
                  min="0"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Current Value:</span>
            <span className="text-xl font-bold text-gray-900">
              {fee.type === 'fixed' ? `₹${fee.value}` : `${fee.value}%`}
              {fee.type === 'percentage' && fee.maxAmount && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (Max ₹{fee.maxAmount})
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== TAX CARD ====================
const TaxCard = ({
  tax,
  onUpdate,
  loading,
}: {
  tax: TaxConfig;
  onUpdate: (data: TaxConfig) => void;
  loading: boolean;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localTax, setLocalTax] = useState(tax);

  useEffect(() => {
    setLocalTax(tax);
  }, [tax]);

  const handleSave = () => {
    onUpdate(localTax);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
            <Receipt size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Tax / GST</h3>
            <p className="text-sm text-gray-500">Configure tax applied to orders</p>
          </div>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Edit2 size={18} className="text-gray-500" />
        </button>
      </div>

      {isEditing ? (
        <div className="space-y-4 pt-4 border-t border-gray-100">
          {/* Tax Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tax Name</label>
            <input
              type="text"
              value={localTax.name}
              onChange={(e) => setLocalTax(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. GST, VAT"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Tax Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tax Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setLocalTax(prev => ({ ...prev, type: 'fixed' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                  localTax.type === 'fixed'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <DollarSign size={18} />
                Fixed
              </button>
              <button
                onClick={() => setLocalTax(prev => ({ ...prev, type: 'percentage' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                  localTax.type === 'percentage'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Percent size={18} />
                Percentage
              </button>
            </div>
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                {localTax.type === 'fixed' ? '₹' : '%'}
              </span>
              <input
                type="number"
                value={localTax.value}
                onChange={(e) => setLocalTax(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                min="0"
                step="0.01"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{tax.name}:</span>
            <span className="text-xl font-bold text-gray-900">
              {tax.type === 'fixed' ? `₹${tax.value}` : `${tax.value}%`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== PAYMENT METHOD ICON COMPONENT ====================
const PaymentIcon = ({ iconType, className = "w-6 h-6" }: { iconType: string; className?: string }) => {
  switch (iconType) {
    case 'gpay':
      return <img src="https://img.icons8.com/color/48/google-pay.png" alt="GPay" className={className} />;
    case 'phonepe':
      return <img src="https://img.icons8.com/color/48/phone-pe.png" alt="PhonePe" className={className} />;
    case 'paytm':
      return <img src="https://img.icons8.com/color/48/paytm.png" alt="Paytm" className={className} />;
    case 'amazon':
      return <img src="https://img.icons8.com/color/48/amazon.png" alt="Amazon" className={className} />;
    case 'clock':
      return <Clock size={24} className="text-white" />;
    case 'card':
      return <CreditCard size={24} className="text-white" />;
    case 'bank':
      return <Building size={24} className="text-white" />;
    case 'wallet':
      return <Wallet size={24} className="text-white" />;
    case 'cash':
      return <Banknote size={24} className="text-white" />;
    case 'plus':
      return <Plus size={24} className="text-white" />;
    default:
      return <CreditCard size={24} className="text-white" />;
  }
};

// ==================== PAYMENT METHOD CARD ====================
const PaymentMethodCard = ({
  methodKey,
  method,
  onToggle,
  loading,
}: {
  methodKey: string;
  method: { enabled: boolean; label: string; description: string; icon: string };
  onToggle: (key: string, enabled: boolean) => void;
  loading: boolean;
}) => {
  // Define colors based on method
  const getColorClass = (key: string) => {
    const colors: Record<string, string> = {
      'pay-after': 'bg-orange-500',
      'google-pay': 'bg-white border border-gray-200',
      'phonepe': 'bg-purple-600',
      'paytm': 'bg-blue-500',
      'amazon-pay': 'bg-gray-900',
      'card': 'bg-indigo-600',
      'net-banking': 'bg-green-600',
      'wallet': 'bg-cyan-600',
      'cash-on-delivery': 'bg-emerald-600',
      'new-upi': 'bg-gray-600',
    };
    return colors[key] || 'bg-gray-500';
  };

  // Check if icon is an image URL type
  const isImageIcon = ['gpay', 'phonepe', 'paytm', 'amazon'].includes(method.icon);

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border ${
      method.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
    } transition-all`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${getColorClass(methodKey)} flex items-center justify-center`}>
          <PaymentIcon iconType={method.icon} />
        </div>
        <div>
          <h4 className={`font-semibold ${method.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
            {method.label}
          </h4>
          <p className="text-sm text-gray-500">{method.description}</p>
        </div>
      </div>
      <button
        onClick={() => onToggle(methodKey, !method.enabled)}
        disabled={loading}
        className={`relative w-14 h-8 rounded-full transition-colors ${
          method.enabled ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${
          method.enabled ? 'left-7' : 'left-1'
        }`} />
      </button>
    </div>
  );
};

// ==================== PRICE CALCULATOR ====================
const PriceCalculator = ({ settings }: { settings: CheckoutSettings | null }) => {
  const [basePrice, setBasePrice] = useState(100);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    if (!basePrice) return;
    
    try {
      setLoading(true);
      const response = await checkoutApi.calculatePrice(basePrice);
      if (response.success) {
        setResult(response.data);
      }
    } catch (err) {
      console.error('Calculate error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center">
          <Calculator size={24} className="text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Price Calculator</h3>
          <p className="text-sm text-gray-600">Test your checkout pricing</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
            placeholder="Enter base price"
            className="w-full pl-10 pr-4 py-3 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
          />
        </div>
        <button
          onClick={calculate}
          disabled={loading}
          className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-medium flex items-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
          Calculate
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Base Price</span>
            <span className="font-medium">₹{result.basePrice}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Service Fee</span>
            <span className="font-medium">₹{result.serviceFee}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Platform Fee</span>
            <span className="font-medium">₹{result.platformFee}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">₹{result.subtotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{result.taxName}</span>
            <span className="font-medium">₹{result.tax}</span>
          </div>
          <hr className="border-gray-200" />
          <div className="flex justify-between">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-orange-600">₹{result.total}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
export default function CheckoutSettingsPage() {
  const [settings, setSettings] = useState<CheckoutSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch settings
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await checkoutApi.getSettings();
      if (response.success) {
        setSettings(response.data.settings);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Show success message
  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Update service fee
  const handleUpdateServiceFee = async (data: FeeConfig) => {
    try {
      setSaving(true);
      setError('');
      await checkoutApi.updateServiceFee(data);
      showSuccess('Service fee updated successfully');
      fetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to update service fee');
    } finally {
      setSaving(false);
    }
  };

  // Update platform fee
  const handleUpdatePlatformFee = async (data: FeeConfig) => {
    try {
      setSaving(true);
      setError('');
      await checkoutApi.updatePlatformFee(data);
      showSuccess('Platform fee updated successfully');
      fetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to update platform fee');
    } finally {
      setSaving(false);
    }
  };

  // Update tax
  const handleUpdateTax = async (data: TaxConfig) => {
    try {
      setSaving(true);
      setError('');
      await checkoutApi.updateTax(data);
      showSuccess('Tax updated successfully');
      fetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to update tax');
    } finally {
      setSaving(false);
    }
  };

  // Toggle payment method
  const handleTogglePaymentMethod = async (method: string, enabled: boolean) => {
    try {
      setSaving(true);
      setError('');
      await checkoutApi.togglePaymentMethod(method, enabled);
      showSuccess(`Payment method ${enabled ? 'enabled' : 'disabled'}`);
      fetchSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to update payment method');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  // Define payment methods for display
  const paymentMethodsList = settings ? [
    { key: 'pay-after', data: settings.paymentMethods.payAfterService, category: 'popular' },
    { key: 'google-pay', data: settings.paymentMethods.googlePay, category: 'upi' },
    { key: 'phonepe', data: settings.paymentMethods.phonePe, category: 'upi' },
    { key: 'paytm', data: settings.paymentMethods.paytm, category: 'upi' },
    { key: 'amazon-pay', data: settings.paymentMethods.amazonPay, category: 'upi' },
    { key: 'card', data: settings.paymentMethods.card, category: 'card' },
    { key: 'net-banking', data: settings.paymentMethods.netBanking, category: 'card' },
    { key: 'wallet', data: settings.paymentMethods.wallet, category: 'other' },
    { key: 'cash-on-delivery', data: settings.paymentMethods.cashOnDelivery, category: 'other' },
    { key: 'new-upi', data: settings.paymentMethods.newUpi, category: 'other' },
  ] : [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checkout Settings</h1>
          <p className="text-gray-500 mt-1">Configure fees, taxes, and payment methods</p>
        </div>
        <button
          onClick={fetchSettings}
          className="flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Success Alert */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Fees & Payment Methods */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fees Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Fees Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings && (
                <>
                  <FeeCard
                    title="Service Fee"
                    description="Fee charged for service"
                    icon={Wallet}
                    fee={settings.serviceFee}
                    onUpdate={handleUpdateServiceFee}
                    loading={saving}
                    color="bg-blue-500"
                  />
                  <FeeCard
                    title="Platform Fee"
                    description="Platform usage fee"
                    icon={Smartphone}
                    fee={settings.platformFee}
                    onUpdate={handleUpdatePlatformFee}
                    loading={saving}
                    color="bg-purple-500"
                  />
                </>
              )}
            </div>
          </div>

          {/* Tax Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tax Configuration</h2>
            {settings && (
              <TaxCard
                tax={settings.tax}
                onUpdate={handleUpdateTax}
                loading={saving}
              />
            )}
          </div>

          {/* Payment Methods */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>
            
            {/* UPI Methods */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">UPI Payments</h3>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                {paymentMethodsList
                  .filter(m => m.category === 'upi')
                  .map(({ key, data }) => (
                    <PaymentMethodCard
                      key={key}
                      methodKey={key}
                      method={data}
                      onToggle={handleTogglePaymentMethod}
                      loading={saving}
                    />
                  ))}
              </div>
            </div>

            {/* Card & Banking */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Cards & Banking</h3>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                {paymentMethodsList
                  .filter(m => m.category === 'card')
                  .map(({ key, data }) => (
                    <PaymentMethodCard
                      key={key}
                      methodKey={key}
                      method={data}
                      onToggle={handleTogglePaymentMethod}
                      loading={saving}
                    />
                  ))}
              </div>
            </div>

            {/* Other Methods */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Other Methods</h3>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                {paymentMethodsList
                  .filter(m => m.category === 'popular' || m.category === 'other')
                  .map(({ key, data }) => (
                    <PaymentMethodCard
                      key={key}
                      methodKey={key}
                      method={data}
                      onToggle={handleTogglePaymentMethod}
                      loading={saving}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Calculator & Info */}
        <div className="space-y-6">
          <PriceCalculator settings={settings} />

          {/* Quick Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Payment Methods Overview</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Total Methods</span>
                <span className="font-semibold text-gray-900">
                  {paymentMethodsList.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Enabled</span>
                <span className="font-semibold text-green-600">
                  {paymentMethodsList.filter(m => m.data.enabled).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Disabled</span>
                <span className="font-semibold text-gray-400">
                  {paymentMethodsList.filter(m => !m.data.enabled).length}
                </span>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">How Pricing Works</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600">1</span>
                </div>
                <p>Base price is the service cost</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600">2</span>
                </div>
                <p>Service fee & platform fee are added</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-blue-600">3</span>
                </div>
                <p>Tax is calculated on subtotal</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-green-600">4</span>
                </div>
                <p>Coupon discount is applied at checkout</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}