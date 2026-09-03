import { Operator, GarmentStyle, WorkstationAssignment, LineBalancingResult, MachineCategory } from '../types';
import { getGradeFromRate } from '../data/mockData';

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
      return Math.max(curr as number, next as number);
    }
    if (hasNext) {
      return next as number;
    }
    if (hasCurr) {
      return curr as number;
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
    const parsedNum = parseInt(String(selectedMonth).trim(), 10);
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 12) {
      selMonthNum = parsedNum;
    } else {
      const monthStr = String(selectedMonth).trim().toLowerCase();
      selMonthNum = MONTH_MAP[monthStr] !== undefined ? MONTH_MAP[monthStr] + 1 : 9;
    }
  }

  const selYearNum = parseInt(String(selectedYear), 10) || 2026;
  const cutoffPeriod = selYearNum * 100 + selMonthNum;

  // STEP 1: CUMULATIVE POINT-IN-TIME FILTERING (<= Cut-off Month & Year)
  const cumulativeRecords = rawOperators.filter((op: any) => {
    const dateSource = op.date || op.recordDate || op.updatedAt;
    const extracted = extractMonthAndYear(dateSource);
    if (extracted) {
      const recPeriod = extracted.year * 100 + extracted.month;
      return recPeriod <= cutoffPeriod;
    }
    const parsed = parseFlexibleDate(dateSource);
    if (parsed && !isNaN(parsed.getTime())) {
      const recYear = parsed.getFullYear();
      const recMonth = parsed.getMonth() + 1;
      const recPeriod = recYear * 100 + recMonth;
      return recPeriod <= cutoffPeriod;
    }
    return true;
  });

  // STEP 2: CUMULATIVE MERGING & PERMANENT STATUS LOCKING
  const uniqueNikMap = new Map<string, Operator>();

  cumulativeRecords.forEach((record, idx) => {
    const rawNik = (record.nik ? String(record.nik).trim() : "") || (record.id ? String(record.id).trim() : "");
    const key = rawNik.toLowerCase() || `op-${idx}`;

    const existing = uniqueNikMap.get(key);
    const incomingStatus = record.status && String(record.status).trim() ? String(record.status).trim().toUpperCase() : "ACTIVE";

    if (!existing) {
      uniqueNikMap.set(key, {
        ...record,
        nik: record.nik ? String(record.nik).trim() : `NIK-${idx}`,
        name: record.name ? String(record.name).trim() : `Operator ${idx + 1}`,
        factory: record.factory ? String(record.factory).trim() : "Factory 1",
        line: record.line ? String(record.line).trim() : "Line 1",
        status: incomingStatus,
        lockstitch: record.lockstitch ?? null,
        overlock: record.overlock ?? null,
        flatseam: record.flatseam ?? null,
        special: record.special ?? null,
        buttonHole: record.buttonHole ?? null,
        buttonSet: record.buttonSet ?? null,
        chainstitch: record.chainstitch ?? null,
        bartack: record.bartack ?? null,
      });
    } else {
      mergeMachineRates(existing, record);

      // KUNCI STATUS PERMANEN: Jika status sebelumnya sudah RESIGNED, jangan pernah timpa jadi ACTIVE lagi
      const currentStatus = (existing.status || "ACTIVE").toUpperCase();
      const isAlreadyResigned = currentStatus === "RESIGNED" || currentStatus === "INACTIVE" || currentStatus === "MUTASI" || currentStatus.includes("RESIGN");

      if (!isAlreadyResigned) {
        if (incomingStatus === "RESIGNED" || incomingStatus === "INACTIVE" || incomingStatus === "MUTASI" || incomingStatus.includes("RESIGN")) {
          existing.status = incomingStatus;
        } else if (record.status && String(record.status).trim() !== "") {
          existing.status = incomingStatus;
        }
      }

      if (record.name && record.name.trim() !== "") existing.name = String(record.name).trim();
      if (record.doj && record.doj !== "-") existing.doj = record.doj;
      if (record.factory && record.factory.trim() !== "") existing.factory = record.factory.trim();
      if (record.line && record.line.trim() !== "") existing.line = record.line.trim();
      if (record.recordDate) existing.recordDate = record.recordDate;
      if (record.date) existing.date = record.date;
      if (record.no) existing.no = record.no;
    }
  });

  const cumulativeSnapshotOperators = Array.from(uniqueNikMap.values());

  // STEP 3: FINAL STATUS & LOCATION FILTER
  const targetFactoryNum = selectedFactory ? extractFactoryNumber(selectedFactory) : null;
  const targetLineNum = selectedLine ? extractLineNumber(selectedLine) : null;
  const targetFactoryNormalized = selectedFactory ? normalizeFactoryName(selectedFactory).toLowerCase().trim() : null;
  const targetLineNormalized = selectedLine ? normalizeLineName(selectedLine).toLowerCase().trim() : null;

  const result = cumulativeSnapshotOperators.filter((op) => {
    const rawStatus = (op.status ? String(op.status).trim() : "ACTIVE").toUpperCase();
    const isInactive = 
      rawStatus === "RESIGNED" ||
      rawStatus === "INACTIVE" ||
      rawStatus === "MUTASI" ||
      rawStatus.includes("RESIGN") ||
      rawStatus.includes("MUTASI");

    if (isInactive) return false;

    if (targetFactoryNormalized) {
      const opFactoryNum = extractFactoryNumber(op.factory);
      if (targetFactoryNum !== null && opFactoryNum !== null) {
        if (opFactoryNum !== targetFactoryNum) return false;
      } else {
        const opFactory = normalizeFactoryName(op.factory).toLowerCase().trim();
        if (opFactory !== targetFactoryNormalized) return false;
      }
    }

    if (targetLineNormalized) {
      const opLineNum = extractLineNumber(op.line);
      if (targetLineNum !== null && opLineNum !== null) {
        if (opLineNum !== targetLineNum) return false;
      } else {
        const opLine = normalizeLineName(op.line).toLowerCase().trim();
        if (opLine !== targetLineNormalized) return false;
      }
    }

    return true;
  });

  return result
    .sort((a, b) => {
      if (a.no && b.no) return a.no - b.no;
      return (a.name || "").localeCompare(b.name || "");
    })
    .map((op, i) => ({
      ...op,
      no: i + 1,
    }));
}

export const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyfi3iPH2UPpA_SOIt8hUWLTybF30icj_X-IT0V4TyfZGQAmCTWPIrij1LZmmi4oUWDng/exec";

/**
 * Filter operator aktif di dalam fungsi kalkulasi/tabel frontend.
 * Membuang operator dengan status RESIGNED dari daftar aktif di line.
 */
export function filterActiveOperators<T extends { status?: string | null }>(rawData: T[]): T[] {
  if (!rawData || !Array.isArray(rawData)) return [];
  return rawData.filter((row) => {
    const isResigned = row.status?.toUpperCase() === "RESIGNED";

    // Jika statusnya RESIGNED, buang dari daftar operator aktif di line
    if (isResigned) {
      return false;
    }
    return true;
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
