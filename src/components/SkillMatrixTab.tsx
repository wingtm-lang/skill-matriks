import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Download, 
  Sparkles, 
  Edit3, 
  Award, 
  User, 
  CheckCircle2, 
  X,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  Flame,
  Star,
  UserX,
  AlertCircle,
  Loader2,
  Info,
  Lock,
  Database,
  FileSpreadsheet,
  ExternalLink,
  HelpCircle,
  Table
} from 'lucide-react';
import { Operator, GradeType, MachineCategory } from '../types';
import { 
  getOperatorMultiSkillCount, 
  getOperatorAvgRate, 
  setOperatorResigned, 
  getGradeFromTotalPoints, 
  getOperatorTotalPoints,
  isOperatorResignedAtPeriod,
  calculateWorkTimeMonths,
  appendOperatorToByWorker
} from '../utils/ieCalculations';
import { getGradeFromRate, GRADE_BENCHMARKS } from '../data/mockData';
import { useLanguage } from '../i18n/LanguageContext';

const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '-';
  // Ambil bagian depannya saja sebelum huruf 'T' (YYYY-MM-DD)
  const cleanDate = dateString.split('T')[0];
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const monthsName = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthStr = monthsName[parseInt(month, 10) - 1] || month;
    return `${day} ${monthStr} ${year}`;
  }
  return cleanDate;
};

interface SkillMatrixTabProps {
  operators: Operator[];
  onAddOperator: (operator: Operator) => void;
  onUpdateOperator: (operator: Operator) => void;
  onDeleteOperator: (id: string) => void;
  userRole: 'VIEWER' | 'EDITOR' | 'ADMIN';
  selectedLine: string;
  selectedFactory: string;
  selectedMonth?: number;
  selectedYear?: number;
}

