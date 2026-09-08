import React, { useState, useEffect } from 'react';
import { 
  Target, 
  Sparkles, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  ChevronRight, 
  Award, 
  RefreshCw,
  Zap,
  GraduationCap,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { Operator, MachineCategory } from '../types';
import { getOperatorMultiSkillCount, getOperatorAvgRate } from '../utils/ieCalculations';
import { getGradeFromRate } from '../data/mockData';
import { useLanguage } from '../i18n/LanguageContext';

interface MultiSkillDevelopmentTabProps {
  operators: Operator[];
  selectedLine: string;
  selectedFactory: string;
}

export const MultiSkillDevelopmentTab: React.FC<MultiSkillDevelopmentTabProps> = ({
  operators,
  selectedLine,
  selectedFactory,
}) => {
  const { t } = useLanguage();
  // Filter operator aktif di dalam fungsi kalkulasi/tabel frontend
  const activeOperators = operators.filter(row => {
    const isResigned = row.status?.toUpperCase() === "RESIGNED";
    
    // Jika statusnya RESIGNED, buang dari daftar operator aktif di line
    if (isResigned) {
      return false; 
    }
    return true;
  });

  const [selectedOpId, setSelectedOpId] = useState<string>(activeOperators[0]?.id || '');
  const [targetMachine, setTargetMachine] = useState<MachineCategory>('OVERLOCK');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);

  // Sync selectedOpId when operators change
  useEffect(() => {
    if (activeOperators.length > 0) {
      setSelectedOpId((prev) => (activeOperators.some(op => op.id === prev) ? prev : activeOperators[0].id));
    } else {
      setSelectedOpId('');
    }
  }, [activeOperators]);

  // Machine Coverage Breakdown in this Line
  const machineCoverage = {
    lockstitch: activeOperators.filter((op) => (op.lockstitch ?? 0) > 0).length,
    overlock: activeOperators.filter((op) => (op.overlock ?? 0) > 0).length,
    flatseam: activeOperators.filter((op) => (op.flatseam ?? 0) > 0).length,
    special: activeOperators.filter((op) => (op.special ?? 0) > 0).length,
    buttonHole: activeOperators.filter((op) => (op.buttonHole ?? 0) > 0).length,
    buttonSet: activeOperators.filter((op) => (op.buttonSet ?? 0) > 0).length,
  };

  const selectedOp = activeOperators.find((op) => op.id === selectedOpId) || activeOperators[0];

  // AI Retraining Plan Request
  const handleGenerateRetrainingPlan = async () => {
    if (!selectedOp) return;
    setIsAiGenerating(true);
    setGeneratedPlan(null);

    try {
      const response = await fetch('/api/gemini/retraining-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: selectedOp,
          targetMachine,
          line: selectedLine,
          factory: selectedFactory,
        }),
      });

      const data = await response.json();
      if (data.plan) {
        setGeneratedPlan(data.plan);
      }
    } catch (err) {
      console.error('Error generating retraining plan:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. MACHINE COVERAGE & BOTTLENECK READINESS */}
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-[#304848] flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#2AAFA3]" />
            <span>{t.multiSkill.machineCoverageTitle} ({selectedFactory} • {selectedLine})</span>
          </h3>
          <p className="text-xs text-[#788888]">
            {t.multiSkill.machineCoverageSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { name: 'Lockstitch', count: machineCoverage.lockstitch, color: 'text-[#2AAFA3]', bg: 'bg-[#D9F1EF]', border: 'border-[#BDE5E2]', status: t.multiSkill.coverageStatusSafe },
            { name: 'Overlock', count: machineCoverage.overlock, color: 'text-[#2AAFA3]', bg: 'bg-[#D9F1EF]', border: 'border-[#BDE5E2]', status: t.multiSkill.coverageStatusSafe },
            { name: 'Flatseam', count: machineCoverage.flatseam, color: 'text-[#92600C]', bg: 'bg-[#FEF3D6]', border: 'border-[#FDE5A5]', status: t.multiSkill.coverageStatusCritical },
            { name: 'Special / Press', count: machineCoverage.special, color: 'text-[#92600C]', bg: 'bg-[#FEF3D6]', border: 'border-[#FDE5A5]', status: t.multiSkill.coverageStatusCritical },
            { name: 'Button Hole', count: machineCoverage.buttonHole, color: 'text-[#405858]', bg: 'bg-[#E8EEEE]', border: 'border-[#D5E1E1]', status: t.multiSkill.coverageStatusModerate },
            { name: 'Button Set', count: machineCoverage.buttonSet, color: 'text-[#405858]', bg: 'bg-[#E8EEEE]', border: 'border-[#D5E1E1]', status: t.multiSkill.coverageStatusModerate },
          ].map((item, idx) => (
            <div key={idx} className="bg-[#F8F8F8] border border-[#E0E8E8] rounded-2xl p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#788888] block truncate">{item.name}</span>
                <h4 className="text-xl font-bold text-[#304848] mt-1 font-mono">
                  {item.count} <span className="text-xs font-normal text-[#788888]">{t.multiSkill.operatorUnit}</span>
                </h4>
              </div>
              <div className="mt-2.5 pt-2 border-t border-[#E0E8E8]">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.bg} ${item.color} ${item.border}`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. OPERATOR RETRAINING & MULTI-SKILL AI BUILDER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form: Select Operator & Target Machine */}
        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] space-y-4">
          <div>
            <h3 className="text-sm font-bold text-[#304848] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#D0A018]" />
              <span>{t.multiSkill.plannerTitle}</span>
            </h3>
            <p className="text-xs text-[#788888] mt-0.5">
              {t.multiSkill.plannerSubtitle}
            </p>
          </div>

          {/* Select Operator */}
          <div>
            <label className="block text-xs font-semibold text-[#506868] mb-1">
              {t.multiSkill.selectOperator}
            </label>
            <select
              value={selectedOpId}
              onChange={(e) => setSelectedOpId(e.target.value)}
              disabled={operators.length === 0}
              className="w-full bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] text-xs font-semibold rounded-xl p-2.5 focus:border-[#2AAFA3] outline-none cursor-pointer disabled:opacity-60"
            >
              {operators.length === 0 ? (
                <option value="">{t.multiSkill.noOperatorsInLine}</option>
              ) : (
                operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nik} - {op.name} ({getOperatorMultiSkillCount(op)} Skill, Avg: {getOperatorAvgRate(op).toFixed(1)}%)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Selected Operator Summary Card */}
          {selectedOp && (
            <div className="bg-[#F8FBFB] border border-[#C8D8D8] rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#304848]">{selectedOp.name}</span>
                <span className="text-[10px] bg-[#E0F0F0] text-[#405858] font-bold px-2 py-0.5 rounded-full border border-[#C8D8D8]">
                  {t.multiSkill.operatorTenure}: {selectedOp.workTimeMonths} {t.common.months}
                </span>
              </div>
              
              <div className="text-[11px] text-[#788888] space-y-1">
                <div>{t.multiSkill.currentSkillsLabel}:</div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {selectedOp.lockstitch && <span className="badge-teal text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#BDE5E2]">Lockstitch ({selectedOp.lockstitch}%)</span>}
                  {selectedOp.overlock && <span className="badge-teal text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#BDE5E2]">Overlock ({selectedOp.overlock}%)</span>}
                  {selectedOp.flatseam && <span className="badge-gold text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E8D499]">Flatseam ({selectedOp.flatseam}%)</span>}
                  {selectedOp.special && <span className="badge-gold text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E8D499]">Special ({selectedOp.special}%)</span>}
                  {selectedOp.buttonHole && <span className="badge-neutral text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#D5E1E1]">Button Hole ({selectedOp.buttonHole}%)</span>}
                </div>
              </div>
            </div>
          )}

          {/* Target Machine to Learn */}
          <div>
            <label className="block text-xs font-semibold text-[#506868] mb-1">
              {t.multiSkill.targetMachine}
            </label>
            <select
              value={targetMachine}
              onChange={(e) => setTargetMachine(e.target.value as MachineCategory)}
              className="w-full bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] text-xs font-semibold rounded-xl p-2.5 focus:border-[#D0A018] outline-none cursor-pointer"
            >
              <option value="OVERLOCK">Overlock (O/L 3-4 Benang)</option>
              <option value="FLATSEAM">Flatseam (4 Needle 6 Thread - High Skill)</option>
              <option value="SPECIAL">Special / Automatic Hemming / Elastic</option>
              <option value="LOCKSTITCH">Lockstitch (Single Needle High Speed)</option>
              <option value="BUTTON_HOLE">Button Hole (Lubang Kancing Komputer)</option>
              <option value="BUTTON_SET">Button Set (Pasang Kancing)</option>
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateRetrainingPlan}
            disabled={isAiGenerating || !selectedOp}
            className="w-full bg-[#D0A018] hover:bg-[#B88C10] text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isAiGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>{t.multiSkill.generatingPlan}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-white" />
                <span>{t.multiSkill.generatePlanBtn}</span>
              </>
            )}
          </button>

        </div>

        {/* Right Content: Generated Curriculum & Step Roadmap */}
        <div className="lg:col-span-2 bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] flex flex-col">
          
          <div className="pb-3 border-b border-[#E0E8E8] flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#304848] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2AAFA3]" />
              <span>{t.multiSkill.curriculumTitle}</span>
            </h3>
            {generatedPlan && (
              <span className="badge-teal text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#BDE5E2]">
                {t.multiSkill.curriculumActive}
              </span>
            )}
          </div>

          {isAiGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <RefreshCw className="w-8 h-8 text-[#D0A018] animate-spin mb-3" />
              <p className="font-bold text-sm text-[#304848]">{t.multiSkill.designingModule}</p>
              <p className="text-xs text-[#788888] mt-1">{t.multiSkill.designingModuleSub}</p>
            </div>
          ) : generatedPlan ? (
            <div className="space-y-4 text-xs text-[#506868] leading-relaxed whitespace-pre-line overflow-y-auto max-h-[500px] pr-2">
              {generatedPlan}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center text-[#788888]">
              <GraduationCap className="w-12 h-12 text-[#C8D8D8] mb-3" />
              <p className="font-bold text-sm text-[#304848]">{t.multiSkill.noRoadmapTitle}</p>
              <p className="text-xs text-[#788888] mt-1 max-w-sm">
                {t.multiSkill.noRoadmapDesc}
              </p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
