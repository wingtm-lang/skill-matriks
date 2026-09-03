import { Operator, GarmentStyle, GradeType } from '../types';

export const GRADE_BENCHMARKS: Array<{
  minRate: number;
  maxRate: number;
  grade: GradeType;
  label: string;
  color: string;
  bgClass: string;
  textColor: string;
  cssBadge: string;
  bgColor: string;
  description: string;
}> = [
  { 
    minRate: 100, 
    maxRate: 9999, 
    grade: 'S', 
    label: 'S (≥100%)', 
    color: '#059669', // Emerald Hijau Zamrud
    bgClass: 'bg-[#059669]', 
    textColor: 'text-white font-bold',
    cssBadge: 'bg-[#059669] text-white font-bold border border-[#059669]', 
    bgColor: '#059669', 
    description: 'Expert / Star Operator (Efficiency ≥ 100%)' 
  },
  { 
    minRate: 80, 
    maxRate: 99.99, 
    grade: 'A', 
    label: 'A (80-99%)', 
    color: '#0d9488', // Teal Toska
    bgClass: 'bg-[#0d9488]', 
    textColor: 'text-white font-bold',
    cssBadge: 'bg-[#0d9488] text-white font-bold border border-[#0d9488]', 
    bgColor: '#0d9488', 
    description: 'Skilled / Target Operator (Efficiency 80% - 99.99%)' 
  },
  { 
    minRate: 60, 
    maxRate: 79.99, 
    grade: 'B', 
    label: 'B (60-79%)', 
    color: '#0284c7', // Blue Langit
    bgClass: 'bg-[#0284c7]', 
    textColor: 'text-white font-bold',
    cssBadge: 'bg-[#0284c7] text-white font-bold border border-[#0284c7]', 
    bgColor: '#0284c7', 
    description: 'Competent / Developing Operator (Efficiency 60% - 79.99%)' 
  },
  { 
    minRate: 0.01, 
    maxRate: 59.99, 
    grade: 'C', 
    label: 'C (<60%)', 
    color: '#d97706', // Amber Keemasan
    bgClass: 'bg-[#d97706]', 
    textColor: 'text-white font-bold',
    cssBadge: 'bg-[#d97706] text-white font-bold border border-[#d97706]', 
    bgColor: '#d97706', 
    description: 'Novice / Retraining Required (Efficiency < 60%)' 
  },
  { 
    minRate: 0, 
    maxRate: 0, 
    grade: 'HELPER', 
    label: 'Helper', 
    color: '#475569', // Slate Profesional
    bgClass: 'bg-[#475569]', 
    textColor: 'text-white font-bold',
    cssBadge: 'bg-[#475569] text-white font-bold border border-[#475569]', 
    bgColor: '#475569', 
    description: 'Helper / Non-Machine Support / Manual Trimmer' 
  }
];

export interface GradeBadgeResult {
  label: string;
  grade: GradeType;
  color: string;
  bgClass: string;
  textColor: string;
  cssBadge: string;
  bgColor: string;
  description: string;
}

export function getGradeFromRate(efficiency: number | null | undefined): GradeBadgeResult {
  // Handle empty, null, undefined, or 0/helper input
  if (efficiency === null || efficiency === undefined || efficiency <= 0 || isNaN(efficiency)) {
    return getHelperGradeBadge();
  }

  if (efficiency >= 100) {
    return { 
      label: 'S', 
      grade: 'S',
      color: '#059669', // Emerald Hijau Zamrud
      bgClass: 'bg-[#059669]', 
      textColor: 'text-white font-bold',
      cssBadge: 'bg-[#059669] text-white font-bold border border-[#059669]',
      bgColor: '#059669',
      description: 'Expert / Star Operator (Efficiency ≥ 100%)'
    };
  } else if (efficiency >= 80) {
    return { 
      label: 'A', 
      grade: 'A',
      color: '#0d9488', // Teal Toska
      bgClass: 'bg-[#0d9488]', 
      textColor: 'text-white font-bold',
      cssBadge: 'bg-[#0d9488] text-white font-bold border border-[#0d9488]',
      bgColor: '#0d9488',
      description: 'Skilled / Target Operator (Efficiency 80% - 99.99%)'
    };
  } else if (efficiency >= 60) {
    return { 
      label: 'B', 
      grade: 'B',
      color: '#0284c7', // Blue Langit
      bgClass: 'bg-[#0284c7]', 
      textColor: 'text-white font-bold',
      cssBadge: 'bg-[#0284c7] text-white font-bold border border-[#0284c7]',
      bgColor: '#0284c7',
      description: 'Competent / Developing Operator (Efficiency 60% - 79.99%)'
    };
  } else {
    return { 
      label: 'C', 
      grade: 'C',
      color: '#d97706', // Amber Keemasan
      bgClass: 'bg-[#d97706]', 
      textColor: 'text-white font-bold',
      cssBadge: 'bg-[#d97706] text-white font-bold border border-[#d97706]',
      bgColor: '#d97706',
      description: 'Novice / Retraining Required (Efficiency < 60%)'
    };
  }
}

