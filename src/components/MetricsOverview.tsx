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
  
  // Hitung rata-rata grade operator line dalam satuan poin
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
      {/* 3 TOP PRIMARY KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* 1. Total Operator Active Card */}
        <div className="ops-card ops-card-hover p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-[#647878] uppercase tracking-wider">
                {t.metrics.totalOperators}
              </p>
              <h3 className="text-3xl sm:text-[32px] font-bold text-[#102A2A] mt-1.5 tracking-tight tabular-nums">
                {totalCount.toLocaleString()} <span className="text-xs font-normal text-[#647878]">{t.common.personnel}</span>
              </h3>
              <p className="text-[12px] text-[#647878] mt-1">
                Active production workforce
              </p>
            </div>
            <div className="p-2.5 bg-[#EAF5F5] text-[#214E49] rounded-[10px] border border-[#D8E5E5] shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#D8E5E5] flex items-center justify-between text-xs">
            <span className="text-[#12B886] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t.metrics.readyToWork}
            </span>
            <span className="text-[#647878] font-medium">{selectedFactory} • {selectedLine}</span>
          </div>
        </div>

        {/* 2. Rata-Rata Grade Operator Line Card */}
        <div className="ops-card ops-card-hover p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-[#647878] uppercase tracking-wider">
                {t.metrics.avgLineGrade}
              </p>
              <h3 className="text-3xl sm:text-[32px] font-bold text-[#102A2A] mt-1.5 tracking-tight tabular-nums">
                {lineAvgPoints > 0 ? `${lineAvgPoints.toFixed(1)} ${t.common.points}` : `0 ${t.common.points}`}
              </h3>
              <p className="text-[12px] text-[#647878] mt-1">
                Average skill level index
              </p>
            </div>
            <div className="p-2.5 bg-[#FEF6E7] text-[#C77E05] rounded-[10px] border border-[#FCDCA0] shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#D8E5E5] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded-[6px] ${gradeInfo.cssBadge}`}>
                {gradeInfo.letter || gradeInfo.grade.charAt(0)}
              </span>
              <span className="text-[11px] font-semibold text-[#102A2A]">
                {gradeInfo.label}
              </span>
            </div>
            <span className="text-[#647878] font-medium">{t.metrics.targetIE}: {targetGrade}</span>
          </div>
        </div>

        {/* 3. Multiskill Operator Card */}
        <div className="ops-card ops-card-hover p-5 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-bold text-[#647878] uppercase tracking-wider">
                {t.metrics.multiSkillTitle}
              </p>
              <h3 className="text-3xl sm:text-[32px] font-bold text-[#102A2A] mt-1.5 tracking-tight tabular-nums">
                {multiskillCount.toLocaleString()} <span className="text-xs font-normal text-[#647878]">{t.common.personnel}</span>
              </h3>
              <p className="text-[12px] text-[#647878] mt-1">
                {multiskillCount} operators master ≥2 machines
              </p>
            </div>
            <div className="p-2.5 bg-[#EBF6FC] text-[#0F78AC] rounded-[10px] border border-[#BEDFF4] shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[#D8E5E5] flex items-center justify-between text-xs">
            <span className="text-[#1477B8] font-semibold">
              {multiskillPct}% {t.metrics.ofPopulation}
            </span>
            <span className="text-[#647878] font-medium">{t.metrics.rebalancingReadiness}</span>
          </div>
        </div>

      </div>

      {/* PIMPINAN LINI: CHIEF, SUPERVISOR, IE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* CHIEF */}
        <div className="flex items-center gap-3 p-3 rounded-[12px] bg-white border border-[#D8E5E5]">
          <div className="w-8 h-8 rounded-[8px] bg-[#E8F8F2] border border-[#B8EBD8] flex items-center justify-center text-[#0E936B] font-bold shrink-0">
            <Award className="w-4 h-4 text-[#0E936B]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E936B] block">
              {t.metrics.chiefLabel}
            </span>
            <p className="text-[13px] font-bold text-[#102A2A] truncate" title={currentLeader.chief}>
              {currentLeader.chief && currentLeader.chief !== "-" ? currentLeader.chief : "-"}
            </p>
          </div>
        </div>

        {/* SUPERVISOR */}
        <div className="flex items-center gap-3 p-3 rounded-[12px] bg-white border border-[#D8E5E5]">
          <div className="w-8 h-8 rounded-[8px] bg-[#EBF6FC] border border-[#BEDFF4] flex items-center justify-center text-[#0F78AC] font-bold shrink-0">
            <UserCheck className="w-4 h-4 text-[#0F78AC]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0F78AC] block">
              {t.metrics.supervisorLabel}
            </span>
            <p className="text-[13px] font-bold text-[#102A2A] truncate" title={currentLeader.supervisor}>
              {currentLeader.supervisor && currentLeader.supervisor !== "-" ? currentLeader.supervisor : "-"}
            </p>
          </div>
        </div>

        {/* INDUSTRIAL ENGINEER / IE */}
        <div className="flex items-center gap-3 p-3 rounded-[12px] bg-white border border-[#D8E5E5]">
          <div className="w-8 h-8 rounded-[8px] bg-[#FEF6E7] border border-[#FCDCA0] flex items-center justify-center text-[#C77E05] font-bold shrink-0">
            <Cog className="w-4 h-4 text-[#C77E05]" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C77E05] block">
              {t.metrics.ieLabel}
            </span>
            <p className="text-[13px] font-bold text-[#102A2A] truncate" title={currentLeader.ie}>
              {currentLeader.ie && currentLeader.ie !== "-" ? currentLeader.ie : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
