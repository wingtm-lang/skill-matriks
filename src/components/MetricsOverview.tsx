import React from 'react';
import { Users, TrendingUp, Cpu, CheckCircle2 } from 'lucide-react';
import { Operator } from '../types';
import { getOperatorMultiSkillCount, getOperatorAvgRate } from '../utils/ieCalculations';
import { getGradeFromRate } from '../data/mockData';

interface MetricsOverviewProps {
  operators: Operator[];
  selectedLine: string;
  selectedFactory: string;
  targetRate?: number;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  operators,
  selectedLine,
  selectedFactory,
  targetRate = 75,
}) => {
  // Filter operator aktif di dalam fungsi kalkulasi/tabel frontend
  const activeOperators = operators.filter(row => {
    const isResigned = row.status?.toUpperCase() === "RESIGNED";
    
    // Jika statusnya RESIGNED, buang dari daftar operator aktif di line
    if (isResigned) {
      return false; 
    }
    return true;
  });

  const totalCount = activeOperators.length;
  
  // Calculate average line efficiency
  const allAvgRates = activeOperators.map(op => getOperatorAvgRate(op)).filter(r => r > 0);
  const lineAvgRate = allAvgRates.length > 0
    ? (allAvgRates.reduce((a, b) => a + b, 0) / allAvgRates.length)
    : 0;
  const gradeInfo = getGradeFromRate(lineAvgRate);

  // Multiskill count (operators mastering 2 or more machine types)
  const multiskillOps = activeOperators.filter(op => getOperatorMultiSkillCount(op) >= 2);
  const multiskillCount = multiskillOps.length;
  const multiskillPct = totalCount > 0 ? ((multiskillCount / totalCount) * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-6">
      
      {/* 1. Total Operator Active Card */}
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] hover:shadow-[0_12px_36px_rgba(48,72,72,0.10)] transition-all duration-200">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-[#788888] uppercase tracking-wider">
              Total Operator Line
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#304848] mt-1.5 font-sans">
              {totalCount} <span className="text-xs font-normal text-[#788888]">Personil</span>
            </h3>
          </div>
          <div className="p-3 bg-[#E0F0F0] text-[#405858] rounded-2xl border border-[#C8D8D8]">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-[#E0E8E8] flex items-center justify-between text-xs">
          <span className="text-[#2AAFA3] font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            100% Siap Kerja
          </span>
          <span className="text-[#98A8A8] font-medium">{selectedFactory} • {selectedLine}</span>
        </div>
      </div>

      {/* 2. Rata-Rata Line Efficiency Card */}
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] hover:shadow-[0_12px_36px_rgba(48,72,72,0.10)] transition-all duration-200">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-[#788888] uppercase tracking-wider">
              Rata-Rata Efisiensi Line
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#304848] mt-1.5 font-sans">
              {lineAvgRate > 0 ? `${lineAvgRate.toFixed(1)}%` : '0%'}
            </h3>
          </div>
          <div className="p-3 bg-[#F5EAC5] text-[#8A6A08] rounded-2xl border border-[#E8D499]">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-[#E0E8E8] flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${gradeInfo.cssBadge}`}>
              {gradeInfo.label}
            </span>
          </div>
          <span className="text-[#788888] font-medium">Target IE: {targetRate}%</span>
        </div>
      </div>

      {/* 3. Multiskill Operator Card */}
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] hover:shadow-[0_12px_36px_rgba(48,72,72,0.10)] transition-all duration-200">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-[#788888] uppercase tracking-wider">
              Multi-Skill (≥2 Mesin)
            </p>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#304848] mt-1.5 font-sans">
              {multiskillCount} <span className="text-xs font-normal text-[#788888]">Personil</span>
            </h3>
          </div>
          <div className="p-3 bg-[#D9F1EF] text-[#247F77] rounded-2xl border border-[#BDE5E2]">
            <Cpu className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-[#E0E8E8] flex items-center justify-between text-xs">
          <span className="text-[#2AAFA3] font-semibold">
            {multiskillPct}% dari populasi
          </span>
          <span className="text-[#788888]">Kesiapan Rebalancing</span>
        </div>
      </div>

    </div>
  );
};
