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
  Cpu,
  FileDown,
  Wrench,
  Check,
  ShieldCheck,
  Layers,
  Flag,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { Operator, MachineCategory, LineLeader } from '../types';
import { 
  getOperatorMultiSkillCount, 
  getOperatorTotalPoints, 
  getGradeFromTotalPoints, 
  getOperatorActiveMachineColumn,
  calculateWorkTimeMonths
} from '../utils/ieCalculations';
import { useLanguage } from '../i18n/LanguageContext';
import { ExportPDFModal } from './ExportPDFModal';

/**
 * ============================================================================
 * SCHEMA SPECIFICATION: AI Multi-Skill Retraining Roadmap (Structured JSON)
 * ============================================================================
 * The backend (/api/gemini/retraining-plan) and client-side fallback produce
 * a structured JSON object according to this contract:
 *
 * {
 *   "operator_name": string,
 *   "nik": string,
 *   "factory"?: string,
 *   "line"?: string,
 *   "current_grade"?: string,
 *   "current_points"?: number,
 *   "tenure_months"?: number,
 *   "target_machine": string,
 *   "goal_summary": string,
 *   "total_weeks": number,
 *   "weeks": [
 *     {
 *       "week_number": number,
 *       "title": string,
 *       "target_points": number,
 *       "technical_focus": string,
 *       "hands_on_drills": string,
 *       "safety_ergonomics"?: string,
 *       "kpi_target": string
 *     }
 *   ]
 * }
 * ============================================================================
 */

export interface RoadmapWeekStep {
  week_number: number;
  title: string;
  target_points: number;
  technical_focus: string;
  hands_on_drills: string;
  safety_ergonomics?: string;
  kpi_target: string;
}

export interface RoadmapPlanData {
  operator_name: string;
  nik: string;
  factory?: string;
  line?: string;
  current_grade?: string;
  current_points?: number;
  tenure_months?: number;
  target_machine: string;
  goal_summary: string;
  total_weeks: number;
  weeks: RoadmapWeekStep[];
}

interface MultiSkillDevelopmentTabProps {
  operators: Operator[];
  selectedLine: string;
  selectedFactory: string;
  selectedMonth?: number;
  selectedYear?: number;
  lineLeaders?: LineLeader[];
}

// Machine display configuration helper
const MACHINE_NAMES: Record<MachineCategory, { nameId: string; nameEn: string; descId: string; descEn: string }> = {
  OVERLOCK: {
    nameId: 'Overlock (O/L 3-4 Benang)',
    nameEn: 'Overlock (3-4 Thread O/L)',
    descId: 'Pengaturan pisau pemotong, tension looper atas & bawah, dan keliman tepi rapi tanpa kerut.',
    descEn: 'Trimming knife adjustment, upper & lower looper tension, clean edge serging without puckering.'
  },
  FLATSEAM: {
    nameId: 'Flatseam (4 Needle 6 Thread - High Skill)',
    nameEn: 'Flatseam (4 Needle 6 Thread - High Skill)',
    descId: 'Penyelarasan 4 jarum & 6 benang, sinkronisasi differential feed, dan sambungan flat elastic seam.',
    descEn: '4-needle 6-thread alignment, differential feed sync, and flat elastic join seams.'
  },
  SPECIAL: {
    nameId: 'Special / Automatic Hemming / Elastic',
    nameEn: 'Special / Auto Hemming / Elastic',
    descId: 'Kalibrasi tension guide karet otomatis, pneumatic presser foot, dan sensor pemotong.',
    descEn: 'Auto elastic guide tension calibration, pneumatic presser foot, and cutter sensor.'
  },
  LOCKSTITCH: {
    nameId: 'Lockstitch (Single Needle High Speed)',
    nameEn: 'Lockstitch (Single Needle High Speed)',
    descId: 'Kendali foot pedal presisi, teknik backstitch awal-akhir, dan kelurusan jahitan jarak 1/16".',
    descEn: 'Precision foot pedal control, backtack technique, and 1/16" edge stitch alignment.'
  },
  BUTTON_HOLE: {
    nameId: 'Button Hole (Lubang Kancing Komputer)',
    nameEn: 'Button Hole (Computerized)',
    descId: 'Pemilihan pola lubang kancing digital, pengaturan pisau potong tengah, dan densitas jahitan SPI.',
    descEn: 'Digital hole pattern selection, center cutter setting, and SPI stitch density.'
  },
  BUTTON_SET: {
    nameId: 'Button Set (Pasang Kancing Otomatis)',
    nameEn: 'Button Set (Auto Button Attaching)',
    descId: 'Penjepit kancing otomatis, penyesuaian jumlah simpul ikatan, dan uji kekuatan tarik kancing.',
    descEn: 'Auto button clamp, knot count adjustment, and pull-test strength verification.'
  },
  BARTACK: {
    nameId: 'Bartack (Penguat Sudut Jahitan Otomatis)',
    nameEn: 'Bartack (Auto Corner Reinforcement)',
    descId: 'Pengaturan densitas tusukan bartack, clamping pressure, dan pencegahan benang gumpal.',
    descEn: 'Bartack stitch density setting, clamping pressure, and thread nesting prevention.'
  },
  CHAINSTITCH: {
    nameId: 'Chainstitch (Jahitan Rantai 2 Benang)',
    nameEn: 'Chainstitch (2-Thread Chainstitch)',
    descId: 'Pengaturan looper elastisitas jahitan pinggang/bawah dan penyesuaian looper timing.',
    descEn: 'Elastic waistband/bottom looper tension and looper timing calibration.'
  }
};

