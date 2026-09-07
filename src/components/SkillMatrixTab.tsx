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
  Loader2
} from 'lucide-react';
import { Operator, GradeType, MachineCategory } from '../types';
import { 
  getOperatorMultiSkillCount, 
  getOperatorAvgRate, 
  setOperatorResigned, 
  getGradeFromTotalPoints, 
  getOperatorTotalPoints,
  isOperatorResignedAtPeriod
} from '../utils/ieCalculations';
import { getGradeFromRate, GRADE_BENCHMARKS } from '../data/mockData';

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

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<Operator>>({});

  // Resign modal state
  const [resignTargetOp, setResignTargetOp] = useState<Operator | null>(null);
  const [isResigning, setIsResigning] = useState(false);
  const [resignToast, setResignToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
          message: `Status RESIGNED untuk ${resignTargetOp.name} (${resignTargetOp.nik}) berhasil dikirim ke Google Sheets!`
        });
      } else {
        setResignToast({
          type: 'error',
          message: `Gagal memperbarui status resigned operator di Google Sheets.`
        });
      }
    } catch (err) {
      setResignToast({
        type: 'error',
        message: `Terjadi kesalahan saat memperbarui status operator.`
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
    setIsEditModalOpen(true);
  };

  const handleOpenAdd = () => {
    setFormData({
      nik: `260${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      doj: '1-Feb-26',
      workTimeMonths: 6,
      factory: selectedFactory,
      line: selectedLine,
      lockstitch: null,
      overlock: null,
      flatseam: null,
      special: null,
      buttonHole: null,
      buttonSet: null,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nik) return;
    onUpdateOperator(formData as Operator);
    setIsEditModalOpen(false);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.nik) return;
    const newOp: Operator = {
      ...(formData as Operator),
      id: `op-${Date.now()}`,
      no: operators.length + 1,
      factory: selectedFactory,
      line: selectedLine,
    };
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
        {cappedPoint} Poin
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

      {/* --- FILTER GRADE BARU (Diletakkan di bawah bar statistik) --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filter Grade:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedGrade('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedGrade === 'ALL' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua {gradeCounts.ALL > 0 && <span className="ml-1 opacity-80">({gradeCounts.ALL})</span>}
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
              placeholder="Cari Operator (Nama atau NIK)..."
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
              <span>Multi-Skill Saja</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="bg-[#E0F0F0] text-[#405858] hover:bg-[#C8D8D8] border border-[#C8D8D8] text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            {/* Add Operator (Visible for Editor and Admin) */}
            {(userRole === 'EDITOR' || userRole === 'ADMIN') && (
              <button
                onClick={handleOpenAdd}
                className="bg-[#D0A018] hover:bg-[#B88C10] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Operator</span>
              </button>
            )}

          </div>
        </div>

        {/* SECONDARY FILTER PILLS */}
        <div className="px-5 py-3 bg-[#F8F8F8] border-b border-[#E0E8E8] flex flex-wrap items-center justify-between gap-2 text-xs">
          
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#788888] font-semibold flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3 text-[#405858]" />
              Kategori:
            </span>
            {[
              { id: 'ALL', label: 'Semua Mesin' },
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
            Menampilkan <strong className="text-[#304848]">{filteredOperators.length}</strong> dari {operators.length} Operator
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
                    <span>No</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>
                <th className="py-3 px-3 text-left w-28">NIK</th>
                <th 
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 text-left cursor-pointer hover:text-[#2AAFA3]"
                >
                  <div className="flex items-center gap-1">
                    <span>Nama Operator</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('workTime')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-[#2AAFA3] w-20"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Masa (Bln)</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>
                
                {/* Machine Columns */}
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
                    <span>Skill</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('avgRate')}
                  className="py-3 px-3.5 text-center cursor-pointer hover:text-[#2AAFA3] w-28"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Grade (Poin)</span>
                    <ArrowUpDown className="w-3 h-3 text-[#98A8A8]" />
                  </div>
                </th>

                {(userRole === 'EDITOR' || userRole === 'ADMIN') && (
                  <th className="py-3 px-3 text-center w-20">Aksi</th>
                )}
              </tr>
            </thead>
            
            <tbody className="divide-y divide-[#E0E8E8]">
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[#788888]">
                    <div className="flex flex-col items-center justify-center">
                      <User className="w-10 h-10 text-[#C8D8D8] mb-2" />
                      <p className="font-semibold text-sm text-[#304848]">Tidak ada operator ditemukan</p>
                      <p className="text-xs text-[#788888] mt-1">
                        {operators.length === 0
                          ? `Belum ada data operator yang terdaftar di ${selectedFactory} • ${selectedLine}.`
                          : 'Coba sesuaikan kata kunci pencarian atau filter kategori.'}
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
                              {totalPoints} Poin
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#98A8A8] font-mono mt-0.5">
                              0 Poin
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
            <span>Standarisasi Grade / Penilaian Operator (PT. Winners International):</span>
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
              <h3 className="text-base font-bold text-[#304848] flex items-center gap-2">
                <User className="w-5 h-5 text-[#2AAFA3]" />
                <span>{isAddModalOpen ? 'Tambah Operator Baru' : 'Edit Data Operator'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="text-[#788888] hover:text-[#304848] p-1 rounded-lg hover:bg-[#F8F8F8]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isAddModalOpen ? handleSaveAdd : handleSaveEdit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#506868] mb-1">NIK Operator:</label>
                  <input
                    type="text"
                    required
                    value={formData.nik || ''}
                    onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                    className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-3 py-2 text-xs font-mono text-[#304848] focus:border-[#2AAFA3] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#506868] mb-1">Nama Lengkap:</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                    className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-3 py-2 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none uppercase font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#506868] mb-1">Masa Kerja (Bulan):</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={formData.workTimeMonths || 0}
                    onChange={(e) => setFormData({ ...formData, workTimeMonths: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-3 py-2 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#506868] mb-1">Date of Joining (DOJ):</label>
                  <input
                    type="text"
                    value={formData.doj || ''}
                    onChange={(e) => setFormData({ ...formData, doj: e.target.value })}
                    className="w-full bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-3 py-2 text-xs text-[#304848] focus:border-[#2AAFA3] focus:outline-none"
                  />
                </div>
              </div>

              {/* Machine Competencies Header */}
              <div className="pt-2 border-t border-[#E0E8E8]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#405858]">Nilai Poin Mesin (Kolom N Spreadsheet):</h4>
                  <span className="text-[10px] text-[#788888] bg-[#F0F4F4] px-2 py-0.5 rounded-full font-medium">Maks. 3 Poin per mesin</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#788888] mb-1">Lockstitch (Poin):</label>
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
                    <label className="block text-[11px] text-[#788888] mb-1">Overlock (Poin):</label>
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
                    <label className="block text-[11px] text-[#788888] mb-1">Flatseam (Poin):</label>
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
                    <label className="block text-[11px] text-[#788888] mb-1">Special / Press (Poin):</label>
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
                    <label className="block text-[11px] text-[#788888] mb-1">Button Hole (Poin):</label>
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
                    <label className="block text-[11px] text-[#788888] mb-1">Button Set (Poin):</label>
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

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-[#E0E8E8] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#E0F0F0] text-[#405858] hover:bg-[#C8D8D8] transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#D0A018] hover:bg-[#B88C10] text-white shadow-sm transition-colors cursor-pointer"
                >
                  Simpan Data
                </button>
              </div>

            </form>

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
                <h3 className="text-base font-bold text-[#304848]">Tandai Operator Resigned</h3>
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
              <p>Apakah Anda yakin ingin menandai operator ini sebagai <strong className="text-[#e11d48]">RESIGNED</strong>?</p>
              
              <div className="p-3 bg-[#F8F8F8] rounded-xl border border-[#E0E8E8] space-y-1.5 font-mono text-[11px]">
                <div><span className="text-[#788888]">Nama:</span> <strong className="text-[#304848]">{resignTargetOp.name}</strong></div>
                <div><span className="text-[#788888]">NIK:</span> <strong className="text-[#304848]">{resignTargetOp.nik}</strong></div>
                <div><span className="text-[#788888]">Pabrik / Line:</span> <strong className="text-[#304848]">{resignTargetOp.factory} / {resignTargetOp.line}</strong></div>
                <div><span className="text-[#788888]">Periode Efektif:</span> <strong className="text-[#304848]">Bulan {selectedMonth}, {selectedYear}</strong></div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900 text-[11px]">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Permintaan status Resigned akan dikirimkan langsung ke backend <strong>Google Apps Script Web App</strong> untuk sinkronisasi ke Google Sheets PT. Winners International.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E0E8E8]">
              <button
                type="button"
                onClick={() => setResignTargetOp(null)}
                disabled={isResigning}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#E0F0F0] text-[#405858] hover:bg-[#C8D8D8] transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
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
                    <span>Mengirim ke Sheets...</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>Konfirmasi Resign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
