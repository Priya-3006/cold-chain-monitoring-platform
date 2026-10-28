import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import FaultInjectionPanel from './components/FaultInjectionPanel.jsx';
import ChatbotWidget from './components/ChatbotWidget.jsx';

// Role-Tailored Views
import WarehouseView from './pages/WarehouseView.jsx';
import MonitoringView from './pages/MonitoringView.jsx';
import AlertCenterView from './pages/AlertCenterView.jsx';
import ManagerView from './pages/ManagerView.jsx';
import DriverView from './pages/DriverView.jsx';
import VerificationView from './pages/VerificationView.jsx';
import HospitalView from './pages/HospitalView.jsx';
import TraceabilityView from './pages/TraceabilityView.jsx';
import PublicVerifyView from './pages/PublicVerifyView.jsx';
import AdminView from './pages/AdminView.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('warehouse');
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  // Set default view matching the user's role whenever persona changes
  useEffect(() => {
    if (!user) return;
    switch (user.role) {
      case 'Driver':
        setActiveTab('driver');
        break;
      case 'Verification Staff':
        setActiveTab('verification');
        break;
      case 'Hospital Receiver':
        setActiveTab('hospital');
        break;
      case 'Auditor':
        setActiveTab('traceability');
        break;
      case 'Manager':
        setActiveTab('manager');
        break;
      case 'Admin':
        setActiveTab('admin');
        break;
      default:
        setActiveTab('warehouse');
    }
  }, [user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-mono text-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <span>Initializing Smart Cold-Chain Telemetry System...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Top Header Navbar */}
      <Navbar
        onOpenSimulator={() => setSimulatorOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Workspace with Sidebar and Viewport */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 overflow-y-auto min-h-[calc(100vh-60px)]">
          {activeTab === 'warehouse' && <WarehouseView />}
          {activeTab === 'monitoring' && <MonitoringView />}
          {activeTab === 'alerts' && <AlertCenterView />}
          {activeTab === 'manager' && <ManagerView />}
          {activeTab === 'driver' && <DriverView />}
          {activeTab === 'verification' && <VerificationView />}
          {activeTab === 'hospital' && <HospitalView />}
          {activeTab === 'traceability' && <TraceabilityView />}
          {activeTab === 'public-verify' && <PublicVerifyView />}
          {activeTab === 'admin' && <AdminView />}
        </main>
      </div>

      {/* Floating AI Chatbot Widget */}
      <ChatbotWidget />

      {/* IoT Fault Injection Control Drawer */}
      <FaultInjectionPanel
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
      />
    </div>
  );
}
