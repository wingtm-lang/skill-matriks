import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Edit3, 
  Trash2, 
  Search, 
  RefreshCw, 
  KeyRound, 
  Shield, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Save, 
  Layers, 
  ExternalLink,
  Eye,
  EyeOff,
  UserCheck,
  Building,
  Info
} from 'lucide-react';
import { AuthUser, UserAccount, UserRole } from '../types';
import { fetchUsersList, addNewUser, updateUserAccount, deleteUser, normalizeRole } from '../utils/authService';
import { useLanguage } from '../i18n/LanguageContext';

interface UserManagementTabProps {
  currentUser: AuthUser;
}

export const UserManagementTab: React.FC<UserManagementTabProps> = ({ currentUser }) => {
  const { language } = useLanguage();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  // Form states
  const [formNik, setFormNik] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'viewer' | 'editor' | 'admin master'>('viewer');
  const [formDefaultView, setFormDefaultView] = useState<string>('All Factory');
  const [showPassword, setShowPassword] = useState(false);

  // Action status
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUsersList();
      setUsers(data);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Gagal memuat daftar pengguna' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter((u) => u.role === 'admin master').length;
    const editorCount = users.filter((u) => u.role === 'editor').length;
    const viewerCount = users.filter((u) => u.role === 'viewer').length;
    return { total, adminCount, editorCount, viewerCount };
  }, [users]);

  // Handle Add User
  const handleOpenAdd = () => {
    setFormNik('');
    setFormName('');
    setFormPassword('');
    setFormRole('viewer');
    setFormDefaultView('All Factory');
    setShowPassword(false);
    setIsAddModalOpen(true);
  };

  const handleSaveNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNik.trim() || !formName.trim() || !formPassword.trim()) {
      setToastMessage({ type: 'error', text: 'Semua field wajib diisi lengkap.' });
      return;
    }

    setActionLoading(true);
    try {
      const res = await addNewUser({
        nik: formNik.trim(),
        name: formName.trim(),
        password: formPassword.trim(),
        role: formRole,
        defaultView: formDefaultView,
      });

      if (res.success) {
        setToastMessage({ type: 'success', text: res.message });
        setIsAddModalOpen(false);
 loadUsers();
      } else {
        setToastMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Gagal menambahkan user' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Edit User
  const handleOpenEdit = (user: UserAccount) => {
    setSelectedUser(user);
    setFormNik(user.nik);
    setFormName(user.name);
    setFormPassword(user.password || '');
    setFormRole(normalizeRole(user.role));
    setFormDefaultView(user.defaultView || 'All Factory');
    setShowPassword(false);
    setIsEditModalOpen(true);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setToastMessage({ type: 'error', text: 'Nama profile tidak boleh kosong.' });
      return;
    }

    setActionLoading(true);
    try {
      const res = await updateUserAccount({
        nik: formNik,
        name: formName.trim(),
        password: formPassword.trim() || undefined,
        role: formRole,
        defaultView: formDefaultView,
      });

      if (res.success) {
        setToastMessage({ type: 'success', text: res.message });
        setIsEditModalOpen(false);
        loadUsers();
      } else {
        setToastMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Gagal memperbarui user' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete User
  const handleOpenDelete = (user: UserAccount) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const res = await deleteUser(selectedUser.nik);
      if (res.success) {
        setToastMessage({ type: 'success', text: res.message });
        setIsDeleteModalOpen(false);
        loadUsers();
      } else {
        setToastMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Gagal menghapus user' });
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadgeUI = (role: string) => {
    const clean = normalizeRole(role);
    if (clean === 'admin master') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1">
          <Shield className="w-3 h-3 text-amber-500" />
          Admin Master
        </span>
      );
    }
    if (clean === 'editor') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-300 flex items-center gap-1">
          <Edit3 className="w-3 h-3 text-teal-500" />
          Editor
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-300 flex items-center gap-1">
        <Users className="w-3 h-3 text-sky-500" />
        Viewer
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all shadow-md ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-black/5 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Hero Banner & Controls */}
      <div className="bg-white border border-[#E0E8E8] rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(48,72,72,0.05)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#183935] text-white flex items-center justify-center shadow-md">
                <ShieldCheck className="w-5 h-5 text-[#2AAFA3]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#183935] tracking-tight">
                  {language === 'id' ? 'Manajemen Pengguna & Hak Akses' : 'User Access & Account Management'}
                </h2>
                <p className="text-xs text-[#708888]">
                  {language === 'id'
                    ? 'Kelola NIK, password, dan level izin yang tersinkronisasi pada sheet "by_worker" Kolom AJ..AM'
                    : 'Manage NIK, passwords, and permission roles synced to sheet "by_worker" Col AJ..AM'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#F0F5F5] hover:bg-[#E2EBEB] text-[#405858] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2AAFA3] ${isLoading ? 'animate-spin' : ''}`} />
              <span>{language === 'id' ? 'Sinkronkan Data' : 'Sync Users'}</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2AAFA3] to-[#208E84] hover:from-[#35C2B5] hover:to-[#2AAFA3] text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{language === 'id' ? 'Tambah User Baru' : 'Add New User'}</span>
            </button>
          </div>
        </div>

        {/* 4 Statistics KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="p-3.5 rounded-2xl bg-[#F8FAFA] border border-[#E0E8E8]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#708888]">
              {language === 'id' ? 'Total Akun' : 'Total Accounts'}
            </span>
            <p className="text-2xl font-extrabold text-[#183935] mt-0.5">{stats.total}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Admin Master
              </span>
              <Shield className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-2xl font-extrabold text-amber-900 mt-0.5">{stats.adminCount}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                Editor
              </span>
              <Edit3 className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <p className="text-2xl font-extrabold text-teal-900 mt-0.5">{stats.editorCount}</p>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800">
                Viewer
              </span>
              <Users className="w-3.5 h-3.5 text-sky-600" />
            </div>
            <p className="text-2xl font-extrabold text-sky-900 mt-0.5">{stats.viewerCount}</p>
          </div>
        </div>

      </div>

      {/* User Table & Filter Section */}
      <div className="bg-white border border-[#E0E8E8] rounded-3xl p-5 sm:p-6 shadow-[0_4px_24px_rgba(48,72,72,0.05)]">
        
        {/* Search and Role Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
          
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#708888] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'id' ? 'Cari NIK atau Nama...' : 'Search NIK or Name...'}
              className="w-full pl-10 pr-3 py-2 bg-[#F8FAFA] text-xs text-[#304848] rounded-xl border border-[#D0E0E0] focus:border-[#2AAFA3] outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-[#708888] shrink-0">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#F8FAFA] text-xs font-semibold text-[#304848] border border-[#D0E0E0] rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              <option value="ALL">{language === 'id' ? 'Semua Role' : 'All Roles'}</option>
              <option value="admin master">Admin Master</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

        </div>

        {/* Users Data Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#E0E8E8]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F0F5F5] text-[#507070] font-bold border-b border-[#E0E8E8]">
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">NIK (Kolom AJ)</th>
                <th className="py-3 px-4">Log In Profile (Kolom AL)</th>
                <th className="py-3 px-4">Role (Kolom AM)</th>
                <th className="py-3 px-4">Tampilan Default (Kolom AN)</th>
                <th className="py-3 px-4">Password (Kolom AK)</th>
                <th className="py-3 px-4 text-center">Hak Akses</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#80A0A0]">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-[#2AAFA3] border-t-transparent rounded-full animate-spin" />
                        <span>Memuat akun...</span>
                      </div>
                    ) : (
                      'Tidak ada pengguna ditemukan dengan kriteria pencarian.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, index) => {
                  const isSelf = u.nik.toLowerCase() === currentUser.nik.toLowerCase();
                  return (
                    <tr key={`${u.nik}_${index}`} className="hover:bg-[#F8FAFA] transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-[#80A0A0]">{index + 1}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#183935]">
                        {u.nik}
                        {isSelf && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-[#2AAFA3]/15 text-[#2AAFA3] text-[9px] font-bold">
                            Anda
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#304848]">
                        {u.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {getRoleBadgeUI(u.role)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#214E49]">
                        <span className="px-2 py-0.5 rounded-md bg-[#EAF5F5] border border-[#D8E5E5] text-[11px] font-bold">
                          {u.defaultView || 'All Factory'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#709090]">
                        ••••••••
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] text-[#708888]">
                          {u.role === 'admin master'
                            ? 'Full Control & User Mgmt'
                            : u.role === 'editor'
                            ? 'Add / Edit / Delete Operator'
                            : 'Read-only'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 rounded-lg bg-[#F0F5F5] hover:bg-[#2AAFA3]/15 text-[#405858] hover:text-[#2AAFA3] transition-colors cursor-pointer"
                            title="Edit Akun"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => handleOpenDelete(u)}
                              className="p-1.5 rounded-lg bg-[#F0F5F5] hover:bg-rose-100 text-[#405858] hover:text-rose-600 transition-colors cursor-pointer"
                              title="Hapus Akun"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* MODAL: TAMBAH USER BARU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#E0E8E8] overflow-hidden">
            
            <div className="bg-[#183935] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-[#2AAFA3]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {language === 'id' ? 'Tambah Pengguna Baru' : 'Add New User'}
                  </h3>
                  <p className="text-xs text-[#A0B5B5]">
                    {language === 'id' ? 'Akan ditanamkan ke sheet "by_worker" Kolom AJ:AM' : 'Will be saved to sheet "by_worker" Col AJ:AM'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUser} className="p-5 sm:p-6 space-y-4">
              
              {/* NIK */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#405858]">
                  NIK / Worker Code (Kolom AJ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formNik}
                  onChange={(e) => setFormNik(e.target.value)}
                  placeholder="Contoh: 20240192 atau ADMIN02"
                  className="w-full bg-[#F8FAFA] text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-[#D0E0E0] focus:border-[#2AAFA3] outline-none"
                  required
                />
              </div>

              {/* Log In Profile / Nama */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#405858]">
                  Log In Profile / Nama Lengkap (Kolom AL) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Budi Santoso (Supervisor IE)"
                  className="w-full bg-[#F8FAFA] text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-[#D0E0E0] focus:border-[#2AAFA3] outline-none"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#405858]">
                  Password (Kolom AK) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Masukkan password akun..."
                    className="w-full bg-[#F8FAFA] text-xs sm:text-sm pl-3 pr-10 py-2.5 rounded-xl border border-[#D0E0E0] focus:border-[#2AAFA3] outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#80A0A0] hover:text-[#405858] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Tampilan Default Pabrik (Kolom AN) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#405858]">
                  Tampilan Default Pabrik (Kolom AN)
                </label>
                <select
                  value={formDefaultView}
                  onChange={(e) => setFormDefaultView(e.target.value)}
                  className="w-full bg-[#F8FAFA] text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-[#D0E0E0] focus:border-[#2AAFA3] outline-none cursor-pointer font-bold text-[#183935]"
                >
                  <option value="All Factory">All Factory (Semua Pabrik)</option>
                  <option value="Factory 1">Factory 1</option>
                  <option value="Factory 2">Factory 2</option>
                  <option value="Factory 3">Factory 3</option>
                  <option value="Factory 3B">Factory 3B</option>
                  <option value="Factory 5">Factory 5</option>
                  <option value="Factory 6">Factory 6</option>
                </select>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#405858]">
                  Pilih Role Akses (Kolom AM) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  
                  <div
                    onClick={() => setFormRole('viewer')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formRole === 'viewer'
                        ? 'border-[#2AAFA3] bg-teal-50/50 shadow-xs'
                        : 'border-[#E0E8E8] hover:bg-[#F8FAFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#183935]">Viewer</span>
                      <Users className="w-3.5 h-3.5 text-sky-600" />
                    </div>
                    <p className="text-[10px] text-[#708888]">Hanya melihat dashboard & matriks (read-only).</p>
                  </div>

                  <div
                    onClick={() => setFormRole('editor')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formRole === 'editor'
                        ? 'border-[#2AAFA3] bg-teal-50/50 shadow-xs'
                        : 'border-[#E0E8E8] hover:bg-[#F8FAFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#183935]">Editor</span>
                      <Edit3 className="w-3.5 h-3.5 text-[#2AAFA3]" />
                    </div>
                    <p className="text-[10px] text-[#708888]">Dapat menambah & menghapus operator.</p>
                  </div>

                  <div
                    onClick={() => setFormRole('admin master')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      formRole === 'admin master'
                        ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                        : 'border-[#E0E8E8] hover:bg-[#F8FAFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-amber-900">Admin Master</span>
                      <Shield className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <p className="text-[10px] text-[#708888]">Akses penuh & manajemen user.</p>
                  </div>

                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E0E8E8]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#607878] hover:bg-[#F0F5F5] rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#2AAFA3] hover:bg-[#22998F] rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan User Baru</span>
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: EDIT USER */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#E0E8E8] overflow-hidden">
            
            <div className="bg-[#183935] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-[#2AAFA3]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Edit Pengguna ({selectedUser.nik})
                  </h3>
                  <p className="text-xs text-[#A0B5B5]">
                    Perbarui profil, hak akses role, atau ubah password
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="p-5 sm:p-6 space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#405858]">NIK</label>
                <input
                  type="text"
                  value={formNik}
                  disabled
                  className="w-full bg-[#EAEAEA] text-xs font-mono px-3 py-2.5 rounded-xl border border-[#D0E0E0] text-[#707070] cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#405858]">Log In Profile / Nama Lengkap</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#F8FAFA] text-xs px-3 py-2.5 rounded-xl border border-[#D0E0E0] focus:border-[#2AAFA3] outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#405858]">Password Baru (Kosongkan jika tidak diubah)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Masukkan password baru..."
                    className="w-full bg-[#F8FAFA] text-xs pl-3 pr-10 py-2.5 rounded-xl border border-[#D0E0E0] focus:border-[#2AAFA3] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#80A0A0] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Tampilan Default Pabrik (Kolom AN) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#405858]">Tampilan Default Pabrik (Kolom AN)</label>
                <select
                  value={formDefaultView}
                  onChange={(e) => setFormDefaultView(e.target.value)}
                  className="w-full bg-[#F8FAFA] text-xs sm:text-sm px-3 py-2.5 rounded-xl border border-[#D0E0E0] focus:border-[#2AAFA3] outline-none cursor-pointer font-bold text-[#183935]"
                >
                  <option value="All Factory">All Factory (Semua Pabrik)</option>
                  <option value="Factory 1">Factory 1</option>
                  <option value="Factory 2">Factory 2</option>
                  <option value="Factory 3">Factory 3</option>
                  <option value="Factory 3B">Factory 3B</option>
                  <option value="Factory 5">Factory 5</option>
                  <option value="Factory 6">Factory 6</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#405858]">Role Akses</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['viewer', 'editor', 'admin master'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setFormRole(r)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        formRole === r
                          ? 'border-[#2AAFA3] bg-teal-50 text-[#183935] font-bold'
                          : 'border-[#E0E8E8] text-[#607878] hover:bg-[#F8FAFA]'
                      }`}
                    >
                      <span className="capitalize text-xs block">{r}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E0E8E8]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-[#607878] hover:bg-[#F0F5F5] rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#2AAFA3] hover:bg-[#22998F] rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {actionLoading ? 'Menyimpan...' : 'Perbarui Pengguna'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS USER */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#E0E8E8] p-5 sm:p-6 space-y-4">
            
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[#183935]">
                Hapus Akses Pengguna?
              </h3>
              <p className="text-xs text-[#708888]">
                Apakah Anda yakin ingin menghapus akses untuk <strong>{selectedUser.name}</strong> ({selectedUser.nik})? Data pada baris pengguna di Google Sheets akan dihapus.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-[#607878] hover:bg-[#F0F5F5] rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Menghapus...' : 'Ya, Hapus Pengguna'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
