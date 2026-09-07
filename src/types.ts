export type GradeType = 
  | 'S' 
  | 'A' 
  | 'B' 
  | 'C' 
  | 'HELPER'
  | 'S+' | 'A+' | 'B+' | 'C+' | 'D+' | 'D' | 'E+' | 'E' | 'F';

export type MachineCategory = 
  | 'LOCKSTITCH' 
  | 'OVERLOCK' 
  | 'FLATSEAM' 
  | 'SPECIAL' 
  | 'BUTTON_HOLE' 
  | 'BUTTON_SET' 
  | 'CHAINSTITCH' 
  | 'BARTACK';

export interface RawSheetRow {
  factory: string;
  line: string;
  date: string;
  nik: string;
  name: string;
  [key: string]: any;
}

export interface Operator {
  id: string;
  no: number;
  nik: string;
  name: string;
  doj: string; // Date of joining
  workTimeMonths: number;
  factory: string;
  line: string;
  recordDate?: string; // Date of this record / skill assessment (Format: YYYY-MM-DD or DD-MM-YYYY)
  date?: string; // Alias for recordDate / assessment date from spreadsheet
  updatedAt?: string; // Timestamp of record update
  status?: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'RESIGNED' | string; // Operational status at recordDate
  grade?: GradeType | string; // Calculated or assigned grade (S, A, B, C, HELPER)
  resignDate?: string | null; // Date of resignation if applicable
  transferDate?: string | null; // Date of transfer to another line/factory if applicable
  
  // Google Sheets by_worker direct columns
  machine?: string; // Kolom H: Machine
  styleNo?: string; // Kolom I: Style No
  process?: string; // Kolom J: Process
  productionRate?: number; // Kolom M: Production Rate (%)
  points?: number; // Kolom N: POINT (langsung dari Sheets)
  workMonth?: number; // Kolom O: Work Month (langsung dari Sheets)
  dateOfResign?: string; // Kolom P: Date of Resign
  machineCategory?: string; // Kolom Q: Machine Category

  // Efficiency rate in % for each machine type (null if not tested/no competency)
  lockstitch: number | null;
  overlock: number | null;
  flatseam: number | null;
  special: number | null;
  buttonHole: number | null;
  buttonSet: number | null;
  chainstitch?: number | null;
  bartack?: number | null;
  notes?: string;
  avatarUrl?: string;
}

export interface MachineSkillSummary {
  category: MachineCategory;
  name: string;
  rate: number | null;
  grade: GradeType;
}

export interface OperationProcess {
  id: string;
  seq: number;
  name: string;
  machineType: MachineCategory;
  smvSeconds: number; // Standard Allowed Minutes in seconds (SAM/SMV)
  description?: string;
  category: 'PREPARATION' | 'ASSEMBLY' | 'FINISHING';
}

export interface GarmentStyle {
  id: string;
  styleCode: string;
  styleName: string;
  category: string;
  buyer: string;
  targetPcsPerHour: number;
  targetDailyOutput: number;
  totalSmvSeconds: number;
  processes: OperationProcess[];
  thumbnail?: string;
}

export interface WorkstationAssignment {
  stationNumber: number;
  process: OperationProcess;
  assignedOperator: Operator | null;
  operatorEfficiency: number; // in %
  actualCycleTime: number; // smv / (eff / 100)
  pitchTime: number;
  isBottleneck: boolean;
  backupOperator?: Operator | null;
  helperAssigned?: boolean;
  notes?: string;
}

export interface LineBalancingResult {
  styleId: string;
  styleName: string;
  line: string;
  pitchTime: number; // in seconds
  taktTime: number; // in seconds
  totalSmv: number; // in seconds
  totalManpower: number;
  lineEfficiency: number; // in %
  balanceDelay: number; // in %
  smoothnessIndex: number;
  bottleneckCycleTime: number; // max station time
  projectedOutputPerHour: number;
  projectedDailyOutput: number;
  assignments: WorkstationAssignment[];
  aiRecommendations: {
    overallAnalysis: string;
    bottleneckAlerts: Array<{
      stationNumber: number;
      processName: string;
      reason: string;
      recommendedAction: string;
      suggestedHelperOrBackup: string;
    }>;
    multiskillUtilizationScore: number; // 0-100
    leanKaizenTips: string[];
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface RetrainingCandidate {
  operatorId: string;
  operatorName: string;
  nik: string;
  currentPrimarySkill: string;
  currentGrade: GradeType;
  recommendedTargetMachine: MachineCategory;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string;
  targetWeeks: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
}
