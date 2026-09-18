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
import { Operator, LineLeader } from '../types';
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
  getGradeFromTotalPoints,
  DEFAULT_LINE_LEADERS,
  getLineLeader
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
  lineLeaders?: LineLeader[];
}

export const ExportPDFModal: React.FC<ExportPDFModalProps> = ({
  isOpen,
  onClose,
  operators,
  selectedFactory,
  selectedLine,
  selectedMonth,
  selectedYear,
  lineLeaders
}) => {
  const { language, getMonthName, t } = useLanguage();
  const pdfT = t.exportPdfModal;

  // Export & Display Options (Default to Portrait A4 as requested)
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [includeResigned, setIncludeResigned] = useState<boolean>(true);
  const [includeSummary, setIncludeSummary] = useState<boolean>(true);
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [includeCurrentOperation, setIncludeCurrentOperation] = useState<boolean>(true);
  const [selectedOperationFilter, setSelectedOperationFilter] = useState<string>('ALL');
  const [multiSkillOnlyFilter, setMultiSkillOnlyFilter] = useState<boolean>(false);

  // Unique list of processes / operations in current scope
  const uniqueOperations = useMemo(() => {
    const set = new Set<string>();
    operators.forEach(op => {
      const opName = (op.process || op.currentOperation || '').trim();
      if (opName && opName !== '-') {
        set.add(opName);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [operators]);

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
    if (selectedOperationFilter !== 'ALL') {
      list = list.filter(op => {
        const curOp = (op.process || op.currentOperation || '').trim();
        return curOp.toLowerCase() === selectedOperationFilter.toLowerCase();
      });
    }
    return list;
  }, [operators, includeResigned, multiSkillOnlyFilter, selectedOperationFilter, selectedMonth, selectedYear]);

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
        const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER' || (op as any).grade === 'H';
        const gradeObj = getGradeFromTotalPoints(pts, isHelper);
        const letter = gradeObj.letter;
        if (letter === 'H' || gradeObj.grade === 'HELPER' || isHelper) {
          gradeCounts.HELPER++;
        } else if (letter === 'S') {
          gradeCounts.S++;
        } else if (letter === 'A') {
          gradeCounts.A++;
        } else if (letter === 'B') {
          gradeCounts.B++;
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
  // With the new Unified Executive KPI Strip saving 50% vertical space, Page 1 can comfortably fit more rows
  const pagesData = useMemo(() => {
    if (filteredOperators.length === 0) {
      return [[]];
    }

    const isPortrait = orientation === 'portrait';
    const firstPageCapacity = isPortrait 
      ? (includeSummary ? 18 : 24)
      : (includeSummary ? 13 : 17);
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
        includeCurrentOperation,
        language,
        orientation,
        lineLeaders
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
        includeCurrentOperation,
        language,
        orientation,
        lineLeaders
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
                  {pdfT.modalTitle}
                </h3>
                <span className="bg-amber-400 text-teal-950 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wider shadow-xs">
                  {orientation === 'portrait' ? pdfT.portraitBadge : pdfT.landscapeBadge}
                </span>
              </div>
              <p className="text-xs text-teal-200/80">
                {pdfT.modalSubtitle}
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
                {pdfT.tabPreview}
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('options')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  mobileTab === 'options' ? 'bg-white text-[#244646]' : 'text-teal-200'
                }`}
              >
                {pdfT.tabOptions}
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-teal-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={pdfT.closeTooltip}
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
                  {pdfT.targetSectionTitle}
                </span>
                <span className="text-[11px] font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded font-semibold">
                  {filteredOperators.length} {pdfT.recordsCount}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <div className="truncate">
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">{pdfT.locationLabel}</span>
                    <span className="font-semibold text-slate-800 truncate block">{selectedFactory} • {selectedLine}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">{pdfT.periodLabel}</span>
                    <span className="font-semibold text-slate-800">{monthName} {selectedYear}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">{pdfT.manpowerLabel}</span>
                    <span className="font-semibold text-slate-800">{stats.totalActive} {pdfT.activeText} ({stats.totalResigned} {pdfT.resignedText})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-semibold">{pdfT.multiSkillLabel}</span>
                    <span className="font-semibold text-slate-800">{stats.multiSkillCount} {pdfT.personsUnit} ({stats.multiSkillPercent}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ORIENTATION SELECTOR (PORTRAIT IS DEFAULT) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                {pdfT.orientationLabel}
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
                  <span>{pdfT.portraitOption}</span>
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
                  <span>{pdfT.landscapeOption}</span>
                </button>
              </div>
            </div>

            {/* CONTENT TOGGLES */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  {pdfT.includeSectionsLabel}
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
                    {pdfT.summaryCheckboxTitle}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {pdfT.summaryCheckboxDesc}
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
                    {pdfT.resignedCheckboxTitle}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {pdfT.resignedCheckboxDesc}
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
                    {pdfT.signaturesCheckboxTitle}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {pdfT.signaturesCheckboxDesc}
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
                    {pdfT.multiSkillOnlyTitle}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {pdfT.multiSkillOnlyDesc}
                  </p>
                </div>
              </div>

              {/* Checkbox 5: Include Current Operation Column */}
              <div 
                onClick={() => setIncludeCurrentOperation(!includeCurrentOperation)}
                className="flex items-start gap-2.5 p-2.5 bg-white rounded-xl border border-slate-200 hover:border-teal-300 cursor-pointer transition-colors"
              >
                <div className="mt-0.5 text-teal-700 shrink-0">
                  {includeCurrentOperation ? (
                    <CheckSquare className="w-4 h-4 text-[#244646]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="text-xs">
                  <p className="font-semibold text-slate-800 leading-tight">
                    {pdfT.currentOperationCheckboxTitle}
                  </p>
                  <p className="text-slate-500 text-[10px] mt-0.5">
                    {pdfT.currentOperationCheckboxDesc}
                  </p>
                </div>
              </div>

              {/* Filter by Current Operation (if operations exist) */}
              {uniqueOperations.length > 0 && (
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800">
                      {pdfT.filterOperationTitle}
                    </span>
                    {selectedOperationFilter !== 'ALL' && (
                      <button 
                        onClick={() => setSelectedOperationFilter('ALL')}
                        className="text-[10px] font-semibold text-teal-700 hover:text-teal-900 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedOperationFilter}
                    onChange={(e) => setSelectedOperationFilter(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value="ALL">
                      {pdfT.allOperationsOption} ({operators.length})
                    </option>
                    {uniqueOperations.map((opName) => {
                      const count = operators.filter(o => ((o.process || o.currentOperation || '').trim().toLowerCase() === opName.toLowerCase())).length;
                      return (
                        <option key={opName} value={opName}>
                          {opName} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            {/* AUDIT / GSD COMPLIANCE BANNER */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 mt-auto">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{pdfT.auditBannerTitle}</span>
              </div>
              <p className="text-[10px] leading-relaxed text-amber-800/90">
                {pdfT.auditBannerDesc}
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
                  <span>{pdfT.realA4PreviewBadge}</span>
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
                      title={pdfT.prevPageTooltip}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1 text-[11px]">
                      {pdfT.pageIndicator} {safePageIndex + 1} {pdfT.ofText} {pagesData.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActivePageIndex(prev => Math.min(pagesData.length - 1, prev + 1))}
                      disabled={safePageIndex === pagesData.length - 1}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-40 cursor-pointer"
                      title={pdfT.nextPageTooltip}
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
                    title={pdfT.zoomOutTooltip}
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
                    title={pdfT.zoomInTooltip}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(100)}
                    className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200 cursor-pointer border-l border-slate-300"
                    title={pdfT.resetZoomTooltip}
                  >
                    Reset
                  </button>
                </div>

                {/* Open in Standalone Tab */}
                <button
                  type="button"
                  onClick={handleOpenFullTab}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-300 transition-colors cursor-pointer"
                  title={pdfT.openPdfTabTooltip}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{pdfT.openPdfTabBtn}</span>
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
                    ? 'w-[794px] min-h-[1123px] p-[16px]' 
                    : 'w-[1123px] min-h-[794px] p-[18px]'
                }`}
              >
                {/* SHEET MAIN CONTENT */}
                <div className="space-y-4">
                  
                  {/* HEADER & METADATA SECTION */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <img
                          src="/winners-logo.png"
                          alt="PT. Winners International"
                          className="w-6 h-6 object-contain shrink-0"
                        />
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                          {pdfT.companyTitle}
                        </h1>
                      </div>
                      <h2 className="text-sm font-extrabold text-[#244646] mt-1.5 ml-[34px] tracking-wide uppercase">
                        {pdfT.documentTitle}
                      </h2>
                    </div>

                    {/* Metadata Card Box */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10px] min-w-[210px] space-y-1">
                      <div className="flex justify-between pb-0.5 border-b border-slate-200">
                        <span className="text-slate-500">{pdfT.docIdLabel}:</span>
                        <span className="font-mono font-bold text-[#C48E14]">{docIdStr}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{pdfT.factoryLineLabel}:</span>
                        <span className="font-bold text-slate-800">{selectedFactory} • {selectedLine}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{pdfT.periodLabel}:</span>
                        <span className="font-bold text-slate-800">{monthName} {selectedYear}</span>
                      </div>
                    </div>
                  </div>

                  {/* UNIFIED EXECUTIVE KPI STRIP (ON FIRST PAGE) */}
                  {includeSummary && safePageIndex === 0 && (
                    <div className="bg-slate-50/90 border border-slate-200 rounded-lg overflow-hidden">
                      <div className="grid grid-cols-4 divide-x divide-slate-200 text-xs">
                        {/* Metric 1: Total Manpower */}
                        <div className="p-2.5 flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#244646] shrink-0" />
                            <span className="text-[8.5px] font-bold text-slate-600 uppercase tracking-wider truncate">
                              {pdfT.kpiTotalManpower}
                            </span>
                          </div>
                          <div className="text-sm font-extrabold text-[#244646] my-auto leading-none">
                            {stats.totalActive} <span className="text-[9.5px] font-semibold text-slate-600">{pdfT.kpiActiveLabel}</span>
                          </div>
                        </div>

                        {/* Metric 2: Multi-Skill Ratio */}
                        <div className="p-2.5 flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                            <span className="text-[8.5px] font-bold text-slate-600 uppercase tracking-wider truncate">
                              {pdfT.kpiMultiSkillRatio}
                            </span>
                          </div>
                          <div className="text-sm font-extrabold text-emerald-700 mt-1 leading-none">
                            {stats.multiSkillPercent}%
                          </div>
                          <span className="text-[8.5px] text-slate-500 mt-1 block font-medium truncate">
                            {stats.multiSkillCount} / {stats.totalActive} {pdfT.kpiQualifiedCount}
                          </span>
                        </div>

                        {/* Metric 3: Grade Distribution */}
                        <div className="p-2.5 flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                            <span className="text-[8.5px] font-bold text-slate-600 uppercase tracking-wider truncate">
                              {pdfT.kpiGradeDistribution}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className="px-1 py-0.5 rounded bg-purple-100 text-purple-800 font-extrabold text-[8.5px] leading-none">S:{stats.gradeCounts.S}</span>
                            <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[8.5px] leading-none">A:{stats.gradeCounts.A}</span>
                            <span className="px-1 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold text-[8.5px] leading-none">B:{stats.gradeCounts.B}</span>
                            <span className="px-1 py-0.5 rounded bg-slate-200 text-slate-700 font-extrabold text-[8.5px] leading-none">C:{stats.gradeCounts.C}</span>
                          </div>
                          <span className="text-[8.5px] text-slate-500 mt-1 block truncate">
                            {pdfT.kpiHelperAvg.replace('{helper}', String(stats.gradeCounts.HELPER)).replace('{avg}', String(stats.avgPoints))}
                          </span>
                        </div>

                        {/* Metric 4: Machine Population */}
                        <div className="p-2.5 flex flex-col justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-600 shrink-0" />
                            <span className="text-[8.5px] font-bold text-slate-600 uppercase tracking-wider truncate">
                              {pdfT.kpiMachinePopulation}
                            </span>
                          </div>
                          <div className="text-[9.5px] font-bold text-slate-800 font-mono mt-1 leading-none truncate">
                            SN:{stats.machineCounts.lockstitch} · OL:{stats.machineCounts.overlock} · FS:{stats.machineCounts.flatseam}
                          </div>
                          <div className="text-[8.5px] font-bold text-slate-700 font-mono mt-1 leading-none truncate">
                            SP:{stats.machineCounts.special} · BTN Hole:{stats.machineCounts.buttonHole} · BTN Set:{stats.machineCounts.buttonSet}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SKILL MATRIX TABLE */}
                  <div className="border border-slate-300 rounded-md overflow-hidden text-[10px]">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#244646] text-white font-bold text-center">
                          <th className="py-1.5 px-1 w-6 border-r border-teal-800">{pdfT.thNo}</th>
                          <th className="py-1.5 px-1.5 w-16 border-r border-teal-800">{pdfT.thNik}</th>
                          <th className={`py-1.5 px-2 text-left border-r border-teal-800 ${includeCurrentOperation ? 'min-w-[130px]' : 'min-w-[170px]'}`}>{pdfT.thOperatorName}</th>
                          <th className="py-1.5 px-1 w-14 border-r border-teal-800">{pdfT.thTenure}</th>
                          {includeCurrentOperation && (
                            <th className="py-1.5 px-1.5 w-28 border-r border-teal-800 text-left">Current Operation</th>
                          )}
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">SN<br/><span className="text-[8px] font-normal">{pdfT.thLockstitch}</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">OL<br/><span className="text-[8px] font-normal">{pdfT.thOverlock}</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">FS<br/><span className="text-[8px] font-normal">{pdfT.thFlatseam}</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">SP<br/><span className="text-[8px] font-normal">{pdfT.thSpecial}</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">BTN<br/><span className="text-[8px] font-normal">{pdfT.thButtonHole}</span></th>
                          <th className="py-1 px-1 w-8 border-r border-teal-800 leading-tight">BTN<br/><span className="text-[8px] font-normal">{pdfT.thButtonSet}</span></th>
                          <th className="py-1.5 px-1 w-12 border-r border-teal-800">{pdfT.thMulti}</th>
                          <th className="py-1.5 px-1 w-12 border-r border-teal-800">{pdfT.thTotal}</th>
                          <th className="py-1.5 px-1.5 w-16">{pdfT.thGrade}</th>
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
                            const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER' || (op as any).grade === 'H';
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
                                <td className="py-1 px-2 text-left font-bold border-r border-slate-200 truncate max-w-[200px]">{op.name}</td>
                                <td className="py-1 px-1 text-[9px] border-r border-slate-200">{op.workTimeMonths ? `${op.workTimeMonths} ${pdfT.tenureMonthUnit}` : '-'}</td>
                                {includeCurrentOperation && (
                                  <td className="py-1 px-1.5 text-left text-[8px] font-medium border-r border-slate-200 truncate max-w-[140px]" title={op.process || op.currentOperation}>
                                    {op.process || op.currentOperation || '-'}
                                  </td>
                                )}
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.lockstitch)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.overlock)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.flatseam)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.special)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.buttonHole)}</td>
                                <td className="py-1 px-1 border-r border-slate-200">{renderVal(op.buttonSet)}</td>
                                <td className={`py-1 px-1 font-bold border-r border-slate-200 ${msCount >= 2 ? 'text-emerald-700' : 'text-slate-400'}`}>
                                  {msCount > 0 ? `${msCount} ${pdfT.machineUnit}` : '-'}
                                </td>
                                <td className="py-1 px-1 font-extrabold border-r border-slate-200">{totalPts}</td>
                                <td className="py-1 px-1.5">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[8.5px] font-extrabold ${gradeObj.cssBadge}`}>
                                    {gradeObj.letter || gradeObj.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={includeCurrentOperation ? 14 : 13} className="py-8 text-center text-slate-400">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <Users className="w-6 h-6 text-slate-300" />
                                <span className="font-semibold text-xs text-slate-500">
                                  {pdfT.noOperatorsFound}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {pdfT.noOperatorsHint}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SIGNATURES BLOCK (ON LAST PAGE) */}
                  {includeSignatures && safePageIndex === pagesData.length - 1 && (() => {
                    const leaderInfo = getLineLeader(lineLeaders || DEFAULT_LINE_LEADERS, selectedFactory, selectedLine);
                    return (
                      <div className="pt-2">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          {/* Box 1 */}
                          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                            <p className="text-[9px] font-bold text-[#244646] uppercase">{pdfT.sigCreatedBy}</p>
                            <p className="text-[8px] text-slate-400 mb-5">{pdfT.sigCreatedDept}</p>
                            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
                            <p className="text-[9px] font-bold text-slate-800">{leaderInfo.ie && leaderInfo.ie !== '-' ? leaderInfo.ie : pdfT.sigCreatedRole}</p>
                            <p className="text-[7.5px] text-slate-400">{pdfT.sigCreatedRole}</p>
                          </div>

                          {/* Box 2 */}
                          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                            <p className="text-[9px] font-bold text-[#244646] uppercase">{pdfT.sigVerifiedBy}</p>
                            <p className="text-[8px] text-slate-400 mb-5">{pdfT.sigVerifiedDept}</p>
                            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
                            <p className="text-[9px] font-bold text-slate-800">{leaderInfo.supervisor && leaderInfo.supervisor !== '-' ? leaderInfo.supervisor : pdfT.sigVerifiedRole.replace('{line}', selectedLine)}</p>
                            <p className="text-[7.5px] text-slate-400">{pdfT.sigVerifiedRole.replace('{line}', selectedLine)}</p>
                          </div>

                          {/* Box 3 */}
                          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                            <p className="text-[9px] font-bold text-[#244646] uppercase">{pdfT.sigApprovedBy}</p>
                            <p className="text-[8px] text-slate-400 mb-5">{pdfT.sigApprovedDept}</p>
                            <div className="border-b border-dashed border-slate-300 mx-3 mb-1" />
                            <p className="text-[9px] font-bold text-slate-800">{leaderInfo.chief && leaderInfo.chief !== '-' ? leaderInfo.chief : 'Sewing Chief'}</p>
                            <p className="text-[7.5px] text-slate-400">{pdfT.sigApprovedRole}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* BOTTOM FOOTER ON PAPER */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400">
                  <span className="font-semibold text-slate-500">{pdfT.paperFooterCompany}</span>
                  <span className="text-slate-400 font-medium">
                    {pdfT.generatedLabel}: {new Date().toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="font-bold text-slate-600">
                    {pdfT.pageIndicator} {safePageIndex + 1} {pdfT.ofText} {pagesData.length}
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
              {pdfT.readyExportMessage
                .replace('{count}', String(filteredOperators.length))
                .replace('{orientation}', orientation)}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isDownloading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              {pdfT.closeBtn}
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
                  <span>{pdfT.downloadingBtn}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>{pdfT.downloadBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
