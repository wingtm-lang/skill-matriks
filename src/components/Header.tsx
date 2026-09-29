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
  const selectableFactories = activeTab === 'overall'
    ? ['All Factory', ...factoryList.filter(f => f !== 'All Factory')]
    : factoryList.filter(f => f !== 'All Factory');

  const lineList = sortLinesNumerically(
    availableLines && availableLines.length > 0 ? availableLines : LINES
  );

  const monthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => ({
    value: num,
    label: getMonthName(num),
  }));

  return (
    <header className="bg-white border border-[#D8E5E5] rounded-[16px] shadow-[0_4px_20px_rgba(22,63,59,0.04)] p-3.5 sm:p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        
        {/* Left Section: Mobile Toggle & Context Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-[10px] bg-[#EAF5F5] border border-[#D8E5E5] text-[#214E49] hover:bg-[#D4E8E8] transition-colors cursor-pointer"
            aria-label="Toggle Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <img
              src="/winners-logo.png"
              alt="PT. Winners International Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-[17px] font-bold text-[#102A2A] tracking-tight">
                  {t.header.companyName}
                </h2>
                {!isLive && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[6px] border bg-amber-50 text-amber-800 border-amber-200">
                    {t.header.mockBadge}
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-[#647878] font-medium">
                {t.header.systemSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Right Section: Factory, Line, Point-in-Time Date & Refresh */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 ml-auto">

          {/* Factory Selector */}
          <div className="flex items-center space-x-1.5 bg-[#FFFFFF] hover:bg-[#EAF5F5] border border-[#D8E5E5] hover:border-[#2E625C]/40 rounded-[10px] px-2.5 py-1.5 transition-colors">
            <Building2 className="w-3.5 h-3.5 text-[#2E625C]" />
            <span className="text-[11px] text-[#647878] font-medium hidden sm:inline">{t.header.factory}:</span>
            <select
              value={selectedFactory}
              onChange={(e) => onFactoryChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-[#102A2A] outline-none cursor-pointer pr-1"
            >
              {selectableFactories.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {/* Line Selector - only shown when on line-specific tabs */}
          {activeTab !== 'overall' && activeTab !== 'search' && activeTab !== 'users' && (
            <div className={`flex items-center space-x-1.5 border rounded-[10px] px-2.5 py-1.5 transition-colors ${
              normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b'
                ? 'bg-amber-50/70 border-amber-200 text-amber-800'
                : 'bg-[#FFFFFF] hover:bg-[#EAF5F5] border-[#D8E5E5] hover:border-[#2E625C]/40'
            }`}>
              <GitFork className={`w-3.5 h-3.5 ${
                normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' ? 'text-amber-500' : 'text-[#1477B8]'
              }`} />
              {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' ? (
                <span className="text-xs font-semibold text-amber-800/80 italic pr-1">
                  {t.header.noLineAvailable}
                </span>
              ) : (
                <select
                  value={selectedLine}
                  onChange={(e) => onLineChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-[#102A2A] outline-none cursor-pointer pr-1"
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
          <div className="flex items-center space-x-1.5 bg-[#FFFFFF] hover:bg-[#EAF5F5] border border-[#D8E5E5] hover:border-[#2E625C]/40 rounded-[10px] px-2.5 py-1.5 transition-colors" title="Point-in-Time Operational Reporting Filter">
            <Calendar className="w-3.5 h-3.5 text-[#2E625C]" />
            <span className="text-[11px] text-[#647878] font-medium hidden sm:inline">{t.header.period}</span>
            
            {/* Month Select */}
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange && onMonthChange(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-[#102A2A] outline-none cursor-pointer pr-1"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            <span className="text-[#A5BDBD] text-xs">/</span>

            {/* Year Select */}
            <select
              value={selectedYear}
              onChange={(e) => onYearChange && onYearChange(parseInt(e.target.value, 10))}
              className="bg-transparent text-xs font-bold text-[#102A2A] outline-none cursor-pointer"
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
              className="flex items-center space-x-1.5 bg-[#214E49] hover:bg-[#163F3B] text-white rounded-[10px] px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 shadow-xs"
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
