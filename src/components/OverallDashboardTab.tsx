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
  ExternalLink,
  Info
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

  const isAllFactory = normalizeFactoryName(selectedFactory).toLowerCase() === 'all factory' || selectedFactory.toLowerCase() === 'all';

  // 1. Data point-in-time untuk Factory yang dipilih pada bulan/tahun aktif (atau seluruh factory jika All Factory)
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

  // Breakdown per Line di dalam Factory terpilih atau seluruh factory
  const linesBreakdown = useMemo(() => {
    const linesMap = new Map<string, {
      factory: string;
      line: string;
      displayLine: string;
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
      const opFactory = normalizeFactoryName(op.factory || '1');
      const lName = normalizeLineName(op.dominantLine || op.line || '1');
      const key = isAllFactory ? `${opFactory}_${lName}` : lName;

      if (!linesMap.has(key)) {
        const foundLeader = lineLeaders.find(
          (ll) => normalizeFactoryName(ll.factory).toLowerCase() === opFactory.toLowerCase() && normalizeLineName(ll.line).toLowerCase() === lName.toLowerCase()
        );
        linesMap.set(key, {
          factory: opFactory,
          line: lName,
          displayLine: isAllFactory ? `${opFactory} - ${lName}` : lName,
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

      const item = linesMap.get(key)!;
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
    if (isAllFactory) {
      return list.sort((a, b) => {
        if (a.factory !== b.factory) return a.factory.localeCompare(b.factory, undefined, { numeric: true });
        return sortLinesNumerically([a.line, b.line])[0] === a.line ? -1 : 1;
      });
    }
    const sorted = sortLinesNumerically(list.map(l => l.line));
    return sorted.map(lineName => linesMap.get(lineName)!).filter(Boolean);
  }, [currentFactoryOps, selectedFactory, lineLeaders, isAllFactory]);

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
      
      {/* SECTION 1 HEADER CARD: Elevated Container Grounded Cleanly */}
      <div className="ops-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-[10px] bg-[#214E49] flex items-center justify-center text-[#F4C430] shadow-xs shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-[20px] font-bold text-[#102A2A] tracking-tight">
                {selectedFactory}
              </h1>
              <span className="text-[#A5BDBD]">•</span>
              <span className="text-xs font-semibold text-[#214E49] bg-[#EAF5F5] px-2.5 py-0.5 rounded-[6px] border border-[#D8E5E5]">
                {monthLabel} {selectedYear}
              </span>
              <div className="relative group/info inline-flex items-center cursor-help ml-0.5" title={t.overallDashboard.tabSubtitle}>
                <Info className="w-4 h-4 text-[#647878] hover:text-[#102A2A] transition-colors" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/info:flex flex-col items-center z-50 pointer-events-none w-max max-w-xs sm:max-w-sm">
                  <div className="bg-[#163F3B] text-white text-[11px] font-normal leading-normal px-2.5 py-1.5 rounded-[8px] shadow-lg border border-[#2E625C] text-center">
                    {t.overallDashboard.tabSubtitle}
                  </div>
                  <div className="w-2 h-2 bg-[#163F3B] rotate-45 -mt-1 border-r border-b border-[#2E625C]" />
                </div>
              </div>
            </div>
            <p className="text-[12px] text-[#647878] mt-0.5 font-medium">
              Factory Skill Matrix & Operator Workforce Overview
            </p>
          </div>
        </div>

        {/* Quick KPI Stats */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#FFFFFF] border border-[#D8E5E5] text-xs">
            <span className="text-[#647878] font-medium">{t.overallDashboard.avgScoreLabel}</span>
            <span className="font-bold text-[#102A2A] tabular-nums">
              {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' ? '-' : `${factoryStats.avgPoints} Pts`}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[#FFFFFF] border border-[#D8E5E5] text-xs">
            <span className="text-[#647878] font-medium">{t.overallDashboard.multiSkillLabel}</span>
            <span className="font-bold text-[#1477B8] tabular-nums">
              {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' ? '-' : `${factoryStats.multiSkillRate}%`}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: PROFIL DETAIL 1 FACTORY TERPILIH */}
      <section className="space-y-4">
        {/* Khusus Factory 3B: Info bahwa data belum ada dan dikosongkan agar tidak rancu */}
        {normalizeFactoryName(selectedFactory).toLowerCase() === 'factory 3b' && (
          <div className="bg-amber-50 border border-amber-200/80 rounded-[14px] p-4 flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-[8px] text-amber-800 shrink-0">
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
          <div className="col-span-2 md:col-span-3 lg:col-span-1 bg-[#214E49] text-white rounded-[16px] p-4.5 shadow-md flex flex-col justify-between border border-[#163F3B] relative overflow-hidden">
            <div className="absolute -right-3 -bottom-3 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
            <div>
              <div className="flex items-center justify-between text-[#A3C8C4]">
                <span className="text-[11px] font-bold uppercase tracking-wider">{t.overallDashboard.totalOperatorCardTitle}</span>
                <Users className="w-4 h-4 text-[#F4C430]" />
              </div>
              <div className="text-3xl font-bold tracking-tight mt-2 text-white tabular-nums">
                {factoryStats.total.toLocaleString()}
              </div>
              <p className="text-[11px] text-[#A3C8C4] mt-0.5">
                {isAllFactory ? 'All Factories Population' : t.overallDashboard.totalOperatorPopSubtitle.replace('{factory}', selectedFactory)}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-[#A3C8C4]">{t.overallDashboard.multiSkillOfTotal}</span>
              <span className="font-bold text-[#F4C430] tabular-nums">{factoryStats.multiSkillRate}% ({factoryStats.multiSkillCount} {t.overallDashboard.opUnit})</span>
            </div>
          </div>

          {/* 2. Grade S Card */}
          <div className="ops-card ops-card-hover p-3.5 sm:p-4 border-l-4 border-l-[#12B886] flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#12B886] shrink-0" />
                  <span className="text-xs font-bold text-[#102A2A] uppercase tracking-wide">
                    {t.overallDashboard.gradeSTitle}
                  </span>
                </div>
                <div 
                  className="cursor-help text-[#647878] hover:text-[#102A2A] transition-colors p-0.5"
                  title={`${t.overallDashboard.criteriaLabel} ${t.overallDashboard.criteriaS}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-[28px] font-bold text-[#102A2A] mt-2 tabular-nums">
                {factoryStats.countS}
              </div>
              <p className="text-xs text-[#647878] font-medium mt-0.5">
                <span className="font-bold text-[#102A2A]">{factoryStats.pctS}%</span> {t.overallDashboard.ofTotal}
              </p>
            </div>

            {/* Logo Huruf S Menonjol Kanan Bawah */}
            <div className="absolute right-3 bottom-2.5 sm:right-3.5 sm:bottom-3 flex items-center justify-center pointer-events-none select-none">
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] bg-[#12B886]/15 border-2 border-[#12B886]/45 text-[#0E936B] font-black text-xl sm:text-2xl flex items-center justify-center shadow-xs font-sans tracking-tight">
                S
              </span>
            </div>
          </div>

          {/* 3. Grade A Card */}
          <div className="ops-card ops-card-hover p-3.5 sm:p-4 border-l-4 border-l-[#12B886] flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#12B886] shrink-0" />
                  <span className="text-xs font-bold text-[#102A2A] uppercase tracking-wide">
                    {t.overallDashboard.gradeATitle}
                  </span>
                </div>
                <div 
                  className="cursor-help text-[#647878] hover:text-[#102A2A] transition-colors p-0.5"
                  title={`${t.overallDashboard.criteriaLabel} ${t.overallDashboard.criteriaA}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-[28px] font-bold text-[#102A2A] mt-2 tabular-nums">
                {factoryStats.countA}
              </div>
              <p className="text-xs text-[#647878] font-medium mt-0.5">
                <span className="font-bold text-[#102A2A]">{factoryStats.pctA}%</span> {t.overallDashboard.ofTotal}
              </p>
            </div>

            {/* Logo Huruf A Menonjol Kanan Bawah */}
            <div className="absolute right-3 bottom-2.5 sm:right-3.5 sm:bottom-3 flex items-center justify-center pointer-events-none select-none">
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] bg-[#12B886]/15 border-2 border-[#12B886]/45 text-[#0E936B] font-black text-xl sm:text-2xl flex items-center justify-center shadow-xs font-sans tracking-tight">
                A
              </span>
            </div>
          </div>

          {/* 4. Grade B Card */}
          <div className="ops-card ops-card-hover p-3.5 sm:p-4 border-l-4 border-l-[#1597D4] flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1597D4] shrink-0" />
                  <span className="text-xs font-bold text-[#102A2A] uppercase tracking-wide">
                    {t.overallDashboard.gradeBTitle}
                  </span>
                </div>
                <div 
                  className="cursor-help text-[#647878] hover:text-[#102A2A] transition-colors p-0.5"
                  title={`${t.overallDashboard.criteriaLabel} ${t.overallDashboard.criteriaB}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-[28px] font-bold text-[#102A2A] mt-2 tabular-nums">
                {factoryStats.countB}
              </div>
              <p className="text-xs text-[#647878] font-medium mt-0.5">
                <span className="font-bold text-[#102A2A]">{factoryStats.pctB}%</span> {t.overallDashboard.ofTotal}
              </p>
            </div>

            {/* Logo Huruf B Menonjol Kanan Bawah */}
            <div className="absolute right-3 bottom-2.5 sm:right-3.5 sm:bottom-3 flex items-center justify-center pointer-events-none select-none">
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] bg-[#1597D4]/15 border-2 border-[#1597D4]/45 text-[#0F78AC] font-black text-xl sm:text-2xl flex items-center justify-center shadow-xs font-sans tracking-tight">
                B
              </span>
            </div>
          </div>

          {/* 5. Grade C Card */}
          <div className="ops-card ops-card-hover p-3.5 sm:p-4 border-l-4 border-l-[#F59E0B] flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" />
                  <span className="text-xs font-bold text-[#102A2A] uppercase tracking-wide">
                    {t.overallDashboard.gradeCTitle}
                  </span>
                </div>
                <div 
                  className="cursor-help text-[#647878] hover:text-[#102A2A] transition-colors p-0.5"
                  title={`${t.overallDashboard.criteriaLabel} ${t.overallDashboard.criteriaC}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-[28px] font-bold text-[#102A2A] mt-2 tabular-nums">
                {factoryStats.countC}
              </div>
              <p className="text-xs text-[#647878] font-medium mt-0.5">
                <span className="font-bold text-[#102A2A]">{factoryStats.pctC}%</span> {t.overallDashboard.ofTotal}
              </p>
            </div>

            {/* Logo Huruf C Menonjol Kanan Bawah */}
            <div className="absolute right-3 bottom-2.5 sm:right-3.5 sm:bottom-3 flex items-center justify-center pointer-events-none select-none">
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] bg-[#F59E0B]/15 border-2 border-[#F59E0B]/45 text-[#C77E05] font-black text-xl sm:text-2xl flex items-center justify-center shadow-xs font-sans tracking-tight">
                C
              </span>
            </div>
          </div>

          {/* 6. Helper Card */}
          <div className="ops-card ops-card-hover p-3.5 sm:p-4 border-l-4 border-l-[#94A3B8] flex flex-col justify-between relative overflow-hidden group">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#94A3B8] shrink-0" />
                  <span className="text-xs font-bold text-[#102A2A] uppercase tracking-wide">
                    {t.overallDashboard.helperTitle}
                  </span>
                </div>
                <div 
                  className="cursor-help text-[#647878] hover:text-[#102A2A] transition-colors p-0.5"
                  title={`${t.overallDashboard.criteriaLabel} ${t.overallDashboard.criteriaHelper}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl sm:text-[28px] font-bold text-[#102A2A] mt-2 tabular-nums">
                {factoryStats.countHelper}
              </div>
              <p className="text-xs text-[#647878] font-medium mt-0.5">
                <span className="font-bold text-[#102A2A]">{factoryStats.pctHelper}%</span> {t.overallDashboard.ofTotal}
              </p>
            </div>

            {/* Logo Huruf H Menonjol Kanan Bawah */}
            <div className="absolute right-3 bottom-2.5 sm:right-3.5 sm:bottom-3 flex items-center justify-center pointer-events-none select-none">
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] bg-[#94A3B8]/20 border-2 border-[#94A3B8]/45 text-[#475569] font-black text-xl sm:text-2xl flex items-center justify-center shadow-xs font-sans tracking-tight">
                H
              </span>
            </div>
          </div>

        </div>

        {/* VISUAL SEGMENTED GRADE DISTRIBUTION PROGRESS BAR */}
        <div className="ops-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#102A2A] flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#214E49]" />
              {t.overallDashboard.visualDistTitle.replace('{factory}', selectedFactory).replace('{period}', `${monthLabel} ${selectedYear}`)}
            </span>
            <span className="text-xs font-semibold text-[#647878]">
              Total: <strong className="text-[#102A2A]">{t.overallDashboard.totalOperatorsLabel.replace('{total}', String(factoryStats.total))}</strong>
            </span>
          </div>

          {/* The Multi-Segment Bar */}
          <div className="h-6 w-full bg-[#EAF5F5] rounded-[8px] overflow-hidden flex shadow-inner">
            {factoryStats.countS > 0 && (
              <div 
                style={{ width: `${factoryStats.pctS}%` }} 
                className="bg-[#12B886] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[11px] text-white font-bold"
                title={`Grade S: ${factoryStats.countS} ${t.overallDashboard.opUnit} (${factoryStats.pctS}%)`}
              >
                {parseFloat(factoryStats.pctS) >= 5 && `${factoryStats.pctS}%`}
              </div>
            )}
            {factoryStats.countA > 0 && (
              <div 
                style={{ width: `${factoryStats.pctA}%` }} 
                className="bg-[#0E936B] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[11px] text-white font-bold"
                title={`Grade A: ${factoryStats.countA} ${t.overallDashboard.opUnit} (${factoryStats.pctA}%)`}
              >
                {parseFloat(factoryStats.pctA) >= 5 && `${factoryStats.pctA}%`}
              </div>
            )}
            {factoryStats.countB > 0 && (
              <div 
                style={{ width: `${factoryStats.pctB}%` }} 
                className="bg-[#1597D4] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[11px] text-white font-bold"
                title={`Grade B: ${factoryStats.countB} ${t.overallDashboard.opUnit} (${factoryStats.pctB}%)`}
              >
                {parseFloat(factoryStats.pctB) >= 5 && `${factoryStats.pctB}%`}
              </div>
            )}
            {factoryStats.countC > 0 && (
              <div 
                style={{ width: `${factoryStats.pctC}%` }} 
                className="bg-[#F59E0B] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[11px] text-white font-bold"
                title={`Grade C: ${factoryStats.countC} ${t.overallDashboard.opUnit} (${factoryStats.pctC}%)`}
              >
                {parseFloat(factoryStats.pctC) >= 5 && `${factoryStats.pctC}%`}
              </div>
            )}
            {factoryStats.countHelper > 0 && (
              <div 
                style={{ width: `${factoryStats.pctHelper}%` }} 
                className="bg-[#94A3B8] hover:brightness-110 transition-all relative group cursor-pointer flex items-center justify-center text-[11px] text-white font-bold"
                title={`Helper: ${factoryStats.countHelper} ${t.overallDashboard.opUnit} (${factoryStats.pctHelper}%)`}
              >
                {parseFloat(factoryStats.pctHelper) >= 5 && `${factoryStats.pctHelper}%`}
              </div>
            )}
          </div>
        </div>

        {/* BREAKDOWN PER LINE DI FACTORY INI */}
        <div className="ops-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#102A2A] flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#214E49]" />
                <span>{isAllFactory ? 'Operator Breakdown Across All Lines' : t.overallDashboard.lineBreakdownTitle.replace('{factory}', selectedFactory)}</span>
                <div className="relative group/info inline-flex items-center cursor-help ml-0.5" title={t.overallDashboard.lineBreakdownSubtitle}>
                  <Info className="w-4 h-4 text-[#647878] hover:text-[#102A2A] transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/info:flex flex-col items-center z-50 pointer-events-none w-max max-w-xs sm:max-w-sm">
                    <div className="bg-[#163F3B] text-white text-[11px] font-normal leading-normal px-2.5 py-1.5 rounded-[8px] shadow-lg border border-[#2E625C] text-center">
                      {t.overallDashboard.lineBreakdownSubtitle}
                    </div>
                    <div className="w-2 h-2 bg-[#163F3B] rotate-45 -mt-1 border-r border-b border-[#2E625C]" />
                  </div>
                </div>
              </h3>
            </div>

            {/* Quick Line Search */}
            <div className="flex items-center gap-2 bg-[#FFFFFF] px-3.5 py-2 rounded-[10px] border border-[#D8E5E5] max-w-xs w-full sm:w-auto shadow-2xs">
              <Search className="w-4 h-4 text-[#647878] shrink-0" />
              <input
                type="text"
                value={lineSearch}
                onChange={(e) => setLineSearch(e.target.value)}
                placeholder={t.overallDashboard.searchLinePlaceholder}
                className="text-xs sm:text-[13px] bg-transparent outline-none w-full placeholder:text-[#647878] text-[#102A2A]"
              />
            </div>
          </div>

          {/* Table of Lines */}
          <div className="overflow-x-auto rounded-[12px] border border-[#D8E5E5]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#214E49] text-white font-bold uppercase tracking-wider text-xs sm:text-[11px]">
                  <th className="py-3.5 px-4">{t.overallDashboard.thLine}</th>
                  <th className="py-3.5 px-3.5">{t.overallDashboard.thChief}</th>
                  <th className="py-3.5 px-3.5 text-center">{t.overallDashboard.thTotalOp}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thGradeS}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thGradeA}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thGradeB}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thGradeC}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thHelper}</th>
                  <th className="py-3.5 px-3.5 text-center">{t.overallDashboard.thMultiSkillPct}</th>
                  <th className="py-3.5 px-4 text-right">{t.overallDashboard.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E5E5]">
                {filteredLines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-sm text-[#647878]">
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
                        key={`${item.factory}_${item.line}`}
                        className={`hover:bg-[#EAF5F5]/60 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFCFC]'}`}
                      >
                        <td className="py-3.5 px-4 font-bold text-sm sm:text-[15px] text-[#102A2A] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{item.line}</span>
                            {isAllFactory && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-[6px] bg-[#EAF5F5] text-[#214E49] border border-[#D8E5E5]">
                                {item.factory}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 text-[#647878] whitespace-nowrap">
                          {item.leader?.chief && item.leader.chief !== '-' ? (
                            <div>
                              <span className="font-bold text-[#102A2A] block text-xs sm:text-[13px]">{item.leader.chief}</span>
                              <span className="text-[11px] text-[#647878]">{t.overallDashboard.chiefRole}</span>
                            </div>
                          ) : (
                            <span className="text-[#94A3B8] italic text-xs">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 text-center font-bold text-[#102A2A] whitespace-nowrap">
                          <span className="bg-[#EAF5F5] text-[#214E49] px-2.5 py-1 rounded-[8px] font-bold text-xs sm:text-[13px] tabular-nums">
                            {item.total}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-[#0E936B] bg-emerald-50/30 whitespace-nowrap">
                          {item.countS > 0 ? (
                            <span className="bg-[#E8F8F2] text-[#0E936B] px-2.5 py-1 rounded-[8px] tabular-nums text-xs sm:text-[13px]">
                              {item.countS}
                            </span>
                          ) : <span className="text-sm font-normal text-[#94A3B8]">-</span>}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-[#0E936B] bg-emerald-50/30 whitespace-nowrap">
                          {item.countA > 0 ? (
                            <span className="bg-[#E8F8F2] text-[#0E936B] px-2.5 py-1 rounded-[8px] tabular-nums text-xs sm:text-[13px]">
                              {item.countA}
                            </span>
                          ) : <span className="text-sm font-normal text-[#94A3B8]">-</span>}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-[#0F78AC] bg-sky-50/30 whitespace-nowrap">
                          {item.countB > 0 ? (
                            <span className="bg-[#EBF6FC] text-[#0F78AC] px-2.5 py-1 rounded-[8px] tabular-nums text-xs sm:text-[13px]">
                              {item.countB}
                            </span>
                          ) : <span className="text-sm font-normal text-[#94A3B8]">-</span>}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-[#C77E05] bg-amber-50/30 whitespace-nowrap">
                          {item.countC > 0 ? (
                            <span className="bg-[#FEF6E7] text-[#C77E05] px-2.5 py-1 rounded-[8px] tabular-nums text-xs sm:text-[13px]">
                              {item.countC}
                            </span>
                          ) : <span className="text-sm font-normal text-[#94A3B8]">-</span>}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-[#64748B] bg-slate-50/40 whitespace-nowrap">
                          {item.countHelper > 0 ? (
                            <span className="bg-[#F1F5F9] text-[#64748B] px-2.5 py-1 rounded-[8px] tabular-nums text-xs sm:text-[13px]">
                              {item.countHelper}
                            </span>
                          ) : <span className="text-sm font-normal text-[#94A3B8]">-</span>}
                        </td>
                        <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-bold text-[#102A2A] tabular-nums text-xs sm:text-[13px]">{lineRate}%</span>
                            <span className="text-[11px] sm:text-xs text-[#647878] tabular-nums">({item.multiSkillCount} {t.overallDashboard.opUnit})</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => onNavigateToLine(item.factory || selectedFactory, item.line)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#214E49] hover:bg-[#163F3B] text-white rounded-[8px] text-xs font-bold shadow-2xs transition-all cursor-pointer"
                            title={t.overallDashboard.openMatrixTooltip.replace('{factory}', item.factory || selectedFactory).replace('{line}', item.line)}
                          >
                            <span>{t.overallDashboard.openMatrixBtn}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-[#F4C430]" />
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
      <section className="space-y-5 pt-6 border-t border-[#D8E5E5]">
        
        {/* Section 2 Header Card: Consolidated subtitle with period text */}
        <div className="ops-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[10px] bg-[#EAF5F5] flex items-center justify-center text-[#214E49] shrink-0 border border-[#D8E5E5]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[#102A2A] tracking-tight">
                  {t.overallDashboard.benchmarkTitle}
                </h2>
                <div className="relative group/info inline-flex items-center cursor-help ml-0.5" title={`${t.overallDashboard.benchmarkSubtitle} (${monthLabel} ${selectedYear})`}>
                  <Info className="w-4 h-4 text-[#647878] hover:text-[#102A2A] transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/info:flex flex-col items-center z-50 pointer-events-none w-max max-w-xs sm:max-w-sm">
                    <div className="bg-[#163F3B] text-white text-[11px] font-normal leading-normal px-2.5 py-1.5 rounded-[8px] shadow-lg border border-[#2E625C] text-center">
                      {t.overallDashboard.benchmarkSubtitle} • {monthLabel} {selectedYear}
                    </div>
                    <div className="w-2 h-2 bg-[#163F3B] rotate-45 -mt-1 border-r border-b border-[#2E625C]" />
                  </div>
                </div>
              </div>
              <p className="text-[12px] text-[#647878] font-medium mt-0.5">
                Multi-Factory Workforce Aggregation & Comparative Performance
              </p>
            </div>
          </div>

          {/* Grand Summary Tag */}
          <div className="bg-[#214E49] text-white px-4 py-2.5 rounded-[12px] flex items-center gap-4 self-start md:self-auto shadow-xs border border-[#163F3B]">
            <div>
              <span className="text-[10px] text-[#A3C8C4] uppercase font-bold tracking-wider block">{t.overallDashboard.companyTotalTitle}</span>
              <span className="text-base sm:text-lg font-bold text-white tabular-nums">{t.overallDashboard.companyTotalOperators.replace('{count}', String(enterpriseTotals.grandTotal.toLocaleString()))}</span>
            </div>
            <span className="h-7 w-px bg-white/15" />
            <div>
              <span className="text-[10px] text-[#A3C8C4] uppercase font-bold tracking-wider block">{t.overallDashboard.multiSkillLabel}</span>
              <span className="text-sm font-bold text-[#F4C430] tabular-nums">{enterpriseTotals.msRate}%</span>
            </div>
          </div>
        </div>

        {/* SIDE-BY-SIDE FACTORY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {allFactoriesComparison.map((item) => {
            const isSelected = item.factory === selectedFactory;
            return (
              <div 
                key={item.factory}
                className={`ops-card p-5 flex flex-col justify-between h-full ${
                  isSelected 
                    ? 'border-[#214E49] border-l-4 border-l-[#214E49] bg-[#FFFFFF]' 
                    : 'border-l-4 border-l-transparent hover:border-[#2E625C]/30'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-[#214E49] text-white' : 'bg-[#EAF5F5] text-[#214E49] border border-[#D8E5E5]'
                      }`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-[#102A2A] tracking-tight">
                          {item.factory}
                        </h4>
                        <span className="text-[10px] text-[#647878] block font-medium">
                          {t.overallDashboard.periodLabel.replace('{period}', monthLabel)}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] font-bold bg-[#E8F8F2] text-[#0E936B] border border-[#B8EBD8] px-2 py-0.5 rounded-[6px] uppercase tracking-wider">
                        {t.overallDashboard.selectedBadge}
                      </span>
                    )}
                  </div>

                  {item.hasNoData ? (
                    <>
                      {/* Total Op Big Number Box (Matching Height) */}
                      <div className="mt-4 bg-[#F8FAFA] p-3.5 rounded-[10px] border border-[#D8E5E5] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#647878] block">{t.overallDashboard.totalOperatorCardTitle}</span>
                          <span className="text-2xl font-bold text-[#94A3B8] leading-tight tabular-nums">-</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-[#647878] block">{t.overallDashboard.multiSkillLabel}</span>
                          <span className="text-base font-bold text-[#94A3B8] tabular-nums">-</span>
                        </div>
                      </div>

                      {/* Progress Bar Area */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-amber-700 font-medium">{t.overallDashboard.noDataTitle}</span>
                          <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200/80">{t.overallDashboard.noDataBadge}</span>
                        </div>
                        <div className="h-2 w-full bg-[#EAF5F5] rounded-full overflow-hidden flex">
                          <div className="w-full h-full bg-[#D8E5E5]" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Total Op Big Number Box */}
                      <div className="mt-4 bg-[#F8FAFA] p-3.5 rounded-[10px] border border-[#D8E5E5] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#647878] block">{t.overallDashboard.totalOperatorCardTitle}</span>
                          <span className="text-2xl font-bold text-[#102A2A] leading-tight tabular-nums">{item.total.toLocaleString()}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-[#647878] block">{t.overallDashboard.multiSkillLabel}</span>
                          <span className="text-base font-bold text-[#1477B8] tabular-nums">{item.multiSkillRate}%</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-[#647878] font-medium">
                          <span>Skill Distribution</span>
                          <span className="text-[#102A2A] font-semibold tabular-nums">{item.total} Ops</span>
                        </div>
                        <div className="h-2 w-full bg-[#EAF5F5] rounded-full overflow-hidden flex shadow-inner">
                          {item.countS > 0 && (
                            <div style={{ width: `${item.pctS}%` }} className="bg-[#12B886]" title={`Grade S: ${item.countS} (${item.pctS}%)`} />
                          )}
                          {item.countA > 0 && (
                            <div style={{ width: `${item.pctA}%` }} className="bg-[#0E936B]" title={`Grade A: ${item.countA} (${item.pctA}%)`} />
                          )}
                          {item.countB > 0 && (
                            <div style={{ width: `${item.pctB}%` }} className="bg-[#1597D4]" title={`Grade B: ${item.countB} (${item.pctB}%)`} />
                          )}
                          {item.countC > 0 && (
                            <div style={{ width: `${item.pctC}%` }} className="bg-[#F59E0B]" title={`Grade C: ${item.countC} (${item.pctC}%)`} />
                          )}
                          {item.countHelper > 0 && (
                            <div style={{ width: `${item.pctHelper}%` }} className="bg-[#94A3B8]" title={`Helper: ${item.countHelper} (${item.pctHelper}%)`} />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Focus Button */}
                <div className="mt-5 pt-3.5 border-t border-[#D8E5E5]">
                  <button
                    onClick={() => onFactoryChange(item.factory)}
                    className={`w-full py-2 px-3 rounded-[8px] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#214E49] text-white shadow-xs'
                        : 'bg-[#EAF5F5] hover:bg-[#214E49] text-[#214E49] hover:text-white'
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
        <div className="ops-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#102A2A] flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#214E49]" />
                <span>{t.overallDashboard.compTableTitle.replace('{period}', `${monthLabel} ${selectedYear}`)}</span>
                <div className="relative group/info inline-flex items-center cursor-help ml-0.5" title={t.overallDashboard.compTableSubtitle}>
                  <Info className="w-3.5 h-3.5 text-[#647878] hover:text-[#102A2A] transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/info:flex flex-col items-center z-50 pointer-events-none w-max max-w-xs sm:max-w-sm">
                    <div className="bg-[#163F3B] text-white text-[11px] font-normal leading-normal px-2.5 py-1.5 rounded-[8px] shadow-lg border border-[#2E625C] text-center">
                      {t.overallDashboard.compTableSubtitle}
                    </div>
                    <div className="w-2 h-2 bg-[#163F3B] rotate-45 -mt-1 border-r border-b border-[#2E625C]" />
                  </div>
                </div>
              </h3>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[12px] border border-[#D8E5E5]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#214E49] text-white font-bold uppercase tracking-wider text-xs sm:text-[11px]">
                  <th className="py-3.5 px-4">{t.overallDashboard.thFactoryName}</th>
                  <th className="py-3.5 px-3 text-center">{t.overallDashboard.thTotalOp}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thGradeSHeader}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thGradeAHeader}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thGradeBHeader}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thGradeCHeader}</th>
                  <th className="py-3.5 px-3 text-center bg-[#163F3B]">{t.overallDashboard.thHelperHeader}</th>
                  <th className="py-3.5 px-3 text-center">{t.overallDashboard.thMultiSkillPct}</th>
                  <th className="py-3.5 px-3 text-center">{t.overallDashboard.thAvgPoints}</th>
                  <th className="py-3.5 px-4 text-right">{t.overallDashboard.thAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E5E5]">
                {allFactoriesComparison.map((f, idx) => {
                  const isCurrent = f.factory === selectedFactory;
                  return (
                    <tr 
                      key={f.factory}
                      className={`hover:bg-[#EAF5F5]/60 transition-colors ${isCurrent ? 'bg-[#EAF5F5] font-semibold' : (idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFCFC]')}`}
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-4 h-4 ${isCurrent ? 'text-[#214E49]' : 'text-[#647878]'}`} />
                          <span className="font-bold text-sm text-[#102A2A]">{f.factory}</span>
                          {isCurrent && (
                            <span className="text-[9px] font-bold bg-[#E8F8F2] text-[#0E936B] border border-[#B8EBD8] px-2 py-0.5 rounded-[6px]">
                              {t.overallDashboard.activeStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-[#102A2A] whitespace-nowrap">
                        {f.hasNoData ? (
                          <div className="flex flex-col items-center">
                            <span className="bg-[#F1F5F9] text-[#94A3B8] px-2.5 py-0.5 rounded-[6px] tabular-nums text-xs">
                              0
                            </span>
                            <span className="text-[9px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded mt-1">
                              {t.overallDashboard.noDataBadge}
                            </span>
                          </div>
                        ) : (
                          <span className="bg-[#EAF5F5] text-[#214E49] px-2.5 py-1 rounded-[8px] tabular-nums text-xs sm:text-[13px] font-bold">
                            {f.total.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-[#94A3B8] tabular-nums">-</span>
                        ) : (
                          <>
                            <span className="tabular-nums font-bold text-xs sm:text-[13px] text-[#0E936B]">{f.countS}</span>
                            <span className="text-[10px] text-[#0E936B] block">({f.pctS}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-[#94A3B8] tabular-nums">-</span>
                        ) : (
                          <>
                            <span className="tabular-nums font-bold text-xs sm:text-[13px] text-[#0E936B]">{f.countA}</span>
                            <span className="text-[10px] text-[#0E936B] block">({f.pctA}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-[#94A3B8] tabular-nums">-</span>
                        ) : (
                          <>
                            <span className="tabular-nums font-bold text-xs sm:text-[13px] text-[#0F78AC]">{f.countB}</span>
                            <span className="text-[10px] text-[#0F78AC] block">({f.pctB}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-[#94A3B8] tabular-nums">-</span>
                        ) : (
                          <>
                            <span className="tabular-nums font-bold text-xs sm:text-[13px] text-[#C77E05]">{f.countC}</span>
                            <span className="text-[10px] text-[#C77E05] block">({f.pctC}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {f.hasNoData ? (
                          <span className="text-[#94A3B8] tabular-nums">-</span>
                        ) : (
                          <>
                            <span className="tabular-nums font-bold text-xs sm:text-[13px] text-[#64748B]">{f.countHelper}</span>
                            <span className="text-[10px] text-[#64748B] block">({f.pctHelper}%)</span>
                          </>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap tabular-nums font-bold text-xs sm:text-[13px] text-[#1477B8]">
                        {f.hasNoData ? <span className="text-[#94A3B8] font-normal">-</span> : `${f.multiSkillRate}%`}
                      </td>
                      <td className="py-3.5 px-3 text-center whitespace-nowrap tabular-nums font-semibold text-xs sm:text-[13px] text-[#102A2A]">
                        {f.hasNoData ? <span className="text-[#94A3B8] font-normal">-</span> : `${f.avgPoints} Pts`}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => onFactoryChange(f.factory)}
                          className={`px-3 py-1.5 rounded-[8px] text-xs font-bold transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-[#D8E5E5] text-[#214E49]'
                              : 'bg-[#214E49] hover:bg-[#163F3B] text-white shadow-2xs'
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
                <tr className="bg-[#214E49] text-white font-bold text-xs border-t-2 border-[#163F3B]">
                  <td className="py-3 px-4">{t.overallDashboard.totalCompanyRow}</td>
                  <td className="py-3 px-3 text-center tabular-nums font-bold text-sm text-white">
                    {enterpriseTotals.grandTotal.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center tabular-nums">{enterpriseTotals.s}</td>
                  <td className="py-3 px-3 text-center tabular-nums">{enterpriseTotals.a}</td>
                  <td className="py-3 px-3 text-center tabular-nums">{enterpriseTotals.b}</td>
                  <td className="py-3 px-3 text-center tabular-nums">{enterpriseTotals.c}</td>
                  <td className="py-3 px-3 text-center tabular-nums">{enterpriseTotals.helper}</td>
                  <td className="py-3 px-3 text-center tabular-nums text-[#F4C430]">{enterpriseTotals.msRate}%</td>
                  <td className="py-3 px-3 text-center tabular-nums">-</td>
                  <td className="py-3 px-4 text-right text-[10px] text-[#A3C8C4]">{t.overallDashboard.allFactoriesFoot}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </section>

    </div>
  );
};
