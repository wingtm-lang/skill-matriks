import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { SkillMatrixTab } from './components/SkillMatrixTab';
import { LineBalancingTab } from './components/LineBalancingTab';
import { MultiSkillDevelopmentTab } from './components/MultiSkillDevelopmentTab';
import { IEChatAssistantTab } from './components/IEChatAssistantTab';
import { INITIAL_STYLES, FACTORIES, LINES } from './data/mockData';
import { Operator, GarmentStyle } from './types';
import { 
  sortLinesNumerically, 
  sortFactoriesNumerically, 
  filterOperatorsByPointInTime,
  normalizeFactoryName,
  normalizeLineName,
  MONTH_NAMES_ID,
  isOperatorResignedAtPeriod,
  getPointsFromEfficiency 
} from './utils/ieCalculations';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [styles, setStyles] = useState<GarmentStyle[]>(INITIAL_STYLES);
  const [selectedFactory, setSelectedFactory] = useState<string>('Factory 1');
  const [selectedLine, setSelectedLine] = useState<string>('Line 3');
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // Default September 2026
  const [selectedYear, setSelectedYear] = useState<number>(2026); // Default 2026
  const [activeTab, setActiveTab] = useState<string>('matrix');
  const [userRole, setUserRole] = useState<'VIEWER' | 'EDITOR' | 'ADMIN'>('VIEWER');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Connection & sync state
  const [isLoadingSheets, setIsLoadingSheets] = useState<boolean>(false);
  const [isLiveFromSheets, setIsLiveFromSheets] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [availableFactories, setAvailableFactories] = useState<string[]>(FACTORIES);
  const [availableLines, setAvailableLines] = useState<string[]>(LINES);

  // Fetch live operators directly from Google Apps Script Web App
  const fetchLiveOperators = useCallback(async () => {
    setIsLoadingSheets(true);
    setSyncError(null);

    try {
      // Masukkan URL Web App Google Apps Script kamu secara utuh di sini
      const gasUrl = "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec";

      const response = await fetch(gasUrl);
      const textData = await response.text();

      let result;
      try {
        result = JSON.parse(textData);
      } catch (e) {
        throw new Error("Respons dari Google Sheets bukan JSON yang valid. Periksa deployment GAS.");
      }

      if (result.status === "success" && Array.isArray(result.data)) {
        const rows = result.data;
        const headers: any[] = rows[0] || []; // Baris pertama adalah header spreadsheet
        const dataRows = rows.slice(1); // Baris data operator setelah header

        const findColIdx = (candidates: string[], fallbackIdx: number) => {
          if (!Array.isArray(headers)) return fallbackIdx;
          // 1. Exact match (case-insensitive)
          for (const cand of candidates) {
            const idx = headers.findIndex(
              (h) => typeof h === "string" && h.trim().toUpperCase() === cand.toUpperCase()
            );
            if (idx !== -1) return idx;
          }
          // 2. Starts with / includes match
          for (const cand of candidates) {
            const idx = headers.findIndex(
              (h) => typeof h === "string" && h.toUpperCase().includes(cand.toUpperCase())
            );
            if (idx !== -1) return idx;
          }
          return fallbackIdx;
        };

        const idxWorkerCode = findColIdx(["Worker Code", "NIK", "ID"], 4);
        const idxWorker = findColIdx(["Worker", "Nama", "Operator"], 5);
        const idxFactory = findColIdx(["Factory", "Pabrik"], 0);
        const idxLine = findColIdx(["Line", "Jalur"], 1);
        const idxStatus = findColIdx(["Status"], 17);
        const idxDoj = findColIdx(["Date of Join", "D.O.J", "DOJ"], 6);
        const idxDate = findColIdx(["Date", "Tanggal", "Tgl"], 3);
        const idxRate = findColIdx(["Production Rate (%)", "Actual Rate", "Rate", "Efisiensi"], 12);
        // Prioritaskan "POIN" (Kolom N di index 13) sebelum "point" umum agar tidak salah mendeteksi kolom kalkulasi lain di index 22
        const idxPoints = findColIdx(["POIN", "POINT (KOLOM N)", "POIN MESIN"], 13);
        const idxWorkMonth = findColIdx(["Work Month", "Masa Kerja"], 14);
        const idxDateOfResign = findColIdx(["Date of Resign", "Resign"], 15);
        const idxMachine = findColIdx(["Machine Category", "Kategori Mesin", "Category", "Kategori"], 16);
        const idxMachineName = findColIdx(["Machine", "Mesin", "Nama Mesin"], 7);
        const idxStyleNo = findColIdx(["Style No", "Style"], 8);
        const idxProcess = findColIdx(["Process", "Proses", "Operasi"], 9);

        // Mapping baris spreadsheet ke objek Operator
        const normalizedOps: Operator[] = dataRows.map((row: any, index: number) => {
          const rawProdRate = Number(row[idxRate] ?? row[12] ?? 0);
          // Parse Kolom N / Indeks 13 (POINT) - Standar PT. Winners International: Maksimal 3 Poin per mesin
          const rawPoints = parseFloat(String(row[idxPoints] ?? row[13] ?? "").replace(',', '.').replace(/[^0-9.]/g, '').trim()) || 0;
          let pointVal = rawPoints > 0 ? Math.min(3, Math.max(1, Math.round(rawPoints))) : 0;
          // Standar Sistem Poin IE: 0 Poin (0%), 1 Poin (1-60%), 2 Poin (61-89%), 3 Poin (>90%)
          if (pointVal === 0 && rawProdRate > 0) {
            pointVal = getPointsFromEfficiency(rawProdRate);
          }
          const rawCat = String(row[idxMachine] ?? row[16] ?? "").toUpperCase();
          const rawMachineName = String(row[idxMachineName] ?? row[7] ?? "").toUpperCase();

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

          const rawDate = row[idxDate] ?? row[3] ?? "";
          const rowDateStr = rawDate ? String(rawDate).trim() : "";

          return {
            id: String(row[idxWorkerCode] ?? row[4] ?? index), // Kolom E: Worker Code
            no: index + 1,
            factory: normalizeFactoryName(String(row[idxFactory] ?? row[0] ?? "1")), // Kolom A: Factory
            line: normalizeLineName(String(row[idxLine] ?? row[1] ?? "1")), // Kolom B: Line
            nik: String(row[idxWorkerCode] ?? row[4] ?? ""), // Kolom E: Worker Code
            name: String(row[idxWorker] ?? row[5] ?? "Unknown"), // Kolom F: Worker
            date: rowDateStr, // Kolom D: Date
            recordDate: rowDateStr,
            machine: String(row[idxMachineName] ?? row[7] ?? ""), // Kolom H: Machine
            styleNo: String(row[idxStyleNo] ?? row[8] ?? ""), // Kolom I: Style No
            process: String(row[idxProcess] ?? row[9] ?? ""), // Kolom J: Process
            productionRate: Number(row[idxRate] ?? row[12] ?? 0), // Kolom M: Production Rate (%)
            points: pointVal, // Kolom N: POINT (maksimal 3 per mesin)
            workMonth: Number(row[idxWorkMonth] ?? row[14] ?? 1), // Kolom O: Work Month (langsung dari Sheets)
            dateOfResign: String(row[idxDateOfResign] ?? row[15] ?? ""), // Kolom P: Date of Resign
            machineCategory: rawCat, // Kolom Q: Machine Category
            status: String(row[idxStatus] ?? row[17] ?? "ACTIVE"), // Kolom R: Status

            // Kompatibilitas dengan fitur Skill Matrix & Line Balancing
            doj: String(row[idxDoj] ?? row[6] ?? "-"),
            workTimeMonths: Number(row[idxWorkMonth] ?? row[14] ?? 1),
            resignDate: (row[idxDateOfResign] ?? row[15]) ? String(row[idxDateOfResign] ?? row[15]) : null,
            lockstitch: isLockstitch ? (pointVal > 0 ? pointVal : null) : (!rawCat && !rawMachineName && pointVal > 0 ? pointVal : null),
            overlock: isOverlock ? (pointVal > 0 ? pointVal : null) : null,
            flatseam: isFlatseam ? (pointVal > 0 ? pointVal : null) : null,
            special: isSpecial ? (pointVal > 0 ? pointVal : null) : null,
            buttonHole: isButtonHole ? (pointVal > 0 ? pointVal : null) : null,
            buttonSet: isButtonSet ? (pointVal > 0 ? pointVal : null) : null,
            chainstitch: isChainstitch ? (pointVal > 0 ? pointVal : null) : null,
            bartack: isBartack ? (pointVal > 0 ? pointVal : null) : null,
          };
        });

        setOperators(normalizedOps);
        setIsLiveFromSheets(true);
        setSyncMessage(`Tersambung ke Google Sheets: ${normalizedOps.length} operator berhasil dimuat`);

        // Dynamically update available factories & lines
        const uniqueFactories = Array.from(new Set(normalizedOps.map((op) => op.factory).filter(Boolean)));
        if (uniqueFactories.length > 0) {
          setAvailableFactories(sortFactoriesNumerically(Array.from(new Set([...FACTORIES, ...uniqueFactories]))));
        }
        const uniqueLines = Array.from(new Set(normalizedOps.map((op) => op.line).filter(Boolean)));
        if (uniqueLines.length > 0) {
          setAvailableLines(sortLinesNumerically(Array.from(new Set([...LINES, ...uniqueLines]))));
        }
      } else {
        throw new Error(result.message || "Gagal mengambil data dari Google Sheets.");
      }
    } catch (err: any) {
      setSyncError(err.toString());
      // Fallback ke proxy server jika ada kendala jaringan browser langsung
      try {
        const fallbackRes = await fetch("/api/sheets/operators");
        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok && fallbackData.success && Array.isArray(fallbackData.operators) && fallbackData.operators.length > 0) {
          const fallbackOps = fallbackData.operators.map((op: Operator) => ({
            ...op,
            factory: normalizeFactoryName(op.factory),
            line: normalizeLineName(op.line),
            status: op.status || "ACTIVE",
          }));
          setOperators(fallbackOps);
          setIsLiveFromSheets(true);
          setSyncMessage(`Tersambung ke Google Sheets (Proxy): ${fallbackData.count} operator berhasil dimuat`);
          setSyncError(null);
        }
      } catch (fallbackErr) {
        console.warn("Fallback failed:", fallbackErr);
      }
    } finally {
      setIsLoadingSheets(false);
    }
  }, []);

  // Fetch on initial app load
  useEffect(() => {
    fetchLiveOperators();
  }, [fetchLiveOperators]);

  // 1. Total Point-in-Time Active Operators (Semua Line) untuk agregasi
  const pointInTimeAllOperators = useMemo(() => {
    return filterOperatorsByPointInTime(operators, selectedMonth, selectedYear);
  }, [operators, selectedMonth, selectedYear]);

  // Total unique active operators count based on unique NIK for the selected month/year
  const totalActiveOperatorsCount = useMemo(() => {
    const uniqueNikSet = new Set<string>();
    pointInTimeAllOperators.forEach((op: any) => {
      const nik = op.nik || op.id;
      const isResigned = isOperatorResignedAtPeriod(op, selectedMonth, selectedYear);
      if (nik && !isResigned) {
        uniqueNikSet.add(String(nik).trim());
      }
    });
    return uniqueNikSet.size;
  }, [pointInTimeAllOperators, selectedMonth, selectedYear]);

  // 2. Point-in-Time Filtered Operators untuk Factory & Line terpilih
  const displayedOperators = useMemo(() => {
    return filterOperatorsByPointInTime(
      operators,
      selectedMonth,
      selectedYear,
      selectedFactory,
      selectedLine
    );
  }, [operators, selectedMonth, selectedYear, selectedFactory, selectedLine]);

  // Handlers for Operator CRUD
  const handleAddOperator = (newOp: Operator) => {
    setOperators((prev) => [newOp, ...prev]);
  };

  const handleUpdateOperator = (updatedOp: Operator) => {
    setOperators((prev) =>
      prev.map((op) => (op.id === updatedOp.id ? updatedOp : op))
    );
  };

  const handleDeleteOperator = (id: string) => {
    setOperators((prev) => prev.filter((op) => op.id !== id));
  };

  const handleAddCustomStyle = (newStyle: GarmentStyle) => {
    setStyles((prev) => [...prev, newStyle]);
  };

  return (
    <div className="min-h-screen bg-[#E0F0F0] text-[#304848] flex flex-col lg:flex-row antialiased selection:bg-[#2AAFA3] selection:text-white">
      
      {/* SIDEBAR NAVIGATION */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        selectedFactory={selectedFactory}
        selectedLine={selectedLine}
        totalOperatorsCount={displayedOperators.length}
        totalActiveOperatorsCount={totalActiveOperatorsCount}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col p-3 sm:p-5 lg:p-6 overflow-x-hidden min-h-screen">
        
        {/* TOP HEADER WITH POINT-IN-TIME CONTROLS */}
        <Header
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          selectedFactory={selectedFactory}
          onFactoryChange={setSelectedFactory}
          selectedLine={selectedLine}
          onLineChange={setSelectedLine}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          userRole={userRole}
          onRoleChange={setUserRole}
          availableFactories={availableFactories}
          availableLines={availableLines}
          isLive={isLiveFromSheets}
          isLoading={isLoadingSheets}
          onRefresh={fetchLiveOperators}
        />

        {/* NOTIFICATION SYNC STATUS TOAST BANNER */}
        {syncError && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center justify-between text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{syncError}</span>
            </div>
            <button
              onClick={fetchLiveOperators}
              className="font-bold underline text-amber-800 hover:text-amber-950 ml-3 cursor-pointer shrink-0"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* METRICS KPI SUMMARY ROW */}
        <MetricsOverview
          operators={displayedOperators}
          selectedLine={selectedLine}
          selectedFactory={selectedFactory}
          targetGrade="Grade A"
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
        />

        {/* TAB CONTENTS */}
        <div className="flex-1">
          {activeTab === 'matrix' && (
            <SkillMatrixTab
              operators={displayedOperators}
              onAddOperator={handleAddOperator}
              onUpdateOperator={handleUpdateOperator}
              onDeleteOperator={handleDeleteOperator}
              userRole={userRole}
              selectedLine={selectedLine}
              selectedFactory={selectedFactory}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />
          )}

          {activeTab === 'balancing' && (
            <LineBalancingTab
              styles={styles}
              operators={displayedOperators}
              selectedLine={selectedLine}
              selectedFactory={selectedFactory}
              onAddCustomStyle={handleAddCustomStyle}
            />
          )}

          {activeTab === 'training' && (
            <MultiSkillDevelopmentTab
              operators={displayedOperators}
              selectedLine={selectedLine}
              selectedFactory={selectedFactory}
            />
          )}

          {activeTab === 'chat' && (
            <IEChatAssistantTab
              operators={displayedOperators}
              styles={styles}
              selectedLine={selectedLine}
              selectedFactory={selectedFactory}
            />
          )}
        </div>

        {/* FOOTER */}
        <footer className="mt-8 pt-4 border-t border-[#E0E8E8] text-center text-xs text-[#788888] flex flex-wrap items-center justify-between gap-2">
          <span>PT. Winners International &copy; 2026 — Industrial Engineering & Lean Manufacturing System</span>
          <span className="font-mono text-[11px] text-[#98A8A8]">GSD & MOST Standard Compliance</span>
        </footer>

      </main>

    </div>
  );
}
