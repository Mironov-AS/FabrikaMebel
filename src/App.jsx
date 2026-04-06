import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAppStore from './store/appStore';
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

function ProtectedRoute({ children }) {
  const currentUser = useAppStore(s => s.currentUser);
  const isInitializing = useAppStore(s => s.isInitializing);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const currentUser = useAppStore(s => s.currentUser);
  const isInitializing = useAppStore(s => s.isInitializing);
  const initializeAuth = useAppStore(s => s.initializeAuth);

  useEffect(() => {
    initializeAuth();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Инициализация...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={currentUser ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/" element={<Navigate to={currentUser ? "/dashboard" : "/login"} replace />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
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
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </ErrorBoundary>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
