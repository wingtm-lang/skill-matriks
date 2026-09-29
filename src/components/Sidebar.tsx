import React, { useState } from 'react';
import { 
  LayoutDashboard,
  TableProperties, 
  Target, 
  X,
  ChevronRight,
  ChevronDown,
  Languages,
  Search,
  Users,
  User,
  LogOut,
  KeyRound
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { Operator, AuthUser } from '../types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  selectedFactory?: string;
  selectedLine?: string;
  totalOperatorsCount?: number;
  totalActiveOperatorsCount?: number;
  userRole?: string;
  onRoleChange?: (role: any) => void;
  operators?: Operator[];
  onNavigateToLine?: (factory: string, line: string) => void;
  currentUser?: AuthUser | null;
  onOpenProfile?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpen,
  onClose,
  totalActiveOperatorsCount = 0,
  currentUser,
  onOpenProfile,
  onLogout,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const userRoleClean = (currentUser?.role || 'viewer').toLowerCase();
  const isAdminMaster = userRoleClean.includes('master') || userRoleClean === 'admin';

  interface NavItem {
    id: string;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    adminOnly?: boolean;
  }

  const navItems: NavItem[] = [
    {
      id: 'overall',
      label: t.sidebar.navOverall,
      sublabel: t.sidebar.navOverallSub,
      icon: LayoutDashboard,
    },
    {
      id: 'matrix',
      label: t.sidebar.navMatrix,
      sublabel: t.sidebar.navMatrixSub,
      icon: TableProperties,
    },
    {
      id: 'training',
      label: t.sidebar.navTraining,
      sublabel: t.sidebar.navTrainingSub,
      icon: Target,
    },
    {
      id: 'search',
      label: t.sidebar.navSearch,
      sublabel: t.sidebar.navSearchSub,
      icon: Search,
    },
    ...(isAdminMaster
      ? [
          {
            id: 'users',
            label: language === 'id' ? 'Manajemen Pengguna' : 'User Management',
            sublabel: language === 'id' ? 'Kelola Hak Akses NIK' : 'Manage NIK Permissions',
            icon: Users,
            badge: 'Admin',
            adminOnly: true,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-[#163F3B]/50 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#214E49] text-[#E5F0ED] flex flex-col justify-between transition-transform duration-250 ease-in-out lg:translate-x-0 shadow-xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:h-screen lg:shrink-0 lg:rounded-r-[20px] my-0 lg:my-3 lg:ml-3 lg:h-[calc(100vh-24px)] border-r border-[#2E625C]/40`}
      >
        {/* Top Branding */}
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-[12px] bg-white p-1.5 flex items-center justify-center border border-white/20 shadow-xs shrink-0">
                <img
                  src="/winners-logo.png"
                  alt="PT. Winners International"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-white uppercase font-sans">
                  {t.sidebar.brandTitle}
                </h1>
                <p className="text-[11px] text-[#A3C8C4] font-medium">
                  {t.sidebar.brandSubtitle}
                </p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden text-[#A3C8C4] hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active Personnel Card (Human-Centric Helper Details) */}
        <div className="p-3 mx-4 my-1 bg-white/6 rounded-[14px] border border-white/10 backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-[#A3C8C4] font-bold uppercase tracking-wider">{t.sidebar.activeOpsLabel}</p>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-white mt-0.5 tabular-nums">
            {totalActiveOperatorsCount.toLocaleString()} <span className="text-xs font-normal text-[#A3C8C4]">{t.common.personnel}</span>
          </p>
          <p className="text-[10px] text-[#86ABA7] mt-0.5">{t.sidebar.totalPopLabel}</p>
        </div>

        {/* Quick Search Shortcut Bar */}
        <div className="px-4 pt-2 pb-1">
          <button
            type="button"
            onClick={() => {
              onTabChange('search');
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 text-xs bg-black/20 hover:bg-black/30 text-[#A3C8C4] hover:text-white border border-white/10 hover:border-[#8FC4D1]/40 rounded-[10px] outline-none transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-[#8FC4D1] group-hover:scale-110 transition-transform shrink-0" />
              <span className="truncate text-[11px]">{t.sidebar.searchPlaceholder}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#A3C8C4]/50 group-hover:text-white transition-colors shrink-0" />
          </button>
        </div>

        {/* MIDDLE SECTION: MAIN NAVIGATION */}
        <div className="flex-1 px-4 py-2 space-y-1 overflow-y-auto no-scrollbar">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#A3C8C4]/60 px-3 mb-2">
            Main Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-left transition-all duration-200 group cursor-pointer relative ${
                  isActive
                    ? 'bg-white/12 text-white font-semibold shadow-xs'
                    : 'text-[#D5E5E2] hover:bg-white/6 hover:text-white'
                }`}
              >
                {/* Active Indicator Bar on Left */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#F4C430] rounded-r-full" />
                )}

                <div className="flex items-center space-x-3 ml-1">
                  <div
                    className={`w-7 h-7 rounded-[8px] flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-[#F4C430] text-[#163F3B]'
                        : 'bg-white/8 text-[#A3C8C4] group-hover:text-white group-hover:bg-white/12'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold tracking-tight">{item.label}</div>
                    <div className="text-[10px] text-[#A3C8C4] font-normal">
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge ? (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-[6px] bg-[#F4C430] text-[#163F3B]">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isActive
                        ? 'text-white translate-x-0.5'
                        : 'text-[#A3C8C4]/40 group-hover:text-[#A3C8C4]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer with Collapsible User Menu & Language Switcher */}
        <div className="p-3 m-3 rounded-[14px] bg-white/6 border border-white/10 text-xs space-y-2.5">
          
          {/* User Account Info Bar (Clickable to Reveal Profile & Logout Actions) */}
          {currentUser && (
            <div className="bg-black/20 rounded-[10px] p-2 border border-white/10 transition-all">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="w-full flex items-center justify-between space-x-2 text-left cursor-pointer group hover:opacity-95"
                title={language === 'id' ? 'Klik untuk menu profil' : 'Click for profile menu'}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  {/* Profil Icon instead of initial/NIK */}
                  <div className="w-7 h-7 rounded-[8px] bg-[#2E625C] text-white flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-[#3B7B74] transition-colors">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    {currentUser.name}
                  </p>
                </div>

                <ChevronDown 
                  className={`w-3.5 h-3.5 text-[#A3C8C4] group-hover:text-white transition-transform duration-200 shrink-0 ${
                    isUserMenuOpen ? 'rotate-180 text-white' : ''
                  }`} 
                />
              </button>

              {/* Sembunyikan bagian profil dan layout (logout) di dalam nama (hanya tampil jika diklik) */}
              {isUserMenuOpen && (
                <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-white/10 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenProfile) onOpenProfile();
                      setIsUserMenuOpen(false);
                    }}
                    className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[6px] text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    title={language === 'id' ? 'Ubah Password & Profil' : 'Change Password & Profile'}
                  >
                    <KeyRound className="w-3 h-3 text-[#8FC4D1]" />
                    <span>{language === 'id' ? 'Profil' : 'Profile'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onLogout) onLogout();
                      setIsUserMenuOpen(false);
                    }}
                    className="px-2 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-[6px] text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    title={language === 'id' ? 'Keluar dari sesi' : 'Logout of session'}
                  >
                    <LogOut className="w-3 h-3 text-rose-400" />
                    <span>{language === 'id' ? 'Keluar' : 'Logout'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Language Switcher */}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center space-x-1.5 text-[#A3C8C4]">
              <Languages className="w-3.5 h-3.5 text-[#8FC4D1]" />
              <span className="font-bold text-white text-[11px]">{t.header.language}</span>
            </div>
            <div className="flex items-center bg-black/30 rounded-[8px] p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-[6px] cursor-pointer transition-all ${
                  language === 'en' 
                    ? 'bg-[#2E625C] text-white shadow-xs' 
                    : 'text-[#A3C8C4] hover:text-white'
                }`}
                title="English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('id')}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-[6px] cursor-pointer transition-all ${
                  language === 'id' 
                    ? 'bg-[#2E625C] text-white shadow-xs' 
                    : 'text-[#A3C8C4] hover:text-white'
                }`}
                title="Bahasa Indonesia"
              >
                ID
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-2">
            <div className="flex items-center space-x-2 text-[#A3C8C4]">
              <div className="w-4 h-4 rounded-sm bg-white p-0.5 shrink-0 flex items-center justify-center">
                <img
                  src="/winners-logo.png"
                  alt="PT. Winners International"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[10px] text-[#86ABA7] block truncate font-medium">
                PT. Winners International &copy; 2026
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
