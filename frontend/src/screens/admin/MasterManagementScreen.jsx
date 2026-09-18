import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Users, Store, Building2, ShieldCheck, Plus, Search, Key, Check, X, ChevronRight, CheckCircle2, AlertCircle, RefreshCw, Shield, SlidersHorizontal, CheckSquare, Square, ArrowLeft, ChevronDown, ChevronUp, Smartphone, Tag, Eye, EyeOff } from "lucide-react";
import api from '../../config/api';
import Header from '../../shared/Header';
import ModalWrapper from '../../shared/ModalWrapper';
import { ROLES, getRoleNavConfig, NAV_MODULES_DICT } from '../../config/roles';
import authStorage from '../../config/storage';
import RoleNavCustomizerModal from './RoleNavCustomizerModal';
import { DataContext } from '../../context/DataContext';
import UserManagementTab from './components/UserManagementTab';
import LocationManagementTab from './components/LocationManagementTab';
import LocationGpsSection from './components/LocationGpsSection';
import BrandChipSelector from '../../shared/BrandChipSelector';
import BrandManagementTab from './components/BrandManagementTab';

export default function MasterManagementScreen({ onBack }) {
  const { refreshData } = React.useContext(DataContext);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'locations' | 'location_types' | 'roles'
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Data states
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [brands, setBrands] = useState([]); // [{id, code, name, description, isActive}]
  const activeBrands = useMemo(() => brands.filter(b => b.isActive !== false), [brands]);
  const [locationTypes, setLocationTypes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);

  // Filter, Search, Pagination & Status
  const [searchTerm, setSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL'); // 'ALL' | roleId / roleCode
  const [locationStatusFilter, setLocationStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [locationBrandFilter, setLocationBrandFilter] = useState([]); // string[] ว่าง = ทุกแบรนด์
  const [userPage, setUserPage] = useState(1);
  const [locationPage, setLocationPage] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const pageSize = 10;

  // ── Modals State ──
  // 1. User Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    roleId: 2,
    branchScope: 'ALL',
    brandScope: 'ALL',
    allowedBrandIds: [],
    isActive: true,
    locationIds: [],
    newPassword: ''
  });

  // 1.1 Branch Selector Sub-Modal (จัดการสาขาที่ได้รับอนุญาต)
  const [showBranchSelectorModal, setShowBranchSelectorModal] = useState(false);
  const [branchSelectorTarget, setBranchSelectorTarget] = useState('edit'); // 'edit' | 'create'
  const [tempBranchLocationIds, setTempBranchLocationIds] = useState([]);
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  const [branchRegionFilter, setBranchRegionFilter] = useState('ALL');
  const [branchShowSelectedOnly, setBranchShowSelectedOnly] = useState(false);
  const [collapsedRegions, setCollapsedRegions] = useState({});

  // 2. Location Modals
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [editLocation, setEditLocation] = useState(null);
  const [isCustomRegionAdd, setIsCustomRegionAdd] = useState(false);
  const [isCustomRegionEdit, setIsCustomRegionEdit] = useState(false);

  const existingRegions = useMemo(() => {
    const set = new Set();
    locations.forEach(l => {
      if (l.region && l.region.trim()) set.add(l.region.trim());
    });
    if (set.size === 0) {
      set.add('กรุงเทพฯ และปริมณฑล');
      set.add('ภาคกลาง');
      set.add('ภาคเหนือ');
      set.add('ภาคตะวันออกเฉียงเหนือ');
      set.add('ภาคใต้');
      set.add('ภาคตะวันออก');
    }
    return Array.from(set).sort();
  }, [locations]);

  const [editLocationForm, setEditLocationForm] = useState({
    code: '',
    name: '',
    boundBrandIds: [],
    locationTypeId: 1,
    region: '',
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
  const [customizingNavRole, setCustomizingNavRole] = useState(null);

  const handleOpenNavCustomizer = (role, e) => {
    e?.stopPropagation();
    setCustomizingNavRole(role);
  };

  const handleSaveNavSuccess = (updatedRole, newNavConfig) => {
    showToast(`✓ บันทึกการตั้งค่าแถบเมนูสำหรับบทบาท "${updatedRole.name || updatedRole.code}" สำเร็จ`);
    setCustomizingNavRole(null);
    loadAllData(true);

    // If the logged-in user shares the updated role, synchronize their session immediately
    const currentUser = authStorage.getUser();
    if (currentUser && (currentUser.role === updatedRole.code || currentUser.roleId === updatedRole.id)) {
      const updatedUser = {
        ...currentUser,
        navConfig: newNavConfig,
        navConfigJson: JSON.stringify(newNavConfig)
      };
      authStorage.setUser(updatedUser);
    }
  };

  // Forms states for New Creation
  const [userForm, setUserForm] = useState({
    username: '',
    fullName: '',
    password: '1234',
    roleId: 2,
    branchScope: 'ALL',
    brandScope: 'ALL',
    allowedBrandIds: [],
    allowedLocationIds: []
  });

  const [locationForm, setLocationForm] = useState({
    code: '',
    name: '',
    boundBrandIds: [],
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

  const loadAllData = async (syncGlobal = false) => {
    setLoading(true);
    setLoadError(false);
    try {
      const [uRes, lRes, ltRes, rRes, pRes, bRes] = await Promise.allSettled([
        api.get('/user'),
        api.get('/location'),
        api.get('/location-type'),
        api.get('/role'),
        api.get('/role/permissions'),
        api.get('/brand')
      ]);

      const anySuccess = [uRes, lRes, ltRes, rRes, pRes, bRes].some(r => r.status === 'fulfilled');
      if (!anySuccess) {
        setLoadError(true);
      }

      if (uRes.status === 'fulfilled' && uRes.value.data) setUsers(uRes.value.data);
      if (lRes.status === 'fulfilled' && lRes.value.data) setLocations(lRes.value.data);
      if (bRes.status === 'fulfilled' && bRes.value.data) setBrands(bRes.value.data);
      if (ltRes.status === 'fulfilled' && ltRes.value.data) {
        setLocationTypes(ltRes.value.data);
        if (ltRes.value.data.length > 0) {
          setLocationForm(prev => ({
            ...prev,
            locationTypeId: prev.locationTypeId && ltRes.value.data.some(t => t.id === prev.locationTypeId) ? prev.locationTypeId : ltRes.value.data[0].id
          }));
        }
      }
      if (rRes.status === 'fulfilled' && rRes.value.data) {
        setRoles(rRes.value.data);
        if (rRes.value.data.length > 0) {
          setUserForm(prev => ({
            ...prev,
            roleId: prev.roleId && rRes.value.data.some(r => r.id === prev.roleId) ? prev.roleId : rRes.value.data[0].id
          }));
        }
      }
      if (pRes.status === 'fulfilled' && pRes.value.data) {
        const sortedPerms = [...pRes.value.data].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        setAvailablePermissions(sortedPerms);
      }
      if (syncGlobal && anySuccess && refreshData) {
        refreshData();
      }
    } catch (err) {
      console.error('Error loading master data:', err);
      setLoadError(true);
      showToast('ไม่สามารถโหลดข้อมูลหลักได้', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData(false);
  }, []);

  // ── 👥 USER HANDLERS ──
  const handleOpenEditUser = (u) => {
    setEditUser(u);
    setEditUserForm({
      fullName: u.fullName || '',
      roleId: u.roleId || (u.role?.id) || 2,
      branchScope: u.branchScope || 'ALL',
      brandScope: u.brandScope || 'ALL',
      allowedBrandIds: u.allowedBrandIds || u.brandIds || [],
      isActive: u.isActive !== undefined ? u.isActive : true,
      locationIds: u.locationIds || [],
      newPassword: ''
    });
  };

  const handleSaveEditUser = async (e) => {
    e.preventDefault();
    if (!editUser || !editUserForm.fullName.trim()) {
      showToast('กรุณากรอกชื่อ-นามสกุลผู้ใช้งาน', true);
      return;
    }

    try {
      // 1. Update Profile & Role & Branch Scope
      await api.put(`/user/${editUser.id}`, {
        fullName: editUserForm.fullName,
        roleId: editUserForm.roleId,
        branchScope: editUserForm.branchScope,
        brandScope: editUserForm.brandScope,
        brandIds: editUserForm.brandScope === 'SPECIFIC' ? editUserForm.allowedBrandIds : [],
        isActive: editUserForm.isActive,
        locationIds: editUserForm.branchScope === 'SPECIFIC' ? editUserForm.locationIds : []
      });

      // 2. If newPassword is provided, reset password
      if (editUserForm.newPassword && editUserForm.newPassword.trim()) {
        if (editUserForm.newPassword.trim().length < 6) {
          showToast('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร', true);
          return;
        }
        await api.post(`/auth/reset-password`, {
          userId: editUser.id,
          newPassword: editUserForm.newPassword.trim()
        });
      }

      showToast(`✓ บันทึกการแก้ไข "${editUserForm.fullName}" สำเร็จ`);
      setEditUser(null);
      loadAllData(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'แก้ไขข้อมูลผู้ใช้ไม่สำเร็จ', true);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.username || !userForm.fullName) {
      showToast('กรุณากรอกชื่อผู้ใช้และชื่อ-นามสกุลให้ครบถ้วน', true);
      return;
    }
    if (!userForm.password || userForm.password.length < 4) {
      showToast('รหัสผ่านเริ่มต้นต้องมีความยาวอย่างน้อย 4 ตัวอักษร', true);
      return;
    }

    try {
      await api.post('/user', {...userForm, brandIds: userForm.brandScope === 'SPECIFIC' ? userForm.allowedBrandIds : []});
      showToast(`✓ สร้างบัญชีผู้ใช้ "${userForm.fullName}" สำเร็จ`);
      setShowAddUserModal(false);
      setShowAddUserPassword(false);
      setUserForm({
        username: '',
        fullName: '',
        password: '1234',
        roleId: 2,
        branchScope: 'ALL',
        allowedLocationIds: []
      });
      loadAllData(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'สร้างบัญชีผู้ใช้ไม่สำเร็จ', true);
    }
  };

  // ── 🏬 LOCATION HANDLERS ──
  const handleOpenEditLocation = (loc) => {
    setEditLocation(loc);
    setIsCustomRegionEdit(false);
    const lbs = loc.locationBrands || [];
    setEditLocationForm({
      code: loc.code || '',
      name: loc.name || '',
      boundBrandIds: lbs.map(lb => lb.brandId),
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
      const { boundBrandIds, ...basicFields } = editLocationForm;
      await api.put(`/location/${editLocation.id}`, {
        id: editLocation.id,
        ...basicFields
      });

      // 🌟 Sync การผูกแบรนด์ (LocationBrands) ให้ตรงกับที่เลือกไว้ในฟอร์มใน Transaction เดียว
      await api.put(`/location/${editLocation.id}/brands`, {
        brandIds: boundBrandIds
      });

      showToast(`✓ บันทึกสถานที่ "${editLocationForm.name}" สำเร็จ`);
      setEditLocation(null);
      loadAllData(true);
    } catch (err) {
      showToast('แก้ไขสถานที่/สาขาไม่สำเร็จ', true);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    if (!locationForm.code || !locationForm.name) {
      showToast('กรุณากรอกรหัสสาขาและชื่อสถานที่ให้ครบถ้วน', true);
      return;
    }

    try {
      const { boundBrandIds, ...basicFields } = locationForm;
      const created = await api.post('/location', basicFields);
      const newLocationId = created.data?.id;

      // 🌟 ผูกแบรนด์ที่เลือกไว้เข้ากับสถานที่ที่เพิ่งสร้างใน Transaction เดียว
      if (newLocationId && boundBrandIds.length > 0) {
        await api.put(`/location/${newLocationId}/brands`, {
          brandIds: boundBrandIds
        });
      }

      showToast(`✓ เพิ่มสถานที่/สาขา "${locationForm.name}" สำเร็จ`);
      setShowAddLocationModal(false);
      setLocationForm({
        code: '',
        name: '',
        brandName: '',
        boundBrandIds: [],
        locationTypeId: locationTypes[0]?.id || 1,
        region: 'กรุงเทพฯ และปริมณฑล',
        address: '',
        phone: '',
        latitude: 13.7466,
        longitude: 100.5347,
        managerUserId: null
      });
      loadAllData(true);
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
    if (!editType || !editTypeForm.name.trim()) {
      showToast('กรุณากรอกชื่อประเภทสถานที่', true);
      return;
    }

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
      loadAllData(true);
    } catch (err) {
      showToast('แก้ไขประเภทสถานที่ไม่สำเร็จ', true);
    }
  };

  const handleCreateLocationType = async (e) => {
    e.preventDefault();
    if (!typeForm.code || !typeForm.name) {
      showToast('กรุณากรอกรหัสประเภทและชื่อประเภทให้ครบถ้วน', true);
      return;
    }

    try {
      await api.post('/location-type', typeForm);
      showToast(`✓ เพิ่มประเภทสถานที่ "${typeForm.name}" สำเร็จ`);
      setShowAddTypeModal(false);
      setTypeForm({ code: '', name: '', description: '' });
      loadAllData(true);
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
      permissionIds: (r.permissions || []).map(p => p.id)
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
      loadAllData(true);
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
      loadAllData(true);
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

  // ── Role Helpers & Filtered lists ──
  const roleOptions = useMemo(() => {
    return roles || [];
  }, [roles]);

  const getRoleUserCount = (role) => {
    return users.filter(u => {
      const matchId = role.id !== undefined && (u.roleId === role.id || u.role?.id === role.id || String(u.roleId) === String(role.id));
      const matchCode = role.code && (u.roleCode === role.code || u.role?.code === role.code || u.roleCode === role.id);
      return matchId || matchCode;
    }).length;
  };

  const filteredUsers = useMemo(() => {
    let list = [...users];

    // 1. Role Filter (ALL | specific roleId or roleCode)
    if (userRoleFilter !== 'ALL') {
      list = list.filter(u => {
        const matchId = u.roleId === userRoleFilter ||
          String(u.roleId) === String(userRoleFilter) ||
          u.role?.id === userRoleFilter ||
          String(u.role?.id) === String(userRoleFilter);
        const matchCode = u.roleCode === userRoleFilter ||
          u.role?.code === userRoleFilter;
        return matchId || matchCode;
      });
    }

    // 2. Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(u =>
        u.username?.toLowerCase().includes(q) ||
        u.fullName?.toLowerCase().includes(q) ||
        u.role?.name?.toLowerCase().includes(q) ||
        u.role?.code?.toLowerCase().includes(q) ||
        u.roleName?.toLowerCase().includes(q) ||
        u.roleCode?.toLowerCase().includes(q)
      );
    }

    // 3. Strict Sorting: 🟢 Active accounts on TOP, 🔴 Inactive accounts at BOTTOM
    list.sort((a, b) => {
      const aActive = a.isActive !== false ? 1 : 0;
      const bActive = b.isActive !== false ? 1 : 0;
      if (aActive !== bActive) {
        return bActive - aActive; // 1 (Active) comes before 0 (Inactive)
      }
      return (a.id || 0) - (b.id || 0); // secondary sort by ID
    });

    return list;
  }, [users, searchTerm, userRoleFilter]);

  const activeUsers = useMemo(() => filteredUsers.filter(u => u.isActive !== false), [filteredUsers]);
  const inactiveUsers = useMemo(() => filteredUsers.filter(u => u.isActive === false), [filteredUsers]);

  // ── Specific Branch Selection Helpers (จัดการสาขาที่ได้รับอนุญาต) ──
  const isLocationInBrands = (loc, allowedBrandIds) => {
    if (!allowedBrandIds || allowedBrandIds.length === 0) return false;
    const brandSet = new Set(allowedBrandIds.map(Number));
    if (loc.locationBrands && loc.locationBrands.length > 0) {
      if (loc.locationBrands.some(lb => brandSet.has(Number(lb.brandId)))) return true;
    }
    if (loc.brandId && brandSet.has(Number(loc.brandId))) return true;
    return false;
  };

  const selectableLocationsForEdit = useMemo(() => {
    if (editUserForm.brandScope !== 'SPECIFIC' || !editUserForm.allowedBrandIds || editUserForm.allowedBrandIds.length === 0) {
      return locations;
    }
    return locations.filter(loc => isLocationInBrands(loc, editUserForm.allowedBrandIds));
  }, [locations, editUserForm.brandScope, editUserForm.allowedBrandIds]);

  const selectableLocationsForCreate = useMemo(() => {
    if (userForm.brandScope !== 'SPECIFIC' || !userForm.allowedBrandIds || userForm.allowedBrandIds.length === 0) {
      return locations;
    }
    return locations.filter(loc => isLocationInBrands(loc, userForm.allowedBrandIds));
  }, [locations, userForm.brandScope, userForm.allowedBrandIds]);

  const currentScopedLocations = useMemo(() => {
    return branchSelectorTarget === 'edit'
      ? selectableLocationsForEdit
      : selectableLocationsForCreate;
  }, [branchSelectorTarget, selectableLocationsForEdit, selectableLocationsForCreate]);

  const currentScopedBrandNames = useMemo(() => {
    const allowedIds = branchSelectorTarget === 'edit'
      ? (editUserForm.brandScope === 'SPECIFIC' ? editUserForm.allowedBrandIds : [])
      : (userForm.brandScope === 'SPECIFIC' ? userForm.allowedBrandIds : []);
    if (!allowedIds || allowedIds.length === 0) return null;
    return brands.filter(b => allowedIds.includes(b.id)).map(b => b.name).join(', ');
  }, [branchSelectorTarget, editUserForm.brandScope, editUserForm.allowedBrandIds, userForm.brandScope, userForm.allowedBrandIds, brands]);

  const uniqueRegions = useMemo(() => {
    const set = new Set();
    currentScopedLocations.forEach(loc => {
      if (loc.region && loc.region.trim()) {
        set.add(loc.region.trim());
      }
    });
    return Array.from(set);
  }, [currentScopedLocations]);

  const filteredBranchLocations = useMemo(() => {
    let list = currentScopedLocations;

    // 1. Region filter
    if (branchRegionFilter !== 'ALL') {
      list = list.filter(loc => loc.region === branchRegionFilter);
    }

    // 2. Selected only filter
    if (branchShowSelectedOnly) {
      list = list.filter(loc => tempBranchLocationIds.includes(loc.id));
    }

    // 3. Search query
    if (branchSearchTerm.trim()) {
      const q = branchSearchTerm.toLowerCase();
      list = list.filter(loc =>
        loc.code?.toLowerCase().includes(q) ||
        loc.name?.toLowerCase().includes(q) ||
        loc.region?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [currentScopedLocations, branchRegionFilter, branchShowSelectedOnly, branchSearchTerm, tempBranchLocationIds]);

  const groupedLocations = useMemo(() => {
    const groups = {};
    filteredBranchLocations.forEach(loc => {
      const region = loc.region || 'กรุงเทพมหานคร';
      if (!groups[region]) {
        groups[region] = [];
      }
      groups[region].push(loc);
    });
    return groups;
  }, [filteredBranchLocations]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredBranchLocations.length === 0) return false;
    return filteredBranchLocations.every(loc => tempBranchLocationIds.includes(loc.id));
  }, [filteredBranchLocations, tempBranchLocationIds]);

  const handleOpenBranchSelector = (target = 'edit') => {
    setBranchSelectorTarget(target);
    const initialIds = target === 'edit'
      ? (editUserForm.locationIds || [])
      : (userForm.allowedLocationIds || userForm.locationIds || []);
    
    // กรองเฉพาะสาขาที่อยู่ในขอบเขตแบรนด์ของผู้ใช้
    const scopedList = target === 'edit' ? selectableLocationsForEdit : selectableLocationsForCreate;
    const scopedIdSet = new Set(scopedList.map(l => l.id));
    const validInitialIds = (target === 'edit' && editUserForm.brandScope === 'SPECIFIC' && editUserForm.allowedBrandIds?.length > 0)
      || (target === 'create' && userForm.brandScope === 'SPECIFIC' && userForm.allowedBrandIds?.length > 0)
        ? initialIds.filter(id => scopedIdSet.has(id))
        : initialIds;

    setTempBranchLocationIds([...validInitialIds]);
    setBranchSearchTerm('');
    setBranchRegionFilter('ALL');
    setBranchShowSelectedOnly(false);
    setShowBranchSelectorModal(true);
  };

  const handleSaveBranchSelection = () => {
    if (branchSelectorTarget === 'edit') {
      setEditUserForm(prev => ({
        ...prev,
        locationIds: tempBranchLocationIds
      }));
    } else {
      setUserForm(prev => ({
        ...prev,
        allowedLocationIds: tempBranchLocationIds
      }));
    }
    setShowBranchSelectorModal(false);
  };

  const toggleBranchSelection = (locId) => {
    setTempBranchLocationIds(prev =>
      prev.includes(locId) ? prev.filter(id => id !== locId) : [...prev, locId]
    );
  };

  const toggleRegionCollapse = (region) => {
    setCollapsedRegions(prev => ({
      ...prev,
      [region]: !prev[region]
    }));
  };

  const handleToggleSelectAllBranches = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredBranchLocations.map(l => l.id));
      setTempBranchLocationIds(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      const newIds = new Set([...tempBranchLocationIds, ...filteredBranchLocations.map(l => l.id)]);
      setTempBranchLocationIds(Array.from(newIds));
    }
  };

  const renderUserCard = (u) => {
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
                <div className="text-xs font-mono text-slate-400 truncate">{u.username}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
                isActive
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                  : 'bg-slate-200 text-slate-600 border-slate-300'
              }`}>
                {u.roleCode || u.role?.code || u.roleName || u.role?.name}
              </span>
              <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0F6659] group-hover:translate-x-0.5 transition-all" />
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
            {isActive ? '✓ ใช้งานอยู่' : '✕ ไม่ใช้งาน'}
          </span>
        </div>
      </div>
    );
  };

  const filteredLocations = useMemo(() => {
    let list = locations;
    if (locationStatusFilter === 'ACTIVE') list = list.filter(l => l.isActive);
    if (locationStatusFilter === 'INACTIVE') list = list.filter(l => !l.isActive);
    if (locationBrandFilter.length > 0) {
      list = list.filter(l => l.locationBrands?.some(lb => locationBrandFilter.includes(lb.brandId)));
    }

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(l =>
      l.code?.toLowerCase().includes(q) ||
      l.name?.toLowerCase().includes(q) ||
      l.region?.toLowerCase().includes(q) ||
      l.locationType?.name?.toLowerCase().includes(q)
    );
  }, [locations, searchTerm, locationStatusFilter, locationBrandFilter]);

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

  const sortedPermissions = useMemo(() => {
    return [...availablePermissions].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [availablePermissions]);

  // ── 📄 Pagination Computations & Resets ──
  const totalUserPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, userPage, pageSize]);

  const totalLocationPages = Math.ceil(filteredLocations.length / pageSize) || 1;
  const paginatedLocations = useMemo(() => {
    const start = (locationPage - 1) * pageSize;
    return filteredLocations.slice(start, start + pageSize);
  }, [filteredLocations, locationPage, pageSize]);

  useEffect(() => {
    setUserPage(1);
  }, [searchTerm, userRoleFilter]);

  useEffect(() => {
    setLocationPage(1);
  }, [searchTerm, locationStatusFilter, locationBrandFilter]);

  return (
    <div className="page-transition p-3.5 sm:p-6 space-y-4 w-full max-w-full overflow-x-hidden mx-auto pb-28 lg:pb-12 font-sans">
      
      {/* Toast alert (Floating Top Screen Edge Banner via Portal) */}
      {toast && typeof document !== 'undefined' && createPortal(
        <div className={`fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-[99999] px-4.5 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold border animate-in fade-in slide-in-from-top-3 duration-200 backdrop-blur-md pointer-events-none ${
          toast.isError ? 'bg-rose-50/95 text-rose-800 border-rose-200 rounded-2xl' : 'bg-emerald-50/95 text-emerald-950 border border-emerald-300 ring-1 ring-emerald-400/20 rounded-2xl'
        }`}>
          {toast.isError ? <AlertCircle size={18} className="text-rose-600 shrink-0" /> : <CheckCircle2 size={18} className="text-[#0F6659] shrink-0" />}
          <span>{toast.msg}</span>
        </div>,
        document.body
      )}

      {/* Header */}
      <Header
        title="ศูนย์การจัดการข้อมูลระบบ (Master Management)"
        subtitle="สร้างและแก้ไขข้อมูลผู้ใช้งาน, สถานที่/สาขา, ประเภทสถานที่ และสิทธิ์บทบาท"
        onBack={onBack}
      />

      {/* Error Alert State if connection fails */}
      {loadError && (
        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <div className="text-sm font-bold">ไม่สามารถเชื่อมต่อฐานข้อมูลหลักได้</div>
              <div className="text-xs text-rose-600">กรุณาตรวจสอบการทำงานของเซิร์ฟเวอร์ Backend หรือลองใหม่อีกครั้ง</div>
            </div>
          </div>
          <button
            type="button"
            onClick={loadAllData}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>ลองใหม่อีกครั้ง</span>
          </button>
        </div>
      )}

      {/* ── 🌟 4 CATEGORY TABS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { key: 'users', label: 'ผู้ใช้งาน (Users)', count: users.length, icon: Users },
          { key: 'locations', label: 'สถานที่/สาขา (Locations)', count: locations.length, icon: Store },
          { key: 'location_types', label: 'ประเภทสถานที่ (Types)', count: locationTypes.length, icon: Building2 },
          { key: 'brands', label: 'แบรนด์ (Brands)', count: brands.length, icon: Tag},
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
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
                  {tab.count}
                </span>
              </div>
              <div>
                <div className={`text-xs sm:text-sm font-bold leading-tight ${isActive ? 'text-[#0F6659]' : 'text-slate-800'}`}>
                  {tab.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 👥 TAB 1: USERS MANAGEMENT ── */}
      {activeTab === 'users' && (
        <UserManagementTab
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          setShowAddUserModal={setShowAddUserModal}
          userRoleFilter={userRoleFilter} setUserRoleFilter={setUserRoleFilter}
          users={users} roleOptions={roleOptions} getRoleUserCount={getRoleUserCount}
          loading={loading} filteredUsers={filteredUsers} paginatedUsers={paginatedUsers}
          handleOpenEditUser={handleOpenEditUser}
          pageSize={pageSize} userPage={userPage} setUserPage={setUserPage} totalUserPages={totalUserPages}
          renderUserCard={renderUserCard}
        />
      )}

      {/* ── 🏬 TAB 2: LOCATIONS MANAGEMENT ── */}
      {activeTab === 'locations' && (
        <LocationManagementTab
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          setShowAddLocationModal={setShowAddLocationModal}
          locations={locations} locationStatusFilter={locationStatusFilter} setLocationStatusFilter={setLocationStatusFilter}
          loading={loading} filteredLocations={filteredLocations} paginatedLocations={paginatedLocations}
          handleOpenEditLocation={handleOpenEditLocation}
          pageSize={pageSize} locationPage={locationPage} setLocationPage={setLocationPage} totalLocationPages={totalLocationPages}
          brandsList={brands} brandFilter={locationBrandFilter} setBrandFilter={setLocationBrandFilter}
        />
      )}

      {/* ── Brand ── */}
      {
        activeTab === 'brands' && (
          <BrandManagementTab 
            brands={brands} 
            loading={loading} 
            onRefresh={loadAllData} 
            showToast={showToast}
          />
        )
      }

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
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} />
              <span>เพิ่มประเภทสถานที่</span>
            </button>
          </div>

          {loading && locationTypes.length === 0 ? (
            <div className="space-y-3 py-4 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-2xl w-full" />
              ))}
            </div>
          ) : filteredTypes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Building2 size={28} />
              </div>
              <p className="text-sm font-bold text-slate-700">ไม่พบประเภทสถานที่ที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
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
          )}
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
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0F6659] hover:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              <Plus size={16} />
              <span>เพิ่มบทบาทใหม่</span>
            </button>
          </div>

          {loading && roles.length === 0 ? (
            <div className="space-y-3 py-4 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-2xl w-full" />
              ))}
            </div>
          ) : filteredRoles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <ShieldCheck size={28} />
              </div>
              <p className="text-sm font-bold text-slate-700">ไม่พบบทบาทที่ตรงกับเงื่อนไข</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredRoles.map((r) => {
                const roleNavItems = getRoleNavConfig(r.code, r.navConfig || r.navConfigJson);

                return (
                  <div
                    key={r.id}
                    className="p-4.5 rounded-2xl border border-slate-200 bg-white transition-all shadow-2xs hover:shadow-xs space-y-3.5 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Role Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-950 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 font-mono">
                          {r.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Shield size={18} className="text-[#0F6659]" />
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <h4 className="text-base font-black text-slate-900 group-hover:text-emerald-800 transition-colors">
                          {r.name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">{r.description || "บทบาทการทำงานในระบบ"}</p>
                      </div>

                      {/* 🌟 Current Navigation Bar Preview Pills */}
                      <div className="pt-2.5 border-t border-slate-100 mt-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-slate-400">แถบเมนูด้านล่าง (3 ช่อง)</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-center">
                          {roleNavItems.map((slotItem, sIdx) => {
                            const isCenter = sIdx === 1 || slotItem.slot === "center";
                            return (
                              <div
                                key={sIdx}
                                className={`py-1 px-1 rounded-lg text-[10px] truncate font-bold ${
                                  isCenter
                                    ? "bg-[#0F6659] text-white shadow-2xs"
                                    : "bg-white text-slate-700 border border-slate-200"
                                }`}
                                title={slotItem.label}
                              >
                                {isCenter ? `★ ${slotItem.label}` : slotItem.label}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Permissions overview */}
                      <div className="pt-2.5 border-t border-slate-100 mt-2">
                        <span className="text-[11px] font-extrabold text-slate-400">สิทธิ์ที่เปิดใช้งาน ({r.permissions?.length || 0})</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-20 overflow-y-auto">
                          {(r.permissions || []).map((p, i) => (
                            <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
                              ✓ {p}
                            </span>
                          ))}
                          {(!r.permissions || r.permissions.length === 0) && (
                            <span className="text-[11px] text-slate-400">สิทธิ์มาตรฐานตามบทบาท</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleOpenNavCustomizer(r, e)}
                        className="py-2 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-[#0F6659] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-emerald-200"
                        title="ปรับแต่งแถบเมนูด้านล่างสำหรับบทบาทนี้"
                      >
                        <Smartphone size={14} />
                        <span>ปรับแต่งเมนู</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditRole(r)}
                        className="py-2 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 border border-emerald-200"
                        title="กำหนดสิทธิ์การเข้าถึงโมดูล"
                      >
                        <Shield size={14} />
                        <span>กำหนดสิทธิ์</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 🌟 CENTERED FIXED MODALS: CLEAN, SOFT COLORS & NON-BOLD DESIGN ── */}

      {/* 1. MODAL: EDIT USER */}
      {editUser && (
        <ModalWrapper onClose={() => setEditUser(null)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 pb-6 sm:pb-8 space-y-4 sm:space-y-5 flex flex-col max-h-[85dvh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0F6659] flex items-center justify-center">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">แก้ไขข้อมูลผู้ใช้งาน</h3>
                  <span className="text-xs font-mono text-slate-400">{editUser.username}</span>
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
            <form onSubmit={handleSaveEditUser} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
              
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ชื่อ-นามสกุล (Full Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editUserForm.fullName}
                  onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs placeholder:text-slate-400"
                  placeholder="เช่น นายวันทร์ หนวดเขี้ยว"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  บทบาทในระบบ (Role) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={editUserForm.roleId}
                    onChange={(e) => setEditUserForm({ ...editUserForm, roleId: parseInt(e.target.value) })}
                    className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                  >
                    {roles.length === 0 ? (
                      <option value="">กำลังโหลดบทบาท...</option>
                    ) : (
                      roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                      ))
                    )}
                  </select>
                  <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ขอบเขตแบรนด์</label>
                <div className="relative">
                  <select
                    value={editUserForm.brandScope}
                    onChange={(e) => {
                      const newScope = e.target.value;
                      setEditUserForm(prev => ({
                        ...prev,
                        brandScope: newScope,
                        locationIds: newScope === 'SPECIFIC' && prev.allowedBrandIds?.length > 0
                          ? (prev.locationIds || []).filter(locId => {
                              const loc = locations.find(l => l.id === locId);
                              return loc && isLocationInBrands(loc, prev.allowedBrandIds);
                            })
                          : prev.locationIds
                      }));
                    }}
                    className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                  >
                    <option value="ALL">ทุกแบรนด์ (ALL)</option>
                    <option value="SPECIFIC">เฉพาะแบรนด์ที่กำหนด (SPECIFIC)</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              {editUserForm.brandScope === 'SPECIFIC' && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <label className="block text-sm font-medium text-slate-600">เลือกแบรนด์ที่ได้รับอนุญาต:</label>
                  <BrandChipSelector
                    brands={activeBrands}
                    selectedIds={editUserForm.allowedBrandIds || []}
                    onChange={(ids) => {
                      setEditUserForm(prev => {
                        const validLocationIds = (prev.locationIds || []).filter(locId => {
                          const loc = locations.find(l => l.id === locId);
                          return loc && isLocationInBrands(loc, ids);
                        });
                        return {
                          ...prev,
                          allowedBrandIds: ids,
                          locationIds: ids.length > 0 ? validLocationIds : prev.locationIds
                        };
                      });
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ขอบเขตการเข้าถึง
                </label>
                <div className="relative">
                  <select
                    value={editUserForm.branchScope}
                    onChange={(e) => setEditUserForm({ ...editUserForm, branchScope: e.target.value })}
                    className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                  >
                    <option value="ALL">ทุกสาขาในองค์กร (ALL)</option>
                    <option value="SPECIFIC">เฉพาะสาขาที่กำหนด (SPECIFIC)</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Specific Locations Selection Preview Card */}
              {editUserForm.branchScope === 'SPECIFIC' && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <label className="block text-sm font-medium text-slate-600">
                    เลือกสาขาที่ได้รับอนุญาต:
                  </label>
                  <div className="p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 space-y-2.5">
                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center shrink-0">
                          <Store size={18} />
                        </div>
                        <span className="text-sm font-bold text-slate-800">
                          เลือกแล้ว {editUserForm.locationIds?.length || 0} จาก {selectableLocationsForEdit.length} สาขา
                        </span>
                      </div>
                      {editUserForm.brandScope === 'SPECIFIC' && editUserForm.allowedBrandIds?.length > 0 && (
                        <span className="text-[11px] font-semibold text-[#0F6659] bg-emerald-100/60 px-2 py-0.5 rounded-md">
                          กรองตาม {editUserForm.allowedBrandIds.length} แบรนด์ที่เลือก
                        </span>
                      )}
                    </div>

                    {/* Previews of selected branches */}
                    {(editUserForm.locationIds?.length || 0) > 0 ? (
                      <div className="space-y-1.5">
                        {editUserForm.locationIds.slice(0, 2).map(locId => {
                          const loc = locations.find(l => l.id === locId);
                          return (
                            <div
                              key={locId}
                              className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 truncate shadow-2xs"
                            >
                              {loc ? `${loc.code} - ${loc.name}` : `สาขารหัส #${locId}`}
                            </div>
                          );
                        })}
                        {editUserForm.locationIds.length > 2 && (
                          <div className="text-xs text-slate-400 font-medium pl-1">
                            + อีก {editUserForm.locationIds.length - 2} สาขา
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 py-1 pl-1">
                        ยังไม่ได้เลือกสาขา (แตะปุ่มด้านล่างเพื่อเลือกสาขา)
                      </div>
                    )}

                    {/* Button to open branch manager modal */}
                    <button
                      type="button"
                      onClick={() => handleOpenBranchSelector('edit')}
                      className="w-full py-2.5 rounded-2xl border border-[#0F6659] text-[#0F6659] hover:bg-[#0F6659] hover:text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-98 bg-white"
                    >
                      <SlidersHorizontal size={15} />
                      <span>จัดการสาขา</span>
                    </button>
                    <p className="text-[11px] text-slate-400 text-center font-normal">
                      ค้นหาหรือเปลี่ยนรายการสาขาที่อนุญาต
                    </p>
                  </div>
                </div>
              )}

              {/* Integrated Password Reset Section */}
              <div className="p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Key size={17} className="text-[#0F6659]" />
                  <span>รีเซ็ตรหัสผ่านใหม่</span>
                  <span className="text-xs text-slate-400 font-normal">(อย่างน้อย 6 ตัว)</span>
                </div>
                <input
                  type="text"
                  placeholder="กรอกรหัสผ่านใหม่ (ปล่อยว่างถ้าไม่ต้องการเปลี่ยน)"
                  value={editUserForm.newPassword || ''}
                  onChange={(e) => setEditUserForm({ ...editUserForm, newPassword: e.target.value })}
                  minLength={6}
                  className="w-full px-4.5 py-3 rounded-xl bg-white border border-slate-200 text-sm sm:text-base font-mono font-normal text-slate-500 focus:text-slate-800 focus:border-[#0F6659] outline-none shadow-xs placeholder:text-slate-400"
                />
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between p-4.5 rounded-2xl bg-slate-50/80 border border-slate-200">
                <div>
                  <div className="text-sm font-medium text-slate-700">สถานะการใช้งานบัญชี</div>
                  <div className="text-xs text-slate-400 font-normal mt-0.5">
                    {editUserForm.isActive ? 'เปิดใช้งาน (สามารถเข้าสู่ระบบได้)' : 'ปิดใช้งาน (ไม่สามารถเข้าสู่ระบบได้)'}
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
              <div className="flex gap-3 pt-4 pb-2 border-t border-slate-100 shrink-0 bg-white">
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
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      )}

      {/* 2. MODAL: CREATE USER */}
      {showAddUserModal && (
        <ModalWrapper onClose={() => setShowAddUserModal(false)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 pb-6 sm:pb-8 space-y-4 sm:space-y-5 flex flex-col max-h-[85dvh]">
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

            <form onSubmit={handleCreateUser} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value.replace(/\s+/g, '') })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs placeholder:text-slate-400"
                  placeholder="เช่น somsak_bkk"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ชื่อ-นามสกุล (Full Name) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={userForm.fullName}
                  onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                  className="w-full px-4.5 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs placeholder:text-slate-400"
                  placeholder="เช่น นายสมศักดิ์ มั่นคง"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  รหัสผ่านเริ่มต้น <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showAddUserPassword ? "text" : "password"}
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full pl-4.5 pr-12 py-3.5 rounded-2xl border border-slate-200 text-sm sm:text-base font-normal text-slate-500 focus:text-slate-800 bg-white focus:border-[#0F6659] focus:ring-2 focus:ring-[#0F6659]/10 outline-none transition-all shadow-xs placeholder:text-slate-400"
                    placeholder="กรอกรหัสผ่านเริ่มต้น..."
                    minLength={4}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddUserPassword(prev => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 active:text-[#0F6659] cursor-pointer rounded-lg transition-colors"
                    aria-label={showAddUserPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    title={showAddUserPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showAddUserPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  บทบาทในระบบ (Role) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={userForm.roleId}
                    onChange={(e) => setUserForm({ ...userForm, roleId: parseInt(e.target.value) })}
                    className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                  >
                    {roles.length === 0 ? (
                      <option value="">กำลังโหลดบทบาท...</option>
                    ) : (
                      roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                      ))
                    )}
                  </select>
                  <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ขอบเขตแบรนด์</label>
                <div className="relative">
                  <select
                    value={userForm.brandScope}
                    onChange={(e) => {
                      const newScope = e.target.value;
                      setUserForm(prev => ({
                        ...prev,
                        brandScope: newScope,
                        allowedLocationIds: newScope === 'SPECIFIC' && prev.allowedBrandIds?.length > 0
                          ? (prev.allowedLocationIds || []).filter(locId => {
                              const loc = locations.find(l => l.id === locId);
                              return loc && isLocationInBrands(loc, prev.allowedBrandIds);
                            })
                          : prev.allowedLocationIds
                      }));
                    }}
                    className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                  >
                    <option value="ALL">ทุกแบรนด์ (ALL)</option>
                    <option value="SPECIFIC">เฉพาะแบรนด์ที่กำหนด (SPECIFIC)</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
              {userForm.brandScope === 'SPECIFIC' && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <label className="block text-sm font-medium text-slate-600">เลือกแบรนด์ที่ได้รับอนุญาต:</label>
                  <BrandChipSelector
                    brands={activeBrands}
                    selectedIds={userForm.allowedBrandIds || []}
                    onChange={(ids) => {
                      setUserForm(prev => {
                        const validLocationIds = (prev.allowedLocationIds || []).filter(locId => {
                          const loc = locations.find(l => l.id === locId);
                          return loc && isLocationInBrands(loc, ids);
                        });
                        return {
                          ...prev,
                          allowedBrandIds: ids,
                          allowedLocationIds: ids.length > 0 ? validLocationIds : prev.allowedLocationIds
                        };
                      });
                    }}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  ขอบเขตสาขาที่เข้าถึงได้ (Branch Scope)
                </label>
                <div className="relative">
                  <select
                    value={userForm.branchScope}
                    onChange={(e) => setUserForm({ ...userForm, branchScope: e.target.value })}
                    className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                  >
                    <option value="ALL">ทุกสาขาในองค์กร (ALL)</option>
                    <option value="SPECIFIC">เฉพาะสาขาที่กำหนด (SPECIFIC)</option>
                  </select>
                  <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Specific Locations Selection Preview for Create User */}
              {userForm.branchScope === 'SPECIFIC' && (
                <div className="space-y-2 pt-1 animate-in fade-in">
                  <label className="block text-sm font-medium text-slate-700">
                    เลือกสาขาที่ได้รับอนุญาต:
                  </label>
                  <div className="p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 space-y-2.5">
                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#0F6659] flex items-center justify-center shrink-0">
                          <Store size={18} />
                        </div>
                        <span className="text-sm font-bold text-slate-800">
                          เลือกแล้ว {userForm.allowedLocationIds?.length || 0} จาก {selectableLocationsForCreate.length} สาขา
                        </span>
                      </div>
                      {userForm.brandScope === 'SPECIFIC' && userForm.allowedBrandIds?.length > 0 && (
                        <span className="text-[11px] font-semibold text-[#0F6659] bg-emerald-100/60 px-2 py-0.5 rounded-md">
                          กรองตาม {userForm.allowedBrandIds.length} แบรนด์ที่เลือก
                        </span>
                      )}
                    </div>

                    {(userForm.allowedLocationIds?.length || 0) > 0 ? (
                      <div className="space-y-1.5">
                        {userForm.allowedLocationIds.slice(0, 2).map(locId => {
                          const loc = locations.find(l => l.id === locId);
                          return (
                            <div
                              key={locId}
                              className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 truncate shadow-2xs"
                            >
                              {loc ? `${loc.code} - ${loc.name}` : `สาขารหัส #${locId}`}
                            </div>
                          );
                        })}
                        {userForm.allowedLocationIds.length > 2 && (
                          <div className="text-xs text-slate-400 font-medium pl-1">
                            + อีก {userForm.allowedLocationIds.length - 2} สาขา
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 py-1 pl-1">
                        ยังไม่ได้เลือกสาขา (แตะปุ่มด้านล่างเพื่อเลือกสาขา)
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenBranchSelector('create')}
                      className="w-full py-2.5 rounded-2xl border border-[#0F6659] text-[#0F6659] hover:bg-[#0F6659] hover:text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-98 bg-white"
                    >
                      <SlidersHorizontal size={15} />
                      <span>จัดการสาขา</span>
                    </button>
                    <p className="text-[11px] text-slate-400 text-center font-normal">
                      ค้นหาหรือเปลี่ยนรายการสาขาที่อนุญาต
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 pb-2 border-t border-slate-100 shrink-0 bg-white">
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

      {/* ── 🏬 SUB-MODAL: MANAGE SPECIFIC BRANCHES (จัดการสาขาที่ได้รับอนุญาต) ── */}
      {showBranchSelectorModal && (
        <ModalWrapper onClose={() => setShowBranchSelectorModal(false)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-6 pb-6 sm:pb-8 space-y-4 flex flex-col max-h-[85dvh]">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowBranchSelectorModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
                title="ย้อนกลับ"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">จัดการสาขาที่ได้รับอนุญาต</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>เลือกแล้ว {tempBranchLocationIds.length} จาก {currentScopedLocations.length} สาขา</span>
                  {currentScopedBrandNames && (
                    <span className="text-[#0F6659] font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                      {currentScopedBrandNames}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อสาขา หรือรหัสสาขา"
                value={branchSearchTerm}
                onChange={(e) => setBranchSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-[#0F6659] outline-none transition-colors"
              />
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Region Filter Dropdown */}
              <div className="relative flex-1">
                <select
                  value={branchRegionFilter}
                  onChange={(e) => setBranchRegionFilter(e.target.value)}
                  className={`w-full py-2.5 pl-3.5 pr-8 rounded-xl border text-xs sm:text-sm font-bold outline-none cursor-pointer appearance-none transition-all ${
                    branchRegionFilter !== 'ALL'
                      ? 'border-[#0F6659] text-[#0F6659] bg-emerald-50/40 ring-1 ring-[#0F6659]/20'
                      : 'border-[#0F6659] text-[#0F6659] bg-white hover:bg-slate-50'
                  }`}
                >
                  <option value="ALL">พื้นที่ทั้งหมด</option>
                  {uniqueRegions.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0F6659] pointer-events-none" />
              </div>

              {/* Show Selected Only Button */}
              <button
                type="button"
                onClick={() => setBranchShowSelectedOnly(!branchShowSelectedOnly)}
                className={`flex-1 py-2.5 px-3.5 rounded-xl border text-xs sm:text-sm font-bold transition-all cursor-pointer text-center ${
                  branchShowSelectedOnly
                    ? 'border-[#0F6659] text-[#0F6659] bg-emerald-50 ring-1 ring-[#0F6659]/20'
                    : 'border-slate-300 text-slate-600 bg-white hover:bg-slate-50'
                }`}
              >
                เฉพาะที่เลือก
              </button>
            </div>

            {/* Subheader: Item count & Select All */}
            <div className="flex items-center justify-between pt-1 pb-0.5 text-xs text-slate-500 font-medium shrink-0">
              <span>สาขาทั้งหมด {filteredBranchLocations.length} รายการ</span>
              <button
                type="button"
                onClick={handleToggleSelectAllBranches}
                className="font-bold text-[#0F6659] hover:underline cursor-pointer"
              >
                {isAllFilteredSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
              </button>
            </div>

            {/* Scrollable Grouped Branch List */}
            <div className="space-y-3 overflow-y-auto overscroll-contain flex-1 pr-1 pb-1">
              {Object.keys(groupedLocations).length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Store size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">ไม่พบสาขาที่ตรงกับเงื่อนไขการค้นหา</p>
                </div>
              ) : (
                Object.entries(groupedLocations).map(([region, locList]) => {
                  const isCollapsed = !!collapsedRegions[region];
                  return (
                    <div key={region} className="space-y-2">
                      {/* Region Header Toggle */}
                      <button
                        type="button"
                        onClick={() => toggleRegionCollapse(region)}
                        className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/90 hover:bg-slate-100 border border-slate-200/80 cursor-pointer transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <Store size={18} className="text-[#0F6659]" />
                          <span className="text-sm font-bold text-slate-800">{region} ({locList.length})</span>
                        </div>
                        {isCollapsed ? (
                          <ChevronDown size={18} className="text-slate-400" />
                        ) : (
                          <ChevronUp size={18} className="text-slate-400" />
                        )}
                      </button>

                      {/* Region Branch Cards */}
                      {!isCollapsed && (
                        <div className="space-y-2">
                          {locList.map((loc) => {
                            const isSelected = tempBranchLocationIds.includes(loc.id);
                            return (
                              <div
                                key={loc.id}
                                onClick={() => toggleBranchSelection(loc.id)}
                                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between bg-white ${
                                  isSelected
                                    ? 'border-[#0F6659] ring-1 ring-[#0F6659]/20 shadow-2xs'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="text-xs font-bold text-emerald-800 font-mono">{loc.code}</div>
                                  <div className="text-sm font-bold text-slate-900 truncate mt-0.5">{loc.name}</div>
                                </div>
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'bg-[#0F6659] text-white shadow-2xs'
                                    : 'border-2 border-slate-300 bg-white'
                                }`}>
                                  {isSelected && <Check size={16} strokeWidth={3} />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Bottom Action Footer */}
            <div className="flex items-center justify-between pt-4 pb-2 sm:pb-3 border-t border-slate-100 shrink-0 bg-white">
              <span className="text-sm font-normal text-slate-800">
                เลือกแล้ว {tempBranchLocationIds.length} สาขา
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowBranchSelectorModal(false)}
                  className="text-sm font-bold text-slate-600 hover:text-slate-900 cursor-pointer px-2 py-2"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveBranchSelection}
                  className="px-5 py-2.5 rounded-xl bg-[#0F6659] hover:bg-emerald-800 text-white text-sm font-bold shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* 3. MODAL: EDIT LOCATION */}
      {editLocation && (
        <ModalWrapper onClose={() => setEditLocation(null)} maxWidth="max-w-md sm:max-w-lg">
          <div className="p-5 sm:p-7 pb-6 sm:pb-8 space-y-4 sm:space-y-5 flex flex-col max-h-[85dvh]">
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

            <form onSubmit={handleSaveEditLocation} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">รหัสสาขา *</label>
                  <input
                    type="text"
                    value={editLocationForm.code}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-2xl border border-slate-200 text-sm sm:text-base font-mono font-semibold text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ประเภทสถานที่ *</label>
                  <div className="relative">
                    <select
                      value={editLocationForm.locationTypeId}
                      onChange={(e) => setEditLocationForm({ ...editLocationForm, locationTypeId: parseInt(e.target.value) })}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      {locationTypes.length === 0 ? (
                        <option value="">กำลังโหลดประเภทสถานที่...</option>
                      ) : (
                        locationTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))
                      )}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อสถานที่/สาขา *</label>
                <input
                  type="text"
                  value={editLocationForm.name}
                  onChange={(e) => setEditLocationForm({ ...editLocationForm, name: e.target.value })}
                  className="w-full px-4.5 py-3.5 min-h-[48px] rounded-2xl border border-slate-200 text-sm sm:text-base font-semibold text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  required
                />
              </div>

              {/* Brand Selection (chip, multi-select) */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  แบรนด์ที่ผูกกับสถานที่นี้
                </label>
                <BrandChipSelector
                  brands={brands}
                  value={editLocationForm.boundBrandIds}
                  onChange={(ids) => setEditLocationForm(prev => ({
                    ...prev,
                    boundBrandIds: ids
                  }))}
                  mode="multi"
                />
              </div>

              {/* Region Selection / Custom Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-600">ภูมิภาค / เขต (Region)</label>
                  {!isCustomRegionEdit ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomRegionEdit(true);
                        setEditLocationForm(prev => ({ ...prev, region: '' }));
                      }}
                      className="text-xs text-[#0F6659] hover:text-emerald-800 font-bold cursor-pointer transition-colors"
                    >
                      + พิมพ์ภูมิภาคใหม่
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomRegionEdit(false);
                        setEditLocationForm(prev => ({ ...prev, region: existingRegions[0] || 'กรุงเทพฯ และปริมณฑล' }));
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer transition-colors"
                    >
                      ← เลือกจากรายการ
                    </button>
                  )}
                </div>

                {!isCustomRegionEdit ? (
                  <div className="relative">
                    <select
                      value={editLocationForm.region || ''}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCustomRegionEdit(true);
                          setEditLocationForm(prev => ({ ...prev, region: '' }));
                        } else {
                          setEditLocationForm(prev => ({ ...prev, region: e.target.value }));
                        }
                      }}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      <option value="">-- เลือกภูมิภาค --</option>
                      {existingRegions.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editLocationForm.region}
                    onChange={(e) => setEditLocationForm(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-4.5 py-3.5 min-h-[48px] rounded-2xl border border-emerald-300 focus:border-[#0F6659] text-sm sm:text-base font-semibold text-slate-800 bg-emerald-50/20 outline-none shadow-xs animate-in fade-in"
                    placeholder="พิมพ์ภูมิภาคใหม่ เช่น ภาคตะวันออก, ชลบุรี"
                    autoFocus
                  />
                )}
              </div>

              {/* 🗺️ Address & Interactive GPS Map Picker */}
              <LocationGpsSection
                form={editLocationForm}
                setForm={setEditLocationForm}
                showToast={showToast}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">เบอร์โทรติดต่อ</label>
                  <input
                    type="text"
                    value={editLocationForm.phone}
                    onChange={(e) => setEditLocationForm({ ...editLocationForm, phone: e.target.value })}
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-2xl border border-slate-200 text-sm sm:text-base font-semibold text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                    placeholder="เช่น 02-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ผู้จัดการประจำสาขา</label>
                  <div className="relative">
                    <select
                      value={editLocationForm.managerUserId || ''}
                      onChange={(e) => setEditLocationForm({ ...editLocationForm, managerUserId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      <option value="">-- ไม่ระบุ --</option>
                      {users.filter(u => u.roleCode === 'AUDITEE' || u.role?.code === 'AUDITEE' || (roles.find(r => r.id === u.roleId)?.code === 'AUDITEE')).map(u => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
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

              <div className="flex gap-3 pt-4 pb-2 border-t border-slate-100 shrink-0 bg-white">
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
          <div className="p-5 sm:p-7 pb-6 sm:pb-8 space-y-4 sm:space-y-5 flex flex-col max-h-[85dvh]">
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

            <form onSubmit={handleCreateLocation} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">รหัสสาขา *</label>
                  <input
                    type="text"
                    value={locationForm.code}
                    onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-2xl border border-slate-200 text-sm sm:text-base font-mono font-semibold text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                    placeholder="BKK-006"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ประเภทสถานที่ *</label>
                  <div className="relative">
                    <select
                      value={locationForm.locationTypeId}
                      onChange={(e) => setLocationForm({ ...locationForm, locationTypeId: parseInt(e.target.value) })}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      {locationTypes.length === 0 ? (
                        <option value="">กำลังโหลดประเภทสถานที่...</option>
                      ) : (
                        locationTypes.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))
                      )}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อสถานที่/สาขา *</label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  className="w-full px-4.5 py-3.5 min-h-[48px] rounded-2xl border border-slate-200 text-sm sm:text-base font-semibold text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                  placeholder="สาขาไอคอนสยาม"
                  required
                />
              </div>

              {/* Brand Selection (chip, multi-select) */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">
                  แบรนด์ที่ผูกกับสถานที่นี้
                </label>
                <BrandChipSelector
                  brands={activeBrands}
                  value={locationForm.boundBrandIds}
                  onChange={(ids) => setLocationForm(prev => ({
                    ...prev,
                    boundBrandIds: ids
                  }))}
                  mode="multi"
                />
              </div>

              {/* Region Selection / Custom Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-600">ภูมิภาค / เขต (Region)</label>
                  {!isCustomRegionAdd ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomRegionAdd(true);
                        setLocationForm(prev => ({ ...prev, region: '' }));
                      }}
                      className="text-xs text-[#0F6659] hover:text-emerald-800 font-bold cursor-pointer transition-colors"
                    >
                      + เพิ่มภูมิภาคใหม่
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomRegionAdd(false);
                        setLocationForm(prev => ({ ...prev, region: existingRegions[0] || 'กรุงเทพฯ และปริมณฑล' }));
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer transition-colors"
                    >
                      ← เลือกจากรายการ
                    </button>
                  )}
                </div>

                {!isCustomRegionAdd ? (
                  <div className="relative">
                    <select
                      value={locationForm.region || ''}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCustomRegionAdd(true);
                          setLocationForm(prev => ({ ...prev, region: '' }));
                        } else {
                          setLocationForm(prev => ({ ...prev, region: e.target.value }));
                        }
                      }}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      <option value="">-- เลือกภูมิภาค --</option>
                      {existingRegions.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={locationForm.region}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full px-4.5 py-3.5 min-h-[48px] rounded-2xl border border-emerald-300 focus:border-[#0F6659] text-sm sm:text-base font-semibold text-slate-800 bg-emerald-50/20 outline-none shadow-xs animate-in fade-in"
                    placeholder="พิมพ์ภูมิภาคใหม่ เช่น ภาคตะวันออก, ชลบุรี"
                    autoFocus
                  />
                )}
              </div>

              {/* 🗺️ Address & Interactive GPS Map Picker */}
              <LocationGpsSection
                form={locationForm}
                setForm={setLocationForm}
                showToast={showToast}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">เบอร์โทรติดต่อ</label>
                  <input
                    type="text"
                    value={locationForm.phone}
                    onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
                    className="w-full px-4 py-3.5 min-h-[48px] rounded-2xl border border-slate-200 text-sm sm:text-base font-semibold text-slate-800 bg-white focus:border-[#0F6659] outline-none shadow-xs"
                    placeholder="เช่น 02-xxx-xxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">ผู้จัดการประจำสาขา</label>
                  <div className="relative">
                    <select
                      value={locationForm.managerUserId || ''}
                      onChange={(e) => setLocationForm({ ...locationForm, managerUserId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full text-xs sm:text-sm pl-4 pr-10 py-3 min-h-[50px] rounded-2xl bg-slate-50 border border-slate-200 outline-none font-semibold text-slate-700 focus:border-[#0F6659] focus:bg-white transition-all shadow-xs cursor-pointer appearance-none truncate"
                    >
                      <option value="">-- ไม่ระบุ --</option>
                      {users.filter(u => u.roleCode === 'AUDITEE' || u.role?.code === 'AUDITEE' || (roles.find(r => r.id === u.roleId)?.code === 'AUDITEE')).map(u => (
                        <option key={u.id} value={u.id}>{u.fullName}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 pb-2 border-t border-slate-100 shrink-0 bg-white">
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
          <div className="p-5 sm:p-7 pb-6 sm:pb-8 space-y-4 sm:space-y-5 flex flex-col max-h-[85dvh]">
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

            <form onSubmit={handleSaveEditType} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
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
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ชื่อประเภท *</label>
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

              <div className="flex gap-3 pt-4 pb-2 border-t border-slate-100 shrink-0 bg-white">
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
          <div className="p-5 sm:p-7 pb-6 sm:pb-8 space-y-4 sm:space-y-5 flex flex-col max-h-[85dvh]">
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

            <form onSubmit={handleCreateLocationType} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
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

              <div className="flex gap-3 pt-4 pb-2 border-t border-slate-100 shrink-0 bg-white">
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
          <div className="p-5 sm:p-7 pb-6 sm:pb-8 space-y-4 sm:space-y-5 flex flex-col max-h-[85dvh]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Shield size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">กำหนดสิทธิ์บทบาท</h3>
                  <span className="text-xs font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-bold">{editRole.code}</span>
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

            <form onSubmit={handleSaveEditRole} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
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
                  {sortedPermissions.map(p => {
                    const isChecked = editRoleForm.permissionIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => togglePermissionForRole(p.id)}
                        className={`w-full p-3.5 rounded-xl text-left text-sm font-normal flex items-center justify-between transition-colors cursor-pointer ${
                          isChecked ? 'bg-emerald-50 text-emerald-950 border border-emerald-200 font-medium' : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="text-sm sm:text-base font-medium text-slate-800">{p.name}</div>
                          <div className="text-xs text-slate-400 font-mono truncate">{p.code} · {p.module}</div>
                        </div>
                        {isChecked ? <CheckSquare size={18} className="text-[#0F6659] shrink-0" /> : <Square size={18} className="text-slate-300 shrink-0" />}
                      </button>
                    );
                  })}
                  {sortedPermissions.length === 0 && (
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
          <div className="p-5 sm:p-7 pb-6 sm:pb-8 space-y-4 sm:space-y-5 flex flex-col max-h-[85dvh]">
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

            <form onSubmit={handleCreateRole} className="space-y-4 overflow-y-auto overscroll-contain flex-1 pr-1">
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

              <div className="flex gap-3 pt-4 pb-2 border-t border-slate-100 shrink-0 bg-white">
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

      {/* 5. MODAL: CUSTOMIZE ROLE NAVIGATION */}
      {customizingNavRole && (
        <RoleNavCustomizerModal
          role={customizingNavRole}
          onClose={() => setCustomizingNavRole(null)}
          onSaveSuccess={handleSaveNavSuccess}
        />
      )}

    </div>
  );
}