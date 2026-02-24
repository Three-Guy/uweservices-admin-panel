import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { User, Provider, Transaction, Category, AppState, BookingStatus, WorkStatus, PaymentMode, Notification, PriceHistory, PriceChangeType, SubService, ProviderServicePricing } from '../types';
import { format, subDays, startOfToday } from 'date-fns';

interface StoreContextType extends AppState {
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  setPriceHistory: React.Dispatch<React.SetStateAction<PriceHistory[]>>;
  setProviderPricings: React.Dispatch<React.SetStateAction<ProviderServicePricing[]>>;
  setViewMode: (mode: 'admin' | 'provider') => void;
  setIsDark: (val: boolean) => void;
  addNotification: (title: string, message: string) => void;
  markNotificationsRead: () => void;
  
  // Actions
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, user: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  addProvider: (provider: Omit<Provider, 'id' | 'initials' | 'performance' | 'paymentReceived'>) => void;
  updateProvider: (id: string, provider: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;
  toggleProviderStatus: (id: string) => void;

  updateCategoryPrice: (id: string, price: number, type: PriceChangeType) => void;
  setBasePrice: (id: string, price: number) => void;
  generateRandomPrice: (id: string, min: number, max: number) => void;
  toggleDynamicPricing: (id: string, enabled: boolean) => void;
  applyAISuggestion: (id: string) => void;

  // Sub-service actions
  updateSubService: (categoryId: string, subServiceId: string, updates: Partial<SubService>) => void;
  addSubService: (categoryId: string, subService: Omit<SubService, 'id'>) => void;
  deleteSubService: (categoryId: string, subServiceId: string) => void;
  resetSubServicePrice: (categoryId: string, subServiceId: string) => void;
  updateCategorySettings: (categoryId: string, updates: { 
    discountPercent?: number; 
    isSurgeEnabled?: boolean; 
    multiplier?: number;
    isTaxEnabled?: boolean;
    gstPercent?: number;
    baseCharge?: number;
    minimumBooking?: number;
    commissionPercent?: number;
    isActive?: boolean;
    isFeatured?: boolean;
  }) => void;
  bulkUpdatePrices: (categoryId: string, percentage: number) => void;

  // Provider Pricing Actions
  updateProviderPrice: (pricing: Omit<ProviderServicePricing, 'id' | 'isApproved' | 'isPending' | 'updatedAt'>) => void;
  approveProviderPrice: (id: string) => void;
  rejectProviderPrice: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [users, setUsers] = useState<User[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [providerPricings, setProviderPricings] = useState<ProviderServicePricing[]>([]);
  const [viewMode, setViewMode] = useState<'admin' | 'provider'>('admin');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [commissionRate] = useState(0.15);

  useEffect(() => {
    // Initial Mock Data
    const initialCategories: Category[] = [
      { 
        id: '1', name: 'Cleaning', basePrice: 2499, currentPrice: 2499, aiSuggestedPrice: 2799, 
        aiReason: 'High weekend demand predicted.', demand: 'High', icon: 'SprayCan', color: 'bg-primary',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 150, minimumBooking: 499, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 15,
        isActive: true, isFeatured: true, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'c1', name: 'Carpet Shampooing', basePrice: 499, defaultPrice: 499, minPrice: 399, maxPrice: 699, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'c2', name: 'Sofa Shampooing', basePrice: 599, defaultPrice: 599, minPrice: 499, maxPrice: 799, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'c3', name: 'Bedroom Deep Cleaning', basePrice: 999, defaultPrice: 999, minPrice: 799, maxPrice: 1499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'c4', name: 'Full Home Deep Cleaning', basePrice: 2499, defaultPrice: 2499, minPrice: 1999, maxPrice: 3499, pricingType: 'Onwards', isPopular: true, isActive: true, updatedAt: new Date().toISOString() },
          { id: 'c5', name: 'Aquarium Cleaning', basePrice: 299, defaultPrice: 299, minPrice: 199, maxPrice: 499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'c6', name: 'Toilet Cleaning', basePrice: 399, defaultPrice: 399, minPrice: 299, maxPrice: 599, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'c7', name: 'Floor Scrubbing & Polishing', basePrice: 799, defaultPrice: 799, minPrice: 599, maxPrice: 1199, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'c8', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 10000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '2', name: 'Plumbing', basePrice: 899, currentPrice: 899, aiSuggestedPrice: 849, 
        aiReason: 'Low demand period.', demand: 'Low', icon: 'Droplets', color: 'bg-green-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 99, minimumBooking: 299, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 12,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'p1', name: 'Tap & Mixer Repair', basePrice: 399, defaultPrice: 399, minPrice: 299, maxPrice: 599, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'p2', name: 'Drain Cleaning', basePrice: 999, defaultPrice: 999, minPrice: 799, maxPrice: 1499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'p3', name: 'Toilet Repair', basePrice: 799, defaultPrice: 799, minPrice: 599, maxPrice: 1199, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'p4', name: 'Water Heater Installation', basePrice: 1999, defaultPrice: 1999, minPrice: 1499, maxPrice: 2999, pricingType: 'Onwards', isPopular: true, isActive: true, updatedAt: new Date().toISOString() },
          { id: 'p5', name: 'Leak Detection', basePrice: 899, defaultPrice: 899, minPrice: 699, maxPrice: 1299, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'p6', name: 'Pipe Replacement', basePrice: 2499, defaultPrice: 2499, minPrice: 1999, maxPrice: 3999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'p7', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 10000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '3', name: 'Electrical', basePrice: 599, currentPrice: 599, aiSuggestedPrice: 649, 
        aiReason: 'Shortage of available pros in North zone.', demand: 'Medium', icon: 'Zap', color: 'bg-indigo-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 99, minimumBooking: 299, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 15,
        isActive: true, isFeatured: true, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'e1', name: 'Switch & Socket Repair', basePrice: 299, defaultPrice: 299, minPrice: 199, maxPrice: 499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'e2', name: 'Fan Installation', basePrice: 499, defaultPrice: 499, minPrice: 399, maxPrice: 799, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'e3', name: 'Wiring Check', basePrice: 1499, defaultPrice: 1499, minPrice: 999, maxPrice: 2499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'e4', name: 'AC Repair & Service', basePrice: 2499, defaultPrice: 2499, minPrice: 1999, maxPrice: 3999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'e5', name: 'Light Fitting', basePrice: 399, defaultPrice: 399, minPrice: 299, maxPrice: 699, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'e6', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 10000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '4', name: 'Home Salon', basePrice: 1200, currentPrice: 1200, aiSuggestedPrice: 1350, 
        aiReason: 'High demand for grooming services.', demand: 'High', icon: 'Scissors', color: 'bg-pink-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 199, minimumBooking: 599, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 20,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 's1', name: 'Classic Manicure', basePrice: 699, defaultPrice: 699, minPrice: 499, maxPrice: 999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 's2', name: 'Pedicure', basePrice: 899, defaultPrice: 899, minPrice: 699, maxPrice: 1299, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 's3', name: 'Facial Treatment', basePrice: 1499, defaultPrice: 1499, minPrice: 999, maxPrice: 2499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 's4', name: 'Haircut & Styling', basePrice: 799, defaultPrice: 799, minPrice: 599, maxPrice: 1499, pricingType: 'Onwards', isPopular: true, isActive: true, updatedAt: new Date().toISOString() },
          { id: 's5', name: 'Waxing', basePrice: 499, defaultPrice: 499, minPrice: 399, maxPrice: 899, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 's6', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 10000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '5', name: 'Gardening', basePrice: 1500, currentPrice: 1500, aiSuggestedPrice: 1400, 
        aiReason: 'Off-season maintenance discount.', demand: 'Low', icon: 'Flower2', color: 'bg-emerald-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 149, minimumBooking: 499, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 10,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'g1', name: 'Lawn Mowing', basePrice: 1499, defaultPrice: 1499, minPrice: 999, maxPrice: 2499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'g2', name: 'Hedge Trimming', basePrice: 1999, defaultPrice: 1999, minPrice: 1499, maxPrice: 2999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'g3', name: 'Planting & Potting', basePrice: 999, defaultPrice: 999, minPrice: 699, maxPrice: 1499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'g4', name: 'Garden Cleanup', basePrice: 2499, defaultPrice: 2499, minPrice: 1999, maxPrice: 3999, pricingType: 'Onwards', isPopular: true, isActive: true, updatedAt: new Date().toISOString() },
          { id: 'g5', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 10000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '6', name: 'Painting', basePrice: 15000, currentPrice: 15000, aiSuggestedPrice: 16000, 
        aiReason: 'Seasonal peak for home renovations.', demand: 'High', icon: 'Brush', color: 'bg-amber-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 499, minimumBooking: 5000, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 15,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'pa1', name: 'Interior Painting', basePrice: 14999, defaultPrice: 14999, minPrice: 9999, maxPrice: 24999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'pa2', name: 'Exterior Painting', basePrice: 34999, defaultPrice: 34999, minPrice: 24999, maxPrice: 59999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'pa3', name: 'Wall Texturing', basePrice: 9999, defaultPrice: 9999, minPrice: 4999, maxPrice: 19999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'pa4', name: 'Waterproofing', basePrice: 19999, defaultPrice: 19999, minPrice: 14999, maxPrice: 29999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'pa5', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 100000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '7', name: 'Pest Control', basePrice: 1200, currentPrice: 1200, aiSuggestedPrice: 1100, 
        aiReason: 'Competitive pricing adjustment.', demand: 'Low', icon: 'Bug', color: 'bg-purple-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 199, minimumBooking: 999, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 15,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'pc1', name: 'Termite Control', basePrice: 4999, defaultPrice: 4999, minPrice: 3999, maxPrice: 7999, pricingType: 'Onwards', isPopular: true, isActive: true, updatedAt: new Date().toISOString() },
          { id: 'pc2', name: 'Cockroach Control', basePrice: 1499, defaultPrice: 1499, minPrice: 999, maxPrice: 2499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'pc3', name: 'Bed Bug Treatment', basePrice: 2999, defaultPrice: 2999, minPrice: 1999, maxPrice: 4999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'pc4', name: 'Rodent Control', basePrice: 1999, defaultPrice: 1999, minPrice: 1499, maxPrice: 2999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'pc5', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 10000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '8', name: 'Moving Service', basePrice: 8000, currentPrice: 8000, aiSuggestedPrice: 8500, 
        aiReason: 'Month-end moving surge.', demand: 'High', icon: 'Truck', color: 'bg-blue-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 999, minimumBooking: 4999, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 10,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'm1', name: 'House Shifting', basePrice: 7999, defaultPrice: 7999, minPrice: 4999, maxPrice: 19999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'm2', name: 'Office Moving', basePrice: 19999, defaultPrice: 19999, minPrice: 14999, maxPrice: 49999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'm3', name: 'Vehicle Transport', basePrice: 9999, defaultPrice: 9999, minPrice: 6999, maxPrice: 24999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'm4', name: 'Packing Service', basePrice: 3999, defaultPrice: 3999, minPrice: 2499, maxPrice: 7999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'm5', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 100000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '9', name: 'Carpentry', basePrice: 1500, currentPrice: 1500, aiSuggestedPrice: 1600, 
        aiReason: 'Increased material costs.', demand: 'Medium', icon: 'Hammer', color: 'bg-orange-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 149, minimumBooking: 399, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 15,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'cr1', name: 'Furniture Assembly', basePrice: 1499, defaultPrice: 1499, minPrice: 999, maxPrice: 2999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'cr2', name: 'Door Repair', basePrice: 999, defaultPrice: 999, minPrice: 499, maxPrice: 1999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'cr3', name: 'Custom Wardrobe', basePrice: 24999, defaultPrice: 24999, minPrice: 14999, maxPrice: 49999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'cr4', name: 'Wood Polishing', basePrice: 1999, defaultPrice: 1999, minPrice: 1499, maxPrice: 3999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'cr5', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 50000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '10', name: 'Appliance Repair', basePrice: 800, currentPrice: 800, aiSuggestedPrice: 850, 
        aiReason: 'High demand for summer appliance service.', demand: 'High', icon: 'Wrench', color: 'bg-cyan-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 199, minimumBooking: 499, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 15,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'ar1', name: 'Washing Machine', basePrice: 1999, defaultPrice: 1999, minPrice: 1499, maxPrice: 3499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'ar2', name: 'Refrigerator Repair', basePrice: 2499, defaultPrice: 2499, minPrice: 1999, maxPrice: 4499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'ar3', name: 'Microwave Repair', basePrice: 1499, defaultPrice: 1499, minPrice: 999, maxPrice: 2499, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'ar4', name: 'TV Repair', basePrice: 1999, defaultPrice: 1999, minPrice: 1499, maxPrice: 4999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'ar5', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 10000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '11', name: 'Roofing Service', basePrice: 5000, currentPrice: 5000, aiSuggestedPrice: 5200, 
        aiReason: 'Pre-monsoon maintenance peak.', demand: 'High', icon: 'Home', color: 'bg-slate-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 499, minimumBooking: 2000, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 15,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'r1', name: 'Roof Leak Repair', basePrice: 4999, defaultPrice: 4999, minPrice: 2999, maxPrice: 9999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'r2', name: 'Shingle Replacement', basePrice: 7999, defaultPrice: 7999, minPrice: 4999, maxPrice: 14999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'r3', name: 'Waterproofing', basePrice: 14999, defaultPrice: 14999, minPrice: 9999, maxPrice: 24999, pricingType: 'Onwards', isPopular: true, isActive: true, updatedAt: new Date().toISOString() },
          { id: 'r4', name: 'Gutter Cleaning', basePrice: 1999, defaultPrice: 1999, minPrice: 1499, maxPrice: 3999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'r5', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 50000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
      { 
        id: '12', name: 'Home Security', basePrice: 5000, currentPrice: 5000, aiSuggestedPrice: 5100, 
        aiReason: 'Growing demand for smart home setups.', demand: 'Medium', icon: 'ShieldCheck', color: 'bg-red-500',
        lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm'), priceStatus: 'Manual', isDynamicEnabled: false,
        baseCharge: 299, minimumBooking: 1500, multiplier: 1.0, discountPercent: 0, gstPercent: 18, commissionPercent: 15,
        isActive: true, isFeatured: false, isSurgeEnabled: false, isTaxEnabled: true,
        subServices: [
          { id: 'hs1', name: 'CCTV Installation', basePrice: 7999, defaultPrice: 7999, minPrice: 4999, maxPrice: 14999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'hs2', name: 'Smart Lock Setup', basePrice: 4999, defaultPrice: 4999, minPrice: 2999, maxPrice: 9999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'hs3', name: 'Alarm System', basePrice: 9999, defaultPrice: 9999, minPrice: 6999, maxPrice: 19999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'hs4', name: 'Video Doorbell', basePrice: 3999, defaultPrice: 3999, minPrice: 2499, maxPrice: 7999, pricingType: 'Onwards', isActive: true, updatedAt: new Date().toISOString() },
          { id: 'hs5', name: 'Other Issues', basePrice: 0, defaultPrice: 0, minPrice: 0, maxPrice: 50000, pricingType: 'Custom', isActive: true, updatedAt: new Date().toISOString() },
        ]
      },
    ];

    const initialProviders: Provider[] = [
      { 
        id: 'p1', name: 'Aman Sharma', category: 'Cleaning', location: 'Bangalore', rating: 4.9, status: 'Available', 
        paymentReceived: 284200, paymentMode: 'UPI', contact: '+91 98765 43210', phone: '9876543210', email: 'aman.sharma@example.com',
        availableTimeStart: '09:00', availableTimeEnd: '18:00', address: '123, MG Road, Bangalore',
        performance: 92, initials: 'AS' 
      },
      { 
        id: 'p2', name: 'Priya Varma', category: 'Pest Control', location: 'Mumbai', rating: 4.8, status: 'Busy', 
        paymentReceived: 156400, paymentMode: 'Bank Transfer', contact: '+91 87654 32109', phone: '8765432109', email: 'priya.v@example.com',
        availableTimeStart: '10:00', availableTimeEnd: '19:00', address: '456, Marine Drive, Mumbai',
        performance: 88, initials: 'PV' 
      },
      { 
        id: 'p3', name: 'Rahul Khan', category: 'Electrical', location: 'Delhi', rating: 3.7, status: 'Offline', 
        paymentReceived: 92800, paymentMode: 'Cash', contact: '+91 76543 21098', phone: '7654321098', email: 'rahul.k@example.com',
        availableTimeStart: '08:00', availableTimeEnd: '17:00', address: '789, Connaught Place, Delhi',
        performance: 75, initials: 'RK' 
      },
      { 
        id: 'p4', name: 'Sneha Gupta', category: 'Cleaning', location: 'Pune', rating: 4.5, status: 'Available', 
        paymentReceived: 210500, paymentMode: 'UPI', contact: '+91 65432 10987', phone: '6543210987', email: 'sneha.g@example.com',
        availableTimeStart: '09:00', availableTimeEnd: '18:00', address: '101, Koregaon Park, Pune',
        performance: 95, initials: 'SG' 
      },
      { 
        id: 'p5', name: 'Vikram Singh', category: 'Plumbing', location: 'Hyderabad', rating: 4.2, status: 'Available', 
        paymentReceived: 125000, paymentMode: 'UPI', contact: '+91 54321 09876', phone: '5432109876', email: 'vikram.s@example.com',
        availableTimeStart: '09:00', availableTimeEnd: '18:00', address: '202, Jubilee Hills, Hyderabad',
        performance: 82, initials: 'VS' 
      },
    ];

    const initialUsers: User[] = [
      { 
        id: 'u1', name: 'Rajesh Gupta', serviceRequired: 'Cleaning', paymentAmount: 2499, paymentMode: 'UPI', location: 'Bangalore', status: 'Success', 
        date: format(new Date(), 'yyyy-MM-dd'), phone: '9988776655', email: 'rajesh.g@example.com', serviceTime: '10:30', address: '12, HSR Layout, Bangalore' 
      },
      { 
        id: 'u2', name: 'Anita Iyer', serviceRequired: 'Pest Control', paymentAmount: 1599, paymentMode: 'Bank Transfer', location: 'Mumbai', status: 'Pending', 
        date: format(new Date(), 'yyyy-MM-dd'), phone: '8877665544', email: 'anita.i@example.com', serviceTime: '14:00', address: '34, Bandra West, Mumbai' 
      },
      { 
        id: 'u3', name: 'Vikram Malhotra', serviceRequired: 'Electrical', paymentAmount: 899, paymentMode: 'Cash', location: 'Delhi', status: 'Success', 
        date: format(subDays(new Date(), 1), 'yyyy-MM-dd'), phone: '7766554433', email: 'vikram.m@example.com', serviceTime: '11:00', address: '56, Saket, Delhi' 
      },
      { 
        id: 'u4', name: 'Sanya Mirza', serviceRequired: 'Cleaning', paymentAmount: 3200, paymentMode: 'UPI', location: 'Pune', status: 'Cancelled', 
        date: format(subDays(new Date(), 2), 'yyyy-MM-dd'), phone: '6655443322', email: 'sanya.m@example.com', serviceTime: '16:30', address: '78, Viman Nagar, Pune' 
      },
    ];

    // Generate 100+ transactions for analytics
    const generatedTransactions: Transaction[] = [];
    const cities = ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata'];
    const cats = ['Cleaning', 'Electrical', 'Painting', 'Plumbing', 'Moving', 'Pest Control'];
    
    for (let i = 0; i < 200; i++) {
      const date = format(subDays(new Date(), Math.floor(Math.random() * 180)), 'yyyy-MM-dd');
      const category = cats[Math.floor(Math.random() * cats.length)];
      const amount = Math.floor(Math.random() * 5000) + 500;
      const discount = Math.random() > 0.7 ? amount * 0.1 : 0;
      const surge = Math.random() > 0.8 ? amount * 0.2 : 0;
      const tax = (amount - discount + surge) * 0.18;
      const status: BookingStatus = Math.random() > 0.1 ? 'Success' : (Math.random() > 0.7 ? 'Pending' : (Math.random() > 0.5 ? 'Failed' : 'Refunded'));
      const paymentModes: PaymentMode[] = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash', 'Wallet', 'EMI'];
      const paymentMode = paymentModes[Math.floor(Math.random() * paymentModes.length)];
      
      generatedTransactions.push({
        id: `TXN-${1000 + i}`,
        bookingId: `BK-${5000 + i}`,
        customerName: `Customer ${i}`,
        providerName: initialProviders[Math.floor(Math.random() * initialProviders.length)].name,
        category,
        serviceName: `${category} Service`,
        totalAmount: amount - discount + surge + tax,
        discountAmount: discount,
        surgeAmount: surge,
        taxAmount: tax,
        commissionAmount: (amount - discount + surge) * 0.15,
        date,
        time: `${Math.floor(Math.random() * 12 + 9)}:00`,
        status,
        paymentMode,
        gatewayRefId: status === 'Success' ? `GREF-${Math.random().toString(36).substr(2, 8).toUpperCase()}` : undefined
      });
    }

    setCategories(initialCategories);
    setProviders(initialProviders);
    setUsers(initialUsers);
    setTransactions(generatedTransactions);
    setNotifications([
      { id: 'n1', title: 'New Booking', message: 'Rajesh Gupta booked Cleaning service.', time: '2 mins ago', read: false },
      { id: 'n2', title: 'Payment Success', message: 'Payment of ₹2499 received.', time: '5 mins ago', read: false },
    ]);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  const addNotification = (title: string, message: string) => {
    setNotifications(prev => [{ id: Math.random().toString(), title, message, time: 'Just now', read: false }, ...prev]);
  };

  const markNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const addUser = (user: Omit<User, 'id'>) => {
    const newUser = { ...user, id: 'u' + Math.random().toString(36).substr(2, 9) };
    setUsers(prev => [newUser, ...prev]);
    
    // Create transaction if success
    if (user.status === 'Success') {
      const provider = providers.find(p => p.category === user.serviceRequired);
      const category = categories.find(c => c.name === user.serviceRequired);
      
      // Find sub-service to get ID
      const subService = category?.subServices.find(s => s.name === user.subService);
      
      // Check for provider-specific pricing
      const providerPricing = providerPricings.find(p => 
        p.providerId === provider?.id && 
        p.serviceId === subService?.id && 
        p.isApproved
      );

      const baseAmount = providerPricing ? providerPricing.providerPrice : user.paymentAmount;
      const baseCharge = category?.baseCharge || 0;
      const multiplier = category?.multiplier || 1;
      const discountPercent = category?.discountPercent || 0;
      const gstPercent = category?.gstPercent || 0;
      const commissionPercent = category?.commissionPercent || 15;

      // Logic: Final = ((Base + VisitCharge) * Multiplier - Discount) + GST
      const subtotalBeforeDiscount = (baseAmount + baseCharge) * multiplier;
      const discountAmount = subtotalBeforeDiscount * (discountPercent / 100);
      const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
      const taxAmount = subtotalAfterDiscount * (gstPercent / 100);
      const total = subtotalAfterDiscount + taxAmount;
      const surgeAmount = (baseAmount + baseCharge) * (multiplier - 1);

      const newTxn: Transaction = {
        id: 'TXN-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        bookingId: 'BK-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        customerName: user.name,
        customerId: newUser.id,
        providerName: provider?.name || 'Unassigned',
        providerId: provider?.id,
        category: user.serviceRequired,
        serviceName: user.subService || user.serviceRequired,
        totalAmount: total,
        discountAmount: discountAmount,
        surgeAmount: surgeAmount,
        taxAmount: taxAmount,
        commissionAmount: subtotalAfterDiscount * (commissionPercent / 100),
        date: user.date,
        time: user.serviceTime,
        status: 'Success',
        paymentMode: user.paymentMode,
        gatewayRefId: 'GREF-' + Math.random().toString(36).substr(2, 8).toUpperCase()
      };
      setTransactions(prev => [newTxn, ...prev]);
    }
    addNotification('New User Added', `${user.name} added to the system.`);
  };

  const updateUser = (id: string, updated: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u));
  };

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  const addProvider = (p: Omit<Provider, 'id' | 'initials' | 'performance' | 'paymentReceived'>) => {
    const newProvider: Provider = {
      ...p,
      id: 'p' + Math.random().toString(36).substr(2, 9),
      initials: p.name.split(' ').map(n => n[0]).join(''),
      performance: 80,
      paymentReceived: 0
    };
    setProviders(prev => [newProvider, ...prev]);
  };

  const updateProvider = (id: string, updated: Partial<Provider>) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));
  };

  const deleteProvider = (id: string) => {
    setProviders(prev => prev.filter(p => p.id !== id));
  };

  const toggleProviderStatus = (id: string) => {
    setProviders(prev => prev.map(p => {
      if (p.id === id) {
        const statuses: WorkStatus[] = ['Available', 'Busy', 'Offline'];
        const next = statuses[(statuses.indexOf(p.status) + 1) % 3];
        return { ...p, status: next };
      }
      return p;
    }));
  };

  const addPriceHistory = (categoryId: string, categoryName: string, oldPrice: number, newPrice: number, type: PriceChangeType) => {
    const history: PriceHistory = {
      id: 'PH-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      categoryId,
      categoryName,
      oldPrice,
      newPrice,
      changeType: type,
      changedBy: 'Admin (Rajesh)',
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm')
    };
    setPriceHistory(prev => [history, ...prev]);
  };

  const updateCategoryPrice = (id: string, price: number, type: PriceChangeType) => {
    setCategories(prev => prev.map(c => {
      if (c.id === id) {
        addPriceHistory(c.id, c.name, c.currentPrice, price, type);
        return { 
          ...c, 
          currentPrice: price, 
          priceStatus: type,
          lastUpdated: format(new Date(), 'yyyy-MM-dd HH:mm')
        };
      }
      return c;
    }));
  };

  const setBasePrice = (id: string, price: number) => {
    setCategories(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, basePrice: price };
      }
      return c;
    }));
  };

  const generateRandomPrice = (id: string, min: number, max: number) => {
    const randomPrice = Math.floor(Math.random() * (max - min + 1)) + min;
    updateCategoryPrice(id, randomPrice, 'Random');
  };

  const toggleDynamicPricing = (id: string, enabled: boolean) => {
    setCategories(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, isDynamicEnabled: enabled };
      }
      return c;
    }));
  };

  const applyAISuggestion = (id: string) => {
    const category = categories.find(c => c.id === id);
    if (category) {
      updateCategoryPrice(id, category.aiSuggestedPrice, 'Dynamic');
    }
  };

  const updateSubService = (categoryId: string, subServiceId: string, updates: Partial<SubService>) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        // If basePrice is updated, notify providers
        if (updates.basePrice !== undefined) {
          const sub = cat.subServices.find(s => s.id === subServiceId);
          if (sub) {
            addNotification(
              'Base Price Updated',
              `The base price for ${sub.name} in ${cat.name} has been updated to ₹${updates.basePrice}. Please review your custom pricing.`
            );
          }
        }
        return {
          ...cat,
          subServices: cat.subServices.map(sub => 
            sub.id === subServiceId ? { ...sub, ...updates, updatedAt: new Date().toISOString() } : sub
          )
        };
      }
      return cat;
    }));
  };

  const resetSubServicePrice = (categoryId: string, subServiceId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          subServices: cat.subServices.map(sub => 
            sub.id === subServiceId ? { ...sub, basePrice: sub.defaultPrice, updatedAt: new Date().toISOString() } : sub
          )
        };
      }
      return cat;
    }));
    addNotification('Price Reset', 'Service price has been reset to default.');
  };

  const addSubService = (categoryId: string, subService: Omit<SubService, 'id'>) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        const newSub = { ...subService, id: Math.random().toString(36).substr(2, 9) };
        return {
          ...cat,
          subServices: [...cat.subServices, newSub]
        };
      }
      return cat;
    }));
  };

  const deleteSubService = (categoryId: string, subServiceId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          subServices: cat.subServices.filter(sub => sub.id !== subServiceId)
        };
      }
      return cat;
    }));
  };

  const updateCategorySettings = (categoryId: string, updates: { 
    discountPercent?: number; 
    isSurgeEnabled?: boolean; 
    multiplier?: number;
    isTaxEnabled?: boolean;
    gstPercent?: number;
    baseCharge?: number;
    minimumBooking?: number;
    commissionPercent?: number;
    isActive?: boolean;
    isFeatured?: boolean;
  }) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, ...updates } : cat
    ));
  };

  const bulkUpdatePrices = (categoryId: string, percentage: number) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        const updatedSubServices = cat.subServices.map(sub => ({
          ...sub,
          basePrice: Math.round(sub.basePrice * (1 + percentage / 100))
        }));
        return { ...cat, subServices: updatedSubServices };
      }
      return cat;
    }));
  };

  const updateProviderPrice = (pricing: Omit<ProviderServicePricing, 'id' | 'isApproved' | 'isPending' | 'updatedAt'>) => {
    setProviderPricings(prev => {
      const existingIndex = prev.findIndex(p => p.providerId === pricing.providerId && p.serviceId === pricing.serviceId);
      const newPricing: ProviderServicePricing = {
        ...pricing,
        id: existingIndex >= 0 ? prev[existingIndex].id : Math.random().toString(36).substr(2, 9),
        isApproved: false,
        isPending: true,
        updatedAt: format(new Date(), 'yyyy-MM-dd HH:mm')
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newPricing;
        return updated;
      }
      return [...prev, newPricing];
    });
    addNotification('Price Update Request', `A provider has requested a price update for a service.`);
  };

  const approveProviderPrice = (id: string) => {
    setProviderPricings(prev => prev.map(p => p.id === id ? { ...p, isApproved: true, isPending: false } : p));
    addNotification('Price Approved', 'Provider price update has been approved.');
  };

  const rejectProviderPrice = (id: string) => {
    setProviderPricings(prev => prev.map(p => p.id === id ? { ...p, isApproved: false, isPending: false } : p));
    addNotification('Price Rejected', 'Provider price update has been rejected.');
  };

  const value = {
    users, setUsers,
    providers, setProviders,
    transactions, setTransactions,
    categories, setCategories,
    priceHistory, setPriceHistory,
    providerPricings, setProviderPricings,
    viewMode, setViewMode,
    commissionRate,
    isDark, setIsDark,
    notifications,
    addNotification,
    markNotificationsRead,
    addUser, updateUser, deleteUser,
    addProvider, updateProvider, deleteProvider, toggleProviderStatus,
    updateCategoryPrice, setBasePrice, generateRandomPrice, toggleDynamicPricing, applyAISuggestion,
    updateSubService, addSubService, deleteSubService, resetSubServicePrice, updateCategorySettings, bulkUpdatePrices,
    updateProviderPrice, approveProviderPrice, rejectProviderPrice
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
};
