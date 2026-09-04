import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { SkillMatrixTab } from './components/SkillMatrixTab';
import { LineBalancingTab } from './components/LineBalancingTab';
import { MultiSkillDevelopmentTab } from './components/MultiSkillDevelopmentTab';
import { IEChatAssistantTab } from './components/IEChatAssistantTab';
import { GoogleSheetsTab } from './components/GoogleSheetsTab';
import { INITIAL_STYLES, FACTORIES, LINES } from './data/mockData';
import { Operator, GarmentStyle } from './types';
import { 
  sortLinesNumerically, 
  sortFactoriesNumerically, 
  filterOperatorsByPointInTime,
  normalizeFactoryName,
  normalizeLineName,
  MONTH_NAMES_ID 
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

        const findColIdx = (name: string, fallbackIdx: number) => {
          if (!Array.isArray(headers)) return fallbackIdx;
          const directIdx = headers.indexOf(name);
          if (directIdx !== -1) return directIdx;
          const fuzzyIdx = headers.findIndex(
            (h) => typeof h === "string" && h.trim().toLowerCase() === name.trim().toLowerCase()
          );
          if (fuzzyIdx !== -1) return fuzzyIdx;
          const partialIdx = headers.findIndex(
            (h) => typeof h === "string" && h.toLowerCase().includes(name.toLowerCase())
          );
          return partialIdx !== -1 ? partialIdx : fallbackIdx;
        };

        const idxWorkerCode = findColIdx("Worker Code", 4);
        const idxWorker = findColIdx("Worker", 5);
        const idxFactory = findColIdx("Factory", 0);
        const idxLine = findColIdx("Line", 1);
        const idxStatus = findColIdx("Status", 17);
        const idxDoj = findColIdx("D.O.J", 6);
        const idxDate = findColIdx("Date", 3);
        const idxRate = findColIdx("Actual Rate", 12);
        const idxMachine = findColIdx("Cat", 16);

        // Mapping baris spreadsheet ke objek Operator
        const normalizedOps: Operator[] = dataRows.map((row: any, index: number) => {
          const rawProdRate = Number(row[12] || 0);
          const machineCat = String(row[16] || "").toUpperCase();

          return {
            id: String(row[4] || index), // Kolom E: Worker Code
            no: index + 1,
            factory: normalizeFactoryName(String(row[0] || "1")), // Kolom A: Factory
            line: normalizeLineName(String(row[1] || "1")), // Kolom B: Line
            nik: String(row[4] || ""), // Kolom E: Worker Code
            name: String(row[5] || "Unknown"), // Kolom F: Worker
            machine: String(row[7] || ""), // Kolom H: Machine
            styleNo: String(row[8] || ""), // Kolom I: Style No
            process: String(row[9] || ""), // Kolom J: Process
            productionRate: Number(row[12] || 0), // Kolom M: Production Rate (%)
            points: Number(row[13] || 1), // Kolom N: POINT (langsung dari Sheets)
            workMonth: Number(row[14] || 1), // Kolom O: Work Month (langsung dari Sheets)
            dateOfResign: String(row[15] || ""), // Kolom P: Date of Resign
            machineCategory: String(row[16] || ""), // Kolom Q: Machine Category
            status: String(row[17] || "ACTIVE"), // Kolom R: Status

            // Kompatibilitas dengan fitur Skill Matrix & Line Balancing
            doj: String(row[6] || "-"),
            workTimeMonths: Number(row[14] || 1),
            resignDate: row[15] ? String(row[15]) : null,
            lockstitch: machineCat.includes("SN") || machineCat.includes("LOCKSTITCH") || (!machineCat && rawProdRate > 0) ? rawProdRate : (rawProdRate > 0 ? null : 75),
            overlock: machineCat.includes("OL") || machineCat.includes("OVERLOCK") ? rawProdRate : null,
            flatseam: machineCat.includes("FS") || machineCat.includes("FLATSEAM") ? rawProdRate : null,
            special: machineCat.includes("SP") || machineCat.includes("SPECIAL") ? rawProdRate : null,
            buttonHole: machineCat.includes("BH") || machineCat.includes("BUTTON HOLE") ? rawProdRate : null,
            buttonSet: machineCat.includes("BS") || machineCat.includes("BUTTON SET") ? rawProdRate : null,
            chainstitch: machineCat.includes("CS") || machineCat.includes("CHAINSTITCH") ? rawProdRate : null,
            bartack: machineCat.includes("BT") || machineCat.includes("BARTACK") ? rawProdRate : null,
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

  // Total database operator aktif di seluruh line (tidak berstatus RESIGNED)
  const totalActiveOperatorsCount = useMemo(() => {
    return pointInTimeAllOperators.filter((op) => {
      const isResigned = op.status?.toUpperCase() === 'RESIGNED';
      return !isResigned;
    }).length;
  }, [pointInTimeAllOperators]);

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
          targetRate={75}
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

          {activeTab === 'sheets' && (
            <GoogleSheetsTab
              operators={displayedOperators}
              selectedFactory={selectedFactory}
              selectedLine={selectedLine}
              userRole={userRole}
              onSyncOperators={(newOps) => {
                if (!Array.isArray(newOps)) return;
                const normalizedOps = newOps.map((op: any, idx: number) => {
                  if (Array.isArray(op)) {
                    const rawProdRate = Number(op[12] || 0);
                    const machineCat = String(op[16] || "").toUpperCase();
                    return {
                      id: String(op[4] || idx), // Kolom E: Worker Code
                      no: idx + 1,
                      factory: normalizeFactoryName(String(op[0] || "1")), // Kolom A: Factory
                      line: normalizeLineName(String(op[1] || "1")), // Kolom B: Line
                      nik: String(op[4] || ""), // Kolom E: Worker Code
                      name: String(op[5] || "Unknown"), // Kolom F: Worker
                      machine: String(op[7] || ""), // Kolom H: Machine
                      styleNo: String(op[8] || ""), // Kolom I: Style No
                      process: String(op[9] || ""), // Kolom J: Process
                      productionRate: Number(op[12] || 0), // Kolom M: Production Rate (%)
                      points: Number(op[13] || 1), // Kolom N: POINT (langsung dari Sheets)
                      workMonth: Number(op[14] || 1), // Kolom O: Work Month (langsung dari Sheets)
                      dateOfResign: String(op[15] || ""), // Kolom P: Date of Resign
                      machineCategory: String(op[16] || ""), // Kolom Q: Machine Category
                      status: String(op[17] || "ACTIVE"), // Kolom R: Status

                      // Kompatibilitas dengan fitur Skill Matrix & Line Balancing
                      doj: String(op[6] || "-"),
                      workTimeMonths: Number(op[14] || 1),
                      resignDate: op[15] ? String(op[15]) : null,
                      lockstitch: machineCat.includes("SN") || machineCat.includes("LOCKSTITCH") || (!machineCat && rawProdRate > 0) ? rawProdRate : (rawProdRate > 0 ? null : 75),
                      overlock: machineCat.includes("OL") || machineCat.includes("OVERLOCK") ? rawProdRate : null,
                      flatseam: machineCat.includes("FS") || machineCat.includes("FLATSEAM") ? rawProdRate : null,
                      special: machineCat.includes("SP") || machineCat.includes("SPECIAL") ? rawProdRate : null,
                      buttonHole: machineCat.includes("BH") || machineCat.includes("BUTTON HOLE") ? rawProdRate : null,
                      buttonSet: machineCat.includes("BS") || machineCat.includes("BUTTON SET") ? rawProdRate : null,
                      chainstitch: machineCat.includes("CS") || machineCat.includes("CHAINSTITCH") ? rawProdRate : null,
                      bartack: machineCat.includes("BT") || machineCat.includes("BARTACK") ? rawProdRate : null,
                    };
                  }
                  return {
                    ...op,
                    factory: normalizeFactoryName(op.factory),
                    line: normalizeLineName(op.line),
                    status: op.status || 'ACTIVE'
                  };
                });
                setOperators(normalizedOps);
                setIsLiveFromSheets(true);
              }}
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