/**
 * Render Markdown Text to clean HTML without showing raw hashes or asterisks
 */
function FormattedMarkdownFallback({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-2.5 text-xs text-slate-700 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-sm font-bold text-[#304848] pt-2 pb-1 border-b border-slate-200 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-[#2AAFA3]" />
              <span>{trimmed.replace(/^###\s+/, '')}</span>
            </h3>
          );
        }

        if (trimmed.startsWith('#### ')) {
          return (
            <h4 key={idx} className="text-xs font-bold text-teal-800 pt-2 pb-0.5 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-teal-600" />
              <span>{trimmed.replace(/^####\s+/, '')}</span>
            </h4>
          );
        }

        if (trimmed.startsWith('---')) {
          return <hr key={idx} className="my-2 border-slate-200" />;
        }

        if (trimmed.startsWith('- ')) {
          const content = trimmed.replace(/^-\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
              <div>{renderInlineFormatting(content)}</div>
            </div>
          );
        }

        return <p key={idx}>{renderInlineFormatting(trimmed)}</p>;
      })}
    </div>
  );
}

function renderInlineFormatting(str: string) {
  // Replace **bold** with <strong> and *italic* with <em>
  const parts = str.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="italic text-slate-700">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export const MultiSkillDevelopmentTab: React.FC<MultiSkillDevelopmentTabProps> = ({
  operators,
  selectedLine,
  selectedFactory,
  selectedMonth = new Date().getMonth() + 1,
  selectedYear = new Date().getFullYear(),
  lineLeaders,
}) => {
  const { t, language } = useLanguage();
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Filter operator aktif di dalam fungsi kalkulasi/tabel frontend
  const activeOperators = operators.filter(row => {
    const isResigned = row.status?.toUpperCase() === "RESIGNED";
    if (isResigned) {
      return false; 
    }
    return true;
  });

  const [selectedOpId, setSelectedOpId] = useState<string>(activeOperators[0]?.id || '');
  const [targetMachine, setTargetMachine] = useState<MachineCategory>('OVERLOCK');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  // Structured roadmap state + text fallback
  const [roadmapData, setRoadmapData] = useState<RoadmapPlanData | null>(null);
  const [fallbackMarkdown, setFallbackMarkdown] = useState<string | null>(null);

  // Sync selectedOpId when operators change
  useEffect(() => {
    if (activeOperators.length > 0) {
      setSelectedOpId((prev) => (activeOperators.some(op => op.id === prev) ? prev : activeOperators[0].id));
    } else {
      setSelectedOpId('');
    }
  }, [activeOperators]);

  // Machine Coverage Breakdown in this Line (Poin > 0)
  const machineCoverage = {
    lockstitch: activeOperators.filter((op) => (op.lockstitch ?? 0) > 0).length,
    overlock: activeOperators.filter((op) => (op.overlock ?? 0) > 0).length,
    flatseam: activeOperators.filter((op) => (op.flatseam ?? 0) > 0).length,
    special: activeOperators.filter((op) => (op.special ?? 0) > 0).length,
    buttonHole: activeOperators.filter((op) => (op.buttonHole ?? 0) > 0).length,
    buttonSet: activeOperators.filter((op) => (op.buttonSet ?? 0) > 0).length,
  };

  const selectedOp = activeOperators.find((op) => op.id === selectedOpId) || activeOperators[0];

  // Helper fungsi untuk menghasilkan data terstruktur kurikulum retraining IE (Client Fallback Handal untuk Vercel)
  const buildClientRetrainingData = (op: Operator, machineCat: MachineCategory): RoadmapPlanData => {
    const opName = op.name || 'Operator';
    const opNik = op.nik || '-';
    const tenureMonths = !isNaN(Number(op.workTimeMonths)) && op.workTimeMonths !== null && op.workTimeMonths !== undefined && Number(op.workTimeMonths) > 0
      ? op.workTimeMonths 
      : (calculateWorkTimeMonths(op.doj) || 0);

    const totalPts = getOperatorTotalPoints(op);
    const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER' || totalPts <= 0;
    const currentGrade = getGradeFromTotalPoints(totalPts, isHelper);
    const machineInfo = MACHINE_NAMES[machineCat] || MACHINE_NAMES.OVERLOCK;
    const machineLabel = language === 'id' ? machineInfo.nameId : machineInfo.nameEn;
    const machineDesc = language === 'id' ? machineInfo.descId : machineInfo.descEn;

    if (language === 'en') {
      return {
        operator_name: opName,
        nik: opNik,
        factory: selectedFactory,
        line: selectedLine,
        current_grade: currentGrade.label,
        current_points: totalPts,
        tenure_months: tenureMonths,
        target_machine: machineLabel,
        goal_summary: `Attain certified Skill Level 3 (3 Points) on ${machineLabel} with Pitch Time compliance, zero critical defects, and dynamic line balancing readiness.`,
        total_weeks: 4,
        weeks: [
          {
            week_number: 1,
            title: 'Machine Anatomy, Threading & Tension Calibration',
            target_points: 1,
            technical_focus: `Comprehensive study of ${machineLabel} mechanics, thread tension balance, needle selection (#9–#14), needle-to-looper clearance, and daily 5S maintenance.`,
            hands_on_drills: 'Scrap fabric seam exercise: 150 pcs/day of parallel straight and curve stitching with consistent SPI (10–12).',
            safety_ergonomics: 'Proper 90° seated posture, safety eye shield inspection, and emergency stop pedal familiarity.',
            kpi_target: 'Eliminate skipped stitches, attain baseline Level 1 (1 Point) competency (handling standard machine speed).'
          },
          {
            week_number: 2,
            title: 'Sub-Assembly Component Practice & Quality Rigor',
            target_points: 2,
            technical_focus: 'Real component sub-assembly (collar rib setting, side-seam serging, cuff hem, elastic band attachment).',
            hands_on_drills: '2-handed ergonomic pickup and dispose motion sequence (MOST / GSD method reduction).',
            safety_ergonomics: 'Align bundle feeder table horizontally to minimize lower back twisting.',
            kpi_target: 'Reach 2 Points competency milestone with stable defect rate < 1.0% and seam allowance tolerance ±1.0 mm.'
          },
          {
            week_number: 3,
            title: 'Tandem Line Integration & Cycle Time Balancing',
            target_points: 2,
            technical_focus: 'Live conveyor line integration under tandem mentorship with Grade S senior operator.',
            hands_on_drills: 'Match workstation Cycle Time with Line Pitch Time (target 80–90% efficiency output) across multi-size style bundles.',
            safety_ergonomics: 'Wrist stretch routine between bundle handovers to prevent repetitive strain injuries.',
            kpi_target: 'Achieve 3 Points benchmark with Cycle Time within ±5% of engineering SMV.'
          },
          {
            week_number: 4,
            title: 'Independent Skill Matrix Evaluation & Certification',
            target_points: 3,
            technical_focus: 'Full 8-hour shift standalone evaluation on critical buyer production garments.',
            hands_on_drills: 'Pull test verification (≥ 15 lbs seam strength) and SPI uniformity inspection across 10 consecutive garment bundles.',
            safety_ergonomics: 'Final PPE compliance check, safety clearance, and 5S clean workstation handover.',
            kpi_target: `Official Skill Matrix certification in PT. Winners International system to +3 Points on ${machineCat}.`
          }
        ]
      };
    }

    // Default Bahasa Indonesia
    return {
      operator_name: opName,
      nik: opNik,
      factory: selectedFactory,
      line: selectedLine,
      current_grade: currentGrade.label,
      current_points: totalPts,
      tenure_months: tenureMonths,
      target_machine: machineLabel,
      goal_summary: `Mencapai sertifikasi Level 3 (3 Poin Penuh) pada mesin ${machineLabel} sesuai standar Pitch Time lini produksi, bebas cacat kualitas (Zero Defect), serta siap line balancing mandiri.`,
      total_weeks: 4,
      weeks: [
        {
          week_number: 1,
          title: 'Pengenalan Anatomi Mesin, Threading & Kontrol Tension',
          target_points: 1,
          technical_focus: `Pemahaman jalur benang (threading path) ${machineLabel}, penyetelan tegangan benang (tension balance), pemilihan nomor jarum (#9–#14), serta pemeliharaan 5S harian. (${machineDesc})`,
          hands_on_drills: 'Menjahit kain perca (scrap fabric) lurus dan melengkung 150 potong/hari dengan kerapatan jahitan SPI (10–12) yang konsisten.',
          safety_ergonomics: 'Posisi duduk tegak 90°, penggunaan finger guard pengaman jarum, dan kontrol injakan pedal gas bertahap.',
          kpi_target: 'Memahami troubleshooting dasar (benang putus/loncat), lulus kualifikasi dasar Level 1 (1 Poin).'
        },
        {
          week_number: 2,
          title: 'Latihan Sub-Assembly Komponen Semi-Kritis',
          target_points: 2,
          technical_focus: 'Pengerjaan proses sub-assembly garmen nyata (seperti sambung pundak, jahit rib leher/manset, kelim samping, atau pasang elastic band).',
          hands_on_drills: 'Penerapan prinsip ekonomi gerakan (motion economy MOST/GSD) saat mengambil bundle dan membuang komponen (pickup & dispose).',
          safety_ergonomics: 'Penataan bundle feeder sejajar meja jahit untuk mengurangi gerakan memutar pinggang berlebih.',
          kpi_target: 'Mencapai milestone kompetensi 2 Poin dengan defect rate < 1.0% dan toleransi lebar kampuh presisi ±1.0 mm.'
        },
        {
          week_number: 3,
          title: 'Integrasi ke Lini Produksi Nyata & Line Balancing',
          target_points: 2,
          technical_focus: 'Masuk ke lini produksi aktif dengan metode pendampingan tandem bersama operator senior Grade S.',
          hands_on_drills: 'Menjaga Cycle Time stasiun kerja stabil mendekati Pitch Time lini (efisiensi output 80–90%) pada variasi style garmen.',
          safety_ergonomics: 'Pencegahan kelelahan otot pergelangan tangan dengan teknik relaksasi jeda antar-bundle.',
          kpi_target: 'Efisiensi mencapai standar 3 Poin, deviasi Cycle Time ≤ 5% terhadap target SMV IE.'
        },
        {
          week_number: 4,
          title: 'Uji Kompetensi Mandiri & Sertifikasi Skill Matrix',
          target_points: 3,
          technical_focus: 'Uji kinerja mandiri selama 1 hari kerja penuh (8 jam) pada pesanan garmen buyer.',
          hands_on_drills: 'Audit kerapian jahitan pada 10 bundle berturut-turut serta verifikasi uji tarik jahitan (seam pull test ≥ 15 lbs).',
          safety_ergonomics: 'Pemeriksaan akhir kepatuhan APD dan kebersihan stasiun kerja 5S.',
          kpi_target: `Pendaftaran resmi pembaruan nilai ke dalam Database Skill Matrix IE PT. Winners International dengan perolehan +3 Poin pada kategori ${machineCat}.`
        }
      ]
    };
  };

  // AI Retraining Plan Request
  const handleGenerateRetrainingPlan = async () => {
    if (!selectedOp) return;
    setIsAiGenerating(true);
    setRoadmapData(null);
    setFallbackMarkdown(null);

    let structuredResult: RoadmapPlanData | null = null;
    let textFallbackResult: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const response = await fetch('/api/gemini/retraining-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          operator: selectedOp,
          targetMachine,
          line: selectedLine,
          factory: selectedFactory,
        }),
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('application/json')) {
        const data = await response.json();
        if (data) {
          if (data.planData && Array.isArray(data.planData.weeks)) {
            structuredResult = data.planData;
          } else if (typeof data.plan === 'string') {
            try {
              const parsed = JSON.parse(data.plan);
              if (parsed && Array.isArray(parsed.weeks)) {
                structuredResult = parsed;
              } else {
                textFallbackResult = data.plan;
              }
            } catch {
              textFallbackResult = data.plan;
            }
          }
        }
      }
    } catch (err) {
      // Backend proxy offline / Vercel SPA static hosting rewrite fallback
    }

    // Jika di Vercel atau belum ada data terstruktur, gunakan Client-Side IE Roadmap Generator yang presisi
    if (!structuredResult && !textFallbackResult) {
      structuredResult = buildClientRetrainingData(selectedOp, targetMachine);
    }

    if (structuredResult) {
      setRoadmapData(structuredResult);
    } else if (textFallbackResult) {
      setFallbackMarkdown(textFallbackResult);
    }

    setIsAiGenerating(false);
  };

  // Selected operator calculations
  const totalPoints = selectedOp ? getOperatorTotalPoints(selectedOp) : 0;
  const isHelper = selectedOp ? (selectedOp.status?.toUpperCase() === 'HELPER' || (selectedOp as any).grade === 'HELPER' || totalPoints <= 0) : true;
  const gradeInfo = getGradeFromTotalPoints(totalPoints, isHelper);

  return (
    <div className="space-y-6">
      
      {/* 1. MACHINE COVERAGE & BOTTLENECK READINESS */}
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#304848] flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#2AAFA3]" />
              <span>{t.multiSkill.machineCoverageTitle} ({selectedFactory} • {selectedLine})</span>
            </h3>
            <p className="text-xs text-[#788888]">
              {t.multiSkill.machineCoverageSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="self-start sm:self-auto bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title={t.matrix.exportPdfDesc}
          >
            <FileDown className="w-3.5 h-3.5 text-rose-600" />
            <span>{t.matrix.exportPDF}</span>
            <span className="text-[9px] bg-rose-200/80 text-rose-900 px-1 py-0.2 rounded font-bold uppercase tracking-wide">A4</span>
          </button>
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

      {/* 2. OPERATOR RETRAINING & MULTI-SKILL ROADMAP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Form: Select Operator & Target Machine */}
        <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] space-y-4">
          <div className="pb-3 border-b border-[#E0E8E8]">
            <h3 className="text-sm font-bold text-[#304848] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#D0A018]" />
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
              className="w-full bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] text-xs font-semibold rounded-xl p-2.5 focus:border-[#D0A018] outline-none cursor-pointer"
            >
              {activeOperators.length === 0 ? (
                <option value="">{t.multiSkill.noOperatorsInLine}</option>
              ) : (
                operators.map((op) => {
                  const opPts = getOperatorTotalPoints(op);
                  const opHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER' || opPts <= 0;
                  const opGrade = getGradeFromTotalPoints(opPts, opHelper);
                  const machineCount = getOperatorMultiSkillCount(op);
                  return (
                    <option key={op.id} value={op.id}>
                      {op.nik} - {op.name} ({machineCount} Mesin • {opPts} {t.common.points} • {opGrade.label})
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* Selected Operator Summary Card */}
          {selectedOp && (
            <div className="bg-[#F8FBFB] border border-[#C8D8D8] rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#304848] block">{selectedOp.name}</span>
                  <span className="text-[10px] text-[#788888] font-mono">NIK: {selectedOp.nik}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${gradeInfo.cssBadge}`}>
                    {gradeInfo.label} ({totalPoints} {t.common.points})
                  </span>
                  <span className="text-[10px] bg-[#E0F0F0] text-[#405858] font-bold px-2 py-0.5 rounded-full border border-[#C8D8D8]">
                    {!isNaN(Number(selectedOp.workTimeMonths)) && selectedOp.workTimeMonths !== null && selectedOp.workTimeMonths !== undefined && Number(selectedOp.workTimeMonths) > 0 
                      ? selectedOp.workTimeMonths 
                      : (calculateWorkTimeMonths(selectedOp.doj) || 0)} {t.common.months}
                  </span>
                </div>
              </div>
              
              <div className="text-[11px] text-[#788888] space-y-1.5 pt-1 border-t border-slate-200">
                <div className="font-semibold text-slate-700 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-[#2AAFA3]" />
                  <span>{t.multiSkill.currentSkillsLabel}:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {Boolean(selectedOp.lockstitch && !isNaN(selectedOp.lockstitch) && selectedOp.lockstitch > 0) && (
                    <span className="inline-flex items-center gap-1 badge-teal text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#BDE5E2]">
                      <span>Lockstitch</span>
                      <span className="font-mono bg-teal-700 text-white px-1.5 py-0.2 rounded-md">{selectedOp.lockstitch} {t.common.points}</span>
                    </span>
                  )}
                  {Boolean(selectedOp.overlock && !isNaN(selectedOp.overlock) && selectedOp.overlock > 0) && (
                    <span className="inline-flex items-center gap-1 badge-teal text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#BDE5E2]">
                      <span>Overlock</span>
                      <span className="font-mono bg-teal-700 text-white px-1.5 py-0.2 rounded-md">{selectedOp.overlock} {t.common.points}</span>
                    </span>
                  )}
                  {Boolean(selectedOp.flatseam && !isNaN(selectedOp.flatseam) && selectedOp.flatseam > 0) && (
                    <span className="inline-flex items-center gap-1 badge-gold text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#E8D499]">
                      <span>Flatseam</span>
                      <span className="font-mono bg-amber-800 text-white px-1.5 py-0.2 rounded-md">{selectedOp.flatseam} {t.common.points}</span>
                    </span>
                  )}
                  {Boolean(selectedOp.special && !isNaN(selectedOp.special) && selectedOp.special > 0) && (
                    <span className="inline-flex items-center gap-1 badge-gold text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#E8D499]">
                      <span>Special</span>
                      <span className="font-mono bg-amber-800 text-white px-1.5 py-0.2 rounded-md">{selectedOp.special} {t.common.points}</span>
                    </span>
                  )}
                  {Boolean(selectedOp.buttonHole && !isNaN(selectedOp.buttonHole) && selectedOp.buttonHole > 0) && (
                    <span className="inline-flex items-center gap-1 badge-neutral text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#D5E1E1]">
                      <span>Button Hole</span>
                      <span className="font-mono bg-slate-700 text-white px-1.5 py-0.2 rounded-md">{selectedOp.buttonHole} {t.common.points}</span>
                    </span>
                  )}
                  {Boolean(selectedOp.buttonSet && !isNaN(selectedOp.buttonSet) && selectedOp.buttonSet > 0) && (
                    <span className="inline-flex items-center gap-1 badge-neutral text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#D5E1E1]">
                      <span>Button Set</span>
                      <span className="font-mono bg-slate-700 text-white px-1.5 py-0.2 rounded-md">{selectedOp.buttonSet} {t.common.points}</span>
                    </span>
                  )}
                  {totalPoints === 0 && (
                    <span className="text-[10px] font-medium text-slate-500 italic bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {language === 'id' ? 'Helper / Belum memiliki sertifikasi poin mesin' : 'Helper / No recorded machine points'}
                    </span>
                  )}
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
              <option value="BUTTON_SET">Button Set (Pasang Kancing Otomatis)</option>
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

        {/* Right Content: Generated Structured Diagram + Stepper Roadmap */}
        <div className="lg:col-span-2 bg-white border border-[#E0E8E8] rounded-[20px] p-5 shadow-[0_8px_30px_rgba(48,72,72,0.06)] flex flex-col">
          
          <div className="pb-3 border-b border-[#E0E8E8] flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#304848] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2AAFA3]" />
              <span>{t.multiSkill.curriculumTitle}</span>
            </h3>
            {(roadmapData || fallbackMarkdown) && (
              <span className="badge-teal text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-[#BDE5E2] flex items-center gap-1">
                <Check className="w-3 h-3 text-teal-700" />
                <span>{t.multiSkill.curriculumActive}</span>
              </span>
            )}
          </div>

          {isAiGenerating ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <RefreshCw className="w-8 h-8 text-[#D0A018] animate-spin mb-3" />
              <p className="font-bold text-sm text-[#304848]">{t.multiSkill.designingModule}</p>
              <p className="text-xs text-[#788888] mt-1">{t.multiSkill.designingModuleSub}</p>
            </div>
          ) : roadmapData ? (
            <div className="space-y-6 overflow-y-auto max-h-[620px] pr-2">
              
              {/* TOP PROGRAM HEADER & HORIZONTAL PROGRESS STRIP */}
              <div className="bg-gradient-to-r from-[#0F3636] to-[#1E4D4D] text-white rounded-2xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#D0A018] text-slate-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md">
                      {roadmapData.total_weeks} {language === 'id' ? 'Minggu Program' : 'Weeks Program'}
                    </span>
                    <span className="text-xs font-semibold text-teal-200">
                      {roadmapData.operator_name} (NIK: {roadmapData.nik})
                    </span>
                  </div>
                  <div className="text-[11px] text-teal-100 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                    Target: <span className="font-bold text-amber-300">{roadmapData.target_machine}</span>
                  </div>
                </div>

                {/* Goal summary text box */}
                <div className="bg-black/20 border border-white/10 rounded-xl p-3 text-xs text-teal-50 flex items-start gap-2.5">
                  <Target className="w-4 h-4 text-[#D0A018] shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <span className="font-bold text-amber-200 block text-[11px] uppercase tracking-wide mb-0.5">
                      {language === 'id' ? 'Sasaran Akhir Program:' : 'Ultimate Program Goal:'}
                    </span>
                    {roadmapData.goal_summary}
                  </div>
                </div>

                {/* Horizontal Stepper Strip */}
                <div className="mt-3 pt-3 border-t border-white/15 grid grid-cols-4 gap-2 text-center">
                  {roadmapData.weeks.map((w, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <span className="w-5 h-5 rounded-full bg-teal-500/30 border border-teal-300 text-teal-200 text-[10px] font-bold flex items-center justify-center">
                          W{w.week_number}
                        </span>
                        <span className="text-[10px] font-semibold text-amber-300">
                          {w.target_points} {t.common.points}
                        </span>
                      </div>
                      <div className="w-full bg-white/15 h-1 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-teal-400 to-[#D0A018]" 
                          style={{ width: `${((idx + 1) / roadmapData.weeks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* VERTICAL TIMELINE / STEPPER */}
              <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-[#2AAFA3] before:via-[#D0A018] before:to-emerald-500">
                {roadmapData.weeks.map((step) => {
                  const isFinal = step.week_number === roadmapData.weeks.length;
                  return (
                    <div key={step.week_number} className="relative group">
                      
                      {/* Step Circle Indicator */}
                      <div className={`absolute -left-6 sm:-left-8 top-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-transform group-hover:scale-110 ${
                        isFinal 
                          ? 'bg-[#D0A018] text-slate-950 ring-4 ring-amber-100' 
                          : 'bg-[#2AAFA3] text-white ring-4 ring-teal-50'
                      }`}>
                        {step.week_number}
                      </div>

                      {/* Step Card Box */}
                      <div className="bg-[#FAFDFD] hover:bg-white border border-[#D5E5E5] hover:border-[#2AAFA3]/60 rounded-2xl p-4 shadow-2xs transition-all">
                        
                        {/* Header Step */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                              {language === 'id' ? `Minggu ${step.week_number}` : `Week ${step.week_number}`}:
                            </span>
                            <h4 className="text-xs sm:text-sm font-bold text-[#304848]">
                              {step.title}
                            </h4>
                          </div>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
                            step.target_points >= 3 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : step.target_points === 2 
                                ? 'bg-amber-50 text-amber-800 border-amber-300' 
                                : 'bg-teal-50 text-teal-800 border-teal-300'
                          }`}>
                            Target: <span className="font-mono font-black">{step.target_points} {t.common.points}</span>
                          </span>
                        </div>

                        {/* Mini Sections Grid */}
                        <div className="space-y-2.5 text-xs">
                          
                          {/* 1. Technical Focus (Icon BookOpen) */}
                          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 text-slate-800 flex items-start gap-2.5">
                            <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg shrink-0 mt-0.5">
                              <BookOpen className="w-3.5 h-3.5" />
                            </div>
                            <div className="space-y-0.5">
                              <span className="font-bold text-[11px] text-sky-900 block uppercase tracking-wide">
                                {language === 'id' ? 'Fokus Teknis & Parameter Mesin' : 'Technical Focus & Parameters'}
                              </span>
                              <p className="text-slate-700 leading-relaxed">{step.technical_focus}</p>
                            </div>
                          </div>

                          {/* 2. Hands-on Drills (Icon Wrench / Target) */}
                          <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 text-slate-800 flex items-start gap-2.5">
                            <div className="p-1.5 bg-teal-100 text-teal-700 rounded-lg shrink-0 mt-0.5">
                              <Wrench className="w-3.5 h-3.5" />
                            </div>
                            <div className="space-y-0.5">
                              <span className="font-bold text-[11px] text-teal-900 block uppercase tracking-wide">
                                {language === 'id' ? 'Latihan Praktik Mandiri & Gerakan (MOST/GSD)' : 'Hands-on Drills & Motion Practice'}
                              </span>
                              <p className="text-slate-700 leading-relaxed">{step.hands_on_drills}</p>
                            </div>
                          </div>

                          {/* 3. Safety & Ergonomics (Optional) */}
                          {step.safety_ergonomics && (
                            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-2.5 text-slate-800 flex items-start gap-2.5">
                              <div className="p-1 bg-amber-100 text-amber-700 rounded-md shrink-0 mt-0.5">
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </div>
                              <div className="space-y-0.5">
                                <span className="font-bold text-[10px] text-amber-900 block uppercase tracking-wide">
                                  {language === 'id' ? 'Aspek K3 & Ergonomi' : 'Safety & Ergonomics'}
                                </span>
                                <p className="text-slate-700 text-[11px] leading-relaxed">{step.safety_ergonomics}</p>
                              </div>
                            </div>
                          )}

                          {/* 4. KPI Target Milestone (Highlight Box with Accent Color) */}
                          <div className="bg-gradient-to-r from-amber-50 via-[#FFF9EB] to-emerald-50 border-2 border-[#D0A018]/70 rounded-xl p-3 text-slate-900 shadow-2xs flex items-start gap-2.5">
                            <div className="p-1.5 bg-[#D0A018] text-white rounded-lg shrink-0 mt-0.5 shadow-2xs">
                              <Award className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-[11px] text-[#805B00] uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-[#D0A018]" />
                                  <span>{language === 'id' ? 'Target KPI & Standar Kelulusan' : 'KPI Milestone & Certification Goal'}</span>
                                </span>
                              </div>
                              <p className="font-medium text-slate-900 text-xs leading-relaxed">{step.kpi_target}</p>
                            </div>
                          </div>

                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : fallbackMarkdown ? (
            <div className="overflow-y-auto max-h-[550px] pr-2">
              <FormattedMarkdownFallback text={fallbackMarkdown} />
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

      {/* Export PDF Modal */}
      <ExportPDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        operators={operators}
        selectedFactory={selectedFactory}
        selectedLine={selectedLine}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        lineLeaders={lineLeaders}
      />

    </div>
  );
};
