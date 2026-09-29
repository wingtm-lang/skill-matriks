import React, { useState } from 'react';
import { 
  X, 
  User, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  Save, 
  Eye, 
  EyeOff,
  Building2
} from 'lucide-react';
import { AuthUser } from '../types';
import { changePassword, updateUserDefaultView } from '../utils/authService';
import { useLanguage } from '../i18n/LanguageContext';

interface ProfileModalProps {
  user: AuthUser;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated?: (user: AuthUser) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const { language } = useLanguage();
  const [defaultView, setDefaultView] = useState<string>(user.defaultView || 'All Factory');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const isPasswordChangeAttempt = oldPassword.trim() || newPassword.trim() || confirmPassword.trim();

    try {
      let passwordSuccess = true;
      let viewSuccess = true;
      let messages: string[] = [];

      // 1. Update Default View Setting if changed
      if (defaultView !== user.defaultView) {
        const viewRes = await updateUserDefaultView(user.nik, defaultView);
        if (viewRes.success) {
          viewSuccess = true;
          messages.push(language === 'id' ? 'Tampilan default berhasil diperbarui' : 'Default view updated');
          if (onUserUpdated) {
            onUserUpdated({ ...user, defaultView });
          }
        } else {
          viewSuccess = false;
          setErrorMsg(viewRes.message);
        }
      }

      // 2. Change password if user entered password fields
      if (isPasswordChangeAttempt) {
        if (!oldPassword.trim()) {
          setErrorMsg(language === 'id' ? 'Password saat ini wajib diisi untuk mengubah password' : 'Current password is required');
          setIsLoading(false);
          return;
        }
        if (!newPassword.trim()) {
          setErrorMsg(language === 'id' ? 'Password baru tidak boleh kosong' : 'New password cannot be empty');
          setIsLoading(false);
          return;
        }
        if (newPassword.length < 4) {
          setErrorMsg(language === 'id' ? 'Password baru minimal 4 karakter' : 'New password must be at least 4 characters');
          setIsLoading(false);
          return;
        }
        if (newPassword !== confirmPassword) {
          setErrorMsg(language === 'id' ? 'Konfirmasi password baru tidak cocok' : 'Password confirmation does not match');
          setIsLoading(false);
          return;
        }

        const passRes = await changePassword(user.nik, oldPassword, newPassword);
        if (passRes.success) {
          passwordSuccess = true;
          messages.push(language === 'id' ? 'Password berhasil diperbarui' : 'Password updated');
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } else {
          passwordSuccess = false;
          setErrorMsg(passRes.message);
        }
      }

      if (passwordSuccess && viewSuccess && messages.length > 0) {
        setSuccessMsg(messages.join(' & ') + ' ' + (language === 'id' ? 'dan disinkronkan ke Google Sheets!' : 'and synced to Google Sheets!'));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[25pt] p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white rounded-[16px] max-w-md w-full shadow-2xl border border-[#D8E5E5] overflow-hidden my-auto sm:my-0">
        
        {/* Header without Account Details */}
        <div className="bg-[#214E49] text-white p-5 sm:p-6 flex items-center justify-between relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="flex items-center space-x-3 relative z-10">
            <div className="w-10 h-10 rounded-[10px] bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <User className="w-5 h-5 text-[#F4C430]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {user.name}
              </h3>
              <p className="text-xs text-[#A3C8C4] font-medium">
                NIK: {user.nik}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[8px] bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {errorMsg && (
              <div className="p-3 rounded-[10px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* 1. Pengaturan Tampilan Default (Refernsi Kolom AN Sheet by_worker) */}
            <div className="p-3.5 bg-[#EAF5F5] rounded-[12px] border border-[#D8E5E5] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#102A2A] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#214E49]" />
                  <span>{language === 'id' ? 'Tampilan Default Pabrik (Kolom AN)' : 'Default Factory View (Col AN)'}</span>
                </label>
                <span className="text-[10px] font-mono text-[#647878] bg-white px-2 py-0.5 rounded border border-[#D8E5E5]">by_worker!AN</span>
              </div>

              <select
                value={defaultView}
                onChange={(e) => setDefaultView(e.target.value)}
                className="w-full bg-white text-xs sm:text-sm px-3 py-2 rounded-[10px] border border-[#D8E5E5] text-[#102A2A] font-bold outline-none cursor-pointer focus:border-[#214E49]"
              >
                <option value="All Factory">All Factory (Semua Pabrik)</option>
                <option value="Factory 1">Factory 1</option>
                <option value="Factory 2">Factory 2</option>
                <option value="Factory 3">Factory 3</option>
                <option value="Factory 3B">Factory 3B</option>
                <option value="Factory 5">Factory 5</option>
                <option value="Factory 6">Factory 6</option>
              </select>
              <p className="text-[11px] text-[#647878]">
                {language === 'id'
                  ? 'Tampilan pabrik ini akan menjadi halaman awal otomatis saat Anda login.'
                  : 'This factory view will be selected automatically upon login.'}
              </p>
            </div>

            {/* 2. Section Header: Ubah Password */}
            <div className="flex items-center gap-2 pt-1 border-b border-[#D8E5E5] pb-2">
              <KeyRound className="w-4 h-4 text-[#214E49]" />
              <h4 className="text-xs sm:text-[13px] font-bold text-[#102A2A]">
                {language === 'id' ? 'Ubah Password (Opsional)' : 'Change Password (Optional)'}
              </h4>
            </div>

            {/* Old Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#102A2A]">
                {language === 'id' ? 'Password Saat Ini' : 'Current Password'}
              </label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={language === 'id' ? 'Masukkan password lama...' : 'Enter current password...'}
                  className="w-full bg-[#FFFFFF] text-xs sm:text-sm pl-3 pr-10 py-2.5 rounded-[10px] border border-[#D8E5E5] focus:border-[#214E49] outline-none text-[#102A2A]"
                />
                <button
                  type="button"
                  onClick={() => setShowOld(!showOld)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#647878] hover:text-[#102A2A] cursor-pointer"
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#102A2A]">
                {language === 'id' ? 'Password Baru' : 'New Password'}
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={language === 'id' ? 'Minimal 4 karakter...' : 'Min. 4 characters...'}
                  className="w-full bg-[#FFFFFF] text-xs sm:text-sm pl-3 pr-10 py-2.5 rounded-[10px] border border-[#D8E5E5] focus:border-[#214E49] outline-none text-[#102A2A]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#647878] hover:text-[#102A2A] cursor-pointer"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#102A2A]">
                {language === 'id' ? 'Konfirmasi Password Baru' : 'Confirm New Password'}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={language === 'id' ? 'Ulangi password baru...' : 'Repeat new password...'}
                  className="w-full bg-[#FFFFFF] text-xs sm:text-sm pl-3 pr-10 py-2.5 rounded-[10px] border border-[#D8E5E5] focus:border-[#214E49] outline-none text-[#102A2A]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#647878] hover:text-[#102A2A] cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-[#647878] hover:bg-[#EAF5F5] rounded-[8px] cursor-pointer transition-colors"
              >
                {language === 'id' ? 'Tutup' : 'Close'}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-[#214E49] hover:bg-[#163F3B] rounded-[8px] shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{language === 'id' ? 'Menyimpan...' : 'Saving...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{language === 'id' ? 'Simpan Pengaturan' : 'Save Settings'}</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
};
