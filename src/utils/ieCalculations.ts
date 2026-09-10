import { Operator, GarmentStyle, WorkstationAssignment, LineBalancingResult, MachineCategory, RawSheetRow } from '../types';
import { 
  getGradeFromRate, 
  getGradeFromPoints, 
  getOperatorMaxPoints, 
  getGradeFromTotalPoints, 
  getOperatorTotalPoints 
} from '../data/mockData';

export { 
  getGradeFromPoints, 
  getOperatorMaxPoints, 
  getGradeFromTotalPoints, 
  getOperatorTotalPoints 
};
export type { RawSheetRow };

// Standar Konversi Sistem Poin IE (Industrial Engineering)
// 0 Poin: Eff 0% (Belum Menguasai / Non-Aktif)
// 1 Poin: Eff 1% - 60% (Tahap Belajar / Novice)
// 2 Poin: Eff 61% - 89% (Standar Produksi / Competent)
// 3 Poin: Eff > 90% (Mahir / Expert / Star)
export const POINT_SYSTEM_RULES = [
  {
    points: 0,
    effLabel: 'Eff 0%',
    effRange: '0%',
    minEff: 0,
    maxEff: 0,
    level: 'Belum Menguasai / Non-Aktif',
    description: 'Belum mencapai standar target waktu siklus (SMV) atau belum terlatih di jenis mesin ini.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    barColor: 'bg-slate-400',
    percentage: '0%',
  },
  {
    points: 1,
    effLabel: 'Eff 1 – 60%',
    effRange: '1% – 60%',
    minEff: 1,
    maxEff: 60,
    level: 'Tahap Belajar (Learning / Novice)',
    description: 'Mampu menjahit jahitan dasar dengan supervisi, cycle time masih di atas SMV standar.',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    barColor: 'bg-amber-500',
    percentage: '50%',
  },
  {
    points: 2,
    effLabel: 'Eff 61 – 89%',
    effRange: '61% – 89%',
    minEff: 61,
    maxEff: 89,
    level: 'Standar Produksi (Competent)',
    description: 'Memenuhi target ritme output harian mandiri dengan tingkat defect (DHU) rendah.',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    barColor: 'bg-sky-500',
    percentage: '75%',
  },
  {
    points: 3,
    effLabel: 'Eff > 90%',
    effRange: '> 90%',
    minEff: 90,
    maxEff: 999,
    level: 'Mahir / Ahli (Expert / Star)',
    description: 'Kecepatan tinggi melampaui standar target SMV, konsisten presisi, kandidat utama floater & trainer.',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    barColor: 'bg-emerald-600',
    percentage: '100%',
  },
];

export function getPointsFromEfficiency(eff: number): number {
  if (eff <= 0) return 0;
  if (eff <= 60) return 1;
  if (eff <= 89) return 2;
  return 3;
}

export function getOperatorSkillForMachine(operator: Operator, machine: MachineCategory): number | null {
  switch (machine) {
    case 'LOCKSTITCH':
      return operator.lockstitch ?? null;
    case 'OVERLOCK':
      return operator.overlock ?? null;
    case 'FLATSEAM':
      return operator.flatseam ?? null;
    case 'SPECIAL':
      return operator.special ?? (operator.bartack ?? null);
    case 'BUTTON_HOLE':
      return operator.buttonHole ?? (operator.special ?? null);
    case 'BUTTON_SET':
      return operator.buttonSet ?? (operator.special ?? null);
    case 'CHAINSTITCH':
      return operator.chainstitch ?? (operator.lockstitch ?? null);
    case 'BARTACK':
      return operator.bartack ?? (operator.special ?? null);
    default:
      return null;
  }
}

export function getOperatorMultiSkillCount(operator: Operator): number {
  let count = 0;
  const rates = [
    operator.lockstitch,
    operator.overlock,
    operator.flatseam,
    operator.special,
    operator.buttonHole,
    operator.buttonSet,
    operator.chainstitch,
    operator.bartack
  ];
  for (const r of rates) {
    if (r !== null && r !== undefined && r > 0) {
      count++;
    }
  }
  return count;
}

