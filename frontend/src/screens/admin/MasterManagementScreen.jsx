import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Store, Building2, ShieldCheck, Plus, Search, Edit3, Trash2,
  Key, Check, X, ChevronRight, CheckCircle2, AlertCircle, RefreshCw,
  MapPin, Phone, Shield, ArrowUpDown, UserCheck, Layers, ExternalLink,
  SlidersHorizontal, CheckSquare, Square, Globe, Lock
} from 'lucide-react';
import api from '../../config/api';
import Header from '../../shared/Header';
import ModalWrapper from '../../shared/ModalWrapper';
import { ROLES } from '../../config/roles';

export default function MasterManagementScreen({ onBack }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'locations' | 'location_types' | 'roles'
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Data states
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationTypes, setLocationTypes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [locationStatusFilter, setLocationStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // ── Modals State ──
  // 1. User Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    roleId: 2,
    branchScope: 'ALL',
    isActive: true,
    locationIds: [],
    newPassword: ''
  });

  // 2. Location Modals
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [editLocation, setEditLocation] = useState(null);
  const [editLocationForm, setEditLocationForm] = useState({
    code: '',
    name: '',
    brandName: 'Urban Burger',
    locationTypeId: 1,
    region: 'กรุงเทพฯ และปริมณฑล',
    address: '',
    phone: '',
    latitude: 13.7466,
    longitude: 100.5347,
    managerUserId: null,
    isActive: true
  });

  // 3. Location Type Modals
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [editType, setEditType] = useState(null);
  const [editTypeForm, setEditTypeForm] = useState({
    code: '',
    name: '',
    description: ''
  });

  // 4. Role Modals
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [editRoleForm, setEditRoleForm] = useState({
    name: '',
    description: '',
    permissionIds: []
  });

  // Forms states for New Creation
  const [userForm, setUserForm] = useState({
    username: '',
    fullName: '',
    password: '1234',
    roleId: 2,
    branchScope: 'ALL',
    allowedLocationIds: []
  });

  const [locationForm, setLocationForm] = useState({
    code: '',
    name: '',
    brandName: 'Urban Burger',
    locationTypeId: 1,
    region: 'กรุงเทพฯ และปริมณฑล',
    address: '',
    phone: '',
    latitude: 13.7466,
    longitude: 100.5347,
    managerUserId: null
  });

  const [typeForm, setTypeForm] = useState({
    code: '',
    name: '',
    description: ''
  });

  const [roleForm, setRoleForm] = useState({
    code: '',
    name: '',
    description: '',
    permissionIds: []
  });

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [uRes, lRes, ltRes, rRes, pRes] = await Promise.allSettled([
        api.get('/user'),
        api.get('/location'),
        api.get('/location-type'),
        api.get('/role'),
        api.get('/role/permissions')
      ]);

      if (uRes.status === 'fulfilled' && uRes.value.data) setUsers(uRes.value.data);
      if (lRes.status === 'fulfilled' && lRes.value.data) setLocations(lRes.value.data);
      if (ltRes.status === 'fulfilled' && ltRes.value.data) setLocationTypes(ltRes.value.data);
      if (rRes.status === 'fulfilled' && rRes.value.data) setRoles(rRes.value.data);
      if (pRes.status === 'fulfilled' && pRes.value.data) setAvailablePermissions(pRes.value.data);
    } catch (err) {
      console.error('Error loading master data:', err);
      showToast('ไม่สามารถโหลดข้อมูลหลักได้', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ── 👥 USER HANDLERS ──
  const handleOpenEditUser = (u) => {
    setEditUser(u);
    setEditUserForm({
      fullName: u.fullName || '',
      roleId: u.roleId || (u.role?.id) || 2,
      branchScope: u.branchScope || 'ALL',
      isActive: u.isActive !== undefined ? u.isActive : true,
      locationIds: u.locationIds || [],
      newPassword: ''
    });
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!editUser || !editUserForm.fullName.trim()) return;

    try {
      // 1. Update Profile & Role & Branch Scope
      await api.put(`/user/${editUser.id}`, {
        fullName: editUserForm.fullName,
        roleId: editUserForm.roleId,
        branchScope: editUserForm.branchScope,
        isActive: editUserForm.isActive,
        locationIds: editUserForm.branchScope === 'SPECIFIC' ? editUserForm.locationIds : []
      });

      // 2. If newPassword is provided, reset password
      if (editUserForm.newPassword && editUserForm.newPassword.trim()) {
        await api.post(`/user/${editUser.id}/reset-password`, {
          newPassword: editUserForm.newPassword.trim()
        });
      }

      showToast(`✓ บันทึกการแก้ไข "${editUserForm.fullName}" สำเร็จ`);
      setEditUser(null);
      loadAllData();
    } catch (err) {
      showToast('แก้ไขข้อมูลผู้ใช้ไม่สำเร็จ', true);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.username || !userForm.fullName) return;

    try {
      await api.post('/user', userForm);
      showToast(`✓ สร้างบัญชีผู้ใช้ "${userForm.fullName}" สำเร็จ`);
      setShowAddUserModal(false);
      setUserForm({
        username: '',
        fullName: '',
        password: '1234',
        roleId: 2,
        branchScope: 'ALL',
        allowedLocationIds: []
      });
      loadAllData();
    } catch (err) {
      showToast(err.response?.data?.message || 'สร้างผู้ใช้ไม่สำเร็จ (อาจมี Username ซ้ำ)', true);
    }
  };

  // ── 🏬 LOCATION HANDLERS ──
  const handleOpenEditLocation = (loc) => {
    setEditLocation(loc);
    setEditLocationForm({
      code: loc.code || '',
      name: loc.name || '',
      brandName: loc.brandName || 'Urban Burger',
      locationTypeId: loc.locationTypeId || 1,
      region: loc.region || 'กรุงเทพฯ และปริมณฑล',
      address: loc.address || '',
      phone: loc.phone || '',
      latitude: loc.latitude || 13.7466,
      longitude: loc.longitude || 100.5347,
      managerUserId: loc.managerUserId || null,
      isActive: loc.isActive !== undefined ? loc.isActive : true
    });
  };

  const handleSaveEditLocation = async (e) => {
    e.preventDefault();
    if (!editLocation || !editLocationForm.name.trim()) return;

    try {
      await api.put(`/location/${editLocation.id}`, {
        id: editLocation.id,
        ...editLocationForm
      });
      showToast(`✓ บันทึกสถานที่ "${editLocationForm.name}" สำเร็จ`);
      setEditLocation(null);
      loadAllData();
    } catch (err) {
      showToast('แก้ไขสถานที่/สาขาไม่สำเร็จ', true);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    if (!locationForm.code || !locationForm.name) return;

    try {
      await api.post('/location', locationForm);
      showToast(`✓ เพิ่มสถานที่/สาขา "${locationForm.name}" สำเร็จ`);
      setShowAddLocationModal(false);
      setLocationForm({
        code: '',
        name: '',
        brandName: 'Urban Burger',
        locationTypeId: locationTypes[0]?.id || 1,
        region: 'กรุงเทพฯ และปริมณฑล',
        address: '',
        phone: '',
        latitude: 13.7466,
        longitude: 100.5347,
        managerUserId: null
      });
      loadAllData();
    } catch (err) {
      showToast('เพิ่มสถานที่/สาขาไม่สำเร็จ', true);
    }
  };

  // ── 🏷️ LOCATION TYPE HANDLERS ──
  const handleOpenEditType = (t) => {
    setEditType(t);
    setEditTypeForm({
      code: t.code || '',
      name: t.name || '',
      description: t.description || ''
    });
  };

  const handleSaveEditType = async (e) => {
    e.preventDefault();
    if (!editType || !editTypeForm.name.trim()) return;

    try {
      await api.put(`/location-type/${editType.id}`, {
        id: editType.id,
        code: editTypeForm.code,
        name: editTypeForm.name,
        description: editTypeForm.description,
        isActive: true
      });
      showToast(`✓ บันทึกประเภทสถานที่ "${editTypeForm.name}" สำเร็จ`);
      setEditType(null);
      loadAllData();
    } catch (err) {
      showToast('แก้ไขประเภทสถานที่ไม่สำเร็จ', true);
    }
  };

  const handleCreateLocationType = async (e) => {
    e.preventDefault();
    if (!typeForm.code || !typeForm.name) return;

    try {
      await api.post('/location-type', typeForm);
      showToast(`✓ เพิ่มประเภทสถานที่ "${typeForm.name}" สำเร็จ`);
      setShowAddTypeModal(false);
      setTypeForm({ code: '', name: '', description: '' });
      loadAllData();
    } catch (err) {
      showToast('เพิ่มประเภทสถานที่ไม่สำเร็จ', true);
    }
  };

  // ── 🛡️ ROLE & PERMISSION HANDLERS ──
  const handleOpenEditRole = (r) => {
    setEditRole(r);
    setEditRoleForm({
      name: r.name || '',
      description: r.description || '',
      permissionIds: r.permissionIds || []
    });
  };

  const handleSaveEditRole = async (e) => {
    e.preventDefault();
    if (!editRole || !editRoleForm.name.trim()) return;

    try {
      await api.put(`/role/${editRole.id}`, {
        code: editRole.code,
        name: editRoleForm.name,
        description: editRoleForm.description,
        permissionIds: editRoleForm.permissionIds
      });
      showToast(`✓ บันทึกสิทธิ์บทบาท "${editRoleForm.name}" สำเร็จ`);
      setEditRole(null);
      loadAllData();
    } catch (err) {
      showToast('แก้ไขสิทธิ์บทบาทไม่สำเร็จ', true);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!roleForm.code || !roleForm.name) return;

    try {
      await api.post('/role', roleForm);
      showToast(`✓ สร้างบทบาทใหม่ "${roleForm.name}" สำเร็จ`);
      setShowAddRoleModal(false);
      setRoleForm({ code: '', name: '', description: '', permissionIds: [] });
      loadAllData();
    } catch (err) {
      showToast('สร้างบทบาทไม่สำเร็จ', true);
    }
  };

  const togglePermissionForRole = (permId) => {
    setEditRoleForm(prev => {
      const exists = prev.permissionIds.includes(permId);
      return {
        ...prev,
        permissionIds: exists ? prev.permissionIds.filter(id => id !== permId) : [...prev.permissionIds, permId]
      };
    });
  };

  // ── Filtered lists ──
  const filteredUsers = useMemo(() => {
    let list = users;
    if (userStatusFilter === 'ACTIVE') list = list.filter(u => u.isActive);
    if (userStatusFilter === 'INACTIVE') list = list.filter(u => !u.isActive);

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.fullName?.toLowerCase().includes(q) ||
      u.role?.name?.toLowerCase().includes(q) ||
      u.role?.code?.toLowerCase().includes(q) ||
      u.roleName?.toLowerCase().includes(q) ||
      u.roleCode?.toLowerCase().includes(q)
    );
  }, [users, searchTerm, userStatusFilter]);

  const filteredLocations = useMemo(() => {
    let list = locations;
    if (locationStatusFilter === 'ACTIVE') list = list.filter(l => l.isActive);
    if (locationStatusFilter === 'INACTIVE') list = list.filter(l => !l.isActive);

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(l =>
      l.code?.toLowerCase().includes(q) ||
      l.name?.toLowerCase().includes(q) ||
      l.region?.toLowerCase().includes(q) ||
      l.locationType?.name?.toLowerCase().includes(q)
    );
  }, [locations, searchTerm, locationStatusFilter]);

  const filteredTypes = useMemo(() => {
    if (!searchTerm.trim()) return locationTypes;
    const q = searchTerm.toLowerCase();
    return locationTypes.filter(t =>
      t.code?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  }, [locationTypes, searchTerm]);

  const filteredRoles = useMemo(() => {
    if (!searchTerm.trim()) return roles;
    const q = searchTerm.toLowerCase();
    return roles.filter(r =>
      r.code?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  }, [roles, searchTerm]);

  return (
    <div className="page-transition p-3.5 sm:p-6 space-y-4 w-full max-w-[100%] sm:max-w-[96%] md:max-w-[92%] mx-auto pb-28 lg:pb-12" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>
      
      {/* Toast alert */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[10000] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-sm font-bold border animate-in fade-in slide-in-from-top-2 ${
          toast.isError ? 'bg-rose-900 text-white border-rose-500' : 'bg-[#1C2129] text-white border-emerald-500'
        }`}>
          {toast.isError ? <AlertCircle size={18} className="text-rose-400 shrink-0" /> : <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <Header
        title="ศูนย์การจัดการข้อมูลระบบ (Master Management)"
        subtitle="สร้างและแก้ไขข้อมูลผู้ใช้งาน, สถานที่/สาขา, ประเภทสถานที่ และสิทธิ์บทบาท"
        onBack={onBack}
        action={
          <button
            type="button"
            onClick={loadAllData}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs cursor-pointer active:scale-95 transition-all"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#0F6659]" : "text-slate-400"} />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        }
      />

      {/* ── 🌟 4 CATEGORY TABS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { key: 'users', label: 'ผู้ใช้งาน (Users)', count: users.length, icon: Users },
          { key: 'locations', label: 'สถานที่/สาขา (Locations)', count: locations.length, icon: Store },
          { key: 'location_types', label: 'ประเภทสถานที่ (Types)', count: locationTypes.length, icon: Building2 },
          { key: 'roles', label: 'บทบาทและสิทธิ์ (Roles)', count: roles.length, icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setSearchTerm('');
              }}
              className={`p-4 rounded-2xl border text-left cursor-pointer transition-all active:scale-98 flex flex-col justify-between gap-2.5 shadow-2xs ${
                isActive
                  ? 'bg-white border-[#0F6659] ring-2 ring-emerald-500/30 shadow-md'
                  : 'bg-white/80 hover:bg-white border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? 'bg-[#0F6659] text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                  {tab.count}
                </span>
              </div>
              <div>
                <div className={`text-xs sm:text-sm font-black leading-tight ${isActive ? 'text-[#0F6659]' : 'text-slate-800'}`}>
                  {tab.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 👥 TAB 1: USERS MANAGEMENT ── */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อผู้ใช้, ชื่อ-นามสกุล, หรือบทบาท..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} />
              <span>เพิ่มผู้ใช้งานใหม่</span>
            </button>
          </div>

          {/* Quick Status Filter Pills for Users */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'ALL', label: `ทั้งหมด (${users.length})` },
              { id: 'ACTIVE', label: `🟢 ใช้งานอยู่ (${users.filter(u => u.isActive).length})` },
              { id: 'INACTIVE', label: `🔴 ระงับการใช้งาน (${users.filter(u => !u.isActive).length})` },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setUserStatusFilter(pill.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  userStatusFilter === pill.id
                    ? 'bg-[#0F6659] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredUsers.map((u) => {
              const isActive = u.isActive !== false;
              return (
                <div
                  key={u.id}
                  onClick={() => handleOpenEditUser(u)}
                  className={`p-4 rounded-2xl border transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-98 flex flex-col justify-between gap-3.5 group ${
                    isActive
                      ? 'border-slate-200 hover:border-[#0F6659] bg-white'
                      : 'border-slate-300/80 bg-slate-50/70 hover:border-[#0F6659] hover:bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-2xs shrink-0 ${
                          isActive
                            ? 'bg-gradient-to-tr from-[#0F6659] to-[#15806e] text-white'
                            : 'bg-slate-300 text-slate-600'
                        }`}>
                          {(u.fullName || u.username).substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-black truncate group-hover:text-[#0F6659] transition-colors ${
                            isActive ? 'text-slate-900' : 'text-slate-600'
                          }`}>
                            {u.fullName}
                          </div>
                          <div className="text-xs font-mono text-slate-400 truncate">@{u.username}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}>
                          {u.roleName || u.role?.name || u.roleCode || u.role?.code}
                        </span>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">ขอบเขตสาขา:</span>
                        <span className="font-extrabold text-slate-800">
                          {u.branchScope === 'SPECIFIC' ? `เฉพาะที่กำหนด (${u.locationIds?.length || 0} สาขา)` : 'ทุกสาขาในองค์กร'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 group-hover:text-[#0F6659] font-bold transition-colors">
                      {isActive ? 'แตะเพื่อแก้ไข' : 'แตะเพื่อเปิดใช้งาน / แก้ไข'}
                    </span>
                    <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                      isActive
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-rose-700 bg-rose-50 border-rose-200'
                    }`}>
                      {isActive ? '✓ ใช้งานอยู่' : '✕ ระงับการใช้งาน'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 🏬 TAB 2: LOCATIONS MANAGEMENT ── */}
      {activeTab === 'locations' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหารหัสสาขา, ชื่อสาขา, หรือภูมิภาค..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddLocationModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} />
              <span>เพิ่มสถานที่/สาขาใหม่</span>
            </button>
          </div>

          {/* Quick Status Filter Pills for Locations */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'ALL', label: `ทั้งหมด (${locations.length})` },
              { id: 'ACTIVE', label: `🟢 เปิดให้บริการ (${locations.filter(l => l.isActive).length})` },
              { id: 'INACTIVE', label: `🔴 ปิดปรับปรุง/ระงับ (${locations.filter(l => !l.isActive).length})` },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setLocationStatusFilter(pill.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                  locationStatusFilter === pill.id
                    ? 'bg-[#0F6659] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredLocations.map((loc) => {
              const isActive = loc.isActive !== false;
              return (
                <div
                  key={loc.id}
                  onClick={() => handleOpenEditLocation(loc)}
                  className={`p-4.5 rounded-2xl border transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-98 space-y-3.5 flex flex-col justify-between group ${
                    isActive
                      ? 'border-slate-200 hover:border-[#0F6659] bg-white'
                      : 'border-slate-300/80 bg-slate-50/70 hover:border-[#0F6659] hover:bg-white'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-slate-400 block">{loc.code}</span>
                        <h4 className={`text-base font-black group-hover:text-[#0F6659] transition-colors ${
                          isActive ? 'text-slate-900' : 'text-slate-600'
                        }`}>{loc.name}</h4>
                        <p className="text-xs text-slate-500 font-medium">{loc.brandName || "Urban Burger"}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                          {loc.locationType?.name || loc.locationType?.code || "STORE"}
                        </span>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 space-y-2 pt-2.5 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{loc.region} · {loc.address || "กรุงเทพฯ"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span>{loc.phone || "02-999-9999"}</span>
                      </div>
                      {loc.managerUser && (
                        <div className="flex items-center gap-2">
                          <UserCheck size={14} className="text-emerald-600 shrink-0" />
                          <span className="font-semibold">ผู้จัดการ: {loc.managerUser.fullName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold">คะแนน: </span>
                      <span className="text-emerald-800 font-mono font-black text-sm">{loc.lastScore ? `${loc.lastScore}%` : "ยังไม่ตรวจ"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 group-hover:text-[#0F6659] font-extrabold transition-colors">
                        {isActive ? 'แตะเพื่อแก้ไข' : 'แตะเพื่อเปิดใช้งาน'}
                      </span>
                      {!isActive && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          ✕ ระงับ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 🏷️ TAB 3: LOCATION TYPES MANAGEMENT ── */}
      {activeTab === 'location_types' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหารหัส หรือชื่อประเภทสถานที่..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddTypeModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} />
              <span>เพิ่มประเภทสถานที่</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {filteredTypes.map((t) => (
              <div
                key={t.id}
                onClick={() => handleOpenEditType(t)}
                className="p-4.5 rounded-2xl border border-slate-200 hover:border-[#0F6659] bg-white transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-98 space-y-2.5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      {t.code}
                    </span>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 group-hover:text-[#0F6659] transition-colors mt-2.5">{t.name}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">{t.description || "ประเภทสถานที่มาตรฐาน Q.S.C."}</p>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                  <span className="group-hover:text-[#0F6659] font-extrabold transition-colors">แตะเพื่อแก้ไข</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 🛡️ TAB 4: ROLES & PERMISSIONS ── */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อบทบาท หรือสิทธิ์..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:border-[#0F6659] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAddRoleModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} />
              <span>เพิ่มบทบาทใหม่</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredRoles.map((r) => (
              <div
                key={r.id}
                onClick={() => handleOpenEditRole(r)}
                className="p-4.5 rounded-2xl border border-slate-200 hover:border-purple-500 bg-white transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-98 space-y-3.5 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-900 bg-purple-100 px-2.5 py-1 rounded-md border border-purple-200 font-mono">
                      {r.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Shield size={18} className="text-purple-600" />
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <h4 className="text-base font-black text-slate-900 group-hover:text-purple-700 transition-colors">{r.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">{r.description || "บทบาทการทำงานในระบบ"}</p>
                  </div>
                  <div className="pt-2.5 border-t border-slate-100 mt-2">
                    <span className="text-xs font-extrabold text-slate-400">สิทธิ์ที่เปิดใช้งาน ({r.permissions?.length || 0}):</span>
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-28 overflow-y-auto">
                      {(r.permissions || []).map((p, i) => (
                        <span key={i} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                          ✓ {p}
                        </span>
                      ))}
                      {(!r.permissions || r.permissions.length === 0) && (
                        <span className="text-xs text-slate-400">สิทธิ์มาตรฐานตามบทบาท</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex justify-between text-xs text-slate-400">
                  <span className="group-hover:text-purple-700 font-extrabold transition-colors">แตะเพื่อจัดการสิทธิ์</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 🌟 CENTERED FIXED MODALS: CLEAN, SOFT COLORS & NON-BOLD DESIGN ── */}

      {/* 1. MODAL: EDIT USER */}
      {editUser && (
        <ModalWrapper onClose={() => setEditUser(null)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">แก้ไขข้อมูลผู้ใช้งาน</h3>
                  <span className="text-xs font-mono text-slate-400">@{editUser.username}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveEditUser} className="space-y-4 overflow-y-auto flex-1 pr-1">
              
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ชื่อ-นามสกุล (Full Name) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={editUserForm.fullName}
                  onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs placeholder:text-slate-300"
                  placeholder="เช่น นายสมศักดิ์ มั่นคง"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  บทบาทในระบบ (Role) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={editUserForm.roleId}
                  onChange={(e) => setEditUserForm({ ...editUserForm, roleId: parseInt(e.target.value) })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                  {roles.length === 0 && (
                    <>
                      <option value={1}>ผู้ดูแลระบบ (ADMIN)</option>
                      <option value={2}>ผู้ตรวจหน้างาน (AUDITOR)</option>
                      <option value={3}>ผู้รับการตรวจ/ผู้จัดการสาขา (AUDITEE)</option>
                      <option value={4}>ผู้ดูแลมาตรฐาน (STANDARD)</option>
                      <option value={5}>ผู้บริหาร (EXEC)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ขอบเขตสาขาที่เข้าถึงได้ (Branch Scope)
                </label>
                <select
                  value={editUserForm.branchScope}
                  onChange={(e) => setEditUserForm({ ...editUserForm, branchScope: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs cursor-pointer"
                >
                  <option value="ALL">🌐 เข้าถึงได้ทุกสาขาในองค์กร (ALL)</option>
                  <option value="SPECIFIC">🎯 เฉพาะสาขาที่กำหนด (SPECIFIC)</option>
                </select>
              </div>

              {/* Specific Locations Selection */}
              {editUserForm.branchScope === 'SPECIFIC' && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <label className="block text-sm font-medium text-slate-600">เลือกสาขาที่ได้รับอนุญาต:</label>
                  <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-200 p-2.5 space-y-1.5 bg-slate-50">
                    {locations.map(loc => {
                      const isSelected = editUserForm.locationIds.includes(loc.id);
                      return (
                        <button
                          type="button"
                          key={loc.id}
                          onClick={() => {
                            const exists = editUserForm.locationIds.includes(loc.id);
                            setEditUserForm({
                              ...editUserForm,
                              locationIds: exists ? editUserForm.locationIds.filter(id => id !== loc.id) : [...editUserForm.locationIds, loc.id]
                            });
                          }}
                          className={`w-full p-3 rounded-xl text-left text-sm font-normal flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected ? 'bg-emerald-50 text-[#0F6659] border border-emerald-200 font-medium' : 'bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{loc.code} - {loc.name}</span>
                          {isSelected ? <CheckSquare size={18} className="text-[#0F6659] shrink-0" /> : <Square size={18} className="text-slate-300 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 🔑 Integrated Password Reset Section */}
              <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Key size={17} className="text-[#0F6659]" />
                  <span>รีเซ็ตรหัสผ่านใหม่ (Reset Password)</span>
                </div>
                <input
                  type="text"
                  placeholder="กรอกรหัสผ่านใหม่ (ปล่อยว่างถ้าไม่ต้องการเปลี่ยน)"
                  value={editUserForm.newPassword || ''}
                  onChange={(e) => setEditUserForm({ ...editUserForm, newPassword: e.target.value })}
                  className="w-full px-4.5 py-3 rounded-xl bg-white border border-slate-200 text-sm sm:text-base font-mono font-normal text-slate-500 focus:text-slate-800 focus:border-[#0F6659] outline-none shadow-xs placeholder:text-slate-300"
                />
                <p className="text-xs text-slate-400 font-normal leading-relaxed">
                  * หากต้องการเปลี่ยนรหัสผ่าน ให้กรอกรหัสใหม่ในช่องนี้ ระบบจะอัปเดตให้ทันทีที่กดบันทึก
                </p>
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200">
                <div>
                  <div className="text-sm font-medium text-slate-700">สถานะการใช้งานบัญชี</div>
                  <div className="text-xs text-slate-400 font-normal mt-0.5">
                    {editUserForm.isActive ? 'เปิดใช้งานปกติ (สามารถเข้าสู่ระบบได้)' : 'ระงับการใช้งานชั่วคราว'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editUserForm.isActive}
                  onClick={() => setEditUserForm({ ...editUserForm, isActive: !editUserForm.isActive })}
                  className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[#0F6659]/20 ${
                    editUserForm.isActive ? 'bg-[#0F6659]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      editUserForm.isActive ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sticky Modal Action Footer */}
              <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  บันทึกการเปลี่ยนแปลง
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* 2. MODAL: CREATE USER */}
      {showAddUserModal && (
        <ModalWrapper onClose={() => setShowAddUserModal(false)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Plus size={22} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">เพิ่มผู้ใช้งานใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ชื่อผู้ใช้งาน (Username) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs placeholder:text-slate-300"
                  placeholder="เช่น somsak_bkk"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ชื่อ-นามสกุล (Full Name) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs placeholder:text-slate-300"
                  placeholder="เช่น นายสมศักดิ์ มั่นคง"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  รหัสผ่านเริ่มต้น <span className="text-rose-400">*</span>
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs placeholder:text-slate-300"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  บทบาท (Role) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={userForm.roleId}
                  onChange={(e) => setUserForm({ ...userForm, roleId: parseInt(e.target.value) })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ขอบเขตสาขา
                </label>
                <select
                  value={userForm.branchScope}
                  onChange={(e) => setUserForm({ ...userForm, branchScope: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs cursor-pointer"
                >
                  <option value="ALL">🌐 เข้าถึงได้ทุกสาขา (องค์กร)</option>
                  <option value="SPECIFIC">🎯 เฉพาะสาขาที่กำหนด</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  บันทึกผู้ใช้
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* 3. MODAL: EDIT LOCATION */}
      {editLocation && (
        <ModalWrapper onClose={() => setEditLocation(null)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Store size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">แก้ไขสถานที่ / สาขา</h3>
                  <span className="text-xs font-mono text-slate-400">{editLocation.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditLocation(null)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditLocation} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">รหัสสาขา *</label>
                  <input
                    type="text"
                    value={editLocationForm.code}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-mono font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ประเภทสถานที่ *</label>
                  <select
                    value={editLocationForm.locationTypeId}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, locationTypeId: parseInt(e.target.value) })}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs cursor-pointer"
                  >
                    {locationTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อสถานที่/สาขา *</label>
                <input
                  type="text"
                  value={editLocationForm.name}
                  onChange={(e) => setEditLocationForm({ ...editLocationForm, name: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">แบรนด์</label>
                <input
                  type="text"
                  value={editLocationForm.brandName}
                  onChange={(e) => setEditLocationForm({ ...editLocationForm, brandName: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ภูมิภาค / เขต</label>
                <input
                  type="text"
                  value={editLocationForm.region}
                  onChange={(e) => setEditLocationForm({ ...editLocationForm, region: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ที่อยู่สถานที่</label>
                <input
                  type="text"
                  value={editLocationForm.address}
                  onChange={(e) => setEditLocationForm({ ...editLocationForm, address: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">เบอร์โทรติดต่อ</label>
                  <input
                    type="text"
                    value={editLocationForm.phone}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, phone: e.target.value })}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ผู้จัดการประจำสาขา</label>
                  <select
                    value={editLocationForm.managerUserId || ''}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, managerUserId: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs cursor-pointer"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {users.filter(u => u.roleCode === 'AUDITEE' || u.roleId === 3 || u.role?.code === 'AUDITEE').map(u => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Active Toggle Switch for Location */}
              <div className="flex items-center justify-between p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200">
                <div>
                  <div className="text-sm font-medium text-slate-700">สถานะเปิดให้บริการ</div>
                  <div className="text-xs text-slate-400 font-normal mt-0.5">
                    {editLocationForm.isActive ? 'เปิดให้บริการตามปกติ' : 'ปิดปรับปรุง / ระงับชั่วคราว'}
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editLocationForm.isActive}
                  onClick={() => setEditLocationForm({ ...editLocationForm, isActive: !editLocationForm.isActive })}
                  className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-[#0F6659]/20 ${
                    editLocationForm.isActive ? 'bg-[#0F6659]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      editLocationForm.isActive ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setEditLocation(null)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  บันทึกสถานที่
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* 4. MODAL: CREATE LOCATION */}
      {showAddLocationModal && (
        <ModalWrapper onClose={() => setShowAddLocationModal(false)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Plus size={22} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">เพิ่มสถานที่ / สาขาใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLocationModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">รหัสสาขา *</label>
                  <input
                    type="text"
                    value={locationForm.code}
                    onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-mono font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                    placeholder="BKK-006"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ประเภทสถานที่ *</label>
                  <select
                    value={locationForm.locationTypeId}
                    onChange={(e) => setLocationForm({ ...locationForm, locationTypeId: parseInt(e.target.value) })}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs cursor-pointer"
                  >
                    {locationTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อสถานที่/สาขา *</label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  placeholder="สาขาไอคอนสยาม"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ภูมิภาค / เขต</label>
                <input
                  type="text"
                  value={locationForm.region}
                  onChange={(e) => setLocationForm({ ...locationForm, region: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  placeholder="กรุงเทพฯ และปริมณฑล"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ที่อยู่สถานที่</label>
                <input
                  type="text"
                  value={locationForm.address}
                  onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  placeholder="ชั้น G โซน Veranda ถ.เจริญนคร"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">เบอร์โทรติดต่อ</label>
                  <input
                    type="text"
                    value={locationForm.phone}
                    onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                    placeholder="02-495-7000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ผู้จัดการประจำสาขา</label>
                  <select
                    value={locationForm.managerUserId || ''}
                    onChange={(e) => setLocationForm({ ...locationForm, managerUserId: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs cursor-pointer"
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {users.filter(u => u.role?.code === 'AUDITEE' || u.roleId === 3).map(u => (
                      <option key={u.id} value={u.id}>{u.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddLocationModal(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  บันทึกสถานที่
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* 5. MODAL: EDIT LOCATION TYPE */}
      {editType && (
        <ModalWrapper onClose={() => setEditType(null)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">แก้ไขประเภทสถานที่</h3>
                  <span className="text-xs font-mono text-slate-400">{editType.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditType(null)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditType} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">รหัสประเภท (Type Code) *</label>
                <input
                  type="text"
                  value={editTypeForm.code}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-mono font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อประเภทภาษาไทย *</label>
                <input
                  type="text"
                  value={editTypeForm.name}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, name: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">คำอธิบาย</label>
                <textarea
                  value={editTypeForm.description}
                  onChange={(e) => setEditTypeForm({ ...editTypeForm, description: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setEditType(null)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  บันทึกประเภท
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* 6. MODAL: CREATE LOCATION TYPE */}
      {showAddTypeModal && (
        <ModalWrapper onClose={() => setShowAddTypeModal(false)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Plus size={22} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">เพิ่มประเภทสถานที่ใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTypeModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLocationType} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">รหัสประเภท (Type Code) *</label>
                <input
                  type="text"
                  value={typeForm.code}
                  onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-mono font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  placeholder="เช่น FOOD_TRUCK หรือ KIOSK"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อประเภทภาษาไทย *</label>
                <input
                  type="text"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  placeholder="เช่น รถจำหน่ายอาหาร (Food Truck)"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">คำอธิบาย</label>
                <textarea
                  value={typeForm.description}
                  onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-medium text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  rows={3}
                  placeholder="ระบุรายละเอียดลักษณะของประเภทสถานที่นี้..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddTypeModal(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  บันทึกประเภท
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* 7. MODAL: EDIT ROLE */}
      {editRole && (
        <ModalWrapper onClose={() => setEditRole(null)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Shield size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">กำหนดสิทธิ์บทบาท</h3>
                  <span className="text-xs font-mono text-purple-700 bg-purple-100 px-2 py-0.5 rounded font-bold">{editRole.code}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditRole(null)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditRole} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อบทบาทภาษาไทย *</label>
                <input
                  type="text"
                  value={editRoleForm.name}
                  onChange={(e) => setEditRoleForm({ ...editRoleForm, name: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">คำอธิบายบทบาท</label>
                <input
                  type="text"
                  value={editRoleForm.description}
                  onChange={(e) => setEditRoleForm({ ...editRoleForm, description: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">สิทธิ์การเข้าถึงโมดูล (Permissions Matrix):</label>
                <div className="max-h-52 overflow-y-auto rounded-2xl border border-slate-200 p-2.5 space-y-2 bg-slate-50">
                  {availablePermissions.map(p => {
                    const isChecked = editRoleForm.permissionIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => togglePermissionForRole(p.id)}
                        className={`w-full p-3.5 rounded-xl text-left text-sm font-normal flex items-center justify-between transition-colors cursor-pointer ${
                          isChecked ? 'bg-purple-50 text-purple-900 border border-purple-200 font-medium' : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="text-sm sm:text-base font-medium text-slate-800">{p.name}</div>
                          <div className="text-xs text-slate-400 font-mono truncate">{p.code} · {p.module}</div>
                        </div>
                        {isChecked ? <CheckSquare size={18} className="text-purple-700 shrink-0" /> : <Square size={18} className="text-slate-300 shrink-0" />}
                      </button>
                    );
                  })}
                  {availablePermissions.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-400 font-normal">
                      กำลังโหลดรายการสิทธิ์...
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setEditRole(null)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  บันทึกสิทธิ์บทบาท
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* 8. MODAL: CREATE ROLE */}
      {showAddRoleModal && (
        <ModalWrapper onClose={() => setShowAddRoleModal(false)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Plus size={22} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">เพิ่มบทบาทใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">รหัสบทบาท (Role Code) *</label>
                <input
                  type="text"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-mono font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  placeholder="เช่น REGIONAL_MANAGER"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อบทบาทภาษาไทย *</label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  placeholder="เช่น ผู้จัดการเขตพื้นที่"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">คำอธิบาย</label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  rows={2}
                  placeholder="ระบุหน้าที่ความรับผิดชอบ..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-sm font-bold text-slate-600 cursor-pointer transition-all active:scale-98"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-[#0F6659] hover:bg-emerald-800 text-sm font-bold text-white shadow-md cursor-pointer active:scale-98 transition-all"
                >
                  บันทึกบทบาท
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

    </div>
  );
}
