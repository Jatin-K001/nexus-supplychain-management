import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { Login } from './pages/Login';
import { ROLE_DEFAULT_PATH } from './components/layout/navConfig';
import type { Role } from '@nexus/shared-types';

import { PmDashboard } from './pages/pm/Dashboard';
import { PmProjectsList } from './pages/pm/ProjectsList';
import { PmProjectDetail } from './pages/pm/ProjectDetail';
import { PmPhaseDetail } from './pages/pm/PhaseDetail';
import { PmStockRequests } from './pages/pm/StockRequests';
import { PmReports } from './pages/pm/Reports';
import { PmNewProjectSetup } from './pages/pm/NewProjectSetup';

import { SupervisorHome } from './pages/supervisor/Home';
import { SupervisorMyProjects } from './pages/supervisor/MyProjects';
import { SupervisorProjectDetail } from './pages/supervisor/ProjectDetail';
import { SupervisorSubphaseSequence } from './pages/supervisor/SubphaseSequence';
import { SupervisorSubphaseDetail } from './pages/supervisor/SubphaseDetail';
import { LogConsumptionSelectProject } from './pages/supervisor/LogConsumptionSelectProject';
import { LogConsumptionSelectPhase } from './pages/supervisor/LogConsumptionSelectPhase';
import { LogConsumptionSelectSubphase } from './pages/supervisor/LogConsumptionSelectSubphase';
import { LogConsumptionAddStock } from './pages/supervisor/LogConsumptionAddStock';
import { SupervisorAlerts } from './pages/supervisor/Alerts';

import { ProcurementStockRequestsInbox } from './pages/procurement/StockRequestsInbox';
import { ProcurementVendorDiscovery } from './pages/procurement/VendorDiscovery';
import { ProcurementVendorComparison } from './pages/procurement/VendorComparison';
import { ProcurementVendorDetail } from './pages/procurement/VendorDetail';
import { ProcurementPlaceOrder } from './pages/procurement/PlaceOrder';
import { ProcurementOrderStatus } from './pages/procurement/OrderStatus';
import { ProcurementLogDelivery } from './pages/procurement/LogDelivery';
import { ProcurementVendorManagement } from './pages/procurement/VendorManagement';

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return null; // profile still resolving
  if (profile.role !== role) return <Navigate to={ROLE_DEFAULT_PATH[profile.role]} replace />;
  return <AppShell role={role}>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Project Manager — PM·01-09 */}
      <Route path="/pm/dashboard" element={<RequireRole role="pm"><PmDashboard /></RequireRole>} />
      <Route path="/pm/projects" element={<RequireRole role="pm"><PmProjectsList /></RequireRole>} />
      <Route path="/pm/projects/:projectId" element={<RequireRole role="pm"><PmProjectDetail /></RequireRole>} />
      <Route path="/pm/projects/:projectId/phases/:phaseId" element={<RequireRole role="pm"><PmPhaseDetail /></RequireRole>} />
      <Route path="/pm/stock-requests" element={<RequireRole role="pm"><PmStockRequests /></RequireRole>} />
      <Route path="/pm/reports" element={<RequireRole role="pm"><PmReports /></RequireRole>} />
      <Route path="/pm/new-project" element={<RequireRole role="pm"><PmNewProjectSetup /></RequireRole>} />

      {/* Site Supervisor — SUP·01-12 */}
      <Route path="/supervisor/home" element={<RequireRole role="supervisor"><SupervisorHome /></RequireRole>} />
      <Route path="/supervisor/projects" element={<RequireRole role="supervisor"><SupervisorMyProjects /></RequireRole>} />
      <Route path="/supervisor/projects/:projectId" element={<RequireRole role="supervisor"><SupervisorProjectDetail /></RequireRole>} />
      <Route path="/supervisor/projects/:projectId/phases/:phaseId" element={<RequireRole role="supervisor"><SupervisorSubphaseSequence /></RequireRole>} />
      <Route path="/supervisor/subphases/:subphaseId" element={<RequireRole role="supervisor"><SupervisorSubphaseDetail /></RequireRole>} />
      <Route path="/supervisor/log-consumption" element={<RequireRole role="supervisor"><LogConsumptionSelectProject /></RequireRole>} />
      <Route path="/supervisor/log-consumption/:projectId" element={<RequireRole role="supervisor"><LogConsumptionSelectPhase /></RequireRole>} />
      <Route path="/supervisor/log-consumption/:projectId/:phaseId" element={<RequireRole role="supervisor"><LogConsumptionSelectSubphase /></RequireRole>} />
      <Route path="/supervisor/log-consumption/:projectId/:phaseId/:subphaseId" element={<RequireRole role="supervisor"><LogConsumptionAddStock /></RequireRole>} />
      <Route path="/supervisor/alerts" element={<RequireRole role="supervisor"><SupervisorAlerts /></RequireRole>} />

      {/* Procurement — PROC·01-09 */}
      <Route path="/procurement/stock-requests" element={<RequireRole role="procurement"><ProcurementStockRequestsInbox /></RequireRole>} />
      <Route path="/procurement/vendors/discover/:stockRequestId" element={<RequireRole role="procurement"><ProcurementVendorDiscovery /></RequireRole>} />
      <Route path="/procurement/vendors/compare/:materialId" element={<RequireRole role="procurement"><ProcurementVendorComparison /></RequireRole>} />
      <Route path="/procurement/vendors/:vendorId" element={<RequireRole role="procurement"><ProcurementVendorDetail /></RequireRole>} />
      <Route path="/procurement/vendors" element={<RequireRole role="procurement"><ProcurementVendorManagement /></RequireRole>} />
      <Route path="/procurement/orders/new" element={<RequireRole role="procurement"><ProcurementPlaceOrder /></RequireRole>} />
      <Route path="/procurement/orders/:orderId" element={<RequireRole role="procurement"><ProcurementOrderStatus /></RequireRole>} />
      <Route path="/procurement/log-delivery" element={<RequireRole role="procurement"><ProcurementLogDelivery /></RequireRole>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