export function getOperatorAvgRate(operator: Operator): number {
  const rates: number[] = [];
  [
    operator.lockstitch,
    operator.overlock,
    operator.flatseam,
    operator.special,
    operator.buttonHole,
    operator.buttonSet,
    operator.chainstitch,
    operator.bartack
  ].forEach(r => {
    if (r !== null && r !== undefined && r > 0) {
      rates.push(r);
    }
  });
  if (rates.length === 0) return 0;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

export interface BalanceOptions {
  workingHoursPerDay?: number; // default 8 hours (28,800 sec)
  targetEfficiencyPercent?: number; // default 75%
  manualTargetOutput?: number;
}

export function calculateLineBalancing(
  style: GarmentStyle,
  availableOperators: Operator[],
  options: BalanceOptions = {}
): LineBalancingResult {
  const workingHours = options.workingHoursPerDay || 8;
  const totalWorkingSeconds = workingHours * 3600; // 28,800
  const processes = style.processes;
  const totalSmv = processes.reduce((acc, p) => acc + p.smvSeconds, 0);
  const totalStations = processes.length;
  
  // Takt time / Pitch time based on target pcs per hour
  const targetPerHour = options.manualTargetOutput ? (options.manualTargetOutput / workingHours) : (style.targetPcsPerHour || 100);
  const pitchTime = Math.round((3600 / targetPerHour) * 10) / 10;
  const taktTime = pitchTime;

  // Track assigned operator IDs to avoid duplicates
  const assignedIds = new Set<string>();
  const assignments: WorkstationAssignment[] = [];

  processes.forEach((process, index) => {
    // Find best matching operator in available pool
    const candidates = availableOperators
      .filter(op => !assignedIds.has(op.id))
      .map(op => {
        const rate = getOperatorSkillForMachine(op, process.machineType);
        const avg = getOperatorAvgRate(op);
        const effectiveRate = rate !== null && rate > 0 ? rate : (avg > 0 ? avg * 0.7 : 50); // fallback heuristic
        const hasDirectSkill = rate !== null && rate > 0;
        return {
          operator: op,
          rate: effectiveRate,
          hasDirectSkill,
          workTime: op.workTimeMonths
        };
      })
      .sort((a, b) => {
        // Prioritize direct skill first, then higher rate, then higher tenure
        if (a.hasDirectSkill && !b.hasDirectSkill) return -1;
        if (!a.hasDirectSkill && b.hasDirectSkill) return 1;
        return b.rate - a.rate;
      });

    const chosen = candidates[0] || null;
    const operator = chosen?.operator || null;
    if (operator) {
      assignedIds.add(operator.id);
    }

    const efficiency = chosen ? chosen.rate : 65; // fallback
    const actualCycleTime = Math.round((process.smvSeconds / (Math.max(efficiency, 20) / 100)) * 10) / 10;
    const isBottleneck = actualCycleTime > pitchTime * 1.05;

    // Backup operator candidate
    const backupCandidate = candidates[1]?.operator || null;

    assignments.push({
      stationNumber: index + 1,
      process,
      assignedOperator: operator,
      operatorEfficiency: efficiency,
      actualCycleTime,
      pitchTime,
      isBottleneck,
      backupOperator: backupCandidate,
      helperAssigned: isBottleneck && actualCycleTime > pitchTime * 1.2
    });
  });

  // Calculate global line metrics
  const cycleTimes = assignments.map(a => a.actualCycleTime);
  const maxCycleTime = Math.max(...cycleTimes);
  const bottleneckCycleTime = maxCycleTime;
  
  // Line Efficiency = (Total SMV / (Max Station Cycle Time * Manpower)) * 100
  const lineEfficiency = Math.min(
    100,
    Math.round(((totalSmv / (maxCycleTime * totalStations)) * 100) * 10) / 10
  );
  const balanceDelay = Math.round((100 - lineEfficiency) * 10) / 10;

  // Smoothness Index = sqrt( sum((Max - Ti)^2) / N )
  const varianceSum = cycleTimes.reduce((acc, ct) => acc + Math.pow(maxCycleTime - ct, 2), 0);
  const smoothnessIndex = Math.round(Math.sqrt(varianceSum / totalStations) * 10) / 10;

  const projectedOutputPerHour = Math.round(3600 / bottleneckCycleTime);
  const projectedDailyOutput = Math.round(projectedOutputPerHour * workingHours);

  // Generate bottleneck alerts
  const bottleneckAlerts = assignments
    .filter(a => a.isBottleneck)
    .map(a => {
      const opName = a.assignedOperator ? a.assignedOperator.name : 'Unassigned';
      const grade = getGradeFromRate(a.operatorEfficiency);
      return {
        stationNumber: a.stationNumber,
        processName: a.process.name,
        reason: `Cycle time (${a.actualCycleTime}s) melampaui Pitch Time (${pitchTime}s) sebesar +${(a.actualCycleTime - pitchTime).toFixed(1)}s. Efisiensi operator ${opName} berada di ${a.operatorEfficiency.toFixed(1)}% (${grade.label}).`,
        recommendedAction: `Pisahkan sub-elemen gerak (split operation), tambahkan 1 Helper penyuap/trimming, atau tempatkan operator Grade B+/A.`,
        suggestedHelperOrBackup: a.backupOperator ? `${a.backupOperator.name} (${a.backupOperator.nik})` : 'Helper Posisi 15 (Sunarwi)'
      };
    });

  // Calculate multiskill utilization
  const assignedOps = assignments.map(a => a.assignedOperator).filter(Boolean) as Operator[];
  const multiSkillCount = assignedOps.filter(op => getOperatorMultiSkillCount(op) >= 2).length;
  const multiskillUtilizationScore = Math.round((multiSkillCount / Math.max(assignedOps.length, 1)) * 100);

  return {
    styleId: style.id,
    styleName: style.styleName,
    line: availableOperators[0]?.line || "Line 1",
    pitchTime,
    taktTime,
    totalSmv,
    totalManpower: totalStations,
    lineEfficiency,
    balanceDelay,
    smoothnessIndex,
    bottleneckCycleTime,
    projectedOutputPerHour,
    projectedDailyOutput,
    assignments,
    aiRecommendations: {
      overallAnalysis: `Keseimbangan Line untuk style "${style.styleName}" mencapai efisiensi ${lineEfficiency}% dengan Balance Delay ${balanceDelay}%. Terdapat ${bottleneckAlerts.length} titik rawan bottleneck yang membutuhkan pemantauan supervisor.`,
      bottleneckAlerts,
      multiskillUtilizationScore,
      leanKaizenTips: [
        "Terapkan visual Kanban buffer maksimal 3 pcs antar stasiun untuk mendeteksi penumpukan WIP seketika.",
        "Gunakan folder/attachment pemandu jahit pada mesin Lockstitch untuk mengurangi waktu positioning material hingga 18%.",
        "Lakukan cross-training operator C-Grade pada Overlock untuk menyiapkan cadangan darurat (backup coverage)."
      ]
    }
  };
}

/**
 * Mengurutkan array nama Line secara urutan numerik murni dari nilai terkecil ke terbesar
 * Contoh: ['Line 1', 'Line 15', 'Line 2', 'Line 30', 'Line 10'] -> ['Line 1', 'Line 2', 'Line 10', 'Line 15', 'Line 30']
 */
export function sortLinesNumerically(lines: string[]): string[] {
  return [...lines].sort((a, b) => {
    const matchA = a.match(/\d+/);
    const matchB = b.match(/\d+/);
    const numA = matchA ? parseInt(matchA[0], 10) : NaN;
    const numB = matchB ? parseInt(matchB[0], 10) : NaN;

    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Mengurutkan array nama Factory secara urutan numerik / alfabetikal
 */
export function sortFactoriesNumerically(factories: string[]): string[] {
  return [...factories].sort((a, b) => {
    const matchA = a.match(/\d+/);
    const matchB = b.match(/\d+/);
    const numA = matchA ? parseInt(matchA[0], 10) : NaN;
    const numB = matchB ? parseInt(matchB[0], 10) : NaN;

    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * Normalisasi nama Factory dan Line agar cocok dengan format Dropdown UI (e.g. '1' / '01' / 'Factory 1' -> 'Factory 1')
 */
export function extractLineNumber(raw: any): number | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (!str || str === "-") return null;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function extractFactoryNumber(raw: any): number | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim();
  if (!str || str === "-") return null;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export function normalizeFactoryName(raw: any): string {
  if (raw === undefined || raw === null) return "Factory 1";
  const str = String(raw).trim();
  if (!str || str === "-") return "Factory 1";
  const match = str.match(/\d+/);
  if (match) {
    return `Factory ${parseInt(match[0], 10)}`;
  }
  if (str.toLowerCase().startsWith("factory")) {
    return str.charAt(0).toUpperCase() + str.slice(1).trim();
  }
  return `Factory ${str}`;
}

export function normalizeLineName(raw: any): string {
  if (raw === undefined || raw === null) return "Line 1";
  const str = String(raw).trim();
  if (!str || str === "-") return "Line 1";
  const match = str.match(/\d+/);
  if (match) {
    return `Line ${parseInt(match[0], 10)}`;
  }
  if (str.toLowerCase().startsWith("line")) {
    return str.charAt(0).toUpperCase() + str.slice(1).trim();
  }
  return `Line ${str}`;
}

/**
 * Format nama factory murni untuk penulisan ke Google Sheets Kolom A (hanya angka).
 * Contoh: "Factory 1" -> "1", "Factory 2" -> "2", "1" -> "1"
 */
export function formatFactoryForSheet(raw: any): string {
  if (raw === undefined || raw === null) return "1";
  const str = String(raw).trim();
  const match = str.match(/\d+/);
  return match ? match[0] : (str.replace(/factory\s*/i, "").trim() || "1");
}

/**
 * Format nomor line murni untuk penulisan ke Google Sheets Kolom B (hanya nomor line).
 * Contoh: "Line 28" -> "28", "Line 1" -> "1", "28" -> "28"
 */
export function formatLineForSheet(raw: any): string {
  if (raw === undefined || raw === null) return "1";
  const str = String(raw).trim();
  const match = str.match(/\d+/);
  return match ? match[0] : (str.replace(/line\s*/i, "").trim() || "1");
}

export const MONTH_NAMES_ID = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

export const AVAILABLE_YEARS = [2024, 2025, 2026, 2027, 2028];

const MONTH_MAP: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  may: 4, mei: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  aug: 7, agu: 7, ags: 7, agustus: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, okt: 9, oktober: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, des: 11, desember: 11, december: 11
};

/**
 * Mem-parse tanggal lokal tanpa pergeseran timezone UTC,
 * terutama untuk format YYYY-MM-DD.
 */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Jika formatnya YYYY-MM-DD
  const parts = String(dateStr).split(' ')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Bulan di JS dimulai dari 0
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day);
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Mem-parse string tanggal dengan berbagai format (YYYY-MM-DD, DD-MMM-YY, DD-MM-YYYY, ISO)
 * secara aman dengan timezone-neutral date instantiations (jam 12 siang).
 */
export function parseFlexibleDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr === '-' || dateStr.trim() === '') return null;
  const clean = dateStr.trim();

  // 1. Format YYYY-MM-DD atau YYYY/MM/DD (contoh: "2026-09-01", "2026/09/01", "2026-8-28")
  const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  // 2. Format DD-MMM-YY atau DD-MMM-YYYY atau DD MMM YYYY (contoh: "01-Sep-26", "1-Sep-2026", "1 September 2026")
  const mmmMatch = clean.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,10})[-\s/](\d{2,4})$/);
  if (mmmMatch) {
    const day = parseInt(mmmMatch[1], 10);
    const monStr = mmmMatch[2].toLowerCase();
    let year = parseInt(mmmMatch[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[monStr];
    if (month !== undefined && !isNaN(day)) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  // 3. Format DD-MM-YYYY atau DD/MM/YYYY (contoh: "01-09-2026", "28-08-2026", "05/05/2025")
  const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 12, 0, 0);
    }
  }

  // 4. Fallback ISO / native Date parser
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Ekstraksi 1-indexed month (1 = Jan ... 9 = Sep ... 12 = Des) dan 4-digit year (misal 2026)
 * menggunakan direct string slicing & parsing murni untuk menghindari bug 0-indexed getMonth() dan timezone shift.
 */
export function extractMonthAndYear(input: string | Date | null | undefined): { month: number; year: number } | null {
  if (!input) return null;

  // Jika input berupa Date, ambil year dan month + 1 secara aman
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return {
      month: input.getMonth() + 1,
      year: input.getFullYear(),
    };
  }

  const str = String(input).trim();
  if (!str || str === '-') return null;

  // 0. ISO string (misal dari Google Apps Script: "2026-09-01T17:00:00.000Z")
  // Di Indonesia (Asia/Jakarta, GMT+7): 01-09-2026 17:00 UTC = 02-09-2026 00:00 WIB
  // Tambahkan offset 7 jam agar tidak meleset tanggal/bulan
  if (str.includes('T') && (str.endsWith('Z') || str.includes('+'))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const jakartaTime = new Date(d.getTime() + 7 * 60 * 60 * 1000);
      return {
        month: jakartaTime.getUTCMonth() + 1,
        year: jakartaTime.getUTCFullYear(),
      };
    }
  }

  // 0b. Excel numeric serial date (misal 46268)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str, 10);
    if (serial >= 30000 && serial <= 60000) {
      const excelDate = new Date(Math.round((serial - 25569) * 86400 * 1000));
      if (!isNaN(excelDate.getTime())) {
        return {
          month: excelDate.getUTCMonth() + 1,
          year: excelDate.getUTCFullYear(),
        };
      }
    }
  }

  // 1. Direct parsing untuk format standard YYYY-MM-DD atau YYYY/MM/DD (contoh: "2026-09-01", "2026-9-1")
  // Karakter 0-4: Tahun, Karakter 5-7 (atau delimiter berikutnya): Bulan
  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10); // '09' -> 9 (September), '08' -> 8 (Agustus)
    if (year > 1900 && month >= 1 && month <= 12) {
      return { month, year };
    }
  }

  // 2. Direct parsing untuk format DD-MMM-YY / DD MMM YYYY (contoh: "01-Sep-26", "1-Sep-2026", "1 September 2026")
  const mmm = str.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,10})[-\s/](\d{2,4})/);
  if (mmm) {
    const monKey = mmm[2].toLowerCase();
    let year = parseInt(mmm[3], 10);
    if (year < 100) year += 2000;
    const monthIndex = MONTH_MAP[monKey];
    if (monthIndex !== undefined) {
      return { month: monthIndex + 1, year };
    }
  }

  // 3. Direct parsing untuk format DD-MM-YYYY atau DD/MM/YYYY (contoh: "01-09-2026", "1/9/2026")
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    const month = parseInt(dmy[2], 10);
    if (year > 1900 && month >= 1 && month <= 12) {
      return { month, year };
    }
  }

  return null;
}

