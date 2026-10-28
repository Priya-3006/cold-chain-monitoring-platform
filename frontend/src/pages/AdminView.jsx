import React, { useState, useEffect } from 'react';
import { adminApi } from '../api/client.js';
import {
  Database,
  Users,
  ShieldCheck,
  Building,
  Truck,
  BookOpen,
  Plus,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export default function AdminView() {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'vaccines' | 'containers' | 'locations' | 'sops'
  const [users, setUsers] = useState([]);
  const [vaccines, setVaccines] = useState([]);
  const [containers, setContainers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [sops, setSops] = useState([]);
  const [loading, setLoading] = useState(true);

  // New User Form State
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    employee_id: '',
    name: '',
    email: '',
    role: 'Warehouse Employee',
    password: 'password123',
    responsibilities: 'Picking & Storage operations'
  });

  useEffect(() => {
    loadAllMasterData();
  }, []);

  const loadAllMasterData = async () => {
    try {
      setLoading(true);
      const [uRes, vRes, cRes, lRes, sRes] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getVaccines(),
        adminApi.getContainers(),
        adminApi.getLocations(),
        adminApi.getSops()
      ]);
      setUsers(uRes.users || []);
      setVaccines(vRes.vaccines || []);
      setContainers(cRes.containers || []);
      setLocations(lRes.locations || []);
      setSops(sRes.sops || []);
    } catch (err) {
      console.error('Failed to load master data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = async (id, currentStatus) => {
    try {
      await adminApi.toggleUserStatus(id, !currentStatus);
      await loadAllMasterData();
    } catch (err) {
      alert(`Status toggle failed: ${err.message}`);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createUser(newUserData);
      alert('User created successfully!');
      setShowUserModal(false);
      setNewUserData({
        employee_id: '',
        name: '',
        email: '',
        role: 'Warehouse Employee',
        password: 'password123',
        responsibilities: 'Picking & Storage operations'
      });
      await loadAllMasterData();
    } catch (err) {
      alert(`User creation error: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-purple-500" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              System Administration & Master Data
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            User RBAC Roster, Vaccine Specifications, Container Registry & Storage Hierarchy
          </p>
        </div>

        {/* Master Data Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('vaccines')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'vaccines'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Vaccines ({vaccines.length})
          </button>
          <button
            onClick={() => setActiveTab('containers')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'containers'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Containers ({containers.length})
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'locations'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Locations ({locations.length})
          </button>
          <button
            onClick={() => setActiveTab('sops')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'sops'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            SOPs ({sops.length})
          </button>
        </div>
      </div>

      {/* 1. USERS TAB */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Active System Employees & Access Roles</h3>
            <button
              onClick={() => setShowUserModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Emp ID</th>
                  <th className="py-2.5 px-3">Name & Email</th>
                  <th className="py-2.5 px-3">Assigned Role</th>
                  <th className="py-2.5 px-3">Warehouse Zone</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Toggle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">{u.employee_id}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 dark:text-white block">{u.name}</span>
                      <span className="text-[11px] text-slate-400">{u.email}</span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{u.role}</td>
                    <td className="py-2.5 px-3 text-slate-500">{u.warehouse_name || 'All Depots'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.is_active === 1
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {u.is_active === 1 ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => handleToggleUser(u.id, u.is_active === 1)}
                        className="text-xs font-bold text-slate-400 hover:text-purple-600"
                      >
                        {u.is_active === 1 ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. VACCINES TAB */}
      {activeTab === 'vaccines' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Vaccine Master Registry (WHO Aligned)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Name & Manufacturer</th>
                  <th className="py-2.5 px-3">Storage Limits</th>
                  <th className="py-2.5 px-3">Freeze Sensitive</th>
                  <th className="py-2.5 px-3">VVM Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {vaccines.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-600">{v.vaccine_code}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 dark:text-white block">{v.name}</span>
                      <span className="text-[11px] text-slate-400">{v.manufacturer}</span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {v.min_temp}°C to {v.max_temp}°C
                    </td>
                    <td className="py-2.5 px-3">
                      {v.freeze_sensitive === 1 ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          CRITICAL (NO FREEZE)
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Tolerant</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{v.vvm_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CONTAINERS TAB */}
      {activeTab === 'containers' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Active & Passive Cold-Chain Container Fleet</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Container</th>
                  <th className="py-2.5 px-3">Type & Cooling</th>
                  <th className="py-2.5 px-3">Operating Range</th>
                  <th className="py-2.5 px-3">Current Temp</th>
                  <th className="py-2.5 px-3">Battery</th>
                  <th className="py-2.5 px-3">Location / Vehicle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {containers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{c.container_code}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">{c.container_type}</span>
                      <span className="text-[10px] text-slate-400">{c.cooling_capability}</span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-sky-600">{c.min_temp}°C to {c.max_temp}°C</td>
                    <td className="py-2.5 px-3 font-bold">{c.current_temp}°C</td>
                    <td className="py-2.5 px-3 font-bold">{c.battery_pct}%</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {c.location_code || c.vehicle_number || 'Staging Area'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LOCATIONS TAB */}
      {activeTab === 'locations' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Warehouse Storage Hierarchy: Warehouse → Cold Room → Rack → Slot</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Slot Code</th>
                  <th className="py-2.5 px-3">Warehouse & Room</th>
                  <th className="py-2.5 px-3">Rack & Slot</th>
                  <th className="py-2.5 px-3">Thermal Spec</th>
                  <th className="py-2.5 px-3">Capacity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {locations.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-sky-600">{l.code}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 dark:text-white block">{l.warehouse_name}</span>
                      <span className="text-[11px] text-slate-400">{l.cold_room}</span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {l.rack} • {l.slot}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-600">{l.min_temp}°C to {l.max_temp}°C</td>
                    <td className="py-2.5 px-3 font-mono">{l.current_occupancy} / {l.capacity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SOPS TAB */}
      {activeTab === 'sops' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Standard Operating Procedures (SOP Library)</h3>
          <div className="space-y-3">
            {sops.map((s) => (
              <div key={s.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-sm text-slate-900 dark:text-white">{s.title}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                    {s.alert_type} • SLA: {s.escalation_minutes}m
                  </span>
                </div>
                <p className="text-slate-500 font-medium">Trigger: {s.trigger_condition}</p>
                <div className="space-y-1 pt-1">
                  {s.instructions?.map((inst, i) => (
                    <div key={i} className="text-slate-700 dark:text-slate-300 font-medium">
                      {inst}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Create New Employee Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Employee ID:</label>
                <input
                  type="text"
                  required
                  placeholder="EMP-WH-002"
                  value={newUserData.employee_id}
                  onChange={(e) => setNewUserData({ ...newUserData, employee_id: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="Suresh Kumar"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Email:</label>
                <input
                  type="email"
                  required
                  placeholder="suresh@coldchain.com"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="font-semibold block text-slate-700 dark:text-slate-300 mb-1">Operational Role:</label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="Warehouse Employee">Warehouse Employee</option>
                  <option value="Manager">Manager</option>
                  <option value="Driver">Driver</option>
                  <option value="Verification Staff">Verification Staff</option>
                  <option value="Hospital Receiver">Hospital Receiver</option>
                  <option value="Auditor">Auditor</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                >
                  Register User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