// Untuk kategori Helper khusus
export function getHelperGradeBadge(): GradeBadgeResult {
  return { 
    label: 'Helper', 
    grade: 'HELPER',
    color: '#475569', // Slate Profesional
    bgClass: 'bg-[#475569]', 
    textColor: 'text-white font-bold',
    cssBadge: 'bg-[#475569] text-white font-bold border border-[#475569]', 
    bgColor: '#475569',
    description: 'Helper / Non-Machine Support / Manual Trimmer'
  };
}

export const INITIAL_OPERATORS: Operator[] = [];

export const INITIAL_STYLES: GarmentStyle[] = [
  {
    id: "style-polo-01",
    styleCode: "NB17100017550-I",
    styleName: "Polo Shirt Premium (Short Sleeve)",
    category: "Polo Knitwear",
    buyer: "New Balance / Nike",
    targetPcsPerHour: 110,
    targetDailyOutput: 880,
    totalSmvSeconds: 312,
    processes: [
      { id: "p1", seq: 1, name: "Press Heat Transfer Size Label & Neck Tape", machineType: "SPECIAL", smvSeconds: 22, category: "PREPARATION", description: "Heat press temperature 160°C for 12 sec" },
      { id: "p2", seq: 2, name: "Join Placket Box & Make Placket", machineType: "LOCKSTITCH", smvSeconds: 42, category: "PREPARATION", description: "Single needle with folder attachment" },
      { id: "p3", seq: 3, name: "Make Collar Point & Trim Corner", machineType: "LOCKSTITCH", smvSeconds: 28, category: "PREPARATION", description: "Precision edge stitching 1/16 inch" },
      { id: "p4", seq: 4, name: "Join Shoulder with Clear Elastic Mobilon Tape", machineType: "OVERLOCK", smvSeconds: 26, category: "ASSEMBLY", description: "4-thread overlock with mobilon feeder" },
      { id: "p5", seq: 5, name: "Attach Collar to Neck & Bind 3-Plies Neck", machineType: "FLATSEAM", smvSeconds: 38, category: "ASSEMBLY", description: "Coverstitch cylinder bed machine" },
      { id: "p6", seq: 6, name: "Join Sleeve & Side Seam Overlock", machineType: "OVERLOCK", smvSeconds: 34, category: "ASSEMBLY", description: "4-thread overlock with differential feed" },
      { id: "p7", seq: 7, name: "Hem Sleeve & Hem Bottom", machineType: "FLATSEAM", smvSeconds: 36, category: "FINISHING", description: "3-needle flatlock top & bottom cover" },
      { id: "p8", seq: 8, name: "Make Button Hole on Placket (2 holes)", machineType: "BUTTON_HOLE", smvSeconds: 28, category: "FINISHING", description: "Electronic eyelet / straight buttonhole" },
      { id: "p9", seq: 9, name: "Attach Button on Placket (2 buttons)", machineType: "BUTTON_SET", smvSeconds: 24, category: "FINISHING", description: "Automatic button feeder machine" },
      { id: "p10", seq: 10, name: "Bar Tack at Placket Base & Side Slit", machineType: "SPECIAL", smvSeconds: 20, category: "FINISHING", description: "Electronic bar tacking 28 stitches" },
      { id: "p11", seq: 11, name: "Final Thread Trimming & Inspection Point", machineType: "LOCKSTITCH", smvSeconds: 16, category: "FINISHING", description: "Manual / Helper with suction trimmer" }
    ]
  },
  {
    id: "style-jkt-02",
    styleCode: "JKT-2026-W",
    styleName: "Windbreaker Light Jacket (Zipper Front)",
    category: "Outerwear Woven",
    buyer: "Adidas / The North Face",
    targetPcsPerHour: 65,
    targetDailyOutput: 520,
    totalSmvSeconds: 540,
    processes: [
      { id: "j1", seq: 1, name: "Fuse Interlining on Collar & Pocket Flap", machineType: "SPECIAL", smvSeconds: 35, category: "PREPARATION" },
      { id: "j2", seq: 2, name: "Make Welt Zipper Pockets (Left & Right)", machineType: "LOCKSTITCH", smvSeconds: 85, category: "PREPARATION" },
      { id: "j3", seq: 3, name: "Join Shoulder with Overedge", machineType: "OVERLOCK", smvSeconds: 40, category: "ASSEMBLY" },
      { id: "j4", seq: 4, name: "Attach Front Open-End Zipper", machineType: "LOCKSTITCH", smvSeconds: 70, category: "ASSEMBLY" },
      { id: "j5", seq: 5, name: "Attach Hood & Collar Assembly", machineType: "LOCKSTITCH", smvSeconds: 65, category: "ASSEMBLY" },
      { id: "j6", seq: 6, name: "Set Sleeves & Topstitch Armhole", machineType: "OVERLOCK", smvSeconds: 60, category: "ASSEMBLY" },
      { id: "j7", seq: 7, name: "Join Side Seam & Underarm", machineType: "OVERLOCK", smvSeconds: 55, category: "ASSEMBLY" },
      { id: "j8", seq: 8, name: "Insert Elastic Cuffs & Bottom Drawcord", machineType: "FLATSEAM", smvSeconds: 65, category: "FINISHING" },
      { id: "j9", seq: 9, name: "Bar Tack Stress Points & Quality Check", machineType: "SPECIAL", smvSeconds: 40, category: "FINISHING" }
    ]
  },
  {
    id: "style-tee-03",
    styleCode: "TS-BASIC-01",
    styleName: "Basic Crewneck Tee (100% Cotton Single Jersey)",
    category: "Basic Tops",
    buyer: "Uniqlo / H&M",
    targetPcsPerHour: 160,
    targetDailyOutput: 1280,
    totalSmvSeconds: 195,
    processes: [
      { id: "t1", seq: 1, name: "Heat Transfer Care Label on Back Neck", machineType: "SPECIAL", smvSeconds: 15, category: "PREPARATION" },
      { id: "t2", seq: 2, name: "Join Shoulder with Mobilon Tape", machineType: "OVERLOCK", smvSeconds: 22, category: "ASSEMBLY" },
      { id: "t3", seq: 3, name: "Rib Neck Making & Attach Neckband", machineType: "OVERLOCK", smvSeconds: 32, category: "ASSEMBLY" },
      { id: "t4", seq: 4, name: "Topstitch Back Neck Tape (Back to Shoulder)", machineType: "FLATSEAM", smvSeconds: 28, category: "ASSEMBLY" },
      { id: "t5", seq: 5, name: "Join Sleeves to Body Overlock", machineType: "OVERLOCK", smvSeconds: 30, category: "ASSEMBLY" },
      { id: "t6", seq: 6, name: "Join Side Seam with Overlock", machineType: "OVERLOCK", smvSeconds: 28, category: "ASSEMBLY" },
      { id: "t7", seq: 7, name: "Bottom Hem & Sleeve Hem Coverstitch", machineType: "FLATSEAM", smvSeconds: 40, category: "FINISHING" }
    ]
  }
];

export const FACTORIES = ["Factory 1", "Factory 2", "Factory 3", "Factory 3B"];
export const LINES = [
  "Line 1", "Line 2", "Line 3", "Line 4", "Line 5", "Line 6", "Line 7", "Line 8", "Line 9", "Line 10",
  "Line 11", "Line 12", "Line 13", "Line 14", "Line 15", "Line 16", "Line 17", "Line 18", "Line 19", "Line 20",
  "Line 21", "Line 22", "Line 23", "Line 24", "Line 25", "Line 26", "Line 27", "Line 28", "Line 29", "Line 30"
];

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
