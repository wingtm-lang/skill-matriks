import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  X, 
  CheckSquare, 
  Square, 
  Sparkles, 
  Building2, 
  Calendar, 
  Users, 
  Award,
  Loader2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers
} from 'lucide-react';
import { Operator } from '../types';
import { 
  exportSkillMatrixPDF, 
  generateSkillMatrixPDFBlob 
} from '../utils/pdfExport';
import { 
  isOperatorResignedAtPeriod, 
  getOperatorMultiSkillCount
} from '../utils/ieCalculations';
import { 
  getOperatorTotalPoints, 
  getGradeFromTotalPoints 
} from '../data/mockData';
import { useLanguage } from '../i18n/LanguageContext';

interface ExportPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  operators: Operator[];
  selectedFactory: string;
  selectedLine: string;
  selectedMonth: number;
  selectedYear: number;
}

export const ExportPDFModal: React.FC<ExportPDFModalProps> = ({
  isOpen,
  onClose,
  operators,
  selectedFactory,
  selectedLine,
  selectedMonth,
  selectedYear
}) => {
  const { language, getMonthName } = useLanguage();
  const isEn = language === 'en';

  // Export & Display Options (Default to Portrait A4 as requested)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [includeResigned, setIncludeResigned] = useState<boolean>(true);
  const [includeSummary, setIncludeSummary] = useState<boolean>(true);
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [multiSkillOnlyFilter, setMultiSkillOnlyFilter] = useState<boolean>(false);

  // Zoom & View state
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<'preview' | 'options'>('preview');

  const monthName = getMonthName(selectedMonth);

  // Filtered operators for export & preview
  const filteredOperators = useMemo(() => {
    let list = operators;
    if (!includeResigned) {
      list = list.filter(op => !isOperatorResignedAtPeriod(op, selectedMonth, selectedYear));
    }
    if (multiSkillOnlyFilter) {
      list = list.filter(op => getOperatorMultiSkillCount(op) >= 2);
    }
    return list;
  }, [operators, includeResigned, multiSkillOnlyFilter, selectedMonth, selectedYear]);

  // Analytics Computation for Header & KPI Cards
  const stats = useMemo(() => {
    let totalActive = 0;
    let totalResigned = 0;
    let multiSkillCount = 0;
    let totalPointsSum = 0;
    const gradeCounts = { S: 0, A: 0, B: 0, C: 0, HELPER: 0 };
    const machineCounts = {
      lockstitch: 0,
      overlock: 0,
      flatseam: 0,
      special: 0,
      buttonHole: 0,
      buttonSet: 0
    };

    filteredOperators.forEach(op => {
      const isRes = isOperatorResignedAtPeriod(op, selectedMonth, selectedYear);
      if (isRes) {
        totalResigned++;
      } else {
        totalActive++;
        const pts = getOperatorTotalPoints(op);
        totalPointsSum += pts;
        const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
        const gradeObj = getGradeFromTotalPoints(pts, isHelper);
        const letter = gradeObj.letter as keyof typeof gradeCounts;
        if (gradeCounts[letter] !== undefined) {
          gradeCounts[letter]++;
        } else {
          gradeCounts.C++;
        }

        const ms = getOperatorMultiSkillCount(op);
        if (ms >= 2) multiSkillCount++;

        if (op.lockstitch && op.lockstitch > 0) machineCounts.lockstitch++;
        if (op.overlock && op.overlock > 0) machineCounts.overlock++;
        if (op.flatseam && op.flatseam > 0) machineCounts.flatseam++;
        if (op.special && op.special > 0) machineCounts.special++;
        if (op.buttonHole && op.buttonHole > 0) machineCounts.buttonHole++;
        if (op.buttonSet && op.buttonSet > 0) machineCounts.buttonSet++;
      }
    });

    const avgPoints = totalActive > 0 ? (totalPointsSum / totalActive).toFixed(1) : '0.0';
    const multiSkillPercent = totalActive > 0 ? Math.round((multiSkillCount / totalActive) * 100) : 0;

    return {
      totalActive,
      totalResigned,
      multiSkillCount,
      multiSkillPercent,
      avgPoints,
      gradeCounts,
      machineCounts
    };
  }, [filteredOperators, selectedMonth, selectedYear]);

  // Page chunking for realistic A4 sheets
  // Portrait: Page 1 with Summary fits ~14-16 items; subsequent pages fit ~22-26 items
  // Landscape: Page 1 fits ~10-12 items; subsequent pages fit ~18 items
  const pagesData = useMemo(() => {
    if (filteredOperators.length === 0) {
      return [[]];
    }

    const isPortrait = orientation === 'portrait';
    const firstPageCapacity = isPortrait 
      ? (includeSummary ? 15 : 22)
      : (includeSummary ? 11 : 16);
    const subsequentPageCapacity = isPortrait ? 24 : 17;

    const pages: Operator[][] = [];
    let currentIdx = 0;

    // Page 1
    const firstBatch = filteredOperators.slice(0, firstPageCapacity);
    pages.push(firstBatch);
    currentIdx += firstBatch.length;

    // Remaining pages
    while (currentIdx < filteredOperators.length) {
      const nextBatch = filteredOperators.slice(currentIdx, currentIdx + subsequentPageCapacity);
      pages.push(nextBatch);
      currentIdx += nextBatch.length;
    }

    return pages;
  }, [filteredOperators, orientation, includeSummary]);

  // Keep activePageIndex within valid bounds
  const safePageIndex = Math.min(activePageIndex, Math.max(0, pagesData.length - 1));

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      exportSkillMatrixPDF({
        operators: filteredOperators,
        selectedFactory,
        selectedLine,
        selectedMonth,
        selectedYear,
        includeResigned,
        includeSummary,
        includeSignatures,
        language,
        orientation
      });

      setTimeout(() => {
        setIsDownloading(false);
      }, 500);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      setIsDownloading(false);
    }
  };

  const handleOpenFullTab = () => {
    try {
      const blob = generateSkillMatrixPDFBlob({
        operators: filteredOperators,
        selectedFactory,
        selectedLine,
        selectedMonth,
        selectedYear,
        includeResigned,
        includeSummary,
        includeSignatures,
        language,
        orientation
      });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to open PDF in new tab:', err);
    }
  };

  const docIdStr = 'WI.FR.LEAN.02.03';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* TOP MODAL HEADER */}
        <div className="bg-[#244646] text-white px-5 py-3.5 flex items-center justify-between border-b border-teal-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <FileText className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base leading-tight">
                  {isEn ? 'Skill Matrix PDF Export & Live Document Sheet' : 'Pratinjau & Ekspor PDF Skill Matrix'}
                </h3>
                <span className="bg-amber-400 text-teal-950 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-xs">
                  {orientation === 'portrait' ? 'A4 Portrait' : 'A4 Landscape'}
                </span>
              </div>
              <p className="text-xs text-teal-200/80">
                PT. Winners International — Industrial Engineering Standard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Tab Switcher */}
            <div className="flex md:hidden bg-teal-900/60 p-0.5 rounded-lg border border-teal-700/50 mr-1">
              <button
                type="button"
                onClick={() => setMobileTab('preview')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  mobileTab === 'preview' ? 'bg-white text-[#244646]' : 'text-teal-200'
                }`}
              >
                {isEn ? 'Preview' : 'Pratinjau'}
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('options')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  mobileTab === 'options' ? 'bg-white text-[#244646]' : 'text-teal-200'
                }`}
              >
                {isEn ? 'Options' : 'Opsi'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-teal-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN BODY (SPLIT VIEW: CONFIG ON LEFT, LIVE DOCUMENT SHEET ON RIGHT) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT SIDEBAR: REPORT CONFIGURATION & FILTERS */}
          <div 
            className={`w-full md:w-[350px] lg:w-[370px] bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto p-4 space-y-3.5 ${
              mobileTab === 'options' ? 'block' : 'hidden md:flex'
            }`}
          >
            {/* REPORT METADATA SUMMARY */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">
                <span className="uppercase tracking-wider text-[10px] text-slate-500">
                  {isEn ? 'Target Line & Period' : 'Target Lini & Periode'}
                </span>
                <span className="text-[11px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded font-semibold">
                  {filteredOperators.length} {isEn ? 'Records' : 'Operator'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <div className="truncate">
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">{isEn ? 'Location' : 'Lokasi'}</span>
                    <span className="font-semibold text-slate-800 truncate block">{selectedFactory} • {selectedLine}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">{isEn ? 'Period' : 'Periode'}</span>
                    <span className="font-semibold text-slate-800">{monthName} {selectedYear}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">{isEn ? 'Manpower' : 'Manpower'}</span>
                    <span className="font-semibold text-slate-800">{stats.totalActive} Aktif ({stats.totalResigned} Resign)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">{isEn ? 'Multi-Skill' : 'Multi-Skill'}</span>
                    <span className="font-semibold text-slate-800">{stats.multiSkillCount} org ({stats.multiSkillPercent}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ORIENTATION SELECTOR (PORTRAIT IS DEFAULT) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                {isEn ? 'Page Orientation' : 'Orientasi Halaman'}
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setOrientation('portrait');
                    setActivePageIndex(0);
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    orientation === 'portrait'
                      ? 'bg-white text-[#244646] shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="w-3 h-4 border-2 border-current rounded-xs shrink-0" />
                  <span>Portrait (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOrientation('landscape');
                    setActivePageIndex(0);
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    orientation === 'landscape'
                      ? 'bg-white text-[#244646] shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <div className="w-4 h-3 border-2 border-current rounded-xs shrink-0" />
                  <span>Landscape</span>
                </button>
              </div>
            </div>

            {/* CONTENT TOGGLES */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  {isEn ? 'Include Sections' : 'Komponen & Saringan Data'}
                </label>
              </div>

              {/* Checkbox 1: Executive KPI Summary */}
              <div 
                onClick={() => setIncludeSummary(!includeSummary)}
                className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 hover:border-teal-300 cursor-pointer transition-colors"
              >
                <div className="mt-0.5 text-teal-700 shrink-0">
                  {includeSummary ? (
                    <CheckSquare className="w-4 h-4 text-[#244646]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-800 leading-tight">
                    {isEn ? 'Executive KPI Summary' : 'Ringkasan KPI Eksekutif'}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {isEn ? 'Total MP, Multi-Skill %, Grade & Machine cards' : 'Kartu Manpower, Rasio Multi-Skill, Grade & Mesin'}
                  </p>
                </div>
              </div>

              {/* Checkbox 2: Include Resigned */}
              <div 
                onClick={() => setIncludeResigned(!includeResigned)}
                className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 hover:border-teal-300 cursor-pointer transition-colors"
              >
                <div className="mt-0.5 text-teal-700 shrink-0">
                  {includeResigned ? (
                    <CheckSquare className="w-4 h-4 text-[#244646]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-800 leading-tight">
                    {isEn ? 'Include Resigned Operators' : 'Sertakan Operator Resigned'}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {isEn ? `Show ${stats.totalResigned} resigned records with status badge` : `Menampilkan ${stats.totalResigned} data operator keluar`}
                  </p>
                </div>
              </div>

              {/* Checkbox 3: Official Signatures */}
              <div 
                onClick={() => setIncludeSignatures(!includeSignatures)}
                className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 hover:border-teal-300 cursor-pointer transition-colors"
              >
                <div className="mt-0.5 text-teal-700 shrink-0">
                  {includeSignatures ? (
                    <CheckSquare className="w-4 h-4 text-[#244646]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-800 leading-tight">
                    {isEn ? 'Official Validation Signatures' : 'Lembar Pengesahan Tanda Tangan'}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {isEn ? 'IE Specialist, Supervisor, and Factory Manager' : 'Kolom IE Specialist, Spv Sewing, & Factory Manager'}
                  </p>
                </div>
              </div>

              {/* Checkbox 4: Filter Multi-Skill only */}
              <div 
                onClick={() => setMultiSkillOnlyFilter(!multiSkillOnlyFilter)}
                className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 hover:border-teal-300 cursor-pointer transition-colors"
              >
                <div className="mt-0.5 text-teal-700 shrink-0">
                  {multiSkillOnlyFilter ? (
                    <CheckSquare className="w-4 h-4 text-[#244646]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-800 leading-tight">
                    {isEn ? 'Multi-Skilled Operators Only' : 'Saring: Hanya Multi-Skill (>=2)'}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {isEn ? 'Only operators who master 2 or more machines' : 'Hanya mencetak operator dengan 2+ jenis mesin'}
                  </p>
                </div>
              </div>
            </div>

            {/* AUDIT / GSD COMPLIANCE BANNER */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 mt-auto">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Standar IE & MOST Terakreditasi</span>
              </div>
              <p className="text-[10px] leading-relaxed text-amber-800/90">
                Format dokumen A4 Portrait beresolusi tajam, siap cetak untuk papan pengumuman lini jahit, binder dokumen IE, dan audit kepatuhan buyer internasional.
              </p>
            </div>
          </div>

          {/* RIGHT MAIN PANE: HIGH-FIDELITY LIVE A4 DOCUMENT SHEET (IMMUNE TO CHROME BLOCKS) */}
          <div 
            className={`flex-1 bg-slate-200/90 flex flex-col overflow-hidden ${
              mobileTab === 'preview' ? 'flex' : 'hidden md:flex'
            }`}
          >
            {/* PREVIEW TOOLBAR WITH ZOOM & PAGE NAVIGATION */}
            <div className="bg-white border-b border-slate-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Pratinjau Lembar A4 Asli</span>
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  • {orientation === 'portrait' ? 'A4 Portrait (210 × 297 mm)' : 'A4 Landscape (297 × 210 mm)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Page Selector if multiple pages */}
                {pagesData.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                    <button
                      type="button"
                      onClick={() => setActivePageIndex(prev => Math.max(0, prev - 1))}
                      disabled={safePageIndex === 0}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-40 cursor-pointer"
                      title="Halaman Sebelumnya"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1 text-[11px]">
                      Hal {safePageIndex + 1} / {pagesData.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivePageIndex(prev => Math.min(pagesData.length - 1, prev + 1))}
                      disabled={safePageIndex === pagesData.length - 1}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-40 cursor-pointer"
                      title="Halaman Berikutnya"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.max(60, prev - 15))}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200 cursor-pointer"
                    title="Perkecil (-)"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono px-1.5 font-bold text-slate-700 min-w-[38px] text-center">
                    {zoomLevel}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(prev => Math.min(140, prev + 15))}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200 cursor-pointer"
                    title="Perbesar (+)"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(100)}
                    className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200 cursor-pointer border-l border-slate-300"
                    title="Reset 100%"
                  >
                    Reset
                  </button>
                </div>

                {/* Open in Standalone Tab */}
                <button
                  type="button"
                  onClick={handleOpenFullTab}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                  title="Buka PDF di tab baru browser"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{isEn ? 'Open PDF' : 'Buka Tab Baru'}</span>
                </button>
              </div>
            </div>

            {/* PREVIEW CANVAS CONTAINER (SCROLLABLE REAL A4 SHEET) */}
            <div className="flex-1 p-3 sm:p-6 overflow-auto relative flex justify-center items-start bg-slate-300/70">
              
              {/* THE AUTHENTIC A4 PAPER SHEET */}
              <div 
                style={{ 
                  transform: `scale(${zoomLevel / 100})`, 
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out'
                }}
                className={`bg-white shadow-2xl border border-slate-300 text-slate-900 rounded-sm relative flex flex-col justify-between select-text shrink-0 my-2 ${
                  orientation === 'portrait' 
                    ? 'w-[794px] min-h-[1123px] p-[38px]' 
                    : 'w-[1123px] min-h-[794px] p-[42px]'
                }`}
              >
                {/* TOP ACCENT STRIPES */}
                <div className="absolute top-0 left-0 right-0 h-[6px] bg-[#244646]" />
                <div className="absolute top-[6px] left-0 right-0 h-[2px] bg-[#C48E14]" />

                {/* SHEET MAIN CONTENT */}
                <div className="space-y-4">
                  
                  {/* HEADER & METADATA SECTION */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                    <div>
                      <h1 className="text-lg font-black text-[#244646] tracking-tight">
                        PT. WINNERS INTERNATIONAL
                      </h1>
                      <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                        INDUSTRIAL ENGINEERING & LEAN MANUFACTURING SYSTEM
                      </p>
                      <h2 className="text-xs font-bold text-slate-800 mt-1 uppercase">
                        {isEn 
                          ? 'Sewing Operator Skill Matrix & Competency Report' 
                          : 'Laporan Matriks Keterampilan & Kompetensi Operator Jahit'}
                      </h2>
                      <p className="text-[9.5px] italic text-slate-400">
                        Standar: General Sewing Data (GSD) & Metodologi Evaluasi MOST
                      </p>
                    </div>

                    {/* Metadata Card Box */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] min-w-[210px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isEn ? 'Factory / Line' : 'Pabrik / Lini'}:</span>
                        <span className="font-bold text-slate-800">{selectedFactory} • {selectedLine}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isEn ? 'Period' : 'Periode'}:</span>
                        <span className="font-bold text-slate-800">{monthName} {selectedYear}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{isEn ? 'Generated' : 'Dicetak'}:</span>
                        <span className="font-semibold text-slate-700">
                          {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex justify-between pt-0.5 border-t border-slate-200">
                        <span className="text-slate-500">Doc ID:</span>
                        <span className="font-mono font-bold text-[#C48E14]">{docIdStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* EXECUTIVE KPI SUMMARY CARDS (ON FIRST PAGE) */}
                  {includeSummary && safePageIndex === 0 && (
                    <div className={`grid gap-2 text-xs ${orientation === 'portrait' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                      {/* Card 1: Manpower */}
                      <div className="bg-[#f1f8f8] border border-[#bedada] rounded-lg p-2.5">
                        <span className="text-[9px] font-bold text-[#465f5f] uppercase tracking-wider block">
                          {isEn ? 'TOTAL MANPOWER' : 'TOTAL OPERATOR (MP)'}
                        </span>
                        <div className="text-base font-extrabold text-[#244646] mt-0.5">
                          {stats.totalActive} {isEn ? 'Active' : 'Aktif'}
                        </div>
                        <span className="text-[9.5px] text-[#8c6464] block">
                          ({stats.totalResigned} {isEn ? 'Resigned/Inactive' : 'Resigned'})
                        </span>
                      </div>

                      {/* Card 2: Multi-Skill */}
                      <div className="bg-[#ecfdf5] border border-[#a7f3d0] rounded-lg p-2.5">
                        <span className="text-[9px] font-bold text-[#166534] uppercase tracking-wider block">
                          {isEn ? 'MULTI-SKILL RATIO (>=2 MACHINES)' : 'RASIO MULTI-SKILL (>=2 MESIN)'}
                        </span>
                        <div className="text-base font-extrabold text-[#166534] mt-0.5">
                          {stats.multiSkillPercent}%
                        </div>
                        <span className="text-[9.5px] text-[#4a725e] block">
                          {stats.multiSkillCount} / {stats.totalActive} {isEn ? 'qualified' : 'operator kompeten'}
                        </span>
                      </div>

                      {/* Card 3: Grade Distribution */}
                      <div className="bg-[#fefce8] border border-[#fef08a] rounded-lg p-2.5">
                        <span className="text-[9px] font-bold text-[#854d0e] uppercase tracking-wider block">
                          {isEn ? 'GRADE DISTRIBUTION' : 'DISTRIBUSI GRADE (S / A / B / C)'}
                        </span>
                        <div className="text-sm font-extrabold text-[#713f12] mt-0.5">
                          S:{stats.gradeCounts.S} • A:{stats.gradeCounts.A} • B:{stats.gradeCounts.B} • C:{stats.gradeCounts.C}
                        </div>
                        <span className="text-[9.5px] text-[#8c6e32] block">
                          Helper: {stats.gradeCounts.HELPER} | Rata Poin: {stats.avgPoints}
                        </span>
                      </div>

                      {/* Card 4: Machine Coverage */}
                      <div className="bg-[#f0f9ff] border border-[#bae6fd] rounded-lg p-2.5">
                        <span className="text-[9px] font-bold text-[#0369a1] uppercase tracking-wider block">
                          {isEn ? 'MACHINE POPULATION' : 'POPULASI MESIN'}
                        </span>
                        <div className="text-xs font-extrabold text-[#0369a1] mt-0.5">
                          SN:{stats.machineCounts.lockstitch} | OL:{stats.machineCounts.overlock} | FS:{stats.machineCounts.flatseam}
                        </div>
                        <span className="text-[9.5px] text-[#5082a0] block">
                          SP:{stats.machineCounts.special} | BTN:{stats.machineCounts.buttonHole + stats.machineCounts.buttonSet}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* SKILL MATRIX TABLE */}
                  <div className="border border-slate-300 rounded-md overflow-hidden text-[10px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#244646] text-white font-bold text-center">
                          <th className="py-1.5 px-1 w-6 border-r border-teal-800">NO</th>
                          <th className="py-1.5 px-1.5 w-16 border-r border-teal-800">NIK</th>
                          <th className="py-1.5 px-2 text-left border-r border-teal-800">{isEn ? 'OPERATOR NAME' : 'NAMA OPERATOR'}</th>
                          <th className="py-1.5 px-1 w-14 border-r border-teal-800">{isEn ? 'TENURE' : 'MASA KERJA'}</th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">SN<br/><span className="text-[8px] font-normal">Lock</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">OL<br/><span className="text-[8px] font-normal">Obras</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">FS<br/><span className="text-[8px] font-normal">Flat</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">SP<br/><span className="text-[8px] font-normal">Special</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">BTN<br/><span className="text-[8px] font-normal">Hole</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">BTN<br/><span className="text-[8px] font-normal">Set</span></th>
                          <th className="py-1.5 px-1 w-12 border-r border-teal-800">{isEn ? 'MULTI' : 'MULTI'}</th>
                          <th className="py-1.5 px-1 w-12 border-r border-teal-800">{isEn ? 'TOTAL' : 'TOTAL'}</th>
                          <th className="py-1.5 px-1 w-14 border-r border-teal-800">GRADE</th>
                          <th className="py-1.5 px-1.5 w-16">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {pagesData[safePageIndex]?.length > 0 ? (
                          pagesData[safePageIndex].map((op, idx) => {
                            // Absolute index
                            let globalIdx = 0;
                            for (let p = 0; p < safePageIndex; p++) {
                              globalIdx += pagesData[p].length;
                            }
                            globalIdx += idx + 1;

                            const isResigned = isOperatorResignedAtPeriod(op, selectedMonth, selectedYear);
                            const totalPts = getOperatorTotalPoints(op);
                            const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
                            const gradeObj = getGradeFromTotalPoints(totalPts, isHelper);
                            const msCount = getOperatorMultiSkillCount(op);

                            const renderVal = (v: number | null | undefined) => {
                              if (!v || v <= 0) return <span className="text-slate-300">-</span>;
                              return <span className="font-semibold text-slate-800">{v}</span>;
                            };

                            return (
                              <tr 
                                key={op.id || idx} 
                                className={`text-center ${idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'} ${
                                  isResigned ? 'text-slate-400 bg-red-50/20' : 'text-slate-800'
                                }`}
                              >
                                <td className="py-1 px-1 font-mono text-[9px] border-r border-slate-200">{globalIdx}</td>
                                <td className="py-1 px-1.5 font-mono font-semibold text-[9.5px] border-r border-slate-200">{op.nik}</td>
                                <td className="py-1 px-2 text-left font-bold border-r border-slate-200 truncate max-w-[170px]">{op.name}</td>
                                <td className="py-1 px-1 text-[9px] border-r border-slate-200">{op.workTimeMonths ? `${op.workTimeMonths} bln` : '-'}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.lockstitch)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.overlock)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.flatseam)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.special)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.buttonHole)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.buttonSet)}</td>
                                <td className={`py-1 px-1 font-bold border-r border-slate-200 ${msCount >= 2 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {msCount > 0 ? `${msCount} Msn` : '-'}
                                </td>
                                <td className="py-1 px-1 font-extrabold border-r border-slate-200">{totalPts}</td>
                                <td className="py-1 px-1 border-r border-slate-200">
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-extrabold ${gradeObj.cssBadge}`}>
                                    {gradeObj.letter || gradeObj.label}
                                  </span>
                                </td>
                                <td className="py-1 px-1.5 font-bold text-[9px]">
                                  {isResigned ? (
                                    <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded">Resign</span>
                                  ) : (
                                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Aktif</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={14} className="py-8 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <Users className="w-6 h-6 text-slate-300" />
                                <span className="font-semibold text-xs text-slate-500">
                                  {isEn ? 'No operator records found for this line.' : 'Tidak ada data operator untuk lini ini pada periode terpilih.'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Pastikan lini dan pabrik memiliki operator aktif, atau periksa filter yang sedang aktif.
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SIGNATURES BLOCK (ON LAST PAGE) */}
                  {includeSignatures && safePageIndex === pagesData.length - 1 && (
                    <div className="pt-2">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        {/* Box 1 */}
                        <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                          <p className="text-[9px] font-bold text-[#244646] uppercase">DIBUAT OLEH (IE OFFICER)</p>
                          <p className="text-[8px] text-slate-400 mb-6">Industrial Engineering Dept.</p>
                          <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
                          <p className="text-[9px] font-bold text-slate-700">( IE Specialist )</p>
                        </div>

                        {/* Box 2 */}
                        <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                          <p className="text-[9px] font-bold text-[#244646] uppercase">DIVERIFIKASI (SPV SEWING)</p>
                          <p className="text-[8px] text-slate-400 mb-6">Sewing Production Line</p>
                          <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
                          <p className="text-[9px] font-bold text-slate-700">( {selectedLine} Supervisor )</p>
                        </div>

                        {/* Box 3 */}
                        <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                          <p className="text-[9px] font-bold text-[#244646] uppercase">DISETUJUI (PABRIK / IE MGR)</p>
                          <p className="text-[8px] text-slate-400 mb-6">Factory & IE Management</p>
                          <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
                          <p className="text-[9px] font-bold text-slate-700">( {selectedFactory} Management )</p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* BOTTOM FOOTER ON PAPER */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[8.5px] text-slate-400">
                  <span>PT. WINNERS INTERNATIONAL — INDUSTRIAL ENGINEERING SYSTEM | DOKUMEN INTERNAL & RAHASIA</span>
                  <span className="font-bold text-slate-600">
                    Halaman {safePageIndex + 1} dari {pagesData.length}
                  </span>
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* BOTTOM MODAL ACTION BAR */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isEn 
                ? `Ready to export ${filteredOperators.length} operator records in ${orientation} format`
                : `Siap mengekspor ${filteredOperators.length} data operator dalam format ${orientation}`}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isDownloading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              {isEn ? 'Close' : 'Tutup'}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-[#244646] hover:bg-[#1a3333] text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>{isEn ? 'Generating & Downloading...' : 'Membuat & Mengunduh PDF...'}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>{isEn ? 'Download PDF Report' : 'Unduh Laporan PDF'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
