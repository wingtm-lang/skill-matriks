import React from 'react';
import { 
  TableProperties, 
  Target, 
  Building2,
  X,
  Layers,
  ChevronRight,
  TrendingUp,
  Award,
  Languages
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  selectedFactory: string;
  selectedLine: string;
  totalOperatorsCount: number;
  totalActiveOperatorsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  isOpen,
  onClose,
  selectedFactory,
  selectedLine,
  totalOperatorsCount,
  totalActiveOperatorsCount = 0,
}) => {
  const { language, setLanguage, t } = useLanguage();

  interface NavItem {
    id: string;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }

  const navItems: NavItem[] = [
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
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-[#304848]/40 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-[#405858] text-[#DDE8E8] flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:h-screen lg:shrink-0 lg:rounded-r-3xl my-0 lg:my-3 lg:ml-3 lg:h-[calc(100vh-24px)]`}
      >
        {/* Top Branding */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/15 shadow-inner">
                <Building2 className="w-5 h-5 text-[#D0A018]" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-wider text-white uppercase font-sans">
                  {t.sidebar.brandTitle}
                </h1>
                <p className="text-[11px] text-[#C8D8D8] font-medium">
                  {t.sidebar.brandSubtitle}
                </p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden text-[#C8D8D8] hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Context Card in Sidebar */}
          <div className="mt-5 p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#C8D8D8] block">
                {t.sidebar.activeLine}
              </span>
              <div className="text-xs font-bold text-white mt-0.5">
                {selectedFactory} • {selectedLine}
              </div>
            </div>
            <span className="text-[11px] font-bold bg-[#D0A018] text-white px-2 py-0.5 rounded-full shadow-xs">
              {totalOperatorsCount} Op
            </span>
          </div>
        </div>

        {/* Bagian bawah Sidebar / di atas menu navigasi */}
        <div className="p-4 mx-4 my-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{t.sidebar.activeOpsLabel}</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {totalActiveOperatorsCount} <span className="text-xs font-normal text-slate-300">{t.common.personnel}</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">{t.sidebar.totalPopLabel}</p>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto no-scrollbar">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#C8D8D8]/70 px-3 mb-2">
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
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-left transition-all duration-200 group cursor-pointer relative ${
                  isActive
                    ? 'bg-white/12 text-white font-semibold shadow-xs'
                    : 'text-[#DDE8E8] hover:bg-white/6 hover:text-white'
                }`}
              >
                {/* Active Indicator Bar on Left */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1.5 bg-[#D0A018] rounded-r-full" />
                )}

                <div className="flex items-center space-x-3 ml-1">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-[#D0A018] text-white'
                        : 'bg-white/8 text-[#C8D8D8] group-hover:text-white group-hover:bg-white/12'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs tracking-tight">{item.label}</div>
                    <div className="text-[10px] text-[#C8D8D8] font-normal">
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge ? (
                  <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#D0A018] text-white">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight
                    className={`w-4 h-4 transition-transform ${
                      isActive
                        ? 'text-white translate-x-0.5'
                        : 'text-[#C8D8D8]/40 group-hover:text-[#C8D8D8]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer with Language Switcher */}
        <div className="p-4 m-4 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#C8D8D8]">
              <Languages className="w-3.5 h-3.5 text-[#D0A018]" />
              <span className="font-semibold text-white text-[11px]">{t.header.language}</span>
            </div>
            <div className="flex items-center bg-black/25 rounded-lg p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setLanguage('id')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                  language === 'id' ? 'bg-[#2AAFA3] text-white shadow-xs' : 'text-[#C8D8D8] hover:text-white'
                }`}
                title="Bahasa Indonesia"
              >
                ID
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md cursor-pointer transition-all ${
                  language === 'en' ? 'bg-[#2AAFA3] text-white shadow-xs' : 'text-[#C8D8D8] hover:text-white'
                }`}
                title="English"
              >
                EN
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 pt-2">
            <div className="flex items-start space-x-2 text-[#C8D8D8]">
              <Award className="w-3.5 h-3.5 text-[#D0A018] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white text-[11px] block leading-tight">
                  Manufacturing Excellence Team
                </span>
                <span className="text-[10px] text-[#C8D8D8] block mt-0.5 font-medium">
                  PT. Winners International
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

