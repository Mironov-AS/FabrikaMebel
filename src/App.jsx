import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAppStore from './store/appStore';
import LoginPage from './pages/LoginPage';
import Layout from './components/layout/Layout';
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
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const currentUser = useAppStore(s => s.currentUser);

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
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
