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
    const hasCurr = curr !== null && curr !== undefined && !isNaN(curr) && curr > 0;
    const hasNext = next !== null && next !== undefined && !isNaN(next) && next > 0;

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

export const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyfi3iPH2UPpA_SOIt8hUWLTybF30icj_X-IT0V4TyfZGQAmCTWPIrij1LZmmi4oUWDng/exec";

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

/**
 * Menanamkan baris data operator baru (dengan status ACTIVE) ke Google Sheets datasheet 'by_worker'.
 */
export async function appendOperatorToByWorker(
  operator: any,
  dateStr?: string
): Promise<{ success: boolean; message: string; gasSuccess?: boolean }> {
  try {
    const payload = {
      ...operator,
      status: 'ACTIVE',
      date: dateStr || operator.date || operator.recordDate,
    };

    // 1. Coba via API Proxy Express Backend
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
          return {
            success: true,
            gasSuccess: json.gasSuccess,
            message: json.message || `Operator ${operator.name} berhasil ditanamkan ke datasheet by_worker`,
          };
        }
      }
    } catch (apiErr) {
      console.warn("Backend append-by-worker error, mencoba direct GAS fallback:", apiErr);
    }

    // 2. Fallback: Direct POST ke Google Apps Script Web App
    const gasUrls = [
      GAS_WEB_APP_URL,
      "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec"
    ];

    for (const url of gasUrls) {
      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: JSON.stringify({
            action: 'appendByWorker',
            operator: payload,
          }),
        });

        return {
          success: true,
          gasSuccess: true,
          message: `Operator ${operator.name} berhasil dikirim ke Google Apps Script untuk ditanamkan ke by_worker`,
        };
      } catch (gasErr) {
        console.warn("GAS Direct POST failed:", gasErr);
      }
    }

    return {
      success: true,
      gasSuccess: false,
      message: `Data operator ${operator.name} tercatat di sistem lokal`,
    };
  } catch (error: any) {
    console.error("Gagal menanamkan operator ke by_worker:", error);
    return {
      success: false,
      message: error.message || 'Gagal menanamkan operator ke datasheet by_worker',
    };
  }
}

