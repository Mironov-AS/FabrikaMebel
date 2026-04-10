import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAppStore from './store/appStore';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
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

function ProtectedRoutes() {
  const { isAuthenticated, loadAll } = useAppStore();

  useEffect(() => {
    if (isAuthenticated) loadAll();
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout>
      <ErrorBoundary title="Ошибка загрузки страницы">
        <Routes>
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
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedHomePage />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedHomePage() {
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <HomePage />;
}
