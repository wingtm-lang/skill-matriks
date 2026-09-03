import React from 'react';
import { 
  Menu, 
  Building2, 
  GitFork, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles,
  Search,
  UserCheck,
  Calendar
} from 'lucide-react';
import { FACTORIES, LINES } from '../data/mockData';
import { 
  sortLinesNumerically, 
  sortFactoriesNumerically, 
  MONTH_NAMES_ID, 
  AVAILABLE_YEARS 
} from '../utils/ieCalculations';

interface HeaderProps {
  onToggleSidebar: () => void;
  selectedFactory: string;
  onFactoryChange: (factory: string) => void;
  selectedLine: string;
  onLineChange: (line: string) => void;
  selectedMonth?: number;
  onMonthChange?: (month: number) => void;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  userRole: 'VIEWER' | 'EDITOR' | 'ADMIN';
  onRoleChange: (role: 'VIEWER' | 'EDITOR' | 'ADMIN') => void;
  availableFactories?: string[];
  availableLines?: string[];
  isLive?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  selectedFactory,
  onFactoryChange,
  selectedLine,
  onLineChange,
  selectedMonth = 6,
  onMonthChange,
  selectedYear = 2026,
  onYearChange,
  userRole,
  onRoleChange,
  availableFactories,
  availableLines,
  isLive = true,
  isLoading = false,
  onRefresh,
}) => {
  const factoryList = sortFactoriesNumerically(
    availableFactories && availableFactories.length > 0 ? availableFactories : FACTORIES
  );
  const lineList = sortLinesNumerically(
    availableLines && availableLines.length > 0 ? availableLines : LINES
  );

  return (
    <header className="bg-white border border-[#E0E8E8] rounded-[20px] shadow-[0_8px_30px_rgba(48,72,72,0.06)] p-3 sm:p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        
        {/* Left Section: Mobile Toggle & Context Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl bg-[#F8F8F8] border border-[#E0E8E8] text-[#405858] hover:bg-[#E0E8E8] transition-colors cursor-pointer"
            aria-label="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[#304848] tracking-tight">
                PT. Winners International
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isLive 
                  ? 'bg-[#D9F1EF] text-[#247F77] border-[#BDE5E2]' 
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {isLive ? 'Google Sheets Live' : 'Mock Dataset'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#788888] font-normal">
              Sewing Skill Matrix & Automated Line Balancing
            </p>
          </div>
        </div>

        {/* Right Section: Factory, Line, Point-in-Time Date, Role Switcher & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 ml-auto">
          
          {/* Factory Selector */}
          <div className="flex items-center space-x-1.5 bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-[#2AAFA3]" />
            <select
              value={selectedFactory}
              onChange={(e) => onFactoryChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#304848] outline-none cursor-pointer pr-1"
            >
              {factoryList.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Line Selector */}
          <div className="flex items-center space-x-1.5 bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 shadow-2xs">
            <GitFork className="w-3.5 h-3.5 text-[#D0A018]" />
            <select
              value={selectedLine}
              onChange={(e) => onLineChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[#304848] outline-none cursor-pointer pr-1"
            >
              {lineList.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {/* Point-in-Time Reporting Filter (Month & Year) */}
          <div className="flex items-center space-x-1.5 bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 shadow-2xs" title="Point-in-Time Reporting Filter: Melihat snapshot lini produksi pada akhir bulan terpilih">
            <Calendar className="w-3.5 h-3.5 text-[#2AAFA3]" />
            <span className="text-[11px] text-[#788888] hidden sm:inline">Periode:</span>
            
            {/* Month Select */}
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange && onMonthChange(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-semibold text-[#304848] outline-none cursor-pointer pr-1"
            >
              {MONTH_NAMES_ID.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Year Select */}
            <select
              value={selectedYear}
              onChange={(e) => onYearChange && onYearChange(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-semibold text-[#304848] outline-none cursor-pointer"
            >
              {AVAILABLE_YEARS.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Authority / Role Selector */}
          <div className="flex items-center space-x-1.5 bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 shadow-2xs">
            <UserCheck className="w-3.5 h-3.5 text-[#405858]" />
            <span className="text-[11px] text-[#788888] hidden sm:inline">Role:</span>
            <select
              value={userRole}
              onChange={(e) => onRoleChange(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-[#405858] outline-none cursor-pointer"
            >
              <option value="VIEWER">Viewer (GM/Manager)</option>
              <option value="EDITOR">Editor (IE Staff)</option>
              <option value="ADMIN">Admin (Full Access)</option>
            </select>
          </div>

          {/* Refresh / Status Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Sinkronkan Ulang dari Google Sheets"
              className="flex items-center space-x-1.5 bg-[#D9F1EF] hover:bg-[#c4ece9] text-[#247F77] border border-[#BDE5E2] rounded-xl px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? 'Syncing...' : 'Sync'}</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
