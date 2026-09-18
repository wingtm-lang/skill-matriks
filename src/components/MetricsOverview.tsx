import React from 'react';
import { Users, TrendingUp, Cpu, CheckCircle2, Award, UserCheck, Cog } from 'lucide-react';
import { Operator, LineLeader } from '../types';
import { getOperatorMultiSkillCount, getOperatorTotalPoints, isOperatorResignedAtPeriod } from '../utils/ieCalculations';
import { getGradeFromTotalPoints, getLineLeader } from '../data/mockData';
import { useLanguage } from '../i18n/LanguageContext';

interface MetricsOverviewProps {
  operators: Operator[];
  selectedLine: string;
  selectedFactory: string;
  targetGrade?: string;
  selectedMonth?: number | string;
  selectedYear?: number | string;
  lineLeaders?: LineLeader[];
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  operators,
  selectedLine,
  selectedFactory,
  targetGrade = "Grade A",
  selectedMonth,
  selectedYear,
  lineLeaders,
}) => {
  const { t } = useLanguage();

  // Lookup data pimpinan lini saat ini (Chief Kolom AE, Supervisor Kolom AF, IE Kolom AG sesuai Factory Kolom AC dan Line Kolom AD)
  const currentLeader = getLineLeader(lineLeaders, selectedFactory, selectedLine);

  // Filter operator aktif di dalam fungsi kalkulasi/tabel frontend
  const activeOperators = operators.filter(row => {
    if (selectedMonth !== undefined && selectedYear !== undefined) {
      return !isOperatorResignedAtPeriod(row, selectedMonth, selectedYear);
    }
    const isResigned = row.status?.toUpperCase() === "RESIGNED";
    
    // Jika statusnya RESIGNED, buang dari daftar operator aktif di line
    if (isResigned) {
      return false; 
    }
    return true;
  });

  const totalCount = activeOperators.length;
  
  // Hitung rata-rata grade operator line dalam satuan poin (berdasarkan akumulasi poin tiap mesin)
  const allPoints = activeOperators.map(op => {
    const p = getOperatorTotalPoints(op);
    return isNaN(p) ? 0 : p;
  });
  const lineAvgPointsRaw = allPoints.length > 0
    ? (allPoints.reduce((a, b) => a + b, 0) / allPoints.length)
    : 0;
  const lineAvgPoints = isNaN(lineAvgPointsRaw) ? 0 : lineAvgPointsRaw;
  const gradeInfo = getGradeFromTotalPoints(lineAvgPoints);

  // Multiskill count (operators mastering 2 or more machine types)
  const multiskillOps = activeOperators.filter(op => getOperatorMultiSkillCount(op) >= 2);
  const multiskillCount = multiskillOps.length;
  const multiskillPctNum = totalCount > 0 ? ((multiskillCount / totalCount) * 100) : 0;
  const multiskillPct = isNaN(multiskillPctNum) ? '0.0' : multiskillPctNum.toFixed(1);

  return (
    <div className="mb-6 space-y-4">
      {/* 3 TOP KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        
        {/* 1. Total Operator Active Card */}
        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] hover:shadow-[0_12px_36px_rgba(48,72,72,0.10)] transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-[#788888] uppercase tracking-wider">
                {t.metrics.totalOperators}
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#304848] mt-1.5 font-sans">
                {totalCount} <span className="text-xs font-normal text-[#788888]">{t.common.personnel}</span>
              </h3>
            </div>
            <div className="p-3 bg-[#E0F0F0] text-[#405858] rounded-2xl border border-[#C8D8D8]">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E0E8E8] flex items-center justify-between text-xs">
            <span className="text-[#2AAFA3] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t.metrics.readyToWork}
            </span>
            <span className="text-[#98A8A8] font-medium">{selectedFactory} • {selectedLine}</span>
          </div>
        </div>

        {/* 2. Rata-Rata Grade Operator Line Card */}
        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] hover:shadow-[0_12px_36px_rgba(48,72,72,0.10)] transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-[#788888] uppercase tracking-wider">
                {t.metrics.avgLineGrade}
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#304848] mt-1.5 font-sans">
                {lineAvgPoints > 0 ? `${lineAvgPoints.toFixed(1)} ${t.common.points}` : `0 ${t.common.points}`}
              </h3>
            </div>
            <div className="p-3 bg-[#F5EAC5] text-[#8A6A08] rounded-2xl border border-[#E8D499]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E0E8E8] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 flex items-center justify-center text-[11px] font-bold rounded-full ${gradeInfo.cssBadge}`}>
                {gradeInfo.letter || gradeInfo.grade.charAt(0)}
              </span>
              <span className="text-[11px] font-semibold text-[#506868]">
                {gradeInfo.label}
              </span>
            </div>
            <span className="text-[#788888] font-medium">{t.metrics.targetIE}: {targetGrade}</span>
          </div>
        </div>

        {/* 3. Multiskill Operator Card */}
        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] hover:shadow-[0_12px_36px_rgba(48,72,72,0.10)] transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-[#788888] uppercase tracking-wider">
                {t.metrics.multiSkillTitle}
              </p>
              <h3 className="text-2xl sm:text-3xl font-bold text-[#304848] mt-1.5 font-sans">
                {multiskillCount} <span className="text-xs font-normal text-[#788888]">{t.common.personnel}</span>
              </h3>
            </div>
            <div className="p-3 bg-[#D9F1EF] text-[#247F77] rounded-2xl border border-[#BDE5E2]">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#E0E8E8] flex items-center justify-between text-xs">
            <span className="text-[#2AAFA3] font-semibold">
              {multiskillPct}% {t.metrics.ofPopulation}
            </span>
            <span className="text-[#788888]">{t.metrics.rebalancingReadiness}</span>
          </div>
        </div>

      </div>

      {/* PIMPINAN LINI: CHIEF, SUPERVISOR, IE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* CHIEF */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#E0E8E8] shadow-[0_4px_16px_rgba(48,72,72,0.04)]">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-700 font-bold shrink-0">
            <Award className="w-4 h-4 text-teal-600" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2AAFA3]">
              {t.metrics.chiefLabel}
            </span>
            <p className="text-sm font-bold text-[#244646] truncate" title={currentLeader.chief}>
              {currentLeader.chief && currentLeader.chief !== "-" ? currentLeader.chief : "-"}
            </p>
          </div>
        </div>

        {/* SUPERVISOR */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#E0E8E8] shadow-[0_4px_16px_rgba(48,72,72,0.04)]">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-700 font-bold shrink-0">
            <UserCheck className="w-4 h-4 text-cyan-700" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#244646]">
              {t.metrics.supervisorLabel}
            </span>
            <p className="text-sm font-bold text-[#244646] truncate" title={currentLeader.supervisor}>
              {currentLeader.supervisor && currentLeader.supervisor !== "-" ? currentLeader.supervisor : "-"}
            </p>
          </div>
        </div>

        {/* INDUSTRIAL ENGINEER / IE */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#E0E8E8] shadow-[0_4px_16px_rgba(48,72,72,0.04)]">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 font-bold shrink-0">
            <Cog className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              {t.metrics.ieLabel}
            </span>
            <p className="text-sm font-bold text-[#244646] truncate" title={currentLeader.ie}>
              {currentLeader.ie && currentLeader.ie !== "-" ? currentLeader.ie : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};


