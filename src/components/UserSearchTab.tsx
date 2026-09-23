import React, { useState, useMemo } from 'react';
import { 
  Search, 
  User, 
  Building2, 
  GitFork, 
  Clock, 
  Workflow, 
  Award, 
  Check, 
  Copy, 
  ArrowRight, 
  Grid, 
  List, 
  RotateCcw, 
  SlidersHorizontal,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { Operator } from '../types';
import { 
  getOperatorTotalPoints, 
  getGradeFromTotalPoints, 
  getOperatorMultiSkillCount,
  calculateWorkTimeMonths,
  sortLinesNumerically,
  sortFactoriesNumerically
} from '../utils/ieCalculations';
import { useLanguage } from '../i18n/LanguageContext';

interface UserSearchTabProps {
  operators: Operator[];
  availableFactories?: string[];
  availableLines?: string[];
  onNavigateToLine: (factory: string, line: string, operatorId?: string) => void;
  initialQuery?: string;
}

export const UserSearchTab: React.FC<UserSearchTabProps> = ({
  operators = [],
  availableFactories = [],
  availableLines = [],
  onNavigateToLine,
  initialQuery = '',
}) => {
  const { language, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedSkill, setSelectedSkill] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('NAME_ASC');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [copiedNik, setCopiedNik] = useState<string | null>(null);

  // Format Tenure (Masa Kerja)
  const formatTenure = (months: number) => {
    if (!months || months <= 0) return language === 'en' ? '0 Mos' : '0 Bln';
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years > 0 && rem > 0) {
      return language === 'en' 
        ? `${years}y ${rem}m (${months}m)` 
        : `${years} Thn ${rem} Bln (${months} Bln)`;
    } else if (years > 0) {
      return language === 'en' 
        ? `${years}y (${months}m)` 
        : `${years} Thn (${months} Bln)`;
    }
    return language === 'en' ? `${months} Mos` : `${months} Bln`;
  };

  // Copy NIK handler
  const handleCopyNik = (nik: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nik) return;
    navigator.clipboard.writeText(nik);
    setCopiedNik(nik);
    setTimeout(() => {
      setCopiedNik(null);
    }, 2000);
  };

  // Deduplicate and enrich operators
  const enrichedOperators = useMemo(() => {
    if (!operators || operators.length === 0) return [];

    const uniqueMap = new Map<string, any>();
    for (const op of operators) {
      const rawNik = (op.nik || op.id || '').trim();
      const rawName = (op.name || '').trim();
      if (!rawNik && !rawName) continue;

      const totalPoints = getOperatorTotalPoints(op);
      const tenureMonths = op.workTimeMonths ?? op.workMonth ?? calculateWorkTimeMonths(op.doj) ?? 0;
      const isHelper = op.status?.toUpperCase() === 'HELPER' || String(op.grade || '').toUpperCase() === 'HELPER' || totalPoints === 0;
      const gradeInfo = getGradeFromTotalPoints(totalPoints, isHelper);

      // Machine Breakdown
      const machineBreakdown = [
        { code: 'SN', label: 'Lockstitch', points: Math.round(op.lockstitch ?? 0) },
        { code: 'OL', label: 'Overlock', points: Math.round(op.overlock ?? 0) },
        { code: 'FS', label: 'Flatseam', points: Math.round(op.flatseam ?? 0) },
        { code: 'SP', label: 'Special', points: Math.round(op.special ?? 0) },
        { code: 'BH', label: 'Button Hole', points: Math.round(op.buttonHole ?? 0) },
        { code: 'BS', label: 'Button Set', points: Math.round(op.buttonSet ?? 0) },
        { code: 'CS', label: 'Chainstitch', points: Math.round(op.chainstitch ?? 0) },
        { code: 'BT', label: 'Bartack', points: Math.round(op.bartack ?? 0) },
      ];

      const activeMachines = machineBreakdown.filter(m => m.points > 0);
      const multiSkillCount = activeMachines.length > 0 ? activeMachines.length : getOperatorMultiSkillCount(op);

      const enriched = {
        ...op,
        totalPoints,
        tenureMonths,
        tenureText: formatTenure(tenureMonths),
        isHelper,
        gradeInfo,
        machineBreakdown,
        activeMachines,
        multiSkillCount,
        currentOperationDisplay: op.currentOperation || op.process || op.machine || '-',
      };

      const key = rawNik || op.id;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, enriched);
      } else {
        const prev = uniqueMap.get(key);
        if (enriched.totalPoints > prev.totalPoints || (!prev.currentOperation && enriched.currentOperation)) {
          uniqueMap.set(key, enriched);
        }
      }
    }

    return Array.from(uniqueMap.values());
  }, [operators, language]);

  // Dynamic factories and lines
  const factoryOptions = useMemo(() => {
    const list = new Set<string>();
    if (availableFactories && availableFactories.length > 0) {
      availableFactories.forEach(f => list.add(f));
    }
    enrichedOperators.forEach(op => {
      if (op.factory) list.add(op.factory);
    });
    return sortFactoriesNumerically(Array.from(list));
  }, [availableFactories, enrichedOperators]);

  const lineOptions = useMemo(() => {
    const list = new Set<string>();
    if (availableLines && availableLines.length > 0) {
      availableLines.forEach(l => list.add(l));
    }
    enrichedOperators.forEach(op => {
      if (selectedFactory === 'ALL' || op.factory === selectedFactory) {
        if (op.line) list.add(op.line);
      }
    });
    return sortLinesNumerically(Array.from(list));
  }, [availableLines, enrichedOperators, selectedFactory]);

  // Filter and Sort operators
  const filteredOperators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return enrichedOperators.filter(op => {
      // Search term filter
      if (q) {
        const matchNik = (op.nik || '').toLowerCase().includes(q);
        const matchName = (op.name || '').toLowerCase().includes(q);
        const matchOp = (op.currentOperationDisplay || '').toLowerCase().includes(q);
        const matchLine = (op.line || '').toLowerCase().includes(q);
        if (!matchNik && !matchName && !matchOp && !matchLine) return false;
      }

      // Factory filter
      if (selectedFactory !== 'ALL' && op.factory !== selectedFactory) return false;

      // Line filter
      if (selectedLine !== 'ALL' && op.line !== selectedLine) return false;

      // Grade filter
      if (selectedGrade !== 'ALL') {
        const opGrade = op.gradeInfo.grade.toUpperCase();
        if (selectedGrade === 'HELPER') {
          if (!op.isHelper && opGrade !== 'HELPER') return false;
        } else {
          if (opGrade !== selectedGrade) return false;
        }
      }

      // Skill filter
      if (selectedSkill !== 'ALL') {
        if (selectedSkill === 'MULTI' && op.multiSkillCount < 2) return false;
        if (selectedSkill === 'SINGLE' && (op.multiSkillCount !== 1 || op.isHelper)) return false;
        if (selectedSkill === 'HELPER' && (!op.isHelper && op.multiSkillCount > 0)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'NAME_DESC') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'TENURE_DESC') return (b.tenureMonths || 0) - (a.tenureMonths || 0);
      if (sortBy === 'TENURE_ASC') return (a.tenureMonths || 0) - (b.tenureMonths || 0);
      if (sortBy === 'POINTS_DESC') return (b.totalPoints || 0) - (a.totalPoints || 0);
      if (sortBy === 'NIK_ASC') return (a.nik || '').localeCompare(b.nik || '');
      return 0;
    });
  }, [enrichedOperators, searchQuery, selectedFactory, selectedLine, selectedGrade, selectedSkill, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredOperators.length;
    if (total === 0) return { total: 0, multiSkill: 0, multiSkillPct: 0, avgPoints: 0, avgTenure: 0 };

    const multiCount = filteredOperators.filter(op => op.multiSkillCount >= 2).length;
    const totalPointsSum = filteredOperators.reduce((acc, op) => acc + (op.totalPoints || 0), 0);
    const totalMonthsSum = filteredOperators.reduce((acc, op) => acc + (op.tenureMonths || 0), 0);

    return {
      total,
      multiSkill: multiCount,
      multiSkillPct: Math.round((multiCount / total) * 100),
      avgPoints: (totalPointsSum / total).toFixed(1),
      avgTenure: (totalMonthsSum / total).toFixed(1),
    };
  }, [filteredOperators]);

  const hasActiveFilters = searchQuery !== '' || selectedFactory !== 'ALL' || selectedLine !== 'ALL' || selectedGrade !== 'ALL' || selectedSkill !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedFactory('ALL');
    setSelectedLine('ALL');
    setSelectedGrade('ALL');
    setSelectedSkill('ALL');
    setSortBy('NAME_ASC');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* 1. HERO HEADER & SEARCH INPUT BANNER */}
      <div className="bg-gradient-to-r from-[#2C3E3E] via-[#354D4D] to-[#405858] rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-white/10 relative overflow-hidden">
        {/* Subtle decorative background shapes */}
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-[#2AAFA3]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 translate-y-12 w-48 h-48 bg-[#D0A018]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#2AAFA3]/25 text-emerald-300 text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border border-[#2AAFA3]/40">
              PT. Winners International IE & Lean System
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <User className="w-7 h-7 text-[#2AAFA3]" />
            <span>{t.searchTab.title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#C8D8D8] mt-1.5 leading-relaxed max-w-2xl">
            {t.searchTab.subtitle}
          </p>

          {/* Primary Search Input Bar */}
          <div className="mt-5 relative max-w-3xl">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-[#2AAFA3] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchTab.searchPlaceholder}
                className="w-full pl-12 pr-28 py-3 sm:py-3.5 bg-black/30 hover:bg-black/40 focus:bg-black/50 text-white placeholder:text-[#A0B5B5] border border-white/20 focus:border-[#2AAFA3] rounded-2xl outline-none text-sm transition-all shadow-inner focus:ring-4 focus:ring-[#2AAFA3]/20"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 px-3 py-1 bg-white/10 hover:bg-white/20 text-[#C8D8D8] hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  {t.sidebar.clearSearch}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER & TOOLBAR PANEL */}
      <div className="bg-white rounded-2xl p-4 border border-[#E0E8E8] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2 text-xs flex-1">
            <div className="flex items-center gap-1.5 text-[#5A6E6E] font-semibold pr-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#2AAFA3]" />
              <span className="hidden sm:inline">Filter:</span>
            </div>

            {/* Factory Filter */}
            <div className="relative">
              <select
                value={selectedFactory}
                onChange={(e) => {
                  setSelectedFactory(e.target.value);
                  setSelectedLine('ALL');
                }}
                aria-label={t.searchTab.filterFactory}
                className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
              >
                <option value="ALL">{t.searchTab.allFactories}</option>
                {factoryOptions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Line Filter */}
            <div className="relative">
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                aria-label={t.searchTab.filterLine}
                className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
              >
                <option value="ALL">{t.searchTab.allLines}</option>
                {lineOptions.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Grade Filter */}
            <div className="relative">
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                aria-label={t.searchTab.filterGrade}
                className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
              >
                <option value="ALL">{t.searchTab.allGrades}</option>
                <option value="S">Grade S (&gt;13 Pts)</option>
                <option value="A">Grade A (8-13 Pts)</option>
                <option value="B">Grade B (4-7 Pts)</option>
                <option value="C">Grade C (1-3 Pts)</option>
                <option value="HELPER">Helper (0 Pts)</option>
              </select>
              <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Skill Filter */}
            <div className="relative">
              <select
                value={selectedSkill}
                onChange={(e) => setSelectedSkill(e.target.value)}
                aria-label={t.searchTab.filterSkill}
                className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
              >
                <option value="ALL">{t.searchTab.allSkills}</option>
                <option value="MULTI">Multi-Skill (≥2 Mesin)</option>
                <option value="SINGLE">Single-Skill (1 Mesin)</option>
                <option value="HELPER">Helper (Non-Mesin)</option>
              </select>
              <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[#E05252] hover:text-[#C53030] hover:bg-rose-50 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t.searchTab.clearFilters}</span>
              </button>
            )}
          </div>

          {/* Sort & View Mode Switcher */}
          <div className="flex items-center gap-2 text-xs">
            {/* Sort Select */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label={t.searchTab.sortBy}
                className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
              >
                <option value="NAME_ASC">{t.searchTab.sortNameAsc}</option>
                <option value="NAME_DESC">{t.searchTab.sortNameDesc}</option>
                <option value="TENURE_DESC">{t.searchTab.sortTenureDesc}</option>
                <option value="TENURE_ASC">{t.searchTab.sortTenureAsc}</option>
                <option value="POINTS_DESC">{t.searchTab.sortPointsDesc}</option>
                <option value="NIK_ASC">{t.searchTab.sortNikAsc}</option>
              </select>
              <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-[#F0F4F4] p-0.5 rounded-xl border border-[#D5DFDF]">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                  viewMode === 'cards' 
                    ? 'bg-white text-[#2AAFA3] shadow-xs' 
                    : 'text-[#788888] hover:text-[#304848]'
                }`}
                title={t.searchTab.viewCard}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                  viewMode === 'table' 
                    ? 'bg-white text-[#2AAFA3] shadow-xs' 
                    : 'text-[#788888] hover:text-[#304848]'
                }`}
                title={t.searchTab.viewTable}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>

        {/* Results Counter & Stats Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF2F2] text-xs">
          <span className="text-[#5A6E6E] font-medium">
            {t.searchTab.showingCount.replace('{count}', String(stats.total)).replace('{total}', String(enrichedOperators.length))}
          </span>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 text-[#304848] font-semibold">
              <Award className="w-3.5 h-3.5 text-[#D0A018]" />
              <span>Multi-Skill:</span>
              <strong className="text-emerald-700">{stats.multiSkill} ({stats.multiSkillPct}%)</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-[#304848] font-semibold">
              <span>Avg Poin:</span>
              <strong className="text-[#2AAFA3]">{stats.avgPoints} Pts</strong>
            </span>
            <span className="inline-flex items-center gap-1 text-[#304848] font-semibold">
              <Clock className="w-3.5 h-3.5 text-sky-600" />
              <span>Avg Masa Kerja:</span>
              <strong className="text-sky-700">{stats.avgTenure} Bln</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. RESULTS DISPLAY AREA */}
      {filteredOperators.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl p-10 border border-[#E0E8E8] text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <User className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#304848]">{t.searchTab.noResults}</h3>
          <p className="text-xs text-[#788888] max-w-md mx-auto leading-relaxed">
            {t.searchTab.noResultsDesc}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#2AAFA3] text-white rounded-xl text-xs font-bold hover:bg-[#23958B] transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.searchTab.clearFilters}</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOperators.map((op) => {
            const hasCopied = copiedNik === (op.nik || op.id);

            return (
              <div
                key={op.id || op.nik}
                className="bg-white rounded-2xl border border-[#E0E8E8] hover:border-[#2AAFA3]/60 hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between space-y-3 group"
              >
                {/* 1. Header: Name, NIK with Copy, and Grade Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[#2C3E3E] group-hover:text-[#2AAFA3] transition-colors truncate">
                      {op.name || 'Unknown Operator'}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={(e) => handleCopyNik(op.nik || op.id, e)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#405858] bg-[#F2F6F6] hover:bg-[#E5EEEE] px-2 py-0.5 rounded-lg border border-[#D5DFDF] transition-colors cursor-pointer"
                        title={hasCopied ? t.searchTab.copyNikSuccess : 'Salin NIK'}
                      >
                        <span>{op.nik || op.id}</span>
                        {hasCopied ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 text-[#788888] opacity-70" />
                        )}
                      </button>

                      {op.status && op.status !== 'ACTIVE' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                          {op.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Grade Badge */}
                  <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase shadow-2xs shrink-0 ${op.gradeInfo.cssBadge}`}>
                    {op.gradeInfo.label}
                  </span>
                </div>

                {/* 2. Specs Grid: Factory/Line, Tenure, Current Operation, Skill */}
                <div className="bg-[#F8FAFA] rounded-xl p-2.5 border border-[#E8EEEE] text-xs space-y-2">
                  {/* Factory & Line + Tenure */}
                  <div className="grid grid-cols-2 gap-2 border-b border-[#E2EBEB] pb-2">
                    <div className="flex items-center gap-1.5 text-[#5A6E6E] truncate">
                      <Building2 className="w-3.5 h-3.5 text-[#2AAFA3] shrink-0" />
                      <span className="font-bold text-[#304848] truncate">
                        {op.factory} • {op.line}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#5A6E6E] truncate justify-end">
                      <Clock className="w-3.5 h-3.5 text-[#D0A018] shrink-0" />
                      <span className="font-bold text-[#304848] truncate" title={`Tenure: ${op.tenureText}`}>
                        {op.tenureText}
                      </span>
                    </div>
                  </div>

                  {/* Current Operation */}
                  <div className="flex items-center gap-2">
                    <Workflow className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <div className="truncate flex-1">
                      <span className="text-[10px] text-[#788888] block leading-none">Operasi Saat Ini:</span>
                      <span className="font-semibold text-[#2C3E3E] text-xs truncate block mt-0.5" title={op.currentOperationDisplay}>
                        {op.currentOperationDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Skill Status */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#E2EBEB] text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-[#D0A018] shrink-0" />
                      <span className="font-bold text-emerald-800">
                        {op.isHelper
                          ? 'Helper (Non-Mesin)'
                          : op.multiSkillCount >= 2
                          ? `Multi-Skill (${op.multiSkillCount} Mesin)`
                          : 'Single-Skill (1 Mesin)'}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[#D0A018] bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-xs">
                      {op.totalPoints} Pts
                    </span>
                  </div>
                </div>

                {/* 3. Poin Mesin Chips Breakdown */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-[#788888] uppercase tracking-wider block">
                    Poin Mesin ({op.activeMachines.length} Mesin Aktif)
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {op.machineBreakdown.map((m: any) => {
                      const hasPoints = m.points > 0;
                      return (
                        <span
                          key={m.code}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 border transition-colors ${
                            m.points === 3
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : m.points === 2
                              ? 'bg-sky-50 text-sky-800 border-sky-300'
                              : m.points === 1
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                          }`}
                          title={`${m.label}: ${m.points} Poin`}
                        >
                          <span>{m.code}</span>
                          <span className={hasPoints ? 'font-black' : ''}>{m.points}p</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Action Button */}
                <div className="pt-2 border-t border-[#EEF2F2]">
                  <button
                    type="button"
                    onClick={() => onNavigateToLine(op.factory || 'Factory 1', op.line || 'Line 1', op.id)}
                    className="w-full py-2 px-3 rounded-xl bg-[#2AAFA3]/10 hover:bg-[#2AAFA3] text-[#2AAFA3] hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer shadow-2xs group/btn"
                  >
                    <span>{t.searchTab.openInMatrix}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABULAR EXCEL/IE VIEW */
        <div className="bg-white rounded-2xl border border-[#E0E8E8] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F5F8F8] text-[#405858] font-bold border-b border-[#E0E8E8] uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">No</th>
                  <th className="px-3 py-3">NIK</th>
                  <th className="px-3 py-3">Nama Operator</th>
                  <th className="px-3 py-3">Lokasi (Pabrik & Lini)</th>
                  <th className="px-3 py-3">Masa Kerja</th>
                  <th className="px-3 py-3">Operasi Saat Ini</th>
                  <th className="px-3 py-3 text-center">Poin Mesin</th>
                  <th className="px-3 py-3">Kategori Skill</th>
                  <th className="px-3 py-3 text-center">Grade IE</th>
                  <th className="px-3 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F2]">
                {filteredOperators.map((op, idx) => {
                  const hasCopied = copiedNik === (op.nik || op.id);

                  return (
                    <tr key={op.id || op.nik} className="hover:bg-[#F9FCFC] transition-colors">
                      <td className="px-3 py-2.5 text-center text-[#788888] font-mono">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[#304848]">
                        <button
                          type="button"
                          onClick={(e) => handleCopyNik(op.nik || op.id, e)}
                          className="inline-flex items-center gap-1 hover:text-[#2AAFA3] cursor-pointer"
                          title="Klik untuk salin NIK"
                        >
                          <span>{op.nik || op.id}</span>
                          {hasCopied ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-[#788888] opacity-60" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-[#2C3E3E]">
                        {op.name}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-[#405858] font-semibold bg-[#F0F5F5] px-2 py-0.5 rounded-md border border-[#E0E8E8]">
                          <Building2 className="w-3 h-3 text-[#2AAFA3]" />
                          {op.factory} • {op.line}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[#405858]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#D0A018]" />
                          {op.tenureText}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[#304848] max-w-xs truncate" title={op.currentOperationDisplay}>
                        {op.currentOperationDisplay}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            {op.totalPoints} Pts
                          </span>
                          <span className="text-[10px] text-[#788888]">
                            ({op.activeMachines.length} Mesin)
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-emerald-800">
                        {op.isHelper
                          ? 'Helper'
                          : op.multiSkillCount >= 2
                          ? `Multi-Skill (${op.multiSkillCount})`
                          : 'Single-Skill'}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase ${op.gradeInfo.cssBadge}`}>
                          {op.gradeInfo.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onNavigateToLine(op.factory || 'Factory 1', op.line || 'Line 1', op.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2AAFA3]/10 hover:bg-[#2AAFA3] text-[#2AAFA3] hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                        >
                          <span>{t.searchTab.openInMatrix}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
