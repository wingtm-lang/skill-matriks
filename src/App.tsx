import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { SkillMatrixTab } from './components/SkillMatrixTab';
import { MultiSkillDevelopmentTab } from './components/MultiSkillDevelopmentTab';
import { OverallDashboardTab } from './components/OverallDashboardTab';
import { UserSearchTab } from './components/UserSearchTab';
import { FACTORIES, LINES, DEFAULT_LINE_LEADERS } from './data/mockData';
import { Operator, LineLeader } from './types';
import { 
  sortLinesNumerically, 
  sortFactoriesNumerically, 
  filterOperatorsByPointInTime,
  normalizeFactoryName,
  normalizeLineName,
  isOperatorResignedAtPeriod,
  getPointsFromEfficiency,
  calculateWorkTimeMonths,
  fetchOperatorsFromGViz,
  getCustomAddedOperatorsFromStorage,
} from './utils/ieCalculations';
import { fetchDirectFromGoogleSheets, getStoredOperatorsCache } from './utils/sheetParser';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

export default function App() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedFactory, setSelectedFactory] = useState<string>('Factory 1');
  const [selectedLine, setSelectedLine] = useState<string>('Line 1');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1); // Current active month (1-12)
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear()); // Current active year
  const [activeTab, setActiveTab] = useState<string>('overall');
  const [userRole, setUserRole] = useState<'VIEWER' | 'EDITOR' | 'ADMIN'>('VIEWER');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Connection & sync state
  const [isLoadingSheets, setIsLoadingSheets] = useState<boolean>(false);
  const [isLiveFromSheets, setIsLiveFromSheets] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [availableFactories, setAvailableFactories] = useState<string[]>(FACTORIES);
  const [availableLines, setAvailableLines] = useState<string[]>(LINES);
  const [lineLeaders, setLineLeaders] = useState<LineLeader[]>(DEFAULT_LINE_LEADERS);

  // Fetch live operators directly from Google Sheets via backend proxy or direct API (for Vercel & static hosting)
  const fetchLiveOperators = useCallback(async () => {
    setIsLoadingSheets(true);
    setSyncError(null);

    // Pre-hydrate from cache if current operators list is empty for instant display
    const cachedData = getStoredOperatorsCache();
    if (cachedData && cachedData.operators.length > 0) {
      setOperators(cachedData.operators);
      if (cachedData.factories.length > 0) {
        setAvailableFactories(sortFactoriesNumerically(Array.from(new Set([...FACTORIES, ...cachedData.factories]))));
      }
      if (cachedData.lines.length > 0) {
        setAvailableLines(sortLinesNumerically(Array.from(new Set([...LINES, ...cachedData.lines]))));
      }
      if (cachedData.lineLeaders && cachedData.lineLeaders.length > 0) {
        setLineLeaders(cachedData.lineLeaders);
      }
      setSyncMessage(`Memuat cache (${cachedData.operators.length} operator)... Menyinkronkan data terbaru...`);
    }

    // Helper untuk menggabungkan data remote dengan operator kustom di LocalStorage
    const mergeWithLocalAdded = (remoteOps: Operator[]): Operator[] => {
      const localAdded = getCustomAddedOperatorsFromStorage();
      if (localAdded.length === 0) return remoteOps;

      const existingKeys = new Set(
        remoteOps.map((o: any) => `${String(o.nik || o.id).trim()}_${String(o.date || o.recordDate || '').trim()}_${String(o.line).trim()}`)
      );
      const newFromStorage = localAdded
        .filter((o) => !existingKeys.has(`${String(o.nik || o.id).trim()}_${String(o.date || o.recordDate || '').trim()}_${String(o.line).trim()}`))
        .map((o: any, idx: number) => ({
          ...o,
          id: o.id || `storage-${o.nik}-${idx}`,
          factory: normalizeFactoryName(o.factory),
          line: normalizeLineName(o.line),
          status: o.status || 'ACTIVE',
        }));
      return [...newFromStorage, ...remoteOps];
    };

    try {
      // 1. Prioritas 1: Backend proxy server (/api/sheets/operators)
      // Berfungsi saat dijalankan di AI Studio, Cloud Run, atau server Node terdedikasi
      try {
      const proxyController = new AbortController();
      const proxyTimeout = setTimeout(() => proxyController.abort(), 6000);

      const proxyRes = await fetch("/api/sheets/operators?force=true", { signal: proxyController.signal });
      clearTimeout(proxyTimeout);

      const contentType = proxyRes.headers.get("content-type") || "";
      if (proxyRes.ok && contentType.includes("application/json")) {
        const proxyData = await proxyRes.json();
        if (proxyData.success && Array.isArray(proxyData.operators) && proxyData.operators.length > 0) {
          const loadedOps: Operator[] = proxyData.operators.map((op: Operator) => ({
            ...op,
            factory: normalizeFactoryName(op.factory),
            line: normalizeLineName(op.line),
            status: op.status || "ACTIVE",
          }));

          const finalOps = mergeWithLocalAdded(loadedOps);
          setOperators(finalOps);
          setIsLiveFromSheets(true);
          setSyncMessage(`Tersambung ke Google Sheets (Proxy): ${finalOps.length} data record operator berhasil disinkronkan`);
          setSyncError(null);

          if (Array.isArray(proxyData.factories) && proxyData.factories.length > 0) {
            setAvailableFactories(sortFactoriesNumerically(Array.from(new Set([...FACTORIES, ...proxyData.factories]))));
          }
          if (Array.isArray(proxyData.lines) && proxyData.lines.length > 0) {
            setAvailableLines(sortLinesNumerically(Array.from(new Set([...LINES, ...proxyData.lines]))));
          }
          if (Array.isArray(proxyData.lineLeaders) && proxyData.lineLeaders.length > 0) {
            setLineLeaders(proxyData.lineLeaders);
          }
          return;
        }
      }
    } catch (backendErr: any) {
      console.warn("Backend proxy tidak aktif atau lambat, beralih ke Direct Google Sheets Sync (Vercel mode):", backendErr);
    }

    // 2. Prioritas 2: Direct Google Sheets API Sync (Sangat Andal untuk Vercel & Hosting Statis)
    // Langsung menghubungi Google Sheets API v4 dari browser dengan dukungan penuh CORS dan kompresi gzip
    try {
      const directData = await fetchDirectFromGoogleSheets();
      if (directData && Array.isArray(directData.operators) && directData.operators.length > 0) {
        const normalizedOps = directData.operators.map((op: Operator) => ({
          ...op,
          factory: normalizeFactoryName(op.factory),
          line: normalizeLineName(op.line),
          status: op.status || "ACTIVE",
        }));

        const finalOps = mergeWithLocalAdded(normalizedOps);
        setOperators(finalOps);
        setIsLiveFromSheets(true);
        setSyncMessage(`Tersambung ke Google Sheets (Direct Sync): ${finalOps.length} data record operator berhasil disinkronkan`);
        setSyncError(null);

        if (Array.isArray(directData.factories) && directData.factories.length > 0) {
          setAvailableFactories(sortFactoriesNumerically(Array.from(new Set([...FACTORIES, ...directData.factories]))));
        }
        if (Array.isArray(directData.lines) && directData.lines.length > 0) {
          setAvailableLines(sortLinesNumerically(Array.from(new Set([...LINES, ...directData.lines]))));
        }
        if (Array.isArray(directData.lineLeaders) && directData.lineLeaders.length > 0) {
          setLineLeaders(directData.lineLeaders);
        }
        return;
      }
    } catch (directErr: any) {
      console.warn("Direct Google Sheets fetch gagal, mencoba fallback Apps Script:", directErr);
    }

    // 3. Prioritas 3: Fallback ke Google Apps Script Web App
    try {
      const gasUrl = "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(gasUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      const textData = await response.text();

      let result;
      try {
        result = JSON.parse(textData);
      } catch (e) {
        throw new Error("Respons dari Google Sheets bukan JSON yang valid.");
      }

      if (result.status === "success" && Array.isArray(result.data)) {
        const rows = result.data;
        const headers: any[] = rows[0] || [];
        const dataRows = rows.slice(1);

        const findColIdx = (candidates: string[], fallbackIdx: number) => {
          if (!Array.isArray(headers)) return fallbackIdx;
          for (const cand of candidates) {
            const idx = headers.findIndex(
              (h) => typeof h === "string" && h.trim().toUpperCase() === cand.toUpperCase()
            );
            if (idx !== -1) return idx;
          }
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
        const idxPoints = findColIdx(["POIN", "POINT (KOLOM N)", "POIN MESIN"], 13);
        const idxWorkMonth = findColIdx(["Work Month", "Masa Kerja"], 14);
        const idxDateOfResign = findColIdx(["Date of Resign", "Resign"], 15);
        const idxMachine = findColIdx(["Machine Category", "Kategori Mesin", "Category", "Kategori"], 16);
        const idxMachineName = findColIdx(["Machine", "Mesin", "Nama Mesin"], 7);
        const idxStyleNo = findColIdx(["Style No", "Style"], 8);
        const idxProcess = findColIdx(["Process", "Proses", "Operasi"], 9);

        const safeParseNumber = (val: any, fallback: number = 0): number => {
          if (val === null || val === undefined || val === '') return fallback;
          if (typeof val === 'number') return isNaN(val) ? fallback : val;
          const cleaned = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? fallback : parsed;
        };

        const normalizedOps: Operator[] = dataRows.map((row: any, index: number) => {
          const rawProdRate = safeParseNumber(row[idxRate] ?? row[12], 0);
          const rawPointsStr = String(row[idxPoints] ?? row[13] ?? "").trim();
          const rawPoints = parseFloat(rawPointsStr.replace(',', '.').replace(/[^0-9.]/g, ''));
          let pointVal = !isNaN(rawPoints) ? Math.min(3, Math.max(0, Math.round(rawPoints))) : 0;
          if (rawPointsStr === "" && rawProdRate > 0) {
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

          const parsedWorkMonth = safeParseNumber(row[idxWorkMonth] ?? row[14], 0);
          const rowDoj = String(row[idxDoj] ?? row[6] ?? "-");
          const safeTenure = parsedWorkMonth > 0 ? parsedWorkMonth : (calculateWorkTimeMonths(rowDoj) || 0);

          return {
            id: String(row[idxWorkerCode] ?? row[4] ?? index),
            no: index + 1,
            factory: normalizeFactoryName(String(row[idxFactory] ?? row[0] ?? "1")),
            line: normalizeLineName(String(row[idxLine] ?? row[1] ?? "1")),
            nik: String(row[idxWorkerCode] ?? row[4] ?? ""),
            name: String(row[idxWorker] ?? row[5] ?? "Unknown"),
            date: rowDateStr,
            recordDate: rowDateStr,
            machine: String(row[idxMachineName] ?? row[7] ?? ""),
            styleNo: String(row[idxStyleNo] ?? row[8] ?? ""),
            process: String(row[idxProcess] ?? row[9] ?? ""),
            currentOperation: String(row[idxProcess] ?? row[9] ?? ""),
            productionRate: rawProdRate,
            points: pointVal,
            workMonth: safeTenure,
            dateOfResign: String(row[idxDateOfResign] ?? row[15] ?? ""),
            machineCategory: rawCat,
            status: String(row[idxStatus] ?? row[17] ?? "ACTIVE"),
            doj: rowDoj,
            workTimeMonths: safeTenure,
            resignDate: (row[idxDateOfResign] ?? row[15]) ? String(row[idxDateOfResign] ?? row[15]) : null,
            lockstitch: isLockstitch ? pointVal : (!rawCat && !rawMachineName ? pointVal : null),
            overlock: isOverlock ? pointVal : null,
            flatseam: isFlatseam ? pointVal : null,
            special: isSpecial ? pointVal : null,
            buttonHole: isButtonHole ? pointVal : null,
            buttonSet: isButtonSet ? pointVal : null,
            chainstitch: isChainstitch ? pointVal : null,
            bartack: isBartack ? pointVal : null,
          };
        });

        const finalOps = mergeWithLocalAdded(normalizedOps);
        setOperators(finalOps);
        setIsLiveFromSheets(true);
        setSyncMessage(`Tersambung ke Google Sheets (GAS): ${finalOps.length} operator berhasil dimuat`);

        const uniqueFactories = Array.from(new Set(finalOps.map((op) => op.factory).filter(Boolean)));
        if (uniqueFactories.length > 0) {
          setAvailableFactories(sortFactoriesNumerically(Array.from(new Set([...FACTORIES, ...uniqueFactories]))));
        }
        const uniqueLines = Array.from(new Set(finalOps.map((op) => op.line).filter(Boolean)));
        if (uniqueLines.length > 0) {
          setAvailableLines(sortLinesNumerically(Array.from(new Set([...LINES, ...uniqueLines]))));
        }

        // Ekstraksi Line Leaders dari dataRows (Kolom AC: 28, AD: 29, AE: 30, AF: 31, AG: 32)
        const leadersMap = new Map<string, LineLeader>();
        dataRows.forEach((r: any[]) => {
          const rawF = (r[28] ?? "").toString().trim();
          const rawL = (r[29] ?? "").toString().trim();
          const rawChief = (r[30] ?? "").toString().trim();
          const rawSpv = (r[31] ?? "").toString().trim();
          const rawIE = (r[32] ?? "").toString().trim();
          if (rawF && rawL && (rawChief || rawSpv || rawIE)) {
            const fName = normalizeFactoryName(rawF);
            const lName = normalizeLineName(rawL);
            const key = `${fName}_${lName}`;
            if (!leadersMap.has(key)) {
              leadersMap.set(key, {
                factory: fName,
                line: lName,
                chief: rawChief || "-",
                supervisor: (rawSpv && rawSpv !== "-") ? rawSpv : "-",
                ie: rawIE || "-",
              });
            }
          }
        });
        if (leadersMap.size > 0) {
          setLineLeaders(Array.from(leadersMap.values()));
        }
        return;
      }
    } catch (gasErr) {
      console.warn("GAS fetch fallback failed:", gasErr);
    }

    // 4. Prioritas 4: Muat operator dari localStorage jika semua koneksi remote offline
    const localAdded = getCustomAddedOperatorsFromStorage();
    if (localAdded.length > 0) {
      setOperators(localAdded);
      setSyncMessage(`Mode Offline: Memuat ${localAdded.length} operator tersimpan di perangkat lokal`);
      setSyncError(null);
    } else {
      setSyncError("Tidak dapat memuat data dari Google Sheets. Pastikan koneksi internet stabil atau muat ulang halaman.");
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
        userRole={userRole}
        onRoleChange={setUserRole}
        operators={pointInTimeAllOperators && pointInTimeAllOperators.length > 0 ? pointInTimeAllOperators : operators}
        onNavigateToLine={(fac, line) => {
          setSelectedFactory(fac);
          setSelectedLine(line);
          setActiveTab('matrix');
        }}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col p-3 sm:p-5 lg:p-6 overflow-x-hidden min-h-screen">
        
        {/* TOP HEADER WITH POINT-IN-TIME CONTROLS */}
        <Header
          activeTab={activeTab}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          selectedFactory={selectedFactory}
          onFactoryChange={setSelectedFactory}
          selectedLine={selectedLine}
          onLineChange={setSelectedLine}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
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

        {/* METRICS KPI SUMMARY ROW - Only displayed on line-specific tabs */}
        {activeTab !== 'overall' && activeTab !== 'search' && (
          <MetricsOverview
            operators={displayedOperators}
            selectedLine={selectedLine}
            selectedFactory={selectedFactory}
            targetGrade="Grade A"
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            lineLeaders={lineLeaders}
          />
        )}

        {/* TAB CONTENTS */}
        <div className="flex-1">
          {activeTab === 'overall' && (
            <OverallDashboardTab
              operators={operators}
              availableFactories={availableFactories}
              selectedFactory={selectedFactory}
              onFactoryChange={setSelectedFactory}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              onNavigateToLine={(fac, line) => {
                setSelectedFactory(fac);
                setSelectedLine(line);
                setActiveTab('matrix');
              }}
              lineLeaders={lineLeaders}
            />
          )}

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
              lineLeaders={lineLeaders}
            />
          )}

          {activeTab === 'training' && (
            <MultiSkillDevelopmentTab
              operators={displayedOperators}
              selectedLine={selectedLine}
              selectedFactory={selectedFactory}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              lineLeaders={lineLeaders}
            />
          )}

          {activeTab === 'search' && (
            <UserSearchTab
              operators={pointInTimeAllOperators && pointInTimeAllOperators.length > 0 ? pointInTimeAllOperators : operators}
              onNavigateToLine={(fac, line) => {
                setSelectedFactory(fac);
                setSelectedLine(line);
                setActiveTab('matrix');
              }}
            />
          )}
        </div>

        {/* FOOTER */}
        <footer className="mt-8 pt-4 border-t border-[#E0E8E8] text-center text-xs text-[#788888] flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <img src="/winners-logo.png" alt="" className="w-4 h-4 object-contain inline-block shrink-0" />
            PT. Winners International &copy; 2026 — Industrial Engineering & Lean Manufacturing System
          </span>
          <span className="font-mono text-[11px] text-[#98A8A8]">GSD & MOST Standard Compliance</span>
        </footer>

      </main>

    </div>
  );
}