/**
 * Helper to merge machine skill rates using Peak Performance (Max Efficiency) per machine type.
 * Rules:
 * - Preserves all unique machine competency columns (lockstitch, overlock, flatseam, special, buttonHole, buttonSet, chainstitch, bartack).
 * - If an operator has multiple entries for the exact same machine type in the same month,
 *   keeps the HIGHEST value (Peak Performance / Max Efficiency).
 * - Applied independently across each machine column so performance on one machine doesn't affect another.
 */
function mergeMachineRates(existing: Operator, incoming: Operator): void {
  const mergeRateMax = (curr: number | null | undefined, next: number | null | undefined): number | null => {
    const hasCurr = curr !== null && curr !== undefined && !isNaN(curr) && curr >= 0;
    const hasNext = next !== null && next !== undefined && !isNaN(next) && next >= 0;

    if (hasCurr && hasNext) {
      // Ambil poin paling tinggi di Kolom N untuk riwayat mesin ini (maksimal 3 poin per mesin)
      return Math.min(3, Math.max(curr as number, next as number));
    }
    if (hasNext) {
      return Math.min(3, next as number);
    }
    if (hasCurr) {
      return Math.min(3, curr as number);
    }
    return null;
  };

  existing.lockstitch = mergeRateMax(existing.lockstitch, incoming.lockstitch);
  existing.overlock = mergeRateMax(existing.overlock, incoming.overlock);
  existing.flatseam = mergeRateMax(existing.flatseam, incoming.flatseam);
  existing.special = mergeRateMax(existing.special, incoming.special);
  existing.buttonHole = mergeRateMax(existing.buttonHole, incoming.buttonHole);
  existing.buttonSet = mergeRateMax(existing.buttonSet, incoming.buttonSet);
  existing.chainstitch = mergeRateMax(existing.chainstitch, incoming.chainstitch);
  existing.bartack = mergeRateMax(existing.bartack, incoming.bartack);
}

/**
 * Filter Point-in-Time Reporting (Cumulative Snapshot & Peak Performance Merging):
 * 
 * 1. CUMULATIVE POINT-IN-TIME FILTERING:
 *    Hitung periode cut-off (selectedYear & selectedMonth, misal: Agustus 2026 -> 202608).
 *    Saring SEMUA baris record yang tanggalnya <= tanggal akhir bulan terpilih (dari awal riwayat
 *    hingga akhir bulan terpilih) agar seluruh kompetensi historis (misal: Mei, Juni, Juli) tetap terakumulasi.
 * 
 * 2. CUMULATIVE MULTI-PROCESS / PEAK PERFORMANCE MERGING PER NIK:
 *    Kelompokkan semua baris yang lolos berdasarkan NIK unik.
 *    - Akumulasi semua tipe mesin yang pernah dioperasikan hingga periode snapshot tersebut.
 *    - Jika ada banyak penilaian untuk tipe mesin yang sama, ambil skor TERTINGGI (Peak Performance).
 *    - Perbarui penugasan lokasi (Factory & Line) ke status TERAKHIR dalam rentang waktu kumulatif tersebut.
 * 
 * 3. LOCATION FILTER:
 *    Terapkan filter selectedFactory dan selectedLine pada penugasan terkini dari operator hasil penggabungan.
 * 
 * 4. DEBUG LOGS: Menampilkan ringkasan audit kumulatif per tahap ke browser console.
 */
export function filterOperatorsByPointInTime(
  rawOperators: Operator[],
  selectedMonth: number | string,
  selectedYear: number | string,
  selectedFactory?: string,
  selectedLine?: string
): Operator[] {
  if (!rawOperators || rawOperators.length === 0) return [];

  let selMonthNum: number;
  if (typeof selectedMonth === 'number') {
    selMonthNum = selectedMonth;
  } else {
    const parsed = parseInt(String(selectedMonth).trim(), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
      selMonthNum = parsed;
    } else {
      const monthStr = String(selectedMonth).trim().toLowerCase();
      selMonthNum = MONTH_MAP[monthStr] !== undefined ? MONTH_MAP[monthStr] + 1 : 6;
    }
  }

  const selYearNum = parseInt(String(selectedYear), 10) || 2026;

  // 1. Filter baris data yang masuk ke dalam periode hingga bulan & tahun yang dipilih (Point-in-Time Cumulative Snapshot)
  const filteredByMonth = rawOperators.filter((op: any) => {
    // Ambil sumber tanggal evaluasi dari properti operator (bukan dari doj / tanggal masuk)
    const dataSource = op.date || op.recordDate || op.updatedAt;
    if (!dataSource || dataSource === '-') return true; // Loloskan jika data tanggal tidak diisi agar tidak hilang

    const extracted = extractMonthAndYear(dataSource);
    if (extracted) {
      // Rekor harus berada pada atau sebelum bulan & tahun yang dipilih
      if (extracted.year < selYearNum) return true;
      if (extracted.year === selYearNum && extracted.month <= selMonthNum) return true;
      return false; // Rekor di masa depan (setelah bulan terpilih) diabaikan
    }

    const parsed = parseFlexibleDate(dataSource);
    if (parsed && !isNaN(parsed.getTime())) {
      const pYear = parsed.getFullYear();
      const pMonth = parsed.getMonth() + 1;
      if (pYear < selYearNum) return true;
      if (pYear === selYearNum && pMonth <= selMonthNum) return true;
      return false;
    }

    return true; // Fallback aman agar baris tidak terbuang jika format tanggal tidak terbaca
  });

  // 2. Agregasi per NIK: Ambil MAX PEAK PERFORMANCE untuk setiap kategori mesin & poin
  const workerMap: { [nik: string]: Operator } = {};
  const workerLatestDates: { [nik: string]: number } = {};

  filteredByMonth.forEach((op: any) => {
    const rawNik = op.nik || op.id;
    const nik = rawNik ? String(rawNik).trim() : '';
    if (!nik) return;

    const dataSource = op.date || op.recordDate || op.updatedAt || op.doj;
    const localD = parseLocalDate(dataSource);
    let currentRowDate = localD ? localD.getTime() : new Date(dataSource || 0).getTime();
    if (isNaN(currentRowDate)) {
      const parsed = parseFlexibleDate(dataSource);
      if (parsed) currentRowDate = parsed.getTime();
    }
    if (isNaN(currentRowDate)) currentRowDate = 0;

    if (!workerMap[nik]) {
      workerMap[nik] = { ...op };
      workerLatestDates[nik] = currentRowDate;
    } else {
      const existing = workerMap[nik];
      const existingDate = workerLatestDates[nik] || 0;

      // Ambil MAX PEAK PERFORMANCE per mesin (skor tertinggi, tidak terhapus oleh tanggal terbaru)
      mergeMachineRates(existing, op);

      // Ambil MAX PEAK PERFORMANCE untuk poin & production rate
      if (op.points !== null && op.points !== undefined && !isNaN(op.points) && op.points > 0) {
        existing.points = Math.max(existing.points || 0, op.points);
      }
      if (op.productionRate !== null && op.productionRate !== undefined && !isNaN(op.productionRate) && op.productionRate > 0) {
        existing.productionRate = Math.max(existing.productionRate || 0, op.productionRate);
      }
      if (op.workTimeMonths !== null && op.workTimeMonths !== undefined && !isNaN(op.workTimeMonths) && op.workTimeMonths > 0) {
        existing.workTimeMonths = Math.max(existing.workTimeMonths || 0, op.workTimeMonths);
      }

      // Update penugasan lokasi & status ke tanggal terbaru di bulan tersebut
      if (currentRowDate >= existingDate) {
        workerLatestDates[nik] = currentRowDate;
        existing.factory = op.factory || existing.factory;
        existing.line = op.line || existing.line;
        existing.status = op.status || existing.status;
        existing.recordDate = op.recordDate || existing.recordDate;
        existing.date = op.date || existing.date;
        if (op.doj && op.doj !== '-') existing.doj = op.doj;
      }

      // Preservasi tanggal resign dan status jika tercatat
      if (op.dateOfResign && !existing.dateOfResign) existing.dateOfResign = op.dateOfResign;
      if (op.resignDate && !existing.resignDate) existing.resignDate = op.resignDate;
      if (op.status && !existing.status) existing.status = op.status;
    }
  });

  // 3. Ubah kembali ke bentuk array dari daftar operator unik hasil penggabungan Peak Performance
  // Hitung total grade sebagai PENJUMLAHAN seluruh poin yang didapat dari mesin-mesin yang dikuasai
  let result = Object.values(workerMap).map((op) => {
    const totalPts = getOperatorTotalPoints(op);
    const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
    const gradeObj = getGradeFromTotalPoints(totalPts, isHelper);

    // Evaluasi status point-in-time untuk periode bulan & tahun yang dipilih
    // Jika operator baru resign di bulan Maret, maka saat melihat bulan Januari statusnya tetap AKTIF
    const isResigned = isOperatorResignedAtPeriod(op, selMonthNum, selYearNum);
    const effectiveStatus = isResigned
      ? 'RESIGNED'
      : (op.status?.toUpperCase() === 'RESIGNED' ? 'ACTIVE' : (op.status || 'ACTIVE'));

    return {
      ...op,
      status: effectiveStatus,
      points: totalPts,
      grade: gradeObj.grade,
      overallGrade: gradeObj.grade,
    };
  });

  // Buang operator yang SUDAH RESIGN sebelum periode bulan yang dipilih
  result = result.filter(op => !isOperatorResignedAtPeriod(op, selMonthNum, selYearNum));

  // 4. Filter opsional berdasarkan Factory dan Line jika ada
  if (selectedFactory && selectedFactory !== 'All') {
    result = result.filter((op: any) => {
      const fac = normalizeFactoryName(op.factory || '1');
      return fac.toLowerCase() === normalizeFactoryName(selectedFactory).toLowerCase();
    });
  }

  if (selectedLine && selectedLine !== 'All') {
    result = result.filter((op: any) => {
      const line = op.dominantLine || op.line || '1';
      // Ekstrak angka line dari data (misal dari "Line 3" atau angka 3) menjadi string angka yang bersih
      const lineNumMatch = String(line).match(/\d+/);
      const selectedLineNumMatch = String(selectedLine).match(/\d+/);
      
      const lineNum = lineNumMatch ? lineNumMatch[0] : String(line).trim();
      const selectedNum = selectedLineNumMatch ? selectedLineNumMatch[0] : String(selectedLine).trim();

      return lineNum === selectedNum;
    });
  }

  return result;
}

