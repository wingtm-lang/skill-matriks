import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, 
  Brain, 
  Settings2, 
  AlertTriangle, 
  CheckCircle, 
  Layers, 
  ArrowRight, 
  Users, 
  Clock, 
  Zap, 
  Sliders, 
  Plus, 
  RefreshCw, 
  HelpCircle,
  Lightbulb,
  ShieldCheck,
  TrendingUp,
  LayoutGrid,
  ListTree,
  CheckCircle2
} from 'lucide-react';
import { GarmentStyle, Operator, LineBalancingResult, WorkstationAssignment, OperationProcess } from '../types';
import { calculateLineBalancing } from '../utils/ieCalculations';
import { getGradeFromRate } from '../data/mockData';
import { useLanguage } from '../i18n/LanguageContext';

interface LineBalancingTabProps {
  styles: GarmentStyle[];
  operators: Operator[];
  selectedLine: string;
  selectedFactory: string;
  onAddCustomStyle?: (style: GarmentStyle) => void;
}

export const LineBalancingTab: React.FC<LineBalancingTabProps> = ({
  styles,
  operators,
  selectedLine,
  selectedFactory,
}) => {
  const { t } = useLanguage();
  const [selectedStyleId, setSelectedStyleId] = useState<string>(styles[0]?.id || '');
  const [targetPerHour, setTargetPerHour] = useState<number>(styles[0]?.targetPcsPerHour || 110);
  const [workingHours, setWorkingHours] = useState<number>(8);
  const [viewMode, setViewMode] = useState<'LIST' | 'LAYOUT' | 'YAMAZUMI'>('LIST');

  // AI Loading & Analysis State
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  // Selected Garment Style
  const selectedStyle = useMemo(() => {
    return styles.find((s) => s.id === selectedStyleId) || styles[0];
  }, [styles, selectedStyleId]);

  // Update targetPerHour when style changes
  useEffect(() => {
    if (selectedStyle) {
      setTargetPerHour(selectedStyle.targetPcsPerHour);
    }
  }, [selectedStyle]);

  // Filter operator aktif di dalam fungsi kalkulasi/tabel frontend
  const activeOperators = useMemo(() => {
    return operators.filter(row => {
      const isResigned = row.status?.toUpperCase() === "RESIGNED";
      
      // Jika statusnya RESIGNED, buang dari daftar operator aktif di line
      if (isResigned) {
        return false; 
      }
      return true;
    });
  }, [operators]);

  // Calculate local line balancing based on currently assigned operators
  const balancingResult: LineBalancingResult = useMemo(() => {
    return calculateLineBalancing(selectedStyle, activeOperators, {
      workingHoursPerDay: workingHours,
      manualTargetOutput: targetPerHour * workingHours,
    });
  }, [selectedStyle, activeOperators, workingHours, targetPerHour]);

  // Trigger Gemini AI Line Balancing Optimization
  const handleRunAIBalancing = async () => {
    setIsAiLoading(true);
    setAiAnalysisResult(null);

    try {
      const response = await fetch('/api/gemini/line-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleData: selectedStyle,
          operators: activeOperators.slice(0, 34),
          currentBalancing: balancingResult,
        }),
      });

      const data = await response.json();
      if (data.analysis) {
        setAiAnalysisResult(data.analysis);
      }
    } catch (err) {
      console.error('Error running AI line balance:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER CONTROLS & STYLE SELECTOR */}
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          
          {/* Style Selector */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#506868] mb-1.5 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#2AAFA3]" />
              <span>{t.lineBalancing.selectStyle}</span>
            </label>
            <select
              value={selectedStyleId}
              onChange={(e) => setSelectedStyleId(e.target.value)}
              className="w-full bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] text-xs sm:text-sm font-semibold rounded-xl p-2.5 focus:border-[#2AAFA3] focus:ring-2 focus:ring-[#2AAFA3]/20 outline-none cursor-pointer"
            >
              {styles.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.styleCode} — {style.styleName} ({style.processes.length} {t.lineBalancing.positionsCount})
                </option>
              ))}
            </select>
          </div>

          {/* Target Pcs Per Hour */}
          <div>
            <label className="block text-xs font-semibold text-[#506868] mb-1.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#D0A018]" />
              <span>{t.lineBalancing.targetPcsHour}</span>
            </label>
            <input
              type="number"
              min={10}
              max={500}
              value={targetPerHour}
              onChange={(e) => setTargetPerHour(Math.max(1, parseInt(e.target.value) || 10))}
              className="w-full bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] font-bold text-xs sm:text-sm rounded-xl p-2.5 focus:border-[#D0A018] focus:outline-none"
            />
          </div>

          {/* AI Trigger Button */}
          <div>
            <button
              onClick={handleRunAIBalancing}
              disabled={isAiLoading}
              className="w-full bg-[#D0A018] hover:bg-[#B88C10] text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{t.lineBalancing.aiAnalyzing}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>{t.lineBalancing.aiAutoBalanceBtn}</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* LINE BALANCING PERFORMANCE METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-4 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
          <p className="text-[11px] text-[#788888] font-semibold uppercase tracking-wider">{t.lineBalancing.pitchTime}</p>
          <h4 className="text-xl font-bold text-[#405858] mt-1 font-mono">
            {balancingResult.pitchTime} <span className="text-xs text-[#788888] font-sans">{t.lineBalancing.seconds}</span>
          </h4>
          <p className="text-[10px] text-[#98A8A8] mt-1">{t.lineBalancing.pitchFormula}</p>
        </div>

        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-4 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
          <p className="text-[11px] text-[#788888] font-semibold uppercase tracking-wider">{t.lineBalancing.lineEfficiency}</p>
          <h4 className={`text-xl font-bold mt-1 font-mono ${
            balancingResult.lineEfficiency >= 75 ? 'text-[#2AAFA3]' : 'text-[#D0A018]'
          }`}>
            {balancingResult.lineEfficiency}%
          </h4>
          <p className="text-[10px] text-[#98A8A8] mt-1">{t.lineBalancing.leanTarget}</p>
        </div>

        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-4 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
          <p className="text-[11px] text-[#788888] font-semibold uppercase tracking-wider">{t.lineBalancing.balanceDelay}</p>
          <h4 className="text-xl font-bold text-[#C96B6B] mt-1 font-mono">
            {balancingResult.balanceDelay}%
          </h4>
          <p className="text-[10px] text-[#98A8A8] mt-1">{t.lineBalancing.balanceDelayFormula}</p>
        </div>

        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-4 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
          <p className="text-[11px] text-[#788888] font-semibold uppercase tracking-wider">{t.lineBalancing.bottleneckCycle}</p>
          <h4 className="text-xl font-bold text-[#C96B6B] mt-1 font-mono">
            {balancingResult.bottleneckCycleTime} <span className="text-xs text-[#788888] font-sans">{t.lineBalancing.seconds}</span>
          </h4>
          <p className="text-[10px] text-[#98A8A8] mt-1">{t.lineBalancing.criticalStation}</p>
        </div>

        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-4 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
          <p className="text-[11px] text-[#788888] font-semibold uppercase tracking-wider">{t.lineBalancing.smoothnessIndex}</p>
          <h4 className="text-xl font-bold text-[#405858] mt-1 font-mono">
            {balancingResult.smoothnessIndex}
          </h4>
          <p className="text-[10px] text-[#98A8A8] mt-1">{t.lineBalancing.lowerIsSmoother}</p>
        </div>

        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-4 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
          <p className="text-[11px] text-[#788888] font-semibold uppercase tracking-wider">{t.lineBalancing.projectedOutput}</p>
          <h4 className="text-xl font-bold text-[#2AAFA3] mt-1 font-mono">
            {balancingResult.projectedDailyOutput} <span className="text-xs text-[#788888] font-sans">{t.lineBalancing.pcsPerDay}</span>
          </h4>
          <p className="text-[10px] text-[#98A8A8] mt-1">{balancingResult.projectedOutputPerHour} {t.lineBalancing.pcsPerHour}</p>
        </div>

      </div>

      {/* GEMINI AI IN-DEPTH ANALYSIS CARD (IF GENERATED) */}
      {aiAnalysisResult && (
        <div className="bg-[#F8FBFB] border border-[#C8D8D8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] animate-fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-[#E0E8E8] mb-3">
            <h3 className="text-sm font-bold text-[#405858] flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#2AAFA3]" />
              <span>{t.lineBalancing.aiKaizenTitle}</span>
            </h3>
            <span className="text-[11px] bg-[#F5EAC5] text-[#8A6A08] px-2.5 py-0.5 rounded-full border border-[#E8D499] font-bold">
              {t.lineBalancing.aiKaizenBadge}
            </span>
          </div>
          <div className="text-xs text-[#506868] leading-relaxed whitespace-pre-line font-sans space-y-2">
            {aiAnalysisResult}
          </div>
        </div>
      )}

      {/* VIEW TOGGLES & WORKSTATIONS CONTAINER */}
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] overflow-hidden shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
        
        {/* VIEW MODE TOOLBAR */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#E0E8E8] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#304848] flex items-center gap-2">
              <span>{t.lineBalancing.workstationTitle} ({selectedLine})</span>
              <span className="text-xs font-normal text-[#788888]">({balancingResult.assignments.length} {t.lineBalancing.stationsCountLabel})</span>
            </h3>
          </div>

          <div className="flex items-center bg-[#F8F8F8] p-1 rounded-xl border border-[#E0E8E8]">
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'LIST'
                  ? 'bg-[#405858] text-white shadow-2xs'
                  : 'text-[#788888] hover:text-[#304848]'
              }`}
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>{t.lineBalancing.tabList}</span>
            </button>
            <button
              onClick={() => setViewMode('YAMAZUMI')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'YAMAZUMI'
                  ? 'bg-[#405858] text-white shadow-2xs'
                  : 'text-[#788888] hover:text-[#304848]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{t.lineBalancing.tabYamazumi}</span>
            </button>
            <button
              onClick={() => setViewMode('LAYOUT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'LAYOUT'
                  ? 'bg-[#405858] text-white shadow-2xs'
                  : 'text-[#788888] hover:text-[#304848]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t.lineBalancing.tabLayout}</span>
            </button>
          </div>
        </div>

        {/* 1. LIST VIEW OF WORKSTATIONS */}
        {viewMode === 'LIST' && (
          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#F8FBFB]/50">
            {balancingResult.assignments.map((assignment) => {
              const op = assignment.assignedOperator;
              const grade = getGradeFromRate(assignment.operatorEfficiency);
              const isBottleneck = assignment.isBottleneck;

              return (
                <div
                  key={assignment.stationNumber}
                  className={`bg-white border rounded-[16px] p-4 flex flex-col justify-between transition-all ${
                    isBottleneck
                      ? 'border-[#F8C8C8] bg-[#FFFBFB]'
                      : 'border-[#E0E8E8] hover:border-[#C8D8D8]'
                  }`}
                >
                  <div>
                    
                    {/* Header: Station & Machine */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[#E0F0F0] text-[#405858] font-bold text-xs flex items-center justify-center font-mono">
                          {assignment.stationNumber}
                        </span>
                        <h4 className="text-xs font-bold text-[#304848] line-clamp-1">
                          {assignment.process.name}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        assignment.process.machineType === 'OVERLOCK'
                          ? 'bg-[#D9F1EF] text-[#247F77] border-[#BDE5E2]'
                          : assignment.process.machineType === 'FLATSEAM'
                          ? 'bg-[#FEF3D6] text-[#92600C] border-[#FDE5A5]'
                          : assignment.process.machineType === 'SPECIAL'
                          ? 'bg-[#E8EEEE] text-[#405858] border-[#D5E1E1]'
                          : 'bg-[#E0F2F1] text-[#1D746D] border-[#C6E9E7]'
                      }`}>
                        {assignment.process.machineType}
                      </span>
                    </div>

                    {/* SMV vs Cycle Time Bar */}
                    <div className="bg-[#F8F8F8] rounded-xl p-2.5 mb-3 border border-[#E0E8E8]">
                      <div className="flex items-center justify-between text-xs mb-1 font-mono">
                        <span className="text-[#788888] text-[11px]">
                          SMV: <strong className="text-[#304848]">{assignment.process.smvSeconds}s</strong>
                        </span>
                        <span className={`text-[11px] font-bold ${
                          isBottleneck ? 'text-[#C96B6B]' : 'text-[#2AAFA3]'
                        }`}>
                          Cycle: {assignment.actualCycleTime}s (Pitch: {assignment.pitchTime}s)
                        </span>
                      </div>

                      {/* Progress bar comparing Cycle Time vs Pitch Time */}
                      <div className="w-full h-2 bg-[#E0E8E8] rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isBottleneck ? 'bg-[#C96B6B]' : 'bg-[#2AAFA3]'
                          }`}
                          style={{
                            width: `${Math.min(100, (assignment.actualCycleTime / (assignment.pitchTime * 1.3)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Assigned Operator Info */}
                    {op ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E0F0F0] border border-[#C8D8D8] flex items-center justify-center text-[#405858] font-bold text-xs">
                          {op.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#304848]">{op.name}</span>
                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${grade.cssBadge}`}>
                              {assignment.operatorEfficiency.toFixed(1)}% ({grade.label})
                            </span>
                          </div>
                          <p className="text-[10px] text-[#788888] font-mono">NIK: {op.nik} • {t.multiSkill.operatorTenure}: {op.workTimeMonths} {t.common.months}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#C96B6B] font-medium py-1">
                        {t.lineBalancing.unassignedOperator}
                      </div>
                    )}

                  </div>

                  {/* Bottleneck Alert & Recommendation */}
                  {isBottleneck && (
                    <div className="mt-3 pt-2.5 border-t border-[#F8C8C8] flex items-start gap-2 text-[11px] text-[#C96B6B]">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#C96B6B] shrink-0 mt-0.5" />
                      <div>
                        <span>{t.lineBalancing.bottleneckNotice} (+{(assignment.actualCycleTime - assignment.pitchTime).toFixed(1)}s). </span>
                        {assignment.backupOperator && (
                          <span className="text-[#506868]">
                            {t.lineBalancing.backupRecommendation} <strong>{assignment.backupOperator.name}</strong>.
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}

        {/* 2. YAMAZUMI BALANCING CHART */}
        {viewMode === 'YAMAZUMI' && (
          <div className="p-6 space-y-6">
            <div>
              <h4 className="text-xs font-bold text-[#405858] mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2AAFA3]" />
                <span>{t.lineBalancing.yamazumiTitle}</span>
              </h4>
              <p className="text-xs text-[#788888]">
                {t.lineBalancing.yamazumiSubtitle}
              </p>
            </div>

            <div className="space-y-3">
              {balancingResult.assignments.map((assignment) => {
                const isOver = assignment.actualCycleTime > assignment.pitchTime;
                const ratio = Math.min(100, (assignment.actualCycleTime / (balancingResult.pitchTime * 1.5)) * 100);
                const pitchRatio = (1 / 1.5) * 100; // 66.6% mark

                return (
                  <div key={assignment.stationNumber} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[#304848] font-semibold truncate max-w-xs">
                        Pos {assignment.stationNumber}: {assignment.process.name} ({assignment.assignedOperator?.name || t.lineBalancing.unassignedOperator})
                      </span>
                      <span className={`font-bold ${isOver ? 'text-[#C96B6B]' : 'text-[#2AAFA3]'}`}>
                        {assignment.actualCycleTime}s
                      </span>
                    </div>

                    <div className="relative w-full h-5 bg-[#F8F8F8] rounded-lg overflow-hidden border border-[#E0E8E8]">
                      {/* Pitch time vertical guideline */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-[#405858] z-10"
                        style={{ left: `${pitchRatio}%` }}
                        title={`Pitch Time: ${balancingResult.pitchTime}s`}
                      />

                      {/* Bar fill */}
                      <div
                        className={`h-full rounded transition-all duration-300 ${
                          isOver ? 'bg-[#C96B6B]' : 'bg-[#2AAFA3]'
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-[#788888] pt-4 border-t border-[#E0E8E8]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#2AAFA3] inline-block"></span>
                  {t.lineBalancing.balancedLegend}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#C96B6B] inline-block"></span>
                  {t.lineBalancing.bottleneckLegend}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-[#405858] inline-block"></span>
                  {t.lineBalancing.targetPitchLegend} ({balancingResult.pitchTime}s)
                </span>
              </div>
              <span className="font-mono text-[#304848] font-semibold">{t.lineBalancing.totalSamLabel} {balancingResult.totalSmv} {t.lineBalancing.seconds}</span>
            </div>
          </div>
        )}

        {/* 3. VISUAL SEWING LINE LAYOUT VIEW */}
        {viewMode === 'LAYOUT' && (
          <div className="p-6">
            <div className="mb-4">
              <h4 className="text-xs font-bold text-[#405858] mb-1">
                {t.lineBalancing.visualLayoutTitle}
              </h4>
              <p className="text-xs text-[#788888]">
                {t.lineBalancing.visualLayoutSubtitle}
              </p>
            </div>

            {/* Visual Conveyor Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {balancingResult.assignments.map((assignment) => {
                const isBottleneck = assignment.isBottleneck;
                return (
                  <div
                    key={assignment.stationNumber}
                    className={`bg-[#F8F8F8] border rounded-2xl p-3 flex flex-col justify-between items-center text-center relative transition-all ${
                      isBottleneck ? 'border-[#F8C8C8] bg-[#FFFBFB]' : 'border-[#E0E8E8] hover:border-[#C8D8D8]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#E0F0F0] text-[#405858] font-bold text-xs flex items-center justify-center font-mono mb-2">
                      {assignment.stationNumber}
                    </div>

                    <p className="text-[11px] font-bold text-[#304848] line-clamp-2 mb-1">
                      {assignment.process.name}
                    </p>

                    <span className="text-[10px] font-mono text-[#2AAFA3] mb-2 font-semibold">
                      {assignment.process.machineType}
                    </span>

                    <div className="w-full pt-2 border-t border-[#E0E8E8] text-[10px] font-mono">
                      <span className="text-[#506868] font-semibold block truncate">
                        {assignment.assignedOperator?.name || t.lineBalancing.unassignedOperator}
                      </span>
                      <span className={isBottleneck ? 'text-[#C96B6B] font-bold' : 'text-[#2AAFA3] font-bold'}>
                        {assignment.actualCycleTime}s
                      </span>
                    </div>

                    {isBottleneck && (
                      <span className="absolute -top-2 -right-2 bg-[#C96B6B] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-xs">
                        {t.lineBalancing.bottleneckNotice}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
