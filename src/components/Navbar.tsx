import React from 'react';
import { 
  Building2, 
  GitFork, 
  UserCheck, 
  TableProperties, 
  Target, 
  FileSpreadsheet,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { FACTORIES, LINES } from '../data/mockData';
import { 
  sortLinesNumerically, 
  sortFactoriesNumerically, 
  AVAILABLE_YEARS 
} from '../utils/ieCalculations';
import { useLanguage } from '../i18n/LanguageContext';

interface NavbarProps {
  selectedFactory: string;
  onFactoryChange: (factory: string) => void;
  selectedLine: string;
  onLineChange: (line: string) => void;
  selectedMonth?: number;
  onMonthChange?: (month: number) => void;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'VIEWER' | 'EDITOR' | 'ADMIN';
  onRoleChange: (role: 'VIEWER' | 'EDITOR' | 'ADMIN') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  selectedFactory,
  onFactoryChange,
  selectedLine,
  onLineChange,
  selectedMonth = 6,
  onMonthChange,
  selectedYear = 2026,
  onYearChange,
  activeTab,
  onTabChange,
  userRole,
  onRoleChange,
}) => {
  const { t, getMonthName } = useLanguage();

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 shadow-md">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Company Title */}
          <div className="flex items-center space-x-3.5">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {t.header.companyName}
                </h1>
                <span className="bg-blue-900/60 text-blue-300 text-[11px] font-semibold px-2 py-0.5 rounded border border-blue-700/50">
                  LEAN & IE DEPT
                </span>
              </div>
              <p className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
                <span>{t.header.systemSubtitle}</span>
              </p>
            </div>
          </div>

          {/* Controls: Factory, Line, Date & Role Selector */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Factory Selector */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-1 border border-slate-700">
              <span className="text-xs font-semibold px-2 text-slate-400 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                {t.header.factory}:
              </span>
              <select
                value={selectedFactory}
                onChange={(e) => onFactoryChange(e.target.value)}
                className="bg-slate-900 text-xs font-semibold text-white px-2.5 py-1.5 rounded-md border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {sortFactoriesNumerically(FACTORIES).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Line Selector */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-1 border border-slate-700">
              <span className="text-xs font-semibold px-2 text-slate-400 flex items-center gap-1">
                <GitFork className="w-3.5 h-3.5 text-indigo-400" />
                {t.header.line}:
              </span>
              <select
                value={selectedLine}
                onChange={(e) => onLineChange(e.target.value)}
                className="bg-slate-900 text-xs font-semibold text-white px-2.5 py-1.5 rounded-md border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
              >
                {sortLinesNumerically(LINES).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Point-in-Time Date Filter */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-1 border border-slate-700">
              <span className="text-xs font-semibold px-2 text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                {t.header.period}:
              </span>
              <select
                value={selectedMonth}
                onChange={(e) => onMonthChange && onMonthChange(parseInt(e.target.value, 10))}
                className="bg-slate-900 text-xs font-semibold text-white px-2 py-1.5 rounded-md border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer pr-1"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => onYearChange && onYearChange(parseInt(e.target.value, 10))}
                className="bg-slate-900 text-xs font-semibold text-white px-2 py-1.5 rounded-md border-none focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer ml-1"
              >
                {AVAILABLE_YEARS.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Authority / User Role Toggle */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-1 border border-slate-700">
              <span className="text-xs font-semibold px-2 text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {t.header.role}:
              </span>
              <select
                value={userRole}
                onChange={(e) => onRoleChange(e.target.value as any)}
                className="bg-slate-900 text-xs font-semibold text-emerald-400 px-2.5 py-1.5 rounded-md border-none focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
              >
                <option value="VIEWER">{t.header.roleViewer}</option>
                <option value="EDITOR">{t.header.roleEditor}</option>
                <option value="ADMIN">{t.header.roleAdmin}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-slate-900/90 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex overflow-x-auto no-scrollbar space-x-1 sm:space-x-2">
          
          <button
            onClick={() => onTabChange('matrix')}
            className={`px-3.5 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'matrix'
                ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            <span>{t.sidebar.navMatrix}</span>
          </button>

          <button
            onClick={() => onTabChange('training')}
            className={`px-3.5 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'training'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Target className="w-4 h-4 text-emerald-400" />
            <span>{t.sidebar.navTraining}</span>
          </button>

          <button
            onClick={() => onTabChange('sheets')}
            className={`px-3.5 py-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'sheets'
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span>{t.sidebar.navSheets}</span>
          </button>

        </div>
      </div>
    </header>
  );
};