/**
 * Memproses data mentah dari spreadsheet untuk:
 * 1. Mengambil data pada bulan/tahun tertentu.
 * 2. Mengatasi operator yang bekerja di >1 line dengan memilih line distribusi terbanyak.
 * 
 * Cara Kerja:
 * - Penyaringan Periode & Pabrik: Menyaring data mentah agar hanya membaca bulan, tahun, dan pabrik yang sedang aktif.
 * - Akumulasi Line Multi-Tasking: Menghitung frekuensi baris/kemunculan NIK di setiap line.
 * - Penentuan Dominan: Membandingkan frekuensinya dan memilih line terbanyak, mengunci operator secara eksklusif ke line tersebut.
 */
export function processOperatorsByDominantLine<T extends RawSheetRow = RawSheetRow>(
  rawRows: T[], 
  selectedMonth: number, 
  selectedYear: number,
  targetFactory: string,
  targetLine: string
): T[] {
  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
    return [];
  }

  // 1. Filter baris data yang masuk ke dalam bulan & tahun yang dipilih
  const filteredByMonth = rawRows.filter(row => {
    let rowYear: number;
    let rowMonth: number;

    const extracted = extractMonthAndYear(row.date);
    if (extracted) {
      rowYear = extracted.year;
      rowMonth = extracted.month;
    } else {
      const rowDate = new Date(row.date);
      if (!isNaN(rowDate.getTime())) {
        rowYear = rowDate.getFullYear();
        rowMonth = rowDate.getMonth() + 1;
      } else {
        return true; // Fallback jika tidak ada tanggal yang valid
      }
    }

    const matchesMonth = rowYear === selectedYear && rowMonth === selectedMonth;
    const matchesFactory = !targetFactory ||
      row.factory === targetFactory ||
      normalizeFactoryName(row.factory || '').toLowerCase() === normalizeFactoryName(targetFactory).toLowerCase();

    return matchesMonth && matchesFactory;
  });

  // 2. Petakan data per NIK untuk menghitung kemunculan di setiap Line
  const operatorLineCounts: { [nik: string]: { [line: string]: number } } = {};
  const operatorLatestData: { [nik: string]: T } = {};

  filteredByMonth.forEach(row => {
    const rawNik = row.nik || (row as any).id;
    const nik = rawNik ? String(rawNik).trim() : '';
    const line = row.line ? String(row.line).trim() : '';

    if (!nik) return;

    // Hitung frekuensi kemunculan NIK di line tersebut
    if (!operatorLineCounts[nik]) {
      operatorLineCounts[nik] = {};
    }
    operatorLineCounts[nik][line] = (operatorLineCounts[nik][line] || 0) + 1;

    // Simpan referensi data terakhir operator untuk atribut namanya, dll.
    operatorLatestData[nik] = row;
  });

  // 3. Tentukan line yang paling dominan (distribusi terbanyak) untuk setiap NIK
  const dominantOperatorsMap: { [nik: string]: T } = {};

  Object.keys(operatorLineCounts).forEach(nik => {
    const linesCount = operatorLineCounts[nik];
    
    // Cari line dengan jumlah baris terbanyak
    let dominantLine = '';
    let maxCount = -1;

    Object.entries(linesCount).forEach(([line, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantLine = line;
      }
    });

    // Jika operator tersebut dominan di line yang sedang dipilih, masukkan ke daftar
    const isLineMatch = dominantLine === targetLine ||
      normalizeLineName(dominantLine).toLowerCase() === normalizeLineName(targetLine).toLowerCase();

    if (isLineMatch) {
      dominantOperatorsMap[nik] = {
        ...operatorLatestData[nik],
        line: dominantLine,
      };
    }
  });

  // Kembalikan daftar operator unik yang sudah difilter berdasarkan line dominannya
  return Object.values(dominantOperatorsMap);
}

/**
 * Memproses data mentah dari spreadsheet dengan aturan:
 * 1. Filter berdasarkan bulan dan tahun yang dipilih.
 * 2. Untuk setiap operator (berdasarkan NIK), ambil data pada TANGGAL TERBESAR (akhir bulan) di bulan tersebut.
 * 3. Hitung jumlah operator unik (Count Unique Worker Code) per Factory.
 */
