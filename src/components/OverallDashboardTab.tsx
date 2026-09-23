import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  Users, 
  Award, 
  Sparkles, 
  TrendingUp, 
  Layers, 
  ChevronRight, 
  CheckCircle2, 
  Filter,
  BarChart2,
  PieChart,
  ArrowUpRight,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { Operator, LineLeader } from '../types';
import { 
  filterOperatorsByPointInTime, 
  getOperatorMultiSkillCount, 
  normalizeFactoryName,
  normalizeLineName,
  sortLinesNumerically
} from '../utils/ieCalculations';
import { getOperatorTotalPoints } from '../data/mockData';
import { useLanguage } from '../i18n/LanguageContext';

interface OverallDashboardTabProps {
  operators: Operator[];
  availableFactories: string[];
  selectedFactory: string;
  onFactoryChange: (factory: string) => void;
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  selectedYear: number;
  onYearChange: (year: number) => void;
  onNavigateToLine: (factory: string, line: string) => void;
  lineLeaders?: LineLeader[];
}

export const OverallDashboardTab: React.FC<OverallDashboardTabProps> = ({
  operators,
  availableFactories,
  selectedFactory,
  onFactoryChange,
  selectedMonth,
  onMonthChange,
  selectedYear,
  onYearChange,
  onNavigateToLine,
  lineLeaders = []
}) => {
  const { t, getMonthName } = useLanguage();
  const [lineSearch, setLineSearch] = useState('');

  // 1. Data point-in-time untuk Factory yang dipilih pada bulan/tahun aktif
  const currentFactoryOps = useMemo(() => {
    return filterOperatorsByPointInTime(operators, selectedMonth, selectedYear, selectedFactory);
  }, [operators, selectedMonth, selectedYear, selectedFactory]);

  // Statistik untuk 1 Factory terpilih
  const factoryStats = useMemo(() => {
    const total = currentFactoryOps.length;
    let countS = 0;
    let countA = 0;
    let countB = 0;
    let countC = 0;
    let countHelper = 0;
    let totalPoints = 0;
    let multiSkillCount = 0;

    currentFactoryOps.forEach((op) => {
      const pts = op.points || getOperatorTotalPoints(op);
      totalPoints += pts;

      const isHelper = op.grade === 'HELPER' || op.status?.toUpperCase() === 'HELPER' || pts <= 0;
      if (isHelper) {
        countHelper++;
      } else if (op.grade === 'S' || pts > 13) {
        countS++;
      } else if (op.grade === 'A' || pts >= 8) {
        countA++;
      } else if (op.grade === 'B' || pts >= 4) {
        countB++;
      } else {
        countC++;
      }

      if (getOperatorMultiSkillCount(op) >= 2) {
        multiSkillCount++;
      }
    });

    const pct = (c: number) => (total > 0 ? ((c / total) * 100).toFixed(1) : '0.0');
    const multiSkillRate = total > 0 ? Math.round((multiSkillCount / total) * 100) : 0;
    const avgPoints = total > 0 ? (totalPoints / total).toFixed(1) : '0.0';

    return {
      total,
      countS,
      pctS: pct(countS),
      countA,
      pctA: pct(countA),
      countB,
      pctB: pct(countB),
      countC,
      pctC: pct(countC),
      countHelper,
      pctHelper: pct(countHelper),
      multiSkillCount,
      multiSkillRate,
      avgPoints
    };
  }, [currentFactoryOps]);

  // Breakdown per Line di dalam 1 Factory terpilih
  const linesBreakdown = useMemo(() => {
    const linesMap = new Map<string, {
      line: string;
      total: number;
      countS: number;
      countA: number;
      countB: number;
      countC: number;
      countHelper: number;
      multiSkillCount: number;
      leader?: LineLeader;
    }>();

    currentFactoryOps.forEach((op) => {
      const lName = normalizeLineName(op.dominantLine || op.line || '1');
      if (!linesMap.has(lName)) {
        const foundLeader = lineLeaders.find(
          (ll) => ll.factory === selectedFactory && ll.line === lName
        );
        linesMap.set(lName, {
          line: lName,
          total: 0,
          countS: 0,
          countA: 0,
          countB: 0,
          countC: 0,
          countHelper: 0,
          multiSkillCount: 0,
          leader: foundLeader
        });
      }

      const item = linesMap.get(lName)!;
      item.total++;

      const pts = op.points || getOperatorTotalPoints(op);
      const isHelper = op.grade === 'HELPER' || op.status?.toUpperCase() === 'HELPER' || pts <= 0;
      if (isHelper) {
        item.countHelper++;
      } else if (op.grade === 'S' || pts > 13) {
        item.countS++;
      } else if (op.grade === 'A' || pts >= 8) {
        item.countA++;
      } else if (op.grade === 'B' || pts >= 4) {
        item.countB++;
      } else {
        item.countC++;
      }

      if (getOperatorMultiSkillCount(op) >= 2) {
        item.multiSkillCount++;
      }
    });

    const list = Array.from(linesMap.values());
    const sorted = sortLinesNumerically(list.map(l => l.line));
    return sorted.map(lineName => linesMap.get(lineName)!).filter(Boolean);
  }, [currentFactoryOps, selectedFactory, lineLeaders]);

  const filteredLines = useMemo(() => {
    if (!lineSearch.trim()) return linesBreakdown;
    const query = lineSearch.toLowerCase();
    return linesBreakdown.filter(l => 
      l.line.toLowerCase().includes(query) ||
      (l.leader?.chief && l.leader.chief.toLowerCase().includes(query)) ||
      (l.leader?.supervisor && l.leader.supervisor.toLowerCase().includes(query))
    );
  }, [linesBreakdown, lineSearch]);

  // 2. Data Point-in-Time untuk SELURUH FACTORY pada bulan/tahun aktif yang sama
  const allFactoriesComparison = useMemo(() => {
    return availableFactories.map((fac) => {
      const is3B = normalizeFactoryName(fac).toLowerCase() === 'factory 3b';
      if (is3B) {
        return {
          factory: fac,
          total: 0,
          countS: 0,
          pctS: '0.0',
          countA: 0,
          pctA: '0.0',
          countB: 0,
          pctB: '0.0',
          countC: 0,
          pctC: '0.0',
          countHelper: 0,
          pctHelper: '0.0',
          multiSkillCount: 0,
          multiSkillRate: 0,
          avgPoints: '0.0',
          hasNoData: true
        };
      }

      const ops = filterOperatorsByPointInTime(operators, selectedMonth, selectedYear, fac);
      const total = ops.length;
      let countS = 0;
      let countA = 0;
      let countB = 0;
      let countC = 0;
      let countHelper = 0;
      let totalPts = 0;
      let multiSkillCount = 0;

      ops.forEach((op) => {
        const pts = op.points || getOperatorTotalPoints(op);
        totalPts += pts;
        const isHelper = op.grade === 'HELPER' || op.status?.toUpperCase() === 'HELPER' || pts <= 0;
        if (isHelper) {
          countHelper++;
        } else if (op.grade === 'S' || pts > 13) {
          countS++;
        } else if (op.grade === 'A' || pts >= 8) {
          countA++;
        } else if (op.grade === 'B' || pts >= 4) {
          countB++;
        } else {
          countC++;
        }

        if (getOperatorMultiSkillCount(op) >= 2) {
          multiSkillCount++;
        }
      });

      const pct = (c: number) => (total > 0 ? ((c / total) * 100).toFixed(1) : '0.0');
      const multiSkillRate = total > 0 ? Math.round((multiSkillCount / total) * 100) : 0;
      const avgPoints = total > 0 ? (totalPts / total).toFixed(1) : '0.0';

      return {
        factory: fac,
        total,
        countS,
        pctS: pct(countS),
        countA,
        pctA: pct(countA),
        countB,
        pctB: pct(countB),
        countC,
        pctC: pct(countC),
        countHelper,
        pctHelper: pct(countHelper),
        multiSkillCount,
        multiSkillRate,
        avgPoints
      };
    });
  }, [operators, availableFactories, selectedMonth, selectedYear]);

  // Grand Total Perusahaan (akumulasi semua factory di periode aktif)
  const enterpriseTotals = useMemo(() => {
    let grandTotal = 0;
    let s = 0;
    let a = 0;
    let b = 0;
    let c = 0;
    let helper = 0;
    let ms = 0;

    allFactoriesComparison.forEach((f) => {
      grandTotal += f.total;
      s += f.countS;
      a += f.countA;
      b += f.countB;
      c += f.countC;
      helper += f.countHelper;
      ms += f.multiSkillCount;
    });

    const msRate = grandTotal > 0 ? Math.round((ms / grandTotal) * 100) : 0;

    return {
      grandTotal,
      s,
      a,
      b,
      c,
      helper,
      ms,
      msRate
    };
  }, [allFactoriesComparison]);

  const monthLabel = getMonthName(selectedMonth);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* SECTION 1 HEADER CARD: Elevated White Container Grounded Cleanly */}
      <div className="bg-white rounded-2xl border border-[#E0E8E8] p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#244646] flex items-center justify-center text-[#D0A018] shadow-2xs shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {selectedFactory}
              </h1>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-[#247F77] bg-[#D9F1EF] px-2.5 py-0.5 rounded-md border border-[#247F77]/20">
                {monthLabel} {selectedYear}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {t.overallDashboard.tabSubtitle}
            </p>
          </div>
        </div>

        {/* Quick KPI Stats */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs shadow-2xs">
            <span className="text-slate-500 font-medium">{t.overallDashboard.avgScoreLabel}</span>
            <span className="font-mono font-bold text-[#244646]">
              {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' ? '-' : `${factoryStats.avgPoints} Pts`}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs shadow-2xs">
            <span className="text-slate-500 font-medium">{t.overallDashboard.multiSkillLabel}</span>
            <span className="font-mono font-bold text-[#D0A018]">
              {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' ? '-' : `${factoryStats.multiSkillRate}%`}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: PROFIL DETAIL 1 FACTORY TERPILIH */}
      <section className="space-y-5">
        {/* Khusus Factory 3B: Info bahwa data belum ada dan dikosongkan agar tidak rancu */}
        {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-800 shrink-0">
              <Building2 className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                {t.overallDashboard.f3bWarningTitle}
              </h4>
              <p className="text-xs text-amber-800/90 mt-0.5 leading-relaxed">
                {t.overallDashboard.f3bWarningDesc}
              </p>
            </div>
          </div>
        )}

        {/* HERO METRIC CARDS: TOTAL OPERATOR & GRADE S, A, B, C, HELPER */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          
          {/* 1. Total Operator Card */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1 bg-[#244646] text-white rounded-2xl p-4.5 shadow-md flex flex-col justify-between border border-[#1b3434] relative overflow-hidden">
            <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
            <div>
              <div className="flex items-center justify-between text-[#C8D8D8]">
                <span className="text-[11px] font-bold uppercase tracking-wider">{t.overallDashboard.totalOperatorCardTitle}</span>
                <Users className="w-4 h-4 text-[#D0A018]" />
              </div>
              <div className="text-3xl font-black tracking-tight mt-2 text-white">
                {factoryStats.total}
              </div>
              <p className="text-[11px] text-[#A0B5B5] mt-0.5">
                {t.overallDashboard.totalOperatorPopSubtitle.replace('{factory}', selectedFactory)}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-[#C8D8D8]">{t.overallDashboard.multiSkillOfTotal}</span>
              <span className="font-bold text-[#D0A018]">{factoryStats.multiSkillRate}% ({factoryStats.multiSkillCount} {t.overallDashboard.opUnit})</span>
            </div>
          </div>

          {/* 2. Grade S Card */}
          <div className="bg-white rounded-2xl p-4 border-2 border-emerald-500/30 hover:border-emerald-500 transition-all duration-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {t.overallDashboard.gradeSTitle}
                </span>
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-950 mt-2">
                {factoryStats.countS}
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                {factoryStats.pctS}% {t.overallDashboard.ofTotal}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
              <span>{t.overallDashboard.criteriaLabel}</span>
              <span className="font-semibold text-slate-700">{t.overallDashboard.criteriaS}</span>
            </div>
          </div>

          {/* 3. Grade A Card */}
          <div className="bg-white rounded-2xl p-4 border-2 border-teal-500/30 hover:border-teal-500 transition-all duration-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {t.overallDashboard.gradeATitle}
                </span>
                <Award className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-teal-950 mt-2">
                {factoryStats.countA}
              </div>
              <p className="text-[11px] text-teal-700 font-semibold mt-0.5">
                {factoryStats.pctA}% {t.overallDashboard.ofTotal}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
              <span>{t.overallDashboard.criteriaLabel}</span>
              <span className="font-semibold text-slate-700">{t.overallDashboard.criteriaA}</span>
            </div>
          </div>

          {/* 4. Grade B Card */}
          <div className="bg-white rounded-2xl p-4 border-2 border-sky-500/30 hover:border-sky-500 transition-all duration-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                  {t.overallDashboard.gradeBTitle}
                </span>
                <TrendingUp className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-sky-950 mt-2">
                {factoryStats.countB}
              </div>
              <p className="text-[11px] text-sky-700 font-semibold mt-0.5">
                {factoryStats.pctB}% {t.overallDashboard.ofTotal}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
              <span>{t.overallDashboard.criteriaLabel}</span>
              <span className="font-semibold text-slate-700">{t.overallDashboard.criteriaB}</span>
            </div>
          </div>

          {/* 5. Grade C Card */}
          <div className="bg-white rounded-2xl p-4 border-2 border-amber-500/30 hover:border-amber-500 transition-all duration-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {t.overallDashboard.gradeCTitle}
                </span>
                <Layers className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-950 mt-2">
                {factoryStats.countC}
              </div>
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                {factoryStats.pctC}% {t.overallDashboard.ofTotal}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
              <span>{t.overallDashboard.criteriaLabel}</span>
              <span className="font-semibold text-slate-700">{t.overallDashboard.criteriaC}</span>
            </div>
          </div>

          {/* 6. Helper Card */}
          <div className="bg-white rounded-2xl p-4 border-2 border-slate-400/30 hover:border-slate-500 transition-all duration-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300">
                  {t.overallDashboard.helperTitle}
                </span>
                <ShieldCheck className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                {factoryStats.countHelper}
              </div>
              <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
                {factoryStats.pctHelper}% {t.overallDashboard.ofTotal}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
              <span>{t.overallDashboard.criteriaLabel}</span>
              <span className="font-semibold text-slate-700">{t.overallDashboard.criteriaHelper}</span>
            </div>
          </div>

        </div>

        {/* VISUAL SEGMENTED GRADE DISTRIBUTION PROGRESS BAR */}
        <div className="bg-white rounded-2xl p-5 border border-[#D5E2E2] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#244646]" />
              {t.overallDashboard.visualDistTitle.replace('{factory}', selectedFactory).replace('{period}', `${monthLabel} ${selectedYear}`)}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Total: <strong className="text-slate-900">{t.overallDashboard.totalOperatorsLabel.replace('{total}', String(factoryStats.total))}</strong>
            </span>
          </div>

          {/* The Multi-Segment Bar */}
          <div className="h-5 w-full bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
            {factoryStats.countS > 0 && (
              <div 
                style={{ width: `${factoryStats.pctS}%` }} 
                className="bg-[#059669] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] text-white font-bold"
                title={`Grade S: ${factoryStats.countS} ${t.overallDashboard.opUnit} (${factoryStats.pctS}%)`}
              >
                {parseFloat(factoryStats.pctS) >= 7 && `S: ${factoryStats.pctS}%`}
              </div>
            )}
            {factoryStats.countA > 0 && (
              <div 
                style={{ width: `${factoryStats.pctA}%` }} 
                className="bg-[#0d9488] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] text-white font-bold"
                title={`Grade A: ${factoryStats.countA} ${t.overallDashboard.opUnit} (${factoryStats.pctA}%)`}
              >
                {parseFloat(factoryStats.pctA) >= 7 && `A: ${factoryStats.pctA}%`}
              </div>
            )}
            {factoryStats.countB > 0 && (
              <div 
                style={{ width: `${factoryStats.pctB}%` }} 
                className="bg-[#0284c7] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] text-white font-bold"
                title={`Grade B: ${factoryStats.countB} ${t.overallDashboard.opUnit} (${factoryStats.pctB}%)`}
              >
                {parseFloat(factoryStats.pctB) >= 7 && `B: ${factoryStats.pctB}%`}
              </div>
            )}
            {factoryStats.countC > 0 && (
              <div 
                style={{ width: `${factoryStats.pctC}%` }} 
                className="bg-[#d97706] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] text-white font-bold"
                title={`Grade C: ${factoryStats.countC} ${t.overallDashboard.opUnit} (${factoryStats.pctC}%)`}
              >
                {parseFloat(factoryStats.pctC) >= 7 && `C: ${factoryStats.pctC}%`}
              </div>
            )}
            {factoryStats.countHelper > 0 && (
              <div 
                style={{ width: `${factoryStats.pctHelper}%` }} 
                className="bg-[#475569] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[10px] text-white font-bold"
                title={`Helper: ${factoryStats.countHelper} ${t.overallDashboard.opUnit} (${factoryStats.pctHelper}%)`}
              >
                {parseFloat(factoryStats.pctHelper) >= 7 && `H: ${factoryStats.pctHelper}%`}
              </div>
            )}
          </div>

          {/* Legend Items */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#059669]" />
              <span className="text-slate-600 font-medium">Grade S: <strong className="text-slate-900">{factoryStats.countS}</strong> ({factoryStats.pctS}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#0d9488]" />
              <span className="text-slate-600 font-medium">Grade A: <strong className="text-slate-900">{factoryStats.countA}</strong> ({factoryStats.pctA}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#0284c7]" />
              <span className="text-slate-600 font-medium">Grade B: <strong className="text-slate-900">{factoryStats.countB}</strong> ({factoryStats.pctB}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#d97706]" />
              <span className="text-slate-600 font-medium">Grade C: <strong className="text-slate-900">{factoryStats.countC}</strong> ({factoryStats.pctC}%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-[#475569]" />
              <span className="text-slate-600 font-medium">Helper: <strong className="text-slate-900">{factoryStats.countHelper}</strong> ({factoryStats.pctHelper}%)</span>
            </div>
          </div>
        </div>

        {/* BREAKDOWN PER LINE DI FACTORY INI */}
        <div className="bg-white rounded-3xl p-6 border border-[#D5E2E2] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#244646]" />
                {t.overallDashboard.lineBreakdownTitle.replace('{factory}', selectedFactory)}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.overallDashboard.lineBreakdownSubtitle}
              </p>
            </div>

            {/* Quick Line Search */}
            <div className="flex items-center gap-2 bg-[#F4F8F8] px-3 py-1.5 rounded-xl border border-[#D5E2E2] max-w-xs w-full sm:w-auto">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={lineSearch}
                onChange={(e) => setLineSearch(e.target.value)}
                placeholder={t.overallDashboard.searchLinePlaceholder}
                className="text-xs bg-transparent outline-hidden w-full placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Table of Lines */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#244646] text-white font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">{t.overallDashboard.thLine}</th>
                  <th className="py-3 px-3">{t.overallDashboard.thChief}</th>
                  <th className="py-3 px-3 text-center">{t.overallDashboard.thTotalOp}</th>
                  <th className="py-3 px-3 text-center bg-emerald-800/80">{t.overallDashboard.thGradeS}</th>
                  <th className="py-3 px-3 text-center bg-teal-800/80">{t.overallDashboard.thGradeA}</th>
                  <th className="py-3 px-3 text-center bg-sky-800/80">{t.overallDashboard.thGradeB}</th>
                  <th className="py-3 px-3 text-center bg-amber-800/80">{t.overallDashboard.thGradeC}</th>
                  <th className="py-3 px-3 text-center bg-slate-700/80">{t.overallDashboard.thHelper}</th>
                  <th className="py-3 px-3 text-center">{t.overallDashboard.thMultiSkillPct}</th>
                  <th className="py-3 px-4 text-right">{t.overallDashboard.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b'
                        ? t.overallDashboard.emptyLinesF3B
                        : t.overallDashboard.emptyLinesOther.replace('{factory}', selectedFactory)}
                    </td>
                  </tr>
                ) : (
                  filteredLines.map((item, idx) => {
                    const lineRate = item.total > 0 ? Math.round((item.multiSkillCount / item.total) * 100) : 0;
                    return (
                      <tr 
                        key={item.line}
                        className={`hover:bg-[#F0F7F7] transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFCFC]'}`}
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                          {item.line}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {item.leader?.chief && item.leader.chief !== '-' ? (
                            <div>
                              <span className="font-semibold text-slate-800 block text-[11px]">{item.leader.chief}</span>
                              <span className="text-[10px] text-slate-400">{t.overallDashboard.chiefRole}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full font-mono">
                            {item.total}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40 whitespace-nowrap">
                          {item.countS > 0 ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              {item.countS}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-teal-700 bg-teal-50/40 whitespace-nowrap">
                          {item.countA > 0 ? (
                            <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              {item.countA}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-sky-700 bg-sky-50/40 whitespace-nowrap">
                          {item.countB > 0 ? (
                            <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              {item.countB}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-amber-700 bg-amber-50/40 whitespace-nowrap">
                          {item.countC > 0 ? (
                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              {item.countC}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700 bg-slate-50/60 whitespace-nowrap">
                          {item.countHelper > 0 ? (
                            <span className="bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              {item.countHelper}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-bold text-slate-800 font-mono text-[11px]">{lineRate}%</span>
                            <span className="text-[10px] text-slate-400 font-mono">({item.multiSkillCount} {t.overallDashboard.opUnit})</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => onNavigateToLine(selectedFactory, item.line)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#244646] hover:bg-[#1a3333] text-white rounded-xl text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                            title={t.overallDashboard.openMatrixTooltip.replace('{factory}', selectedFactory).replace('{line}', item.line)}
                          >
                            <span>{t.overallDashboard.openMatrixBtn}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#D0A018]" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 2: OVERALL MASING-MASING FACTORY PADA BULAN AKTIF NYA */}
      <section className="space-y-6 pt-6 border-t-2 border-[#D5E2E2]">
        
        {/* Section 2 Header Card: Elevated White Container Grounded Cleanly */}
        <div className="bg-white rounded-2xl border border-[#E0E8E8] p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#D0A018]/15 flex items-center justify-center text-[#B58500] shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  {t.overallDashboard.benchmarkTitle}
                </h2>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                  {monthLabel} {selectedYear}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.overallDashboard.benchmarkSubtitle}
              </p>
            </div>
          </div>

          {/* Grand Summary Tag */}
          <div className="bg-[#244646] text-white px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-2xs self-start md:self-auto">
            <div>
              <span className="text-[10px] text-[#A0B5B5] uppercase font-bold tracking-wider block">{t.overallDashboard.companyTotalTitle}</span>
              <span className="text-base sm:text-lg font-black text-[#D0A018]">{t.overallDashboard.companyTotalOperators.replace('{count}', String(enterpriseTotals.grandTotal))}</span>
            </div>
            <span className="h-7 w-px bg-white/15" />
            <div>
              <span className="text-[10px] text-[#A0B5B5] uppercase font-bold tracking-wider block">{t.overallDashboard.multiSkillLabel}</span>
              <span className="text-sm font-black text-white">{enterpriseTotals.msRate}%</span>
            </div>
          </div>
        </div>

        {/* ENTERPRISE KPI SUMMARY STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-white p-4 rounded-2xl border border-[#D5E2E2] shadow-2xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">{t.overallDashboard.enterpriseTotalOp}</span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block">{enterpriseTotals.grandTotal}</span>
            <span className="text-[10px] text-slate-400">{t.overallDashboard.allFactoriesPill}</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">{t.overallDashboard.totalGradeSCompany}</span>
            <span className="text-xl font-black text-emerald-950 mt-0.5 block">{enterpriseTotals.s}</span>
            <span className="text-[10px] text-emerald-700 font-semibold">
              {enterpriseTotals.grandTotal > 0 ? ((enterpriseTotals.s / enterpriseTotals.grandTotal) * 100).toFixed(1) : 0}% {t.overallDashboard.companyWidePct}
            </span>
          </div>
          <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
            <span className="text-[10px] uppercase font-bold text-teal-800 block">{t.overallDashboard.totalGradeACompany}</span>
            <span className="text-xl font-black text-teal-950 mt-0.5 block">{enterpriseTotals.a}</span>
            <span className="text-[10px] text-teal-700 font-semibold">
              {enterpriseTotals.grandTotal > 0 ? ((enterpriseTotals.a / enterpriseTotals.grandTotal) * 100).toFixed(1) : 0}% {t.overallDashboard.companyWidePct}
            </span>
          </div>
          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
            <span className="text-[10px] uppercase font-bold text-sky-800 block">{t.overallDashboard.totalGradeBCompany}</span>
            <span className="text-xl font-black text-sky-950 mt-0.5 block">{enterpriseTotals.b}</span>
            <span className="text-[10px] text-sky-700 font-semibold">
              {enterpriseTotals.grandTotal > 0 ? ((enterpriseTotals.b / enterpriseTotals.grandTotal) * 100).toFixed(1) : 0}% {t.overallDashboard.companyWidePct}
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-[10px] uppercase font-bold text-amber-800 block">{t.overallDashboard.totalGradeCCompany}</span>
            <span className="text-xl font-black text-amber-950 mt-0.5 block">{enterpriseTotals.c}</span>
            <span className="text-[10px] text-amber-700 font-semibold">
              {enterpriseTotals.grandTotal > 0 ? ((enterpriseTotals.c / enterpriseTotals.grandTotal) * 100).toFixed(1) : 0}% {t.overallDashboard.companyWidePct}
            </span>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-700 block">{t.overallDashboard.totalHelperCompany}</span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block">{enterpriseTotals.helper}</span>
            <span className="text-[10px] text-slate-500 font-semibold">
              {enterpriseTotals.grandTotal > 0 ? ((enterpriseTotals.helper / enterpriseTotals.grandTotal) * 100).toFixed(1) : 0}% {t.overallDashboard.companyWidePct}
            </span>
          </div>
        </div>

        {/* SIDE-BY-SIDE FACTORY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4.5">
          {allFactoriesComparison.map((item) => {
            const isSelected = item.factory === selectedFactory;
            return (
              <div 
                key={item.factory}
                className={`bg-white rounded-3xl p-5 border-2 transition-all duration-200 shadow-sm flex flex-col justify-between ${
                  isSelected 
                    ? 'border-[#244646] ring-2 ring-[#244646]/20 shadow-md' 
                    : 'border-[#D5E2E2] hover:border-slate-400'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-[#244646] text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900 tracking-tight">
                          {item.factory}
                        </h4>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {t.overallDashboard.periodLabel.replace('{period}', monthLabel)}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-bold bg-[#244646] text-[#D0A018] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {t.overallDashboard.selectedBadge}
                      </span>
                    )}
                  </div>

                  {item.hasNoData ? (
                    /* Tampilan Pabrik yang Datanya Masih Kosong (Factory 3B) */
                    <div className="mt-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 flex flex-col items-center text-center space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-200">
                        {t.overallDashboard.noDataBadge}
                      </span>
                      <p className="text-xs text-amber-800 font-semibold">
                        {t.overallDashboard.noDataTitle}
                      </p>
                      <p className="text-[11px] text-amber-700/80 leading-relaxed">
                        {t.overallDashboard.noDataDesc}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Total Op Big Number */}
                      <div className="mt-4 bg-[#F5F8F8] p-3 rounded-2xl border border-[#E0E8E8] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">{t.overallDashboard.totalOperatorCardTitle}</span>
                          <span className="text-2xl font-black text-slate-900 leading-tight">{item.total}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">{t.overallDashboard.multiSkillLabel}</span>
                          <span className="text-sm font-bold text-[#D0A018] font-mono">{item.multiSkillRate}%</span>
                        </div>
                      </div>

                      {/* Mini Stacked Progress Bar */}
                      <div className="mt-3.5 space-y-1">
                        <div className="h-3 w-full bg-slate-100 rounded-lg overflow-hidden flex">
                          {item.countS > 0 && (
                            <div style={{ width: `${item.pctS}%` }} className="bg-[#059669]" title={`S: ${item.countS}`} />
                          )}
                          {item.countA > 0 && (
                            <div style={{ width: `${item.pctA}%` }} className="bg-[#0d9488]" title={`A: ${item.countA}`} />
                          )}
                          {item.countB > 0 && (
                            <div style={{ width: `${item.pctB}%` }} className="bg-[#0284c7]" title={`B: ${item.countB}`} />
                          )}
                          {item.countC > 0 && (
                            <div style={{ width: `${item.pctC}%` }} className="bg-[#d97706]" title={`C: ${item.countC}`} />
                          )}
                          {item.countHelper > 0 && (
                            <div style={{ width: `${item.pctHelper}%` }} className="bg-[#475569]" title={`Helper: ${item.countHelper}`} />
                          )}
                        </div>
                      </div>

                      {/* Grade Breakdown Grid for this factory */}
                      <div className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-1.5">
                          <span className="text-[9px] font-black text-emerald-800 block">S</span>
                          <span className="text-xs font-bold text-emerald-950 font-mono block mt-0.5">{item.countS}</span>
                          <span className="text-[8px] text-emerald-700 block">{item.pctS}%</span>
                        </div>
                        <div className="bg-teal-50 border border-teal-200/80 rounded-xl p-1.5">
                          <span className="text-[9px] font-black text-teal-800 block">A</span>
                          <span className="text-xs font-bold text-teal-950 font-mono block mt-0.5">{item.countA}</span>
                          <span className="text-[8px] text-teal-700 block">{item.pctA}%</span>
                        </div>
                        <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-1.5">
                          <span className="text-[9px] font-black text-sky-800 block">B</span>
                          <span className="text-xs font-bold text-sky-950 font-mono block mt-0.5">{item.countB}</span>
                          <span className="text-[8px] text-sky-700 block">{item.pctB}%</span>
                        </div>
                        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-1.5">
                          <span className="text-[9px] font-black text-amber-800 block">C</span>
                          <span className="text-xs font-bold text-amber-950 font-mono block mt-0.5">{item.countC}</span>
                          <span className="text-[8px] text-amber-700 block">{item.pctC}%</span>
                        </div>
                        <div className="bg-slate-100 border border-slate-300 rounded-xl p-1.5">
                          <span className="text-[9px] font-black text-slate-700 block">H</span>
                          <span className="text-xs font-bold text-slate-900 font-mono block mt-0.5">{item.countHelper}</span>
                          <span className="text-[8px] text-slate-500 block">{item.pctHelper}%</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Focus Button */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => onFactoryChange(item.factory)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#244646] text-white'
                        : 'bg-slate-100 hover:bg-[#244646] text-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{isSelected ? t.overallDashboard.viewingNow : t.overallDashboard.focusFactoryBtn.replace('{factory}', item.factory)}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* COMPARISON TABLE ALL FACTORIES */}
        <div className="bg-white rounded-3xl p-6 border border-[#D5E2E2] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#244646]" />
                {t.overallDashboard.compTableTitle.replace('{period}', `${monthLabel} ${selectedYear}`)}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.overallDashboard.compTableSubtitle}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#244646] text-white font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">{t.overallDashboard.thFactoryName}</th>
                  <th className="py-3 px-3 text-center">{t.overallDashboard.thTotalOp}</th>
                  <th className="py-3 px-3 text-center bg-emerald-800/80">{t.overallDashboard.thGradeSHeader}</th>
                  <th className="py-3 px-3 text-center bg-teal-800/80">{t.overallDashboard.thGradeAHeader}</th>
                  <th className="py-3 px-3 text-center bg-sky-800/80">{t.overallDashboard.thGradeBHeader}</th>
                  <th className="py-3 px-3 text-center bg-amber-800/80">{t.overallDashboard.thGradeCHeader}</th>
                  <th className="py-3 px-3 text-center bg-slate-700/80">{t.overallDashboard.thHelperHeader}</th>
                  <th className="py-3 px-3 text-center">{t.overallDashboard.thMultiSkillPct}</th>
                  <th className="py-3 px-3 text-center">{t.overallDashboard.thAvgPoints}</th>
                  <th className="py-3 px-4 text-right">{t.overallDashboard.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {allFactoriesComparison.map((f, idx) => {
                  const isCurrent = f.factory === selectedFactory;
                  return (
                    <tr 
                      key={f.factory}
                      className={`hover:bg-[#F0F7F7] transition-colors ${isCurrent ? 'bg-[#EBF5F5] font-semibold' : (idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFCFC]')}`}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 ${isCurrent ? 'text-[#244646]' : 'text-slate-400'}`} />
                          <span className="font-bold text-slate-900">{f.factory}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold bg-[#D0A018] text-white px-2 py-0.5 rounded-full">
                              {t.overallDashboard.activeStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-900 whitespace-nowrap">
                        {f.hasNoData ? (
                          <div className="flex flex-col items-center">
                            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-mono text-xs">
                              0
                            </span>
                            <span className="text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded mt-1">
                              {t.overallDashboard.noDataBadge}
                            </span>
                          </div>
                        ) : (
                          <span className="bg-slate-100 text-slate-900 px-2.5 py-1 rounded-full font-mono text-xs">
                            {f.total}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center bg-emerald-50/40 whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-slate-400 font-mono">-</span>
                        ) : (
                          <>
                            <span className="font-mono font-bold text-emerald-800">{f.countS}</span>
                            <span className="text-[10px] text-emerald-600 block">({f.pctS}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center bg-teal-50/40 whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-slate-400 font-mono">-</span>
                        ) : (
                          <>
                            <span className="font-mono font-bold text-teal-800">{f.countA}</span>
                            <span className="text-[10px] text-teal-600 block">({f.pctA}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center bg-sky-50/40 whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-slate-400 font-mono">-</span>
                        ) : (
                          <>
                            <span className="font-mono font-bold text-sky-800">{f.countB}</span>
                            <span className="text-[10px] text-sky-600 block">({f.pctB}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center bg-amber-50/40 whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-slate-400 font-mono">-</span>
                        ) : (
                          <>
                            <span className="font-mono font-bold text-amber-800">{f.countC}</span>
                            <span className="text-[10px] text-amber-600 block">({f.pctC}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center bg-slate-50/60 whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-slate-400 font-mono">-</span>
                        ) : (
                          <>
                            <span className="font-mono font-bold text-slate-800">{f.countHelper}</span>
                            <span className="text-[10px] text-slate-500 block">({f.pctHelper}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono font-bold text-[#D0A018]">
                        {f.hasNoData ? <span className="text-slate-400 font-normal">-</span> : `${f.multiSkillRate}%`}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap font-mono font-semibold text-slate-700">
                        {f.hasNoData ? <span className="text-slate-400 font-normal">-</span> : `${f.avgPoints} Pts`}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => onFactoryChange(f.factory)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-[#244646] hover:bg-[#1a3333] text-white shadow-2xs'
                          }`}
                        >
                          {isCurrent ? t.overallDashboard.btnSelected : t.overallDashboard.btnSelect}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#244646] text-white font-bold text-xs border-t-2 border-[#1a3333]">
                  <td className="py-3 px-4">{t.overallDashboard.totalCompanyRow}</td>
                  <td className="py-3 px-3 text-center font-mono font-black text-sm text-[#D0A018]">
                    {enterpriseTotals.grandTotal}
                  </td>
                  <td className="py-3 px-3 text-center font-mono">{enterpriseTotals.s}</td>
                  <td className="py-3 px-3 text-center font-mono">{enterpriseTotals.a}</td>
                  <td className="py-3 px-3 text-center font-mono">{enterpriseTotals.b}</td>
                  <td className="py-3 px-3 text-center font-mono">{enterpriseTotals.c}</td>
                  <td className="py-3 px-3 text-center font-mono">{enterpriseTotals.helper}</td>
                  <td className="py-3 px-3 text-center font-mono text-[#D0A018]">{enterpriseTotals.msRate}%</td>
                  <td className="py-3 px-3 text-center font-mono">-</td>
                  <td className="py-3 px-4 text-right text-[10px] text-[#A0B5B5]">{t.overallDashboard.allFactoriesFoot}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </section>

    </div>
  );
};
