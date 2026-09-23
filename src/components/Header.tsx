import React from 'react';
import { 
  Menu, 
  Building2, 
  GitFork, 
  RefreshCw, 
  Calendar
} from 'lucide-react';
import { FACTORIES, LINES } from '../data/mockData';
import { 
  sortLinesNumerically, 
  sortFactoriesNumerically, 
  normalizeFactoryName,
  AVAILABLE_YEARS 
} from '../utils/ieCalculations';
import { useLanguage } from '../i18n/LanguageContext';

interface HeaderProps {
  activeTab?: string;
  onToggleSidebar: () => void;
  selectedFactory: string;
  onFactoryChange: (factory: string) => void;
  selectedLine: string;
  onLineChange: (line: string) => void;
  selectedMonth?: number;
  onMonthChange?: (month: number) => void;
  selectedYear?: number;
  onYearChange?: (year: number) => void;
  availableFactories?: string[];
  availableLines?: string[];
  isLive?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onToggleSidebar,
  selectedFactory,
  onFactoryChange,
  selectedLine,
  onLineChange,
  selectedMonth = (new Date().getMonth() + 1),
  onMonthChange,
  selectedYear = (new Date().getFullYear()),
  onYearChange,
  availableFactories,
  availableLines,
  isLive = true,
  isLoading = false,
  onRefresh,
}) => {
  const { t, getMonthName } = useLanguage();

  const factoryList = sortFactoriesNumerically(
    availableFactories && availableFactories.length > 0 ? availableFactories : FACTORIES
  );
  const lineList = sortLinesNumerically(
    availableLines && availableLines.length > 0 ? availableLines : LINES
  );

  const monthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => ({
    value: num,
    label: getMonthName(num),
  }));

  return (
    <header className="bg-white border border-[#E0E8E8] rounded-2xl shadow-[0_4px_24px_rgba(48,72,72,0.05)] p-3 sm:p-4 mb-6">
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

          <div className="flex items-center space-x-3">
            <img
              src="/winners-logo.png"
              alt="PT. Winners International Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0 drop-shadow-2xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-[#304848] tracking-tight">
                  {t.header.companyName}
                </h2>
                {!isLive && (
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
                    {t.header.mockBadge}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-[#788888] font-normal">
                {t.header.systemSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: Factory, Line, Point-in-Time Date & Refresh */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 ml-auto">
          
          {/* Factory Selector */}
          <div className="flex items-center space-x-1.5 bg-[#F8F8F8] hover:bg-[#F2F6F6] border border-[#E0E8E8] hover:border-[#2AAFA3]/40 rounded-xl px-2.5 py-1.5 shadow-2xs transition-colors">
            <Building2 className="w-3.5 h-3.5 text-[#2AAFA3]" />
            <span className="text-[11px] text-[#788888] hidden sm:inline">{t.header.factory}:</span>
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

          {/* Line Selector - only shown when on line-specific tabs */}
          {activeTab !== 'overall' && activeTab !== 'search' && (
            <div className={`flex items-center space-x-1.5 border rounded-xl px-2.5 py-1.5 shadow-2xs transition-colors ${
              normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b'
                ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                : 'bg-[#F8F8F8] hover:bg-[#F2F6F6] border-[#E0E8E8] hover:border-[#D0A018]/40'
            }`}>
              <GitFork className={`w-3.5 h-3.5 ${
                normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' ? 'text-amber-500' : 'text-[#D0A018]'
              }`} />
              {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' ? (
                <span className="text-xs font-semibold text-amber-800/80 italic pr-1">
                  {t.header.noLineAvailable}
                </span>
              ) : (
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
              )}
            </div>
          )}

          {/* Point-in-Time Reporting Filter (Month & Year) */}
          <div className="flex items-center space-x-1.5 bg-[#F8F8F8] hover:bg-[#F2F6F6] border border-[#E0E8E8] hover:border-[#2AAFA3]/40 rounded-xl px-2.5 py-1.5 shadow-2xs transition-colors" title="Point-in-Time Reporting Filter">
            <Calendar className="w-3.5 h-3.5 text-[#2AAFA3]" />
            <span className="text-[11px] text-[#788888] hidden sm:inline">{t.header.period}</span>
            
            {/* Month Select */}
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange && onMonthChange(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-semibold text-[#304848] outline-none cursor-pointer pr-1"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <span className="text-[#C0D0D0] text-xs">/</span>

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

          {/* Refresh / Status Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title={t.header.syncTooltip}
              className="flex items-center space-x-1.5 bg-[#D9F1EF] hover:bg-[#c4ece9] text-[#247F77] border border-[#BDE5E2] rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isLoading ? t.common.syncing : t.common.sync}</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};