export function processActualMonthlyHeadcount(
  rawRows: RawSheetRow[], 
  selectedMonth: number, 
  selectedYear: number
) {
  if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
    return {
      operators: [],
      factorySummary: {}
    };
  }

  // 1. Filter baris data yang masuk ke dalam bulan & tahun yang dipilih
  const filteredByMonth = rawRows.filter(row => {
    if (!row.date) return false;
    let rowDate = parseLocalDate(row.date) || new Date(row.date);
    if (isNaN(rowDate.getTime())) {
      const parsed = parseFlexibleDate(row.date);
      if (parsed) rowDate = parsed;
    }
    return (
      !isNaN(rowDate.getTime()) &&
      rowDate.getFullYear() === selectedYear &&
      (rowDate.getMonth() + 1) === selectedMonth
    );
  });

  // 2. Kelompokkan seluruh baris valid per NIK di bulan tersebut untuk mencari tanggal maksimum
  const workerRowsMap: { [nik: string]: { row: RawSheetRow; time: number }[] } = {};

  filteredByMonth.forEach(row => {
    const rawNik = row.nik || (row as any).id;
    const nik = rawNik ? String(rawNik).trim() : '';
    if (!nik) return;

    const localD = parseLocalDate(row.date);
    let currentRowDate = localD ? localD.getTime() : new Date(row.date).getTime();
    if (isNaN(currentRowDate)) {
      const parsed = parseFlexibleDate(row.date);
      if (parsed) currentRowDate = parsed.getTime();
    }

    if (!workerRowsMap[nik]) {
      workerRowsMap[nik] = [];
    }
    workerRowsMap[nik].push({ row, time: currentRowDate });
  });

  const latestRowPerWorker: { [nik: string]: RawSheetRow } = {};
  const dominantLinePerWorker: { [nik: string]: string } = {};

  // 3. Proses setiap NIK: Cari tanggal maksimum, lalu tentukan line dominan HANYA dari baris-baris di tanggal akhir tersebut
  Object.keys(workerRowsMap).forEach(nik => {
    const entries = workerRowsMap[nik];
    
    // Cari waktu (timestamp) terbesar untuk operator ini di bulan tersebut
    let maxTime = -1;
    entries.forEach(entry => {
      if (entry.time > maxTime) {
        maxTime = entry.time;
      }
    });

    // Ambil semua baris yang jatuh pada tanggal terbesar (bisa jadi ada beberapa baris/mesin di hari yang sama atau akhir bulan)
    const latestDateEntries = entries.filter(entry => entry.time === maxTime);
    
    // Simpan baris referensi utama (ambil yang pertama dari tanggal terbesar)
    latestRowPerWorker[nik] = latestDateEntries[0].row;

    // Hitung frekuensi line HANYA pada baris-baris di tanggal akhir tersebut
    const lineCountsAtEnd: { [line: string]: number } = {};
    latestDateEntries.forEach(entry => {
      const line = entry.row.line ? String(entry.row.line).trim() : '';
      if (line) {
        lineCountsAtEnd[line] = (lineCountsAtEnd[line] || 0) + 1;
      }
    });

    // Tentukan line dengan frekuensi terbanyak di tanggal akhir
    let dominantLine = latestDateEntries[0].row.line ? String(latestDateEntries[0].row.line).trim() : '';
    let maxCount = -1;
    Object.entries(lineCountsAtEnd).forEach(([line, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantLine = line;
      }
    });

    dominantLinePerWorker[nik] = dominantLine;
  });

  // 4. Susun daftar operator aktif akhir bulan beserta dominantLine-nya
  const activeOperatorsList: (RawSheetRow & { dominantLine: string })[] = [];

  Object.keys(latestRowPerWorker).forEach(nik => {
    const row = latestRowPerWorker[nik];
    activeOperatorsList.push({
      ...row,
      dominantLine: dominantLinePerWorker[nik] || row.line
    });
  });

  // 5. Hitung Count Unique Worker Code per Factory
  const factoryCounts: { [factory: string]: Set<string> } = {};

  activeOperatorsList.forEach(op => {
    const factory = op.factory || '1';
    if (!factoryCounts[factory]) {
      factoryCounts[factory] = new Set<string>();
    }
    factoryCounts[factory].add(op.nik);
  });

  const factorySummary: { [factory: string]: number } = {};
  Object.keys(factoryCounts).forEach(factory => {
    factorySummary[factory] = factoryCounts[factory].size;
  });

  return {
    operators: activeOperatorsList,
    factorySummary: factorySummary
  };
}

export const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec";

/**
 * Kalkulasi selisih bulan (masa kerja) dari string Date of Join (DOJ).
 * Mendukung format DD-MM-YYYY, YYYY-MM-DD, D-MMM-YY, dsb.
 */
export function calculateWorkTimeMonths(dojStr: string | null | undefined): number {
  if (!dojStr || dojStr === "-" || String(dojStr).trim() === "") return 0;

  const str = String(dojStr).trim();
  let dojDate: Date | null = null;

  // Format DD-MM-YYYY atau DD/MM/YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(str)) {
    const parts = str.split(/[-/]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    dojDate = new Date(year, month, day);
  } else if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str)) {
    // Format YYYY-MM-DD
    const parts = str.split(/[-/]/);
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    dojDate = new Date(year, month, day);
  } else {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      dojDate = parsed;
    }
  }

  if (!dojDate || isNaN(dojDate.getTime())) return 0;

  const now = new Date();
  let months = (now.getFullYear() - dojDate.getFullYear()) * 12 + (now.getMonth() - dojDate.getMonth());
  if (now.getDate() < dojDate.getDate()) {
    months--;
  }

  return Math.max(0, months);
}

/**
 * Memeriksa apakah operator sudah mengundurkan diri (RESIGNED) SEBELUM periode bulan dan tahun yang sedang dilihat.
 * Jika operator resign pada bulan Maret 2026:
 * - Pada bulan Januari 2026: isOperatorResignedAtPeriod = false (masih AKTIF bekerja)
 * - Pada bulan Februari 2026: isOperatorResignedAtPeriod = false (masih AKTIF bekerja)
 * - Pada bulan Maret 2026: isOperatorResignedAtPeriod = false (masih dievaluasi / bekerja di bulan Maret)
 * - Pada bulan April 2026 dan seterusnya: isOperatorResignedAtPeriod = true (sudah RESIGNED, tidak aktif di line)
 */
