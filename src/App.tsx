import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { StoreProvider, useStore } from './store/StoreContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/MobileNav';
import { Dashboard } from './components/pages/Dashboard';
import { UsersModule } from './components/pages/UsersModule';
import { ProvidersModule } from './components/pages/ProvidersModule';
import { PricingModule } from './components/pages/PricingModule';
import { TransactionsModule } from './components/pages/TransactionsModule';
import { CategoriesModule } from './components/pages/CategoriesModule';
import { RevenueAnalytics } from './components/pages/RevenueAnalytics';
import { ProviderPricingPanel } from './components/pages/ProviderPricingPanel';
import { ProviderPricingAdmin } from './components/pages/ProviderPricingAdmin';
import { cn } from './lib/utils';

function AppContent() {
  const { isDark } = useStore();

  return (
    <div className="flex h-screen overflow-hidden transition-colors duration-300 bg-bg-primary text-text-primary">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<UsersModule />} />
            <Route path="/providers" element={<ProvidersModule />} />
            <Route path="/pricing" element={<PricingModule />} />
            <Route path="/approvals" element={<ProviderPricingAdmin />} />
            <Route path="/provider/pricing" element={<ProviderPricingPanel />} />
            <Route path="/transactions" element={<TransactionsModule />} />
            <Route path="/categories" element={<CategoriesModule />} />
            <Route path="/analytics" element={<RevenueAnalytics />} />
          </Routes>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Router>
        <AppContent />
      </Router>
    </StoreProvider>
  );
}
