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

  // Fetch live operators from Google Sheets API via server
  const fetchLiveOperators = useCallback(async () => {
    setIsLoadingSheets(true);
    setSyncError(null);

    try {
      const response = await fetch('/api/sheets/operators');
      const data = await response.json();

      if (response.ok && data.success && Array.isArray(data.operators) && data.operators.length > 0) {
        const normalizedOps = data.operators.map((op: Operator) => ({
          ...op,
          factory: normalizeFactoryName(op.factory),
          line: normalizeLineName(op.line),
          status: op.status || 'ACTIVE'
        }));
        setOperators(normalizedOps);
        setIsLiveFromSheets(true);
        setSyncMessage(`Tersambung ke Google Sheets: ${data.count} operator berhasil dimuat`);

        // Dynamically update available factories & lines with natural numeric sorting
        if (data.factories && data.factories.length > 0) {
          const normFact = data.factories.map((f: string) => normalizeFactoryName(f));
          const mergedFactories = sortFactoriesNumerically(
            Array.from(new Set([...FACTORIES, ...normFact]))
          );
          setAvailableFactories(mergedFactories);
        }
        if (data.lines && data.lines.length > 0) {
          const normLn = data.lines.map((l: string) => normalizeLineName(l));
          const mergedLines = sortLinesNumerically(
            Array.from(new Set([...LINES, ...normLn]))
          );
          setAvailableLines(mergedLines);
        }
      } else {
        setIsLiveFromSheets(false);
        setSyncError(data.error || "Tidak ada data operator ditemukan di Google Sheets.");
      }
    } catch (err: any) {
      console.warn("Network error fetching Google Sheets operators:", err);
      setIsLiveFromSheets(false);
      setSyncError("Koneksi server/jaringan terputus saat mengambil data Google Sheets.");
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
                    return {
                      id: `op-sync-${idx + 1}`,
                      no: idx + 1,
                      nik: op[4] || `OP-${idx + 1}`,
                      name: op[5] || `Operator ${idx + 1}`,
                      factory: normalizeFactoryName(op[0]),
                      line: normalizeLineName(op[1]),
                      doj: op[6] || '-',
                      workTimeMonths: 12,
                      status: op[17] || 'ACTIVE',
                      lockstitch: 75,
                      overlock: null,
                      flatseam: null,
                      special: null,
                      buttonHole: null,
                      buttonSet: null,
                      chainstitch: null,
                      bartack: null,
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