export const SkillMatrixTab: React.FC<SkillMatrixTabProps> = ({
  operators,
  onAddOperator,
  onUpdateOperator,
  onDeleteOperator,
  userRole,
  selectedLine,
  selectedFactory,
  selectedMonth = 9,
  selectedYear = 2026,
}) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [machineFilter, setMachineFilter] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [multiskillOnly, setMultiskillOnly] = useState(false);
  const [sortField, setSortField] = useState<'no' | 'name' | 'avgRate' | 'workTime' | 'multiskill'>('no');
  const [sortAsc, setSortAsc] = useState(true);

  // Modals state
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPointInfoOpen, setIsPointInfoOpen] = useState(false);

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<Operator>>({});

  // Date of Join lookup state (Khusus Modal Tambah Operator)
  const [isSearchingDoj, setIsSearchingDoj] = useState<boolean>(false);
  const [dojLookupStatus, setDojLookupStatus] = useState<'idle' | 'found' | 'not_found' | 'error'>('idle');
  const [dojLookupMessage, setDojLookupMessage] = useState<string>('');

  // Resign modal state
  const [resignTargetOp, setResignTargetOp] = useState<Operator | null>(null);
  const [isResigning, setIsResigning] = useState(false);
  const [resignToast, setResignToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // State untuk penanaman ke datasheet by_worker
  const [plantToByWorker, setPlantToByWorker] = useState<boolean>(true);
  const [isPlanting, setIsPlanting] = useState<boolean>(false);
  const [plantToast, setPlantToast] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);

  const handleConfirmResign = async () => {
    if (!resignTargetOp) return;
    setIsResigning(true);
    try {
      const success = await setOperatorResigned(
        resignTargetOp.nik,
        resignTargetOp.name,
        resignTargetOp.factory,
        resignTargetOp.line,
        selectedMonth,
        selectedYear
      );

      if (success) {
        onUpdateOperator({
          ...resignTargetOp,
          status: 'RESIGNED',
          resignDate: `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
        });
        setResignToast({
          type: 'success',
          message: `${t.matrix.resignSuccess} ${resignTargetOp.name} (${resignTargetOp.nik})`
        });
      } else {
        setResignToast({
          type: 'error',
          message: t.matrix.resignFailed
        });
      }
    } catch (err) {
      setResignToast({
        type: 'error',
        message: t.matrix.resignFailed
      });
    } finally {
      setIsResigning(false);
      setResignTargetOp(null);
    }
  };

  // Filter and Sort operators
  const filteredOperators = useMemo(() => {
    return operators
      .filter((op) => {
        // Cek apakah operator sudah resign sebelum periode bulan yang dipilih
        // Jika operator baru resign di bulan Maret, maka di bulan Januari & Februari tetap tampil aktif
        const isResigned = isOperatorResignedAtPeriod(op, selectedMonth, selectedYear);
        if (isResigned) {
          return false;
        }

        // 3. Pencarian berdasarkan nama atau NIK
        const matchesSearch =
          op.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          op.nik.includes(searchTerm);
        if (!matchesSearch) return false;

        // Filter Kategori Mesin
        if (machineFilter === 'LOCKSTITCH' && (op.lockstitch ?? 0) <= 0) return false;
        if (machineFilter === 'OVERLOCK' && (op.overlock ?? 0) <= 0) return false;
        if (machineFilter === 'FLATSEAM' && (op.flatseam ?? 0) <= 0) return false;
        if (machineFilter === 'SPECIAL' && (op.special ?? 0) <= 0) return false;
        if (machineFilter === 'BUTTON_HOLE' && (op.buttonHole ?? 0) <= 0) return false;
        if (machineFilter === 'BUTTON_SET' && (op.buttonSet ?? 0) <= 0) return false;

        // Multiskill filter
        if (multiskillOnly && getOperatorMultiSkillCount(op) < 2) return false;

        // Filter Grade
        if (selectedGrade !== 'ALL') {
          const totalPts = getOperatorTotalPoints(op);
          const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
          const g = getGradeFromTotalPoints(totalPts, isHelper);
          const opGrade = (op as any).grade || g.grade;
          if (opGrade !== selectedGrade) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Logika sorting tetap
        let valA: any = a.no;
        let valB: any = b.no;
        if (sortField === 'name') { valA = a.name; valB = b.name; }
        else if (sortField === 'avgRate') { valA = getOperatorTotalPoints(a); valB = getOperatorTotalPoints(b); }
        else if (sortField === 'workTime') { valA = a.workTimeMonths; valB = b.workTimeMonths; }
        else if (sortField === 'multiskill') { valA = getOperatorMultiSkillCount(a); valB = getOperatorMultiSkillCount(b); }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [operators, searchTerm, machineFilter, multiskillOnly, selectedGrade, sortField, sortAsc, selectedMonth, selectedYear]);

  // Hitung distribusi grade dari seluruh operator aktif di line
  const gradeCounts = useMemo(() => {
    const counts = { ALL: 0, S: 0, A: 0, B: 0, C: 0, HELPER: 0 };
    operators.forEach((op) => {
      const isResigned = isOperatorResignedAtPeriod(op, selectedMonth, selectedYear);
      if (isResigned) return;

      counts.ALL++;
      const totalPts = getOperatorTotalPoints(op);
      const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
      const g = getGradeFromTotalPoints(totalPts, isHelper);
      const opGrade = ((op as any).grade || g.grade) as keyof typeof counts;
      if (counts[opGrade] !== undefined) {
        counts[opGrade]++;
      }
    });
    return counts;
  }, [operators, selectedMonth, selectedYear]);

  const handleSort = (field: 'no' | 'name' | 'avgRate' | 'workTime' | 'multiskill') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleOpenEdit = (op: Operator) => {
    setSelectedOperator(op);
    setFormData({ ...op });
    setDojLookupStatus('idle');
    setDojLookupMessage('');
    setIsEditModalOpen(true);
  };

  // Lookup operator di sheet "date_of_join" berdasarkan NIK
  const handleLookupNik = async (nikToSearch: string) => {
    const cleanNik = String(nikToSearch || '').trim();
    if (!cleanNik) {
      setDojLookupStatus('idle');
      setDojLookupMessage('');
      setFormData(prev => ({ ...prev, nik: '', name: '', doj: '', workTimeMonths: 0 }));
      return;
    }

    setIsSearchingDoj(true);
    setDojLookupStatus('idle');
    setDojLookupMessage('');

    try {
      let foundRecord: { name: string; doj: string; workTimeMonths?: number; factory?: string; line?: string } | null = null;

      // 1. Coba baca dari backend endpoint /api/sheets/date-of-join
      try {
        const res = await fetch(`/api/sheets/date-of-join?nik=${encodeURIComponent(cleanNik)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.found && json.data) {
            foundRecord = {
              name: json.data.name,
              doj: json.data.doj,
              workTimeMonths: json.data.workTimeMonths ?? calculateWorkTimeMonths(json.data.doj),
              factory: json.data.factory,
              line: json.data.line
            };
          }
        }
      } catch (e) {
        console.warn('Backend lookup error:', e);
      }

      // 2. Fallback: Google Apps Script Web App
      if (!foundRecord) {
        try {
          const gasUrl = "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec";
          const res = await fetch(`${gasUrl}?action=lookupDateOfJoin&nik=${encodeURIComponent(cleanNik)}`);
          if (res.ok) {
            const json = await res.json();
            if (json.status === 'success' && json.data && json.data.name) {
              foundRecord = {
                name: json.data.name,
                doj: json.data.doj || '-',
                workTimeMonths: calculateWorkTimeMonths(json.data.doj)
              };
            }
          }
        } catch (e) {
          console.warn('GAS lookup error:', e);
        }
      }

      // 3. Fallback: Cek data operator yang sudah termuat di state
      if (!foundRecord) {
        const matchInOps = operators.find(o => o.nik && o.nik.trim().toUpperCase() === cleanNik.toUpperCase());
        if (matchInOps && matchInOps.name) {
          foundRecord = {
            name: matchInOps.name,
            doj: matchInOps.doj || '-',
            workTimeMonths: matchInOps.workTimeMonths || calculateWorkTimeMonths(matchInOps.doj),
            factory: matchInOps.factory,
            line: matchInOps.line
          };
        }
      }

      if (foundRecord) {
        const tenure = foundRecord.workTimeMonths ?? calculateWorkTimeMonths(foundRecord.doj);
        setFormData(prev => ({
          ...prev,
          nik: cleanNik,
          name: foundRecord!.name.toUpperCase(),
          doj: foundRecord!.doj || '-',
          workTimeMonths: tenure
        }));
        setDojLookupStatus('found');
        setDojLookupMessage(`Data valid: ${foundRecord.name} (DOJ: ${foundRecord.doj || '-'} • Masa Kerja: ${tenure} Bulan)`);
      } else {
        setFormData(prev => ({
          ...prev,
          nik: cleanNik,
          name: '',
          doj: '',
          workTimeMonths: 0
        }));
        setDojLookupStatus('not_found');
        setDojLookupMessage(`NIK "${cleanNik}" tidak ditemukan di sheet "date_of_join". Pastikan NIK terdaftar di master data.`);
      }
    } catch (err: any) {
      setDojLookupStatus('error');
      setDojLookupMessage('Gagal memeriksa data di sheet date_of_join.');
    } finally {
      setIsSearchingDoj(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      nik: '',
      name: '',
      doj: '',
      workTimeMonths: 0,
      factory: selectedFactory,
      line: selectedLine,
      lockstitch: null,
      overlock: null,
      flatseam: null,
      special: null,
      buttonHole: null,
      buttonSet: null,
    });
    setDojLookupStatus('idle');
    setDojLookupMessage('');
    setIsSearchingDoj(false);
    setIsAddModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nik) return;
    onUpdateOperator(formData as Operator);
    setIsEditModalOpen(false);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nik) return;
    if (dojLookupStatus !== 'found') {
      return;
    }

    setIsPlanting(true);

    const today = new Date();
    const formattedToday = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

    const newOp: Operator = {
      ...(formData as Operator),
      id: `op-${formData.nik}-${Date.now()}`,
      no: operators.length + 1,
      factory: selectedFactory,
      line: selectedLine,
      status: 'ACTIVE',
      date: formData.date || formattedToday,
      recordDate: formData.recordDate || formattedToday,
    };

    if (plantToByWorker) {
      try {
        const res = await appendOperatorToByWorker(newOp, formattedToday);
        if (res.success) {
          setPlantToast({
            type: 'success',
            message: `Operator ${newOp.name} (${newOp.nik}) dengan status ACTIVE berhasil ditanamkan ke datasheet by_worker!`,
          });
        } else {
          setPlantToast({
            type: 'warning',
            message: `Operator ditambahkan ke sistem. Status penanaman: ${res.message}`,
          });
        }
      } catch (err: any) {
        console.warn("Gagal menanamkan ke by_worker:", err);
        setPlantToast({
          type: 'warning',
          message: `Operator ditambahkan ke sistem lokal. Catatan sinkronisasi: ${err.message || 'Tertunda'}`,
        });
      }
    } else {
      setPlantToast({
        type: 'success',
        message: `Operator ${newOp.name} (${newOp.nik}) berhasil ditambahkan (Status: ACTIVE).`,
      });
    }

    setIsPlanting(false);
    onAddOperator(newOp);
    setIsAddModalOpen(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'No',
      'NIK',
      'Nama Operator',
      'Masa Kerja (Bulan)',
      'Lockstitch (Poin)',
      'Overlock (Poin)',
      'Flatseam (Poin)',
      'Special (Poin)',
      'Button Hole (Poin)',
      'Button Set (Poin)',
      'Multiskill Count',
      'Total Poin',
      'Grade'
    ];

    const rows = filteredOperators.map((op, idx) => {
      const totalPts = getOperatorTotalPoints(op);
      const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
      const grade = getGradeFromTotalPoints(totalPts, isHelper);
      return [
        idx + 1,
        `"${op.nik}"`,
        `"${op.name}"`,
        op.workTimeMonths,
        op.lockstitch ?? '-',
        op.overlock ?? '-',
        op.flatseam ?? '-',
        op.special ?? '-',
        op.buttonHole ?? '-',
        op.buttonSet ?? '-',
        getOperatorMultiSkillCount(op),
        totalPts,
        grade.label
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Skill_Matrix_${selectedFactory}_${selectedLine}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render cell point badge (Maksimal 3 Poin per mesin sesuai standarisasi Kolom N)
  const renderCellPointBadge = (val: number | null | undefined) => {
    if (val === null || val === undefined || val <= 0) {
      return <span className="text-[#98A8A8] font-mono text-xs">-</span>;
    }
    const cappedPoint = Math.min(3, Math.max(1, Math.round(val)));
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E0F0F0] text-[#2AAFA3] border border-[#C8D8D8] shadow-2xs tracking-tight font-mono">
        {cappedPoint} {t.common.points}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      
      {/* Resign Status Toast Notification */}
      {resignToast && (
        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border ${
          resignToast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {resignToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{resignToast.message}</span>
          </div>
          <button
            onClick={() => setResignToast(null)}
            className="text-xs opacity-70 hover:opacity-100 ml-3 p-1 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Plant to by_worker Status Toast Notification */}
      {plantToast && (
        <div className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border ${
          plantToast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : plantToast.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {plantToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : plantToast.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{plantToast.message}</span>
          </div>
          <button
            onClick={() => setPlantToast(null)}
            className="text-xs opacity-70 hover:opacity-100 ml-3 p-1 rounded hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* --- FILTER GRADE BARU (Diletakkan di bawah bar statistik) --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.matrix.gradeFilter}:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedGrade('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedGrade === 'ALL' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.common.all} {gradeCounts.ALL > 0 && <span className="ml-1 opacity-80">({gradeCounts.ALL})</span>}
            </button>
            <button
              onClick={() => setSelectedGrade('S')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedGrade === 'S' 
                  ? 'bg-[#059669] text-white shadow-sm' 
                  : 'bg-emerald-50 text-[#059669] hover:bg-emerald-100'
              }`}
            >
              Grade S {gradeCounts.S > 0 && <span className="ml-1 opacity-90">({gradeCounts.S})</span>}
            </button>
            <button
              onClick={() => setSelectedGrade('A')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedGrade === 'A' 
                  ? 'bg-[#0d9488] text-white shadow-sm' 
                  : 'bg-teal-50 text-[#0d9488] hover:bg-teal-100'
              }`}
            >
              Grade A {gradeCounts.A > 0 && <span className="ml-1 opacity-90">({gradeCounts.A})</span>}
            </button>
            <button
              onClick={() => setSelectedGrade('B')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedGrade === 'B' 
                  ? 'bg-[#0284c7] text-white shadow-sm' 
                  : 'bg-sky-50 text-[#0284c7] hover:bg-sky-100'
              }`}
            >
              Grade B {gradeCounts.B > 0 && <span className="ml-1 opacity-90">({gradeCounts.B})</span>}
            </button>
            <button
              onClick={() => setSelectedGrade('C')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedGrade === 'C' 
                  ? 'bg-[#d97706] text-white shadow-sm' 
                  : 'bg-amber-50 text-[#d97706] hover:bg-amber-100'
              }`}
            >
              Grade C {gradeCounts.C > 0 && <span className="ml-1 opacity-90">({gradeCounts.C})</span>}
            </button>
            <button
              onClick={() => setSelectedGrade('HELPER')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedGrade === 'HELPER' 
                  ? 'bg-[#475569] text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Helper {gradeCounts.HELPER > 0 && <span className="ml-1 opacity-90">({gradeCounts.HELPER})</span>}
            </button>
          </div>
        </div>

        {/* Compact Point System Legend Badge & Info (i) Button */}
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="font-bold text-[#475569] flex items-center gap-1 mr-1">
              <Award className="w-3.5 h-3.5 text-[#2AAFA3]" />
              {t.matrix.legendTitle}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-white border border-slate-200 text-slate-700">
              0 {t.common.points} (0%)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 border border-amber-200 text-amber-800">
              1 {t.common.points} (1–60%)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 border border-sky-200 text-sky-800">
              2 {t.common.points} (61–89%)
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 border border-emerald-200 text-emerald-800">
              3 {t.common.points} (&gt; 90%)
            </span>
          </div>

          {/* Tombol Info (i) di samping kanan komponen IE Point system */}
          <button
            type="button"
            onClick={() => setIsPointInfoOpen(true)}
            className="w-8 h-8 rounded-xl bg-[#F8FAFC] hover:bg-[#E0F0F0] text-[#475569] hover:text-[#247F77] border border-[#E2E8F0] hover:border-[#BDE5E2] flex items-center justify-center transition-all cursor-pointer shadow-2xs group shrink-0"
            title={t.metrics.pointSystemTitle || "Detail Sistem Poin IE"}
            aria-label="Detail Sistem Poin IE"
          >
            <Info className="w-4 h-4 text-[#2AAFA3] group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] overflow-hidden shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
        
        {/* TOP TOOLBAR */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#E0E8E8] flex flex-wrap items-center justify-between gap-3">
          
          {/* Search Bar */}
          <div className="relative flex-grow max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#788888]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t.matrix.searchPlaceholder}
              className="w-full bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] text-xs sm:text-sm pl-9 pr-4 py-2.5 rounded-xl focus:border-[#2AAFA3] focus:ring-2 focus:ring-[#2AAFA3]/20 focus:outline-none placeholder:text-[#98A8A8]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 ml-auto">
            
            {/* Multi-skill Filter Toggle */}
            <button
              onClick={() => setMultiskillOnly(!multiskillOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                multiskillOnly
                  ? 'bg-[#F5EAC5] text-[#8A6A08] border-[#E8D499]'
                  : 'bg-[#F8F8F8] text-[#788888] border-[#E0E8E8] hover:bg-[#E8EEEE]'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-[#D0A018]" />
              <span>{t.matrix.multiSkillOnly}</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="bg-[#E0F0F0] text-[#405858] hover:bg-[#C8D8D8] border border-[#C8D8D8] text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.matrix.exportCSV}</span>
            </button>

            {/* Panduan Datasheet by_worker Button */}
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Tata Cara Manual & Panduan Datasheet by_worker"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">Panduan by_worker</span>
            </button>

            {/* Add Operator (Visible for Editor and Admin) */}
            {(userRole === 'EDITOR' || userRole === 'ADMIN') && (
              <button
                onClick={handleOpenAdd}
                className="bg-[#D0A018] hover:bg-[#B88C10] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t.matrix.addOperator}</span>
              </button>
            )}

          </div>
        </div>

        {/* SECONDARY FILTER PILLS */}
        <div className="px-5 py-3 bg-[#F8F8F8] border-b border-[#E0E8E8] flex flex-wrap items-center justify-between gap-2 text-xs">
          
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#788888] font-semibold flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-[#405858]" />
              {t.matrix.category}:
            </span>
            {[
              { id: 'ALL', label: t.matrix.allMachines },
              { id: 'LOCKSTITCH', label: 'Lockstitch' },
              { id: 'OVERLOCK', label: 'Overlock' },
              { id: 'FLATSEAM', label: 'Flatseam' },
              { id: 'SPECIAL', label: 'Special' },
              { id: 'BUTTON_HOLE', label: 'Button Hole' },
              { id: 'BUTTON_SET', label: 'Button Set' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMachineFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  machineFilter === tab.id
                    ? 'bg-[#405858] text-white shadow-2xs font-semibold'
                    : 'bg-white text-[#506868] border border-[#E0E8E8] hover:bg-[#E0E8E8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-[#788888] font-medium">
            {t.matrix.showing} <strong className="text-[#304848]">{filteredOperators.length}</strong> {t.matrix.of} {operators.length} {t.matrix.operatorsLabel}
          </div>

        </div>

        {/* TABLE CONTAINER */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F8F8F8] border-b border-[#E0E8E8] text-[#405858] font-bold text-[11px] uppercase tracking-wider select-none">
                <th 
                  onClick={() => handleSort('no')}
                  className="py-3 px-3.5 text-center cursor-pointer hover:text-[#2AAFA3] w-12"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{t.matrix.thNo}</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>
                <th className="py-3 px-3 text-left w-28">{t.matrix.thNik}</th>
                <th 
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 text-left cursor-pointer hover:text-[#2AAFA3]"
                >
                  <div className="flex items-center gap-1">
                    <span>{t.matrix.thName}</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('workTime')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[#2AAFA3] w-20"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{t.matrix.thTenure}</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>
                
                {/* Machine Columns - Note: Machine names are kept untranslated per user instruction */}
                <th className="py-3 px-2 text-center text-[#2AAFA3] bg-[#F4F9F9] border-x border-[#E0E8E8] w-28">Lockstitch</th>
                <th className="py-3 px-2 text-center text-[#2AAFA3] bg-[#F4F9F9] border-r border-[#E0E8E8] w-28">Overlock</th>
                <th className="py-3 px-2 text-center text-[#2AAFA3] bg-[#F4F9F9] border-r border-[#E0E8E8] w-28">Flatseam</th>
                <th className="py-3 px-2 text-center text-[#2AAFA3] bg-[#F4F9F9] border-r border-[#E0E8E8] w-28">Special / Press</th>
                <th className="py-3 px-2 text-center text-[#2AAFA3] bg-[#F4F9F9] border-r border-[#E0E8E8] w-28">Button Hole</th>
                <th className="py-3 px-2 text-center text-[#2AAFA3] bg-[#F4F9F9] border-r border-[#E0E8E8] w-28">Button Set</th>
                
                {/* Aggregate Columns */}
                <th 
                  onClick={() => handleSort('multiskill')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[#2AAFA3] w-20"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{t.matrix.thSkill}</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('avgRate')}
                  className="py-3 px-3.5 text-center cursor-pointer hover:text-[#2AAFA3] w-28"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{t.matrix.thGrade}</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>

                {(userRole === 'EDITOR' || userRole === 'ADMIN') && (
                  <th className="py-3 px-3 text-center w-20">{t.matrix.thAction}</th>
                )}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-[#E0E8E8]">
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[#788888]">
                    <div className="flex flex-col items-center justify-center">
                      <User className="w-10 h-10 text-[#C8D8D8] mb-2" />
                      <p className="font-semibold text-sm text-[#304848]">{t.matrix.noOperators}</p>
                      <p className="text-xs text-[#788888] mt-1">
                        {operators.length === 0
                          ? `${t.matrix.noDataRegistered} ${selectedFactory} • ${selectedLine}.`
                          : t.matrix.adjustFilter}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOperators.map((op, idx) => {
                  const totalPoints = getOperatorTotalPoints(op);
                  const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
                  const gradeInfo = getGradeFromTotalPoints(totalPoints, isHelper);
                  const multiCount = getOperatorMultiSkillCount(op);

                  return (
                    <tr 
                      key={op.id}
                      className="hover:bg-[#F8FBFB] transition-colors group"
                    >
                      {/* No */}
                      <td className="py-3 px-3.5 text-center font-mono text-[#788888] text-xs">
                        {idx + 1}
                      </td>

                      {/* NIK */}
                      <td className="py-3 px-3 font-mono font-semibold text-[#405858] text-xs">
                        {op.nik}
                      </td>

                      {/* Nama Operator */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#E0F0F0] text-[#405858] font-bold text-xs flex items-center justify-center border border-[#C8D8D8] shrink-0">
                            {op.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-[#304848] text-xs block group-hover:text-[#2AAFA3] transition-colors">
                              {op.name}
                            </span>
                            <span className="text-[10px] text-[#98A8A8]">
                              DOJ: {formatDate(op.doj)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Masa Kerja */}
                      <td className="py-3 px-3 text-center text-xs font-mono text-[#506868]">
                        {op.workTimeMonths}
                      </td>

                      {/* Machine Rates */}
                      <td className="py-2.5 px-2 text-center border-x border-[#E0E8E8] w-28">{renderCellPointBadge(op.lockstitch)}</td>
                      <td className="py-2.5 px-2 text-center border-r border-[#E0E8E8] w-28">{renderCellPointBadge(op.overlock)}</td>
                      <td className="py-2.5 px-2 text-center border-r border-[#E0E8E8] w-28">{renderCellPointBadge(op.flatseam)}</td>
                      <td className="py-2.5 px-2 text-center border-r border-[#E0E8E8] w-28">{renderCellPointBadge(op.special)}</td>
                      <td className="py-2.5 px-2 text-center border-r border-[#E0E8E8] w-28">{renderCellPointBadge(op.buttonHole)}</td>
                      <td className="py-2.5 px-2 text-center border-r border-[#E0E8E8] w-28">{renderCellPointBadge(op.buttonSet)}</td>

                      {/* Multiskill Count */}
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          multiCount >= 2 
                            ? 'badge-gold' 
                            : 'bg-[#F0F4F4] text-[#788888]'
                        }`}>
                          {multiCount >= 2 && <Star className="w-3 h-3 fill-current text-[#D0A018]" />}
                          <span>{multiCount}</span>
                        </span>
                      </td>

                      {/* Average Rate & Grade Badge */}
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${gradeInfo.cssBadge} shadow-2xs whitespace-nowrap`}>
                            {gradeInfo.label}
                          </span>
                          {totalPoints > 0 ? (
                            <span className="text-[10px] text-[#788888] font-mono mt-0.5">
                              {totalPoints} {t.common.points}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#98A8A8] font-mono mt-0.5">
                              0 {t.common.points}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      {(userRole === 'EDITOR' || userRole === 'ADMIN') && (
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleOpenEdit(op)}
                              className="p-1.5 rounded-lg text-[#405858] hover:bg-[#E0E8E8] transition-colors cursor-pointer"
                              title="Edit Data Operator"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setResignTargetOp(op)}
                              className="p-1.5 rounded-lg text-[#788888] hover:text-[#e11d48] hover:bg-[#FDECEC] transition-colors cursor-pointer"
                              title="Tandai Operator Resign (Kirim ke Google Sheets)"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM GRADE BENCHMARKS REFERENCE */}
        <div className="p-4 bg-[#F8F8F8] border-t border-[#E0E8E8]">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#405858] mb-2.5">
            <Award className="w-4 h-4 text-[#D0A018]" />
            <span>{t.matrix.gradeStandard}:</span>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {GRADE_BENCHMARKS.map((b) => (
              <span 
                key={b.grade} 
                className={`px-3 py-1 rounded-full font-bold shadow-2xs ${b.cssBadge}`}
                title={b.description}
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* ADD / EDIT MODAL */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 bg-[#304848]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E0E8E8] rounded-[24px] max-w-xl w-full p-6 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-[#E0E8E8] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#D9F1EF] text-[#2AAFA3] flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#304848]">
                    {isAddModalOpen ? 'Tambah Operator Baru' : t.matrix.editTitle}
                  </h3>
                  {isAddModalOpen && (
                    <p className="text-[11px] text-[#788888]">
                      Validasi otomatis via sheet <strong className="text-[#2AAFA3]">"date_of_join"</strong>
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="text-[#788888] hover:text-[#304848] p-1 rounded-lg hover:bg-[#F8F8F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* INFO BANNER KHUSUS MODE TAMBAH OPERATOR */}
            {isAddModalOpen && (
              <div className="mb-4 p-3 bg-[#D9F1EF]/50 border border-[#BDE5E2] rounded-2xl flex items-start gap-2.5 text-xs text-[#247F77]">
                <Info className="w-4 h-4 text-[#2AAFA3] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-[#206A63]">Validasi Master Data (Sheet date_of_join)</p>
                  <p className="text-[11px] text-[#405858] leading-relaxed">
                    Untuk menjamin keabsahan data, <strong>kolom aktif masukan hanya NIK Operator</strong>. Nama Lengkap dan Date of Join (DOJ) akan diambil secara otomatis dari master sheet <code>date_of_join</code>.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={isAddModalOpen ? handleSaveAdd : handleSaveEdit} className="space-y-4">
              
              {/* NIK & SEARCH BAR */}
              <div>
                <label className="block text-xs font-semibold text-[#506868] mb-1">
                  {t.matrix.nikLabel} <span className="text-[#e11d48]">*</span>
                  {isAddModalOpen && (
                    <span className="text-[10px] text-[#2AAFA3] font-normal ml-1">
                      (Satu-satunya kolom aktif masukan)
                    </span>
                  )}:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      autoFocus={isAddModalOpen}
                      placeholder={isAddModalOpen ? "Masukkan NIK operator (contoh: 260123)..." : "NIK"}
                      value={formData.nik || ''}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setFormData({ ...formData, nik: val });
                        if (isAddModalOpen && dojLookupStatus !== 'idle') {
                          setDojLookupStatus('idle');
                          setDojLookupMessage('');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && isAddModalOpen) {
                          e.preventDefault();
                          handleLookupNik(formData.nik || '');
                        }
                      }}
                      className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#304848] focus:border-[#2AAFA3] focus:outline-none"
                    />
                    {isSearchingDoj && (
                      <div className="absolute right-3 top-3">
                        <Loader2 className="w-4 h-4 text-[#2AAFA3] animate-spin" />
                      </div>
                    )}
                  </div>
                  {isAddModalOpen && (
                    <button
                      type="button"
                      onClick={() => handleLookupNik(formData.nik || '')}
                      disabled={isSearchingDoj || !formData.nik}
                      className="bg-[#2AAFA3] hover:bg-[#208E84] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {isSearchingDoj ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>Cari NIK</span>
                    </button>
                  )}
                </div>
              </div>

              {/* STATUS PENCARIAN SHEET DATE_OF_JOIN */}
              {isAddModalOpen && dojLookupStatus === 'found' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900 animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-emerald-800">✓ Data Ditemukan di Sheet "date_of_join"</p>
                    <p className="text-[11px] text-emerald-700">
                      <strong>{formData.name}</strong> • Tanggal Masuk: <strong>{formData.doj || '-'}</strong> (Masa Kerja: <strong>{formData.workTimeMonths || 0} Bulan</strong>)
                    </p>
                  </div>
                </div>
              )}

              {isAddModalOpen && dojLookupStatus === 'not_found' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-800">NIK Tidak Ditemukan di Sheet "date_of_join"</p>
                    <p className="text-[11px] text-rose-700">
                      {dojLookupMessage || `NIK "${formData.nik}" belum terdaftar di sheet date_of_join. Pastikan NIK sudah benar.`}
                    </p>
                  </div>
                </div>
              )}

              {/* KOLOM NAMA LENGKAP (READ-ONLY DI MODE TAMBAH) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#506868]">{t.matrix.nameLabel}:</label>
                  {isAddModalOpen && (
                    <span className="text-[10px] text-[#788888] flex items-center gap-1 font-medium bg-[#F0F5F5] px-2 py-0.5 rounded-md border border-[#E0E8E8]">
                      <Lock className="w-3 h-3 text-[#2AAFA3]" /> Otomatis dari date_of_join
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  readOnly={isAddModalOpen}
                  disabled={isAddModalOpen}
                  placeholder={isAddModalOpen ? "Otomatis terisi saat NIK ditemukan di date_of_join..." : "Nama Lengkap"}
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs uppercase font-bold focus:outline-none ${
                    isAddModalOpen 
                      ? 'bg-[#F0F5F5] border border-[#D5E2E2] text-[#304848] cursor-not-allowed select-none' 
                      : 'bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] focus:border-[#2AAFA3]'
                  }`}
                />
              </div>

              {/* KOLOM MASA KERJA & DATE OF JOIN (READ-ONLY DI MODE TAMBAH) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#506868]">{t.matrix.tenureLabel}:</label>
                    {isAddModalOpen && (
                      <span className="text-[10px] text-[#788888] flex items-center gap-1 font-medium">
                        <Lock className="w-2.5 h-2.5 text-[#2AAFA3]" /> Auto
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    readOnly={isAddModalOpen}
                    disabled={isAddModalOpen}
                    value={formData.workTimeMonths || 0}
                    onChange={(e) => setFormData({ ...formData, workTimeMonths: parseFloat(e.target.value) || 0 })}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none ${
                      isAddModalOpen 
                        ? 'bg-[#F0F5F5] border border-[#D5E2E2] text-[#304848] cursor-not-allowed select-none' 
                        : 'bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] focus:border-[#2AAFA3]'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#506868]">{t.matrix.dojLabel}:</label>
                    {isAddModalOpen && (
                      <span className="text-[10px] text-[#788888] flex items-center gap-1 font-medium">
                        <Lock className="w-2.5 h-2.5 text-[#2AAFA3]" /> Auto
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    readOnly={isAddModalOpen}
                    disabled={isAddModalOpen}
                    placeholder={isAddModalOpen ? "Auto date_of_join..." : "DD-MM-YYYY"}
                    value={formData.doj || ''}
                    onChange={(e) => setFormData({ ...formData, doj: e.target.value })}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none ${
                      isAddModalOpen 
                        ? 'bg-[#F0F5F5] border border-[#D5E2E2] text-[#304848] cursor-not-allowed select-none' 
                        : 'bg-[#F8F8F8] border border-[#E0E8E8] text-[#304848] focus:border-[#2AAFA3]'
                    }`}
                  />
                </div>
              </div>

              {/* PENEMPATAN LOKASI PABRIK & LINE */}
              <div className="p-3 bg-[#F8FBFB] border border-[#E0E8E8] rounded-xl flex items-center justify-between text-xs text-[#506868]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#304848]">Penempatan:</span>
                  <span className="badge-teal font-bold">{selectedFactory}</span>
                  <span className="text-[#809090]">•</span>
                  <span className="font-semibold text-[#405858]">{selectedLine}</span>
                </div>
                <span className="text-[11px] text-[#788888] font-mono">Status: ACTIVE</span>
              </div>

              {/* Machine Competencies Header */}
              <div className="pt-2 border-t border-[#E0E8E8]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#405858]">{t.matrix.machinePointsHeader}:</h4>
                  <span className="text-[10px] text-[#788888] bg-[#F0F4F4] px-2 py-0.5 rounded-full font-medium">{t.matrix.max3Points}</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#788888] mb-1">Lockstitch ({t.common.points}):</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={3}
                      value={formData.lockstitch ?? ''}
                      onChange={(e) => setFormData({ ...formData, lockstitch: e.target.value ? Math.min(3, Math.max(0, parseInt(e.target.value, 10))) : null })}
                      className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none font-mono"
                      placeholder="1 - 3"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#788888] mb-1">Overlock ({t.common.points}):</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={3}
                      value={formData.overlock ?? ''}
                      onChange={(e) => setFormData({ ...formData, overlock: e.target.value ? Math.min(3, Math.max(0, parseInt(e.target.value, 10))) : null })}
                      className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none font-mono"
                      placeholder="1 - 3"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#788888] mb-1">Flatseam ({t.common.points}):</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={3}
                      value={formData.flatseam ?? ''}
                      onChange={(e) => setFormData({ ...formData, flatseam: e.target.value ? Math.min(3, Math.max(0, parseInt(e.target.value, 10))) : null })}
                      className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none font-mono"
                      placeholder="1 - 3"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#788888] mb-1">Special / Press ({t.common.points}):</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={3}
                      value={formData.special ?? ''}
                      onChange={(e) => setFormData({ ...formData, special: e.target.value ? Math.min(3, Math.max(0, parseInt(e.target.value, 10))) : null })}
                      className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none font-mono"
                      placeholder="1 - 3"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#788888] mb-1">Button Hole ({t.common.points}):</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={3}
                      value={formData.buttonHole ?? ''}
                      onChange={(e) => setFormData({ ...formData, buttonHole: e.target.value ? Math.min(3, Math.max(0, parseInt(e.target.value, 10))) : null })}
                      className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none font-mono"
                      placeholder="1 - 3"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#788888] mb-1">Button Set ({t.common.points}):</label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={3}
                      value={formData.buttonSet ?? ''}
                      onChange={(e) => setFormData({ ...formData, buttonSet: e.target.value ? Math.min(3, Math.max(0, parseInt(e.target.value, 10))) : null })}
                      className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-2.5 py-1.5 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none font-mono"
                      placeholder="1 - 3"
                    />
                  </div>
                </div>
              </div>

              {/* FORM PENANAMAN KE DATASHEET BY_WORKER (KHUSUS TAMBAH OPERATOR) */}
              {isAddModalOpen && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-emerald-900">
                      <input
                        type="checkbox"
                        checked={plantToByWorker}
                        onChange={(e) => setPlantToByWorker(e.target.checked)}
                        className="w-4 h-4 rounded text-[#2AAFA3] focus:ring-[#2AAFA3] border-emerald-300 cursor-pointer"
                      />
                      <Database className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Tanamkan Operator ke Datasheet 'by_worker'</span>
                    </label>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Status: ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed pl-6">
                    Data operator baru (NIK, Nama, DOJ, Masa Kerja, Pabrik, Line, Poin Mesin, dan Status <strong>ACTIVE</strong>) akan langsung ditanamkan secara permanen ke tab <strong>by_worker</strong> di Google Sheets.
                  </p>
                  
                  {/* Info baris yang akan ditanamkan */}
                  {formData.name && (
                    <div className="mt-2 pl-6 pt-2 border-t border-emerald-200/60 flex flex-wrap gap-2 text-[10px] font-mono text-emerald-800">
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">NIK: {formData.nik}</span>
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{formData.name}</span>
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-emerald-200">{selectedFactory} - {selectedLine}</span>
                      <span className="bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">Kolom R: ACTIVE</span>
                    </div>
                  )}
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-[#E0E8E8] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#E0F0F0] text-[#405858] hover:bg-[#C8D8D8] transition-colors cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isAddModalOpen && (isSearchingDoj || isPlanting || dojLookupStatus !== 'found' || !formData.name || !formData.nik)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#2AAFA3] hover:bg-[#208C82] text-white shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  title={isAddModalOpen && dojLookupStatus !== 'found' ? "Cari dan validasi NIK di sheet date_of_join terlebih dahulu" : ""}
                >
                  {isPlanting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menanamkan ke by_worker...</span>
                    </>
                  ) : isAddModalOpen && plantToByWorker ? (
                    <>
                      <Database className="w-3.5 h-3.5" />
                      <span>Simpan & Tanamkan ke by_worker</span>
                    </>
                  ) : (
                    <span>{t.common.save}</span>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* MODAL PANDUAN DATASHEET BY_WORKER & TATA CARA INPUT MANUAL */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 bg-[#304848]/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-[#E0E8E8] rounded-[24px] max-w-3xl w-full p-5 sm:p-6 shadow-2xl animate-fade-in my-8 max-h-[90vh] flex flex-col">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E0E8E8]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#304848]">Panduan Datasheet 'by_worker'</h3>
                  <p className="text-xs text-[#788888]">Struktur standar 18 kolom & tata cara penanaman data operator</p>
                </div>
              </div>
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="text-[#788888] hover:text-[#304848] p-1.5 rounded-xl hover:bg-[#F8F8F8] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="overflow-y-auto pr-1 py-4 space-y-6 text-xs text-[#405858]">
              
              {/* Bagian 1: Mengapa Status Operator Sangat Krusial */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Solusi: Penanaman Status Operator ke Tab 'by_worker'</span>
                </div>
                <p className="text-[#304848] leading-relaxed">
                  Ketika Anda menambahkan operator baru dari sheet <code>date_of_join</code>, sistem sekarang <strong>secara otomatis menanamkan baris data baru ke datasheet <code>by_worker</code> dengan Status: <code>ACTIVE</code> (Kolom R)</strong>. 
                  Dengan begitu, data operator baru akan tetap tersimpan secara permanen dan tidak hilang saat halaman disegarkan atau saat disinkronisasi ulang dengan Google Sheets.
                </p>
              </div>

              {/* Bagian 2: Tata Cara & Struktur Kolom Pengisian Manual di Google Sheets */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-[#304848]">
                  <Table className="w-4 h-4 text-[#2AAFA3]" />
                  <span>Struktur 18 Kolom Tab 'by_worker' (Jika Mengisi/Merubah Manual)</span>
                </div>
                <p className="text-xs text-[#788888]">
                  Jika tim IE atau Supervisor ingin menginput baris operator baru secara langsung di Google Spreadsheet pada tab <strong>by_worker</strong>, pastikan seluruh 18 kolom berikut terisi dengan benar:
                </p>

                <div className="border border-[#E0E8E8] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#F0F5F5] text-[#304848] font-bold border-b border-[#E0E8E8]">
                          <th className="py-2.5 px-3">Kolom</th>
                          <th className="py-2.5 px-3">Header Kolom</th>
                          <th className="py-2.5 px-3">Wajib</th>
                          <th className="py-2.5 px-3">Format / Contoh Isi</th>
                          <th className="py-2.5 px-3">Keterangan IE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E0E8E8] font-mono">
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">A</td>
                          <td className="py-2 px-3 font-bold">Factory</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">Ya</td>
                          <td className="py-2 px-3 text-slate-700">Factory 1</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Nomor pabrik operator</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">B</td>
                          <td className="py-2 px-3 font-bold">Line</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">Ya</td>
                          <td className="py-2 px-3 text-slate-700">Line 1</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Jalur sewing penempatan</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">C</td>
                          <td className="py-2 px-3 font-bold">Style</td>
                          <td className="py-2 px-3 text-slate-400">Opsional</td>
                          <td className="py-2 px-3 text-slate-700">BASIC</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Style garmen yang sedang berjalan</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">D</td>
                          <td className="py-2 px-3 font-bold">Date</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">Ya</td>
                          <td className="py-2 px-3 text-slate-700">09-09-2026</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Format tanggal penilaian DD-MM-YYYY</td>
                        </tr>
                        <tr className="hover:bg-slate-50 bg-amber-50/50">
                          <td className="py-2 px-3 font-bold text-teal-700">E</td>
                          <td className="py-2 px-3 font-bold">Worker Code</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">KUNCI</td>
                          <td className="py-2 px-3 text-slate-900 font-bold">260123</td>
                          <td className="py-2 px-3 font-sans text-slate-600">NIK Karyawan (kunci validasi)</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">F</td>
                          <td className="py-2 px-3 font-bold">Worker</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">Ya</td>
                          <td className="py-2 px-3 text-slate-700">SITI NURHALIZA</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Nama lengkap operator (kapital)</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">G</td>
                          <td className="py-2 px-3 font-bold">Date of Join</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">Ya</td>
                          <td className="py-2 px-3 text-slate-700">01-01-2025</td>
                          <td className="py-2 px-3 font-sans text-slate-600">DOJ untuk kalkulasi masa kerja</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">H</td>
                          <td className="py-2 px-3 font-bold">Machine</td>
                          <td className="py-2 px-3 text-slate-400">Opsional</td>
                          <td className="py-2 px-3 text-slate-700">LOCKSTITCH / SN</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Nama mesin yang dioperasikan</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">I - L</td>
                          <td className="py-2 px-3 font-bold">Style No / Process / SMV / Target</td>
                          <td className="py-2 px-3 text-slate-400">Opsional</td>
                          <td className="py-2 px-3 text-slate-700">BASIC, SEWING, 0, 0</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Informasi standar proses IE</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">M</td>
                          <td className="py-2 px-3 font-bold">Production Rate (%)</td>
                          <td className="py-2 px-3 text-slate-400">Opsional</td>
                          <td className="py-2 px-3 text-slate-700">100% atau 85</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Persentase kecepatan operator</td>
                        </tr>
                        <tr className="hover:bg-slate-50 bg-teal-50/50">
                          <td className="py-2 px-3 font-bold text-teal-700">N</td>
                          <td className="py-2 px-3 font-bold">POINT</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">Ya</td>
                          <td className="py-2 px-3 text-teal-800 font-bold">1, 2, atau 3</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Standar Poin IE (Maksimal 3 poin)</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">O</td>
                          <td className="py-2 px-3 font-bold">Work Month</td>
                          <td className="py-2 px-3 text-slate-400">Opsional</td>
                          <td className="py-2 px-3 text-slate-700">12</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Masa kerja dalam satuan bulan</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">P</td>
                          <td className="py-2 px-3 font-bold">Date of Resign</td>
                          <td className="py-2 px-3 text-slate-400">Khusus</td>
                          <td className="py-2 px-3 text-slate-700">- (Kosongkan jika aktif)</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Isi tanggal jika operator mengundurkan diri</td>
                        </tr>
                        <tr className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-teal-700">Q</td>
                          <td className="py-2 px-3 font-bold">Machine Category</td>
                          <td className="py-2 px-3 text-emerald-700 font-bold">Ya</td>
                          <td className="py-2 px-3 text-slate-700">LOCKSTITCH</td>
                          <td className="py-2 px-3 font-sans text-slate-600">Kategori: LOCKSTITCH, OVERLOCK, dll.</td>
                        </tr>
                        <tr className="hover:bg-emerald-50 bg-emerald-100/60 font-bold text-emerald-950">
                          <td className="py-2.5 px-3 text-emerald-800">R</td>
                          <td className="py-2.5 px-3">Status</td>
                          <td className="py-2.5 px-3 text-emerald-700">WAJIB MUTLAK</td>
                          <td className="py-2.5 px-3 text-emerald-800">ACTIVE</td>
                          <td className="py-2.5 px-3 font-sans text-emerald-900">Harus bernilai ACTIVE agar masuk di sistem</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="pt-3 border-t border-[#E0E8E8] flex justify-end">
              <button
                type="button"
                onClick={() => setIsGuideModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#2AAFA3] hover:bg-[#208C82] text-white transition-colors cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>

          </div>
        </div>
      )}

      {/* RESIGN CONFIRMATION MODAL */}
      {resignTargetOp && (
        <div className="fixed inset-0 bg-[#304848]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E0E8E8] rounded-[24px] max-w-md w-full p-6 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E8E8] mb-4">
              <div className="flex items-center gap-2 text-[#e11d48]">
                <UserX className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#304848]">{t.matrix.resignTitle}</h3>
              </div>
              <button
                onClick={() => !isResigning && setResignTargetOp(null)}
                disabled={isResigning}
                className="text-[#788888] hover:text-[#304848] p-1 rounded-lg hover:bg-[#F8F8F8] disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#506868] mb-5">
              <p>{t.matrix.resignConfirmPrompt} <strong className="text-[#e11d48]">RESIGNED</strong>?</p>
              
              <div className="p-3 bg-[#F8F8F8] rounded-xl border border-[#E0E8E8] space-y-1.5 font-mono text-[11px]">
                <div><span className="text-[#788888]">{t.matrix.thName}:</span> <strong className="text-[#304848]">{resignTargetOp.name}</strong></div>
                <div><span className="text-[#788888]">NIK:</span> <strong className="text-[#304848]">{resignTargetOp.nik}</strong></div>
                <div><span className="text-[#788888]">Factory / Line:</span> <strong className="text-[#304848]">{resignTargetOp.factory} / {resignTargetOp.line}</strong></div>
                <div><span className="text-[#788888]">{t.header.period}:</span> <strong className="text-[#304848]">{selectedMonth} / {selectedYear}</strong></div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-[11px]">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{t.matrix.resignWarning}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E0E8E8]">
              <button
                type="button"
                onClick={() => setResignTargetOp(null)}
                disabled={isResigning}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#E0F0F0] text-[#405858] hover:bg-[#C8D8D8] transition-colors cursor-pointer disabled:opacity-50"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmResign}
                disabled={isResigning}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#e11d48] hover:bg-[#be123c] text-white shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isResigning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.matrix.sendingToSheets}</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>{t.matrix.confirmResign}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IE POINT SYSTEM INFORMATION MODAL */}
      {isPointInfoOpen && (
        <div 
          className="fixed inset-0 bg-[#304848]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsPointInfoOpen(false)}
        >
          <div 
            className="bg-white border border-[#E0E8E8] rounded-[24px] max-w-4xl w-full p-5 sm:p-6 shadow-2xl animate-fade-in my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#E0E8E8] mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E0F0F0] border border-[#BDE5E2] flex items-center justify-center text-[#247F77] shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-[#304848]">
                      {t.metrics.pointSystemTitle}
                    </h3>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#E0F0F0] text-[#247F77] border border-[#BDE5E2]">
                      {t.metrics.pointSystemBadge}
                    </span>
                  </div>
                  <p className="text-xs text-[#788888] mt-1">
                    {t.metrics.pointSystemSubtitle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPointInfoOpen(false)}
                className="text-[#788888] hover:text-[#304848] p-1.5 rounded-xl hover:bg-[#F8F8F8] transition-colors cursor-pointer shrink-0 ml-2"
                aria-label={t.common.cancel || "Tutup"}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 4 Tier Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
              {/* 0 Poin */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#475569] bg-white border border-[#CBD5E1] px-2.5 py-1 rounded-full shadow-2xs">
                      {t.metrics.p0Points}
                    </span>
                    <span className="text-xs font-extrabold text-[#64748B] font-mono bg-slate-200/80 px-2 py-0.5 rounded-md">
                      {t.metrics.p0Eff}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-[#334155] mb-1">
                    {t.metrics.p0Title}
                  </h5>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    {t.metrics.p0Desc}
                  </p>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[10px] text-[#64748B]">
                  <span className="font-semibold">{t.metrics.p0Limit}</span>
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>
              </div>

              {/* 1 Poin */}
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-4 flex flex-col justify-between hover:border-[#F59E0B] transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#B45309] bg-white border border-[#FCD34D] px-2.5 py-1 rounded-full shadow-2xs">
                      {t.metrics.p1Points}
                    </span>
                    <span className="text-xs font-extrabold text-[#D97706] font-mono bg-amber-100 px-2 py-0.5 rounded-md">
                      {t.metrics.p1Eff}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-[#92400E] mb-1">
                    {t.metrics.p1Title}
                  </h5>
                  <p className="text-[11px] text-[#B45309] leading-relaxed">
                    {t.metrics.p1Desc}
                  </p>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-amber-200 flex items-center justify-between text-[10px] text-[#B45309]">
                  <span className="font-semibold">{t.metrics.p1Limit}</span>
                  <div className="w-16 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '50%' }} />
                  </div>
                </div>
              </div>

              {/* 2 Poin */}
              <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-4 flex flex-col justify-between hover:border-[#0284C7] transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#0369A1] bg-white border border-[#7DD3FC] px-2.5 py-1 rounded-full shadow-2xs">
                      {t.metrics.p2Points}
                    </span>
                    <span className="text-xs font-extrabold text-[#0284C7] font-mono bg-sky-100 px-2 py-0.5 rounded-md">
                      {t.metrics.p2Eff}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-[#075985] mb-1">
                    {t.metrics.p2Title}
                  </h5>
                  <p className="text-[11px] text-[#0369A1] leading-relaxed">
                    {t.metrics.p2Desc}
                  </p>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-sky-200 flex items-center justify-between text-[10px] text-[#0369A1]">
                  <span className="font-semibold">{t.metrics.p2Limit}</span>
                  <div className="w-16 h-1.5 bg-sky-200 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>
              </div>

              {/* 3 Poin */}
              <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-4 flex flex-col justify-between hover:border-[#059669] transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#047857] bg-white border border-[#6EE7B7] px-2.5 py-1 rounded-full shadow-2xs">
                      {t.metrics.p3Points}
                    </span>
                    <span className="text-xs font-extrabold text-[#059669] font-mono bg-emerald-100 px-2 py-0.5 rounded-md">
                      {t.metrics.p3Eff}
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-[#065F46] mb-1">
                    {t.metrics.p3Title}
                  </h5>
                  <p className="text-[11px] text-[#047857] leading-relaxed">
                    {t.metrics.p3Desc}
                  </p>
                </div>
                <div className="mt-3.5 pt-2.5 border-t border-emerald-200 flex items-center justify-between text-[10px] text-[#047857]">
                  <span className="font-semibold">{t.metrics.p3Limit}</span>
                  <div className="w-16 h-1.5 bg-emerald-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Note & Benchmark Info */}
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl text-xs text-[#506868] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#304848]">
                <Info className="w-4 h-4 text-[#2AAFA3]" />
                <span>Aturan IE PT. Winners International:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-[#64748B] pl-1">
                <li>Setiap jenis mesin memiliki batas penilaian maksimal <strong>3 Poin</strong> per operator.</li>
                <li><strong>Grade Operator</strong> dihitung dari akumulasi total poin seluruh mesin: <strong>Grade S (&ge; 12 Poin)</strong>, <strong>Grade A (9–11 Poin)</strong>, <strong>Grade B (6–8 Poin)</strong>, <strong>Grade C (1–5 Poin)</strong>, <strong>Helper (0 Poin)</strong>.</li>
                <li>Perhitungan efisiensi mengacu pada standar Time Study GSD &amp; MOST Garment Manufacturing.</li>
              </ul>
            </div>

            {/* Footer Close Button */}
            <div className="flex justify-end pt-4 mt-4 border-t border-[#E0E8E8]">
              <button
                type="button"
                onClick={() => setIsPointInfoOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[#304848] hover:bg-[#203434] text-white shadow-sm transition-colors cursor-pointer"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