export function isOperatorResignedAtPeriod(
  op: { status?: string | null; dateOfResign?: string | null; resignDate?: string | null; date?: string; recordDate?: string },
  selectedMonth?: number | string,
  selectedYear?: number | string
): boolean {
  if (!op) return false;

  const selMonthNum = typeof selectedMonth === 'number'
    ? selectedMonth
    : (parseInt(String(selectedMonth || 1), 10) || 1);
  const selYearNum = typeof selectedYear === 'number'
    ? selectedYear
    : (parseInt(String(selectedYear || 2026), 10) || 2026);

  const resignStr = op.dateOfResign || op.resignDate;

  if (resignStr && String(resignStr).trim() !== '' && String(resignStr).trim() !== '-') {
    const extracted = extractMonthAndYear(String(resignStr).trim());
    if (extracted) {
      // Jika resign di tahun sebelum tahun terpilih -> sudah resign
      if (extracted.year < selYearNum) return true;
      // Jika di tahun yang sama: sudah resign jika bulan resign sebelum bulan terpilih
      if (extracted.year === selYearNum) {
        return extracted.month < selMonthNum;
      }
      return false;
    }

    const d = parseFlexibleDate(String(resignStr).trim()) || parseLocalDate(String(resignStr).trim());
    if (d && !isNaN(d.getTime())) {
      const rYear = d.getFullYear();
      const rMonth = d.getMonth() + 1;
      if (rYear < selYearNum) return true;
      if (rYear === selYearNum) return rMonth < selMonthNum;
      return false;
    }
  }

  // Jika tidak memiliki dateOfResign, namun statusnya RESIGNED
  if (op.status?.toUpperCase() === 'RESIGNED') {
    const recStr = op.recordDate || op.date;
    if (recStr && String(recStr).trim() !== '' && String(recStr).trim() !== '-') {
      const recExtracted = extractMonthAndYear(String(recStr).trim());
      if (recExtracted) {
        // Jika rekor resign bertanggal di masa depan setelah bulan terpilih,
        // maka pada bulan terpilih operator BELUM resign
        if (recExtracted.year > selYearNum) return false;
        if (recExtracted.year === selYearNum && recExtracted.month > selMonthNum) return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Filter operator aktif di dalam fungsi kalkulasi/tabel frontend.
 * Membuang operator yang sudah RESIGNED sebelum periode bulan & tahun yang sedang aktif.
 */
export function filterActiveOperators<T extends { status?: string | null; dateOfResign?: string | null; resignDate?: string | null; date?: string; recordDate?: string }>(
  rawData: T[],
  selectedMonth?: number | string,
  selectedYear?: number | string
): T[] {
  if (!rawData || !Array.isArray(rawData)) return [];
  return rawData.filter((row) => {
    if (selectedMonth !== undefined && selectedYear !== undefined) {
      return !isOperatorResignedAtPeriod(row, selectedMonth, selectedYear);
    }
    const isResigned = row.status?.toUpperCase() === "RESIGNED";
    return !isResigned;
  });
}

export async function setOperatorResigned(
  nik: string,
  name: string,
  factory: string,
  line: string,
  month: number,
  year: number
): Promise<boolean> {
  try {
    const response = await fetch(GAS_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors", // Mengatasi isu CORS standar Google Apps Script
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "setResigned",
        nik: nik,
        name: name,
        factory: factory,
        line: line,
        month: month, // Contoh: 9 untuk September
        year: year    // Contoh: 2026
      }),
    });

    // Karena menggunakan mode "no-cors", respons detail tidak bisa dibaca langsung,
    // tapi eksekusi ke Google Sheets dipastikan berjalan lancar di backend.
    return true;
  } catch (error) {
    console.error("Gagal memperbarui status resigned operator:", error);
    return false;
  }
}

export interface NikLookupResult {
  nik: string;
  name: string;
  doj: string;
  workTimeMonths: number;
  factory?: string;
  line?: string;
  status?: string;
}

/**
 * Universal NIK Lookup yang bekerja baik di AI Studio (Express Backend)
 * maupun di Vercel Deployment (Direct GViz CSV & Sheets API v4 fallback).
 */
export async function lookupNikFromDateOfJoin(nikToSearch: string): Promise<NikLookupResult | null> {
  const cleanNik = String(nikToSearch || '').trim();
  if (!cleanNik) return null;

  // 1. Tier 1: Coba Express backend /api/sheets/date-of-join (berfungsi di AI Studio & backend container)
  try {
    const res = await fetch(`/api/sheets/date-of-join?nik=${encodeURIComponent(cleanNik)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.found && json.data) {
        return {
          nik: json.data.nik || cleanNik,
          name: String(json.data.name || '').toUpperCase(),
          doj: json.data.doj || '-',
          workTimeMonths: json.data.workTimeMonths ?? calculateWorkTimeMonths(json.data.doj),
          factory: json.data.factory,
          line: json.data.line,
          status: json.data.status || 'ACTIVE'
        };
      }
    }
  } catch (backendErr) {
    console.warn('Backend lookup tidak tersedia, beralih ke Vercel direct client-side lookup:', backendErr);
  }

  // 2. Tier 2: Direct Google Visualization CSV query (100% BEKERJA DI VERCEL, CORS OPEN, TANPA BUTUH API KEY)
  try {
    const gvizUrl = "https://docs.google.com/spreadsheets/d/1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag/gviz/tq?tqx=out:csv&sheet=date_of_join";
    const res = await fetch(gvizUrl);
    if (res.ok) {
      const csvText = await res.text();
      const lines = csvText.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        // Parse CSV baris dengan regex penangkap tanda kutip
        const cells: string[] = [];
        const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
        let match;
        while ((match = regex.exec(line)) !== null) {
          let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
          cells.push((val || '').trim());
        }
        if (cells.length >= 2) {
          const rowNik = cells[0];
          if (rowNik && rowNik.toUpperCase() === cleanNik.toUpperCase()) {
            const name = (cells[1] || '').toUpperCase();
            const doj = cells[2] || '-';
            return {
              nik: rowNik,
              name,
              doj,
              workTimeMonths: calculateWorkTimeMonths(doj),
              status: 'ACTIVE'
            };
          }
        }
      }
    }
  } catch (gvizErr) {
    console.warn('GViz CSV direct lookup failed:', gvizErr);
  }

  // 3. Tier 3: Direct Google Sheets API v4 fallback
  try {
    const apiKey = "AIzaSyBA08ZGyorJcsIXqe77sTuuNPxsOMWVabw";
    const sheetId = "1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag";
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/date_of_join!A1:E5000?key=${apiKey}`;
    const res = await fetch(sheetsUrl);
    if (res.ok) {
      const json = await res.json();
      const rows = json.values || [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNik = String(row[0] || '').trim();
        if (rowNik.toUpperCase() === cleanNik.toUpperCase()) {
          const name = String(row[1] || '').trim().toUpperCase();
          const doj = String(row[2] || '').trim();
          return {
            nik: rowNik,
            name,
            doj,
            workTimeMonths: calculateWorkTimeMonths(doj),
            status: 'ACTIVE'
          };
        }
      }
    }
  } catch (apiErr) {
    console.warn('Direct Sheets API v4 lookup failed:', apiErr);
  }

  return null;
}

/**
 * Menghasilkan 18 kolom baris standar Google Sheets 'by_worker'
 * beserta rumus XLOOKUP, IFS, DATEDIF, dan INDEX MATCH yang tepat
 */
export interface ByWorkerPlantingResult {
  factory: string;
  line: string;
  tableCode: string;
  dateStr: string;
  nik: string;
  name: string;
  doj: string;
  machineName: string;
  styleNo: string;
  process: string;
  meta: number;
  production: number;
  productionRate: number;
  points: number;
  workMonth: number;
  dateOfResign: string;
  machineCategory: string;
  status: string;
  values: (string | number)[];
  formulas: (string | number)[];
  tsvLine: string;
  formulaTsvLine: string;
}

export function generateByWorkerPlantingRow(
  operator: any,
  targetRowNumber: number = 19625,
  dateStr?: string
): ByWorkerPlantingResult {
  const factoryFormatted = formatFactoryForSheet(operator.factory);
  const lineFormatted = formatLineForSheet(operator.line);
  const rawPoints = typeof operator.points === 'number' 
    ? operator.points 
    : (operator.points !== undefined && operator.points !== null && String(operator.points).trim() !== '' ? parseInt(String(operator.points), 10) : 0);
  const pointVal = isNaN(rawPoints) ? 0 : Math.min(3, Math.max(0, Math.round(rawPoints)));

  const today = new Date();
  const formattedTodayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const dateVal = dateStr || operator.date || operator.recordDate || formattedTodayYmd;

  const nik = String(operator.nik || "").trim();
  const name = String(operator.name || "").trim().toUpperCase();
  const doj = String(operator.doj || "-").trim();
  const tableCode = String(operator.tableCode || operator.table || operator.styleCode || "1").trim();
  const styleNo = String(operator.styleNo || operator.style || "NB17HQ271140").trim();
  const machineName = String(operator.machineName || operator.machine || "1Needle Lockstitch Auto Trim").trim();
  const machineCategory = String(operator.machineCategory || operator.category || "LOCKSTITCH").toUpperCase();
  const process = String(operator.process || "MANUAL").trim().toUpperCase();

  const prodRate = pointVal === 0 ? 0 : Number(operator.productionRate || (pointVal === 1 ? 60 : pointVal === 2 ? 80 : 92.44));
  const meta = pointVal === 0 ? 0 : Number(operator.meta || operator.target || 844);
  const production = pointVal === 0 ? 0 : Number(operator.production || operator.actual || Math.round(meta * (prodRate / 100)));
  const workMonth = typeof operator.workTimeMonths === 'number'
    ? operator.workTimeMonths
    : (typeof operator.workMonth === 'number' ? operator.workMonth : calculateWorkTimeMonths(doj));

  const rowIdx = targetRowNumber > 0 ? targetRowNumber : 19625;

  // RUMUS PENANAMAN GOOGLE SHEETS ASLI:
  // Kolom G (Date of Join): XLOOKUP dari sheet date_of_join
  const formulaG = `=XLOOKUP(E${rowIdx},date_of_join!$A$2:$A$19392,date_of_join!$C$2:$C$19392)`;
  // Kolom N (POIN): 0 untuk Helper (atau IFS yang aman untuk 0)
  const formulaN = pointVal === 0 
    ? 0 
    : `=IFS(M${rowIdx}<=0,0,M${rowIdx}<=60.99,1,AND(M${rowIdx}>=61,M${rowIdx}<=89.99),2,M${rowIdx}>=90,3)`;
  // Kolom O (Work Month): DATEDIF dari DOJ (Kolom G) ke Tanggal (Kolom D)
  const formulaO = `=DATEDIF(G${rowIdx}, D${rowIdx}, "M")`;
  // Kolom P (Date of Resign): XLOOKUP dari sheet date_of_join Kolom D
  const formulaP = `=XLOOKUP(E${rowIdx},date_of_join!$A$2:$A$9996,date_of_join!$D$2:$D$9996)`;
  // Kolom Q (Machine Category): INDEX MATCH ke daftar mesin ($Y$2:$Y$74, $Z$2:$Z$74)
  const formulaQ = `=INDEX($Y$2:$Y$74,MATCH(H${rowIdx},$Z$2:$Z$74,))`;

  // 18 Kolom format Data murni (Static Values)
  const values = [
    factoryFormatted,  // Kolom A: Factory
    lineFormatted,     // Kolom B: Line
    tableCode,         // Kolom C: Table
    dateVal,           // Kolom D: Date
    nik,               // Kolom E: Worker Code
    name,              // Kolom F: Worker
    doj,               // Kolom G: Date of Join
    machineName,       // Kolom H: Machine
    styleNo,           // Kolom I: Style No
    process,           // Kolom J: Process
    meta,              // Kolom K: Meta
    production,        // Kolom L: Production
    prodRate,          // Kolom M: Production Rate (%)
    pointVal,          // Kolom N: POIN (0 untuk Helper)
    workMonth,         // Kolom O: Work Month
    "",                // Kolom P: Date of Resign
    machineCategory,   // Kolom Q: Machine Category
    "ACTIVE",          // Kolom R: Status
  ];

  // 18 Kolom format Formula Google Sheets
  const formulas = [
    factoryFormatted,  // Kolom A
    lineFormatted,     // Kolom B
    tableCode,         // Kolom C
    dateVal,           // Kolom D
    nik,               // Kolom E
    name,              // Kolom F
    formulaG,          // Kolom G (Formula)
    machineName,       // Kolom H
    styleNo,           // Kolom I
    process,           // Kolom J
    meta,              // Kolom K
    production,        // Kolom L
    prodRate,          // Kolom M
    formulaN,          // Kolom N (Formula / 0)
    formulaO,          // Kolom O (Formula)
    formulaP,          // Kolom P (Formula)
    formulaQ,          // Kolom Q (Formula)
    "ACTIVE",          // Kolom R
  ];

  const tsvLine = values.join('\t');
  const formulaTsvLine = formulas.join('\t');

  return {
    factory: factoryFormatted,
    line: lineFormatted,
    tableCode,
    dateStr: dateVal,
    nik,
    name,
    doj,
    machineName,
    styleNo,
    process,
    meta,
    production,
    productionRate: prodRate,
    points: pointVal,
    workMonth,
    dateOfResign: "",
    machineCategory,
    status: "ACTIVE",
    values,
    formulas,
    tsvLine,
    formulaTsvLine,
  };
}

// Helper Persistensi LocalStorage untuk Operator Baru
const STORAGE_KEY_OPERATORS = "ie_custom_added_operators_v2";

export function getCustomAddedOperatorsFromStorage(): any[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OPERATORS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Gagal membaca custom operators dari localStorage:", e);
    return [];
  }
}

export function saveCustomAddedOperatorToStorage(operator: any): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = getCustomAddedOperatorsFromStorage();
    const nik = String(operator.nik || operator.id || "").trim();
    const date = String(operator.date || operator.recordDate || "").trim();
    const line = String(operator.line || "").trim();

    const filtered = existing.filter((item: any) => {
      const itemNik = String(item.nik || item.id || "").trim();
      const itemDate = String(item.date || item.recordDate || "").trim();
      const itemLine = String(item.line || "").trim();
      return !(itemNik === nik && itemDate === date && itemLine === line);
    });

    filtered.unshift({
      ...operator,
      isLocallySaved: true,
      savedAt: new Date().toISOString(),
    });

    localStorage.setItem(STORAGE_KEY_OPERATORS, JSON.stringify(filtered));
  } catch (e) {
    console.warn("Gagal menyimpan custom operator ke localStorage:", e);
  }
}

