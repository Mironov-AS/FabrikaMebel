import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import useAppStore from './store/appStore';
import HomePage from './pages/HomePage';
import { SERVICES } from './data/services';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import ContractsList from './pages/contracts/ContractsList';
import ContractDetail from './pages/contracts/ContractDetail';
import OrdersList from './pages/orders/OrdersList';
import OrderDetail from './pages/orders/OrderDetail';
import ProductionPage from './pages/production/ProductionPage';
import ShipmentsPage from './pages/shipments/ShipmentsPage';
import PaymentsPage from './pages/payments/PaymentsPage';
import ClaimsPage from './pages/claims/ClaimsPage';
import ReportsPage from './pages/reports/ReportsPage';
import ChatPage from './pages/chat/ChatPage';
import AdminPage from './pages/admin/AdminPage';
import CounterpartiesPage from './pages/counterparties/CounterpartiesPage';
import AIAssistant from './pages/ai-assistant/AIAssistant';
import NomenclaturePage from './pages/nomenclature/NomenclaturePage';
import FileRepository from './pages/files/FileRepository';
import WaybillsPage from './pages/waybills/WaybillsPage';

function LayoutWrapper() {
  const loadAll = useAppStore(s => s.loadAll);

  useEffect(() => {
    loadAll();

    // Reload data when the tab becomes visible again, but throttle to at most
    // once per 30 seconds to avoid hammering the API on every window switch.
    let lastLoad = Date.now();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad > 30_000) {
        lastLoad = Date.now();
        loadAll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadAll]);

  return (
    <Layout>
      <ErrorBoundary title="Ошибка загрузки страницы">
        <Outlet />
      </ErrorBoundary>
    </Layout>
  );
}

function HomeRedirect() {
  const currentService = useAppStore(s => s.currentService);
  const service = SERVICES.find(s => s.id === currentService);
  if (service) {
    return <Navigate to={service.defaultPath} replace />;
  }
  return <HomePage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route element={<LayoutWrapper />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/contracts" element={<ContractsList />} />
          <Route path="/contracts/:contractId" element={<ContractDetail />} />
          <Route path="/orders" element={<OrdersList />} />
          <Route path="/orders/:orderId" element={<OrderDetail />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/claims" element={<ClaimsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/counterparties" element={<CounterpartiesPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/nomenclature" element={<NomenclaturePage />} />
          <Route path="/files" element={<FileRepository />} />
          <Route path="/waybills" element={<WaybillsPage />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
