import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
  Boxes,
  Activity,
  AlertTriangle,
  LayoutDashboard,
  Truck,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Database,
  QrCode,
  FileCheck2,
  GitBranch,
  History
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user } = useAuth();
  if (!user) return null;

  const role = user.role;

  // Base list of all system modules
  const allNavItems = [
    // 1. Warehouse & Operations
    { id: 'warehouse', label: 'Guided Picking & Tasks', icon: Boxes, roles: ['Warehouse Employee', 'Admin', 'Manager'] },
    // 2. Monitoring & Cold Chain
    { id: 'monitoring', label: 'Live Cold-Chain Monitoring', icon: Activity, roles: ['Admin', 'Manager', 'Warehouse Employee', 'Auditor'] },
    // 3. Alerts & SOP Response
    { id: 'alerts', label: 'Smart Alerts & SOPs', icon: AlertTriangle, roles: ['Admin', 'Manager', 'Warehouse Employee', 'Verification Staff'] },
    // 4. Executive Dashboard (Manager)
    { id: 'manager', label: 'Operations Command', icon: LayoutDashboard, roles: ['Manager', 'Admin'] },
    // 5. Driver Dispatch & Delivery Proof
    { id: 'driver', label: 'Driver Fleet & Proofs', icon: Truck, roles: ['Driver', 'Admin', 'Manager'] },
    // 6. Verification Staff
    { id: 'verification', label: 'Physical Seal Verification', icon: CheckCircle2, roles: ['Verification Staff', 'Admin', 'Manager'] },
    // 7. Hospital Receiving Portal
    { id: 'hospital', label: 'Hospital Receiving Portal', icon: Building2, roles: ['Hospital Receiver', 'Admin', 'Manager'] },
    // 8. Traceability, Audit & Compliance
    { id: 'traceability', label: 'Audit Chain & Compliance', icon: ShieldCheck, roles: ['Auditor', 'Admin', 'Manager'] },
    // 9. Public Verify Page
    { id: 'public-verify', label: 'Public Vaccine Verification', icon: QrCode, roles: ['Admin', 'Manager', 'Warehouse Employee', 'Driver', 'Verification Staff', 'Hospital Receiver', 'Auditor'] },
    // 10. Admin Master Data
    { id: 'admin', label: 'Admin Master Data', icon: Database, roles: ['Admin'] }
  ];

  // Filter items matching the user's role
  const visibleItems = allNavItems.filter(item => item.roles.includes(role));

  return (
    <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-colors">
      <div className="p-4 flex-1 space-y-1">
        <div className="px-3 py-2 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          Operations Modules
        </div>

        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/25 dark:bg-sky-600'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role Context Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{user.name}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.employee_id}</p>
          <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {user.role}
          </span>
        </div>
      </div>
    </aside>
  );
}