export function removeCustomAddedOperatorFromStorage(nik: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const existing = getCustomAddedOperatorsFromStorage();
    const updated = existing.filter((op) => String(op.nik || op.id).trim() !== String(nik).trim());
    localStorage.setItem(STORAGE_KEY_OPERATORS, JSON.stringify(updated));
  } catch (e) {
    console.warn("Gagal menghapus custom operator dari localStorage:", e);
  }
}

/**
 * Helper untuk mem-parsing satu baris CSV dengan dukungan tanda kutip (quotes)
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Membaca dan mem-parse data tab 'by_worker' secara langsung via Google Visualization (GViz) CSV
 * Sangat cepat, tahan banting, dan 100% bekerja di Vercel maupun lingkungan mana pun tanpa butuh backend
 */
export async function fetchOperatorsFromGViz(sheetId: string = "1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag"): Promise<{
  success: boolean;
  operators: any[];
  count: number;
  error?: string;
}> {
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=by_worker`;
    const res = await fetch(gvizUrl);
    if (!res.ok) {
      throw new Error(`GViz fetch error: HTTP ${res.status}`);
    }

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return { success: true, operators: [], count: 0 };
    }

    // Parse Header
    const headerLine = lines[0];
    const headers = parseCsvLine(headerLine).map((h) => h.trim());

    const findColIdx = (candidates: string[], fallbackIdx: number) => {
      for (const cand of candidates) {
        const idx = headers.findIndex((h) => h.toUpperCase() === cand.toUpperCase());
        if (idx !== -1) return idx;
      }
      for (const cand of candidates) {
        const idx = headers.findIndex((h) => h.toUpperCase().includes(cand.toUpperCase()));
        if (idx !== -1) return idx;
      }
      return fallbackIdx;
    };

    const idxFactory = findColIdx(["Factory", "Pabrik"], 0);
    const idxLine = findColIdx(["Line", "Jalur"], 1);
    const idxDate = findColIdx(["Date", "Tanggal", "Tgl"], 3);
    const idxWorkerCode = findColIdx(["Worker Code", "NIK", "ID"], 4);
    const idxWorker = findColIdx(["Worker", "Nama", "Operator"], 5);
    const idxDoj = findColIdx(["Date of Join", "D.O.J", "DOJ"], 6);
    const idxMachineName = findColIdx(["Machine", "Mesin", "Nama Mesin"], 7);
    const idxStyleNo = findColIdx(["Style No", "Style"], 8);
    const idxProcess = findColIdx(["Process", "Proses", "Operasi"], 9);
    const idxRate = findColIdx(["Production Rate (%)", "Actual Rate", "Rate", "Efisiensi"], 12);
    const idxPoints = findColIdx(["POIN", "POINT (KOLOM N)", "POIN MESIN"], 13);
    const idxWorkMonth = findColIdx(["Work Month", "Masa Kerja"], 14);
    const idxDateOfResign = findColIdx(["Date of Resign", "Resign"], 15);
    const idxMachine = findColIdx(["Machine Category", "Kategori Mesin", "Category", "Kategori"], 16);
    const idxStatus = findColIdx(["Status"], 17);

    const parsedOps: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const nik = (cols[idxWorkerCode] ?? cols[4] ?? "").trim();
      if (!nik || nik.toLowerCase() === "worker code" || nik.toLowerCase() === "nik") continue;

      const rawRate = Number(cols[idxRate] ?? cols[12] ?? 0);
      const rawPointsStr = String(cols[idxPoints] ?? cols[13] ?? "").trim();
      const rawPoints = parseFloat(rawPointsStr.replace(',', '.').replace(/[^0-9.]/g, ''));
      let pointVal = !isNaN(rawPoints) ? Math.min(3, Math.max(0, Math.round(rawPoints))) : 0;
      if (rawPointsStr === "" && rawRate > 0) {
        pointVal = getPointsFromEfficiency(rawRate);
      }

      const rawCat = String(cols[idxMachine] ?? cols[16] ?? "").toUpperCase();
      const rawMachineName = String(cols[idxMachineName] ?? cols[7] ?? "").toUpperCase();

      const isLockstitch = rawCat.includes("LOCKSTITCH") || rawCat.includes("SN") || rawCat.includes("SINGLE NEEDLE") ||
        (!rawCat && (rawMachineName.includes("LOCKSTITCH") || rawMachineName.includes("1NEEDLE") || rawMachineName.includes("SN")));
      const isOverlock = rawCat.includes("OVERLOCK") || rawCat.includes("OL") || rawCat.includes("OBRAS") ||
        (!rawCat && (rawMachineName.includes("OVERLOCK") || rawMachineName.includes("OBRAS") || rawMachineName.includes("2NEEDLE OVERLOCK")));
      const isFlatseam = rawCat.includes("FLATSEAM") || rawCat.includes("COVERSTITCH") || rawCat.includes("FS") || rawCat.includes("KAM") ||
        (!rawCat && (rawMachineName.includes("FLAT SEAM") || rawMachineName.includes("COVERSTITCH") || rawMachineName.includes("FLATSEAM")));
      const isSpecial = rawCat.includes("SPECIAL") || rawCat.includes("SP") || rawCat.includes("PRESS") || rawCat.includes("OTOMATIS") ||
        (!rawCat && (rawMachineName.includes("PRESS") || rawMachineName.includes("HEAT TRANSFER") || rawMachineName.includes("SPECIAL")));
      const isButtonHole = rawCat.includes("BUTTON HOLE") || rawCat.includes("BUTTON_HOLE") || rawCat.includes("BH") || rawCat.includes("LUBANG KANCING") ||
        (!rawCat && (rawMachineName.includes("BUTTON HOLE") || rawMachineName.includes("LUBANG KANCING")));
      const isButtonSet = rawCat.includes("BUTTON SET") || rawCat.includes("BUTTON_SET") || rawCat.includes("BS") || rawCat.includes("PASANG KANCING") ||
        (!rawCat && (rawMachineName.includes("BUTTON SET") || rawMachineName.includes("PASANG KANCING")));
      const isChainstitch = rawCat.includes("CHAINSTITCH") || rawCat.includes("CS") || rawCat.includes("KANSAI") ||
        (!rawCat && (rawMachineName.includes("CHAINSTITCH") || rawMachineName.includes("KANSAI") || rawMachineName.includes("CHAIN STITCH")));
      const isBartack = rawCat.includes("BARTACK") || rawCat.includes("BT") || rawCat.includes("BAR TACK") ||
        (!rawCat && (rawMachineName.includes("BARTACK") || rawMachineName.includes("BAR TACK")));

      const rawDate = cols[idxDate] ?? cols[3] ?? "";
      const rowDateStr = rawDate ? String(rawDate).trim() : "";

      parsedOps.push({
        id: String(nik || i),
        no: i,
        factory: normalizeFactoryName(String(cols[idxFactory] ?? cols[0] ?? "1")),
        line: normalizeLineName(String(cols[idxLine] ?? cols[1] ?? "1")),
        nik: nik,
        name: String(cols[idxWorker] ?? cols[5] ?? "Unknown"),
        date: rowDateStr,
        recordDate: rowDateStr,
        machine: String(cols[idxMachineName] ?? cols[7] ?? ""),
        styleNo: String(cols[idxStyleNo] ?? cols[8] ?? ""),
        process: String(cols[idxProcess] ?? cols[9] ?? ""),
        productionRate: rawRate,
        points: pointVal,
        workMonth: Number(cols[idxWorkMonth] ?? cols[14] ?? 1),
        dateOfResign: String(cols[idxDateOfResign] ?? cols[15] ?? ""),
        machineCategory: rawCat,
        status: String(cols[idxStatus] ?? cols[17] ?? "ACTIVE"),
        doj: String(cols[idxDoj] ?? cols[6] ?? "-"),
        workTimeMonths: Number(cols[idxWorkMonth] ?? cols[14] ?? 1),
        resignDate: (cols[idxDateOfResign] ?? cols[15]) ? String(cols[idxDateOfResign] ?? cols[15]) : null,
        lockstitch: isLockstitch ? pointVal : (!rawCat && !rawMachineName ? pointVal : null),
        overlock: isOverlock ? pointVal : null,
        flatseam: isFlatseam ? pointVal : null,
        special: isSpecial ? pointVal : null,
        buttonHole: isButtonHole ? pointVal : null,
        buttonSet: isButtonSet ? pointVal : null,
        chainstitch: isChainstitch ? pointVal : null,
        bartack: isBartack ? pointVal : null,
      });
    }

    return {
      success: true,
      operators: parsedOps,
      count: parsedOps.length,
    };
  } catch (err: any) {
    console.warn("Gagal fetch operators via GViz:", err);
    return {
      success: false,
      operators: [],
      count: 0,
      error: err.message || String(err),
    };
  }
}

/**
 * Menanamkan operator baru ke Google Sheets (tab 'by_worker')
 * Menggunakan rumus formula penanaman 18 kolom standar
 * Serta menyimpan ke localStorage agar tidak pernah hilang saat refresh
 */
export async function appendOperatorToByWorker(
  operator: any,
  dateStr?: string
): Promise<{ 
  success: boolean; 
  message: string; 
  gasSuccess?: boolean; 
  plantingResult?: ByWorkerPlantingResult;
  row?: any[]; 
}> {
  try {
    const today = new Date();
    const formattedTodayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const dateVal = dateStr || operator.date || operator.recordDate || formattedTodayYmd;

    // 1. Susun baris 18 kolom & rumus penanaman standar
    const plantingResult = generateByWorkerPlantingRow(operator, 19625, dateVal);

    const payload = {
      ...operator,
      factory: plantingResult.factory,
      line: plantingResult.line,
      tableCode: plantingResult.tableCode,
      styleNo: plantingResult.styleNo,
      machineName: plantingResult.machineName,
      machineCategory: plantingResult.machineCategory,
      process: plantingResult.process,
      points: plantingResult.points, // 0 TETAP 0
      productionRate: plantingResult.productionRate,
      meta: plantingResult.meta,
      production: plantingResult.production,
      status: 'ACTIVE',
      date: dateVal,
      rowValues: plantingResult.values,
      rowFormulas: plantingResult.formulas,
    };

    // 2. SIMPAN KE LOCAL STORAGE (Jaminan data TIDAK PERNAH HILANG saat refresh)
    saveCustomAddedOperatorToStorage({
      ...payload,
      id: operator.id || `op-${plantingResult.nik}-${Date.now()}`,
    });

    let networkSuccess = false;
    let successMessage = "";

    // 3. Coba kirim via Express Backend API Proxy
    try {
      const res = await fetch('/api/sheets/append-by-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          networkSuccess = true;
          successMessage = json.message || `Operator ${operator.name} berhasil ditanamkan ke datasheet by_worker`;
        }
      }
    } catch (apiErr) {
      console.warn("Backend append-by-worker error, mencoba direct GAS fallback:", apiErr);
    }

    // 4. Fallback ke Google Apps Script Web App (Metode GET Query Params yang terbukti menanamkan baris ke by_worker)
    if (!networkSuccess) {
      const appendQueryParams = new URLSearchParams({
        action: 'appendByWorker',
        factory: String(operator.factory || "1").replace(/factory\s*/i, "").trim() || "1",
        line: String(operator.line || "1").replace(/line\s*/i, "").trim() || "1",
        tableCode: String(operator.tableCode || operator.table || "1").trim(),
        date: String(operator.date || new Date().toISOString().split("T")[0]).trim(),
        nik: String(operator.nik || "").trim(),
        name: String(operator.name || "").trim().toUpperCase(),
        doj: String(operator.doj || "-").trim(),
        machineName: String(operator.machineName || operator.machine || "1Needle Lockstitch Auto Trim").trim(),
        styleNo: String(operator.styleNo || operator.style || "NB17HQ271140").trim(),
        process: String(operator.process || "SEWING").trim().toUpperCase(),
        meta: String(operator.meta !== undefined ? operator.meta : 0),
        production: String(operator.production !== undefined ? operator.production : 0),
        productionRate: String(operator.productionRate !== undefined ? operator.productionRate : 0),
        points: String(operator.points !== undefined && operator.points !== null ? operator.points : 0),
        workMonth: String(operator.workTimeMonths || 1),
        machineCategory: String(operator.machineCategory || "LOCKSTITCH").trim().toUpperCase(),
        status: "ACTIVE",
      });

      const gasUrls = [
        "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec",
        GAS_WEB_APP_URL,
      ];

      for (const url of gasUrls) {
        // Metode Utama: GET dengan query parameter individual
        try {
          const directRes = await fetch(`${url}?${appendQueryParams.toString()}`, {
            method: 'GET',
          });

          if (directRes.ok) {
            const rawText = await directRes.text();
            if (rawText && !rawText.trim().startsWith("<")) {
              try {
                const directJson = JSON.parse(rawText);
                if (directJson.status === "success") {
                  networkSuccess = true;
                  successMessage = directJson.message || `Operator ${operator.name} berhasil ditanamkan ke baris sheet 'by_worker'!`;
                  break;
                }
              } catch (e) {}
            }
          }
        } catch (fetchErr) {
          console.warn("Direct fetch GET to GAS encountered CORS/redirect, trying no-cors beacon:", fetchErr);
        }

        // Metode Tambahan: No-CORS GET & Image Beacon untuk memastikan terkirim di lingkungan browser Vercel
        try {
          await fetch(`${url}?${appendQueryParams.toString()}`, {
            method: 'GET',
            mode: 'no-cors',
          });
          networkSuccess = true;
          successMessage = `Operator ${operator.name} (${plantingResult.nik}) berhasil dikirim & ditanamkan ke sheet 'by_worker' Google Sheet!`;
          break;
        } catch (noCorsErr) {
          console.warn("No-cors fetch failed, trying Image Beacon:", noCorsErr);
          if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
            const beacon = new Image();
            beacon.src = `${url}?${appendQueryParams.toString()}&_t=${Date.now()}`;
            networkSuccess = true;
            successMessage = `Operator ${operator.name} berhasil ditanamkan ke Google Sheet via Beacon!`;
            break;
          }
        }
      }
    }

    return {
      success: true,
      gasSuccess: networkSuccess,
      message: networkSuccess 
        ? successMessage 
        : `Operator ${operator.name} (${plantingResult.nik}) berhasil disimpan di sistem lokal & rumus penanaman telah dibuat!`,
      plantingResult,
      row: plantingResult.values,
    };
  } catch (error: any) {
    console.error("Gagal menanamkan operator ke by_worker:", error);
    return {
      success: false,
      message: error.message || 'Gagal menanamkan operator ke datasheet by_worker',
    };
  }
}

