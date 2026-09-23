import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  User, 
  Building2, 
  Clock, 
  Workflow, 
  Award, 
  Check, 
  Copy, 
  ArrowRight, 
  Grid, 
  List, 
  RotateCcw, 
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Operator } from '../types';
import { 
  getOperatorTotalPoints, 
  getGradeFromTotalPoints, 
  getOperatorMultiSkillCount,
  getOperatorActiveMachineColumn,
  calculateWorkTimeMonths,
  sortLinesNumerically,
  sortFactoriesNumerically
} from '../utils/ieCalculations';
import { fetchDirectFromGoogleSheets, getStoredOperatorsCache } from '../utils/sheetParser';
import { useLanguage } from '../i18n/LanguageContext';

interface UserSearchTabProps {
  operators?: Operator[];
  availableFactories?: string[];
  availableLines?: string[];
  onNavigateToLine: (factory: string, line: string, operatorId?: string) => void;
  initialQuery?: string;
}

// Jumlah data yang dimuat per batch untuk DOM performance (20-30 data per batch)
const BATCH_SIZE = 24;

// Cache TTL untuk Google Sheets API di sisi client (5 menit / 300.000 ms)
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

export const UserSearchTab: React.FC<UserSearchTabProps> = ({
  operators = [],
  availableFactories = [],
  availableLines = [],
  onNavigateToLine,
  initialQuery = '',
}) => {
  const { language, t } = useLanguage();

  // Search input state (seketika untuk feedback mengetik tanpa lag)
  const [searchInput, setSearchInput] = useState<string>(initialQuery);

  // Debounced search query (hanya diupdate setelah user berhenti mengetik 400ms)
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialQuery.trim());

  // Loading state saat debounce timer berjalan atau request fetch data berlangsung
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Hasil operator dari pencarian aktif
  const [rawSearchResults, setRawSearchResults] = useState<Operator[]>([]);

  // Batch pagination / infinite scroll state
  const [visibleCount, setVisibleCount] = useState<number>(BATCH_SIZE);

  // Filter & View states
  const [selectedFactory, setSelectedFactory] = useState<string>('ALL');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedSkill, setSelectedSkill] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('NAME_ASC');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [copiedNik, setCopiedNik] = useState<string | null>(null);

  // Infinite scroll sentinel ref
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ============================================================================
  // STRATEGI CACHING CLIENT-SIDE (5 MENIT):
  // Menyimpan hasil pencarian query di memory cache agar saat pengguna mengetik ulang
  // kata kunci yang sama (atau menghapus lalu mengetik lagi), data langsung disajikan
  // secara instan (<1ms) tanpa hit ulang ke Google Sheets API / Backend proxy.
  // ============================================================================
  const searchCacheRef = useRef<Map<string, { data: Operator[]; timestamp: number }>>(new Map());

  // Format Tenure (Masa Kerja)
  const formatTenure = useCallback((months: number) => {
    if (!months || months <= 0) return language === 'en' ? '0 Mos' : '0 Bln';
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (years > 0 && rem > 0) {
      return language === 'en' 
        ? `${years}y ${rem}m (${months}m)` 
        : `${years} Thn ${rem} Bln (${months} Bln)`;
    } else if (years > 0) {
      return language === 'en' 
        ? `${years}y (${months}m)` 
        : `${years} Thn (${months} Bln)`;
    }
    return language === 'en' ? `${months} Mos` : `${months} Bln`;
  }, [language]);

  // Copy NIK handler
  const handleCopyNik = (nik: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!nik) return;
    navigator.clipboard.writeText(nik);
    setCopiedNik(nik);
    setTimeout(() => {
      setCopiedNik(null);
    }, 2000);
  };

  // ============================================================================
  // STRATEGI DEBOUNCE 400MS:
  // Menunda request pencarian hingga pengguna berhenti mengetik selama 400 milidetik.
  // Mencegah spike network request di setiap keystroke, mengurangi latency,
  // dan menghemat kuota Google Sheets API rate-limit.
  // ============================================================================
  useEffect(() => {
    const trimmed = searchInput.trim();

    // Jika search box kosong, jangan fetch semua data operator.
    // Tampilkan empty state dan bersihkan hasil sebelumnya.
    if (!trimmed) {
      setDebouncedQuery('');
      setRawSearchResults([]);
      setIsLoading(false);
      return;
    }

    // Aktifkan indikator loading kecil di search box saat user mengetik
    setIsLoading(true);

    const timer = setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

// Helper multi-field search matcher (cocok untuk NIK, Nama, Proses/Operasi, Lini, Pabrik, Mesin, Style)
function matchOperatorRecord(op: any, rawQuery: string): boolean {
  if (!rawQuery) return false;
  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;

  const nik = String(op.nik || op.id || '').toLowerCase();
  const name = String(op.name || '').toLowerCase();
  const proc = String(op.process || op.currentOperation || op.operation || '').toLowerCase();
  const line = String(op.line || '').toLowerCase();
  const factory = String(op.factory || '').toLowerCase();
  const machine = String(op.machine || op.machineCategory || '').toLowerCase();
  const styleNo = String(op.styleNo || '').toLowerCase();

  // Memecah kata kunci jika ada beberapa token (contoh: "Siti Line 1" -> harus mencakup kata "siti", "line", "1")
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  return tokens.every(token => 
    nik.includes(token) || 
    name.includes(token) || 
    proc.includes(token) || 
    line.includes(token) || 
    factory.includes(token) ||
    machine.includes(token) ||
    styleNo.includes(token)
  );
}

  // ============================================================================
  // STRATEGI FETCH DATA DENGAN BACKEND & CLIENT CACHING (KOMPATIBEL DENGAN VERCEL):
  // 1. Cek in-memory client cache (TTL 5 menit) untuk query saat ini.
  // 2. Coba fetch ke Backend Proxy (/api/sheets/operators?q=...) jika tersedia.
  // 3. Khusus Vercel / Static Hosting (di mana backend express tidak aktif):
  //    - Ambil kumpulan operator dari props `operators`
  //    - Atau ambil dari LocalStorage `getStoredOperatorsCache()`
  //    - Atau lakukan fetch direct ke Google Sheets API v4 jika pool masih kosong.
  //    - Jalankan pemfilteran ketat `matchOperatorRecord` sehingga HANYA data yang sesuai
  //      yang ditampilkan dan TIDAK PERNAH menampilkan seluruh data jika tidak cocok!
  // ============================================================================
  useEffect(() => {
    const q = debouncedQuery.trim().toLowerCase();

    // Kosongkan hasil jika tidak ada query aktif
    if (!q) {
      setRawSearchResults([]);
      setIsLoading(false);
      return;
    }

    let isSubscribed = true;

    const executeFetch = async () => {
      setIsLoading(true);

      // 1. Cek Client Cache
      const cached = searchCacheRef.current.get(q);
      if (cached && (Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS)) {
        if (isSubscribed) {
          setRawSearchResults(cached.data);
          setVisibleCount(BATCH_SIZE);
          setIsLoading(false);
        }
        return;
      }

      // 2. Fetch ke Backend Proxy dengan search query (jika respons bertipe application/json)
      let backendMatchedOps: Operator[] | null = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(`/api/sheets/operators?q=${encodeURIComponent(q)}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const contentType = res.headers.get('content-type') || '';
        // Penting: Hanya proses JSON jika backend aktif (di Vercel, SPA rewrite mengembalikan text/html 200 OK)
        if (res.ok && contentType.includes('application/json')) {
          const json = await res.json();
          if (json.success && Array.isArray(json.operators)) {
            // Verifikasi kembali agar benar-benar terfilter dengan matchOperatorRecord
            backendMatchedOps = json.operators.filter((op: any) => matchOperatorRecord(op, q));
          }
        }
      } catch (networkErr) {
        // Backend proxy offline / Vercel static host
      }

      if (backendMatchedOps !== null) {
        if (isSubscribed) {
          searchCacheRef.current.set(q, { data: backendMatchedOps, timestamp: Date.now() });
          setRawSearchResults(backendMatchedOps);
          setVisibleCount(BATCH_SIZE);
          setIsLoading(false);
        }
        return;
      }

      // 3. Fallback Client-Side Search (Sangat Handal untuk Vercel / Netlify / Static Hosting)
      if (isSubscribed) {
        let datasetPool: Operator[] = (operators && operators.length > 0) ? operators : [];

        // Jika props operators kosong (misal user langsung buka tab search sebelum App selesai loading),
        // ambil dari LocalStorage cache
        if (datasetPool.length === 0) {
          const stored = getStoredOperatorsCache();
          if (stored && Array.isArray(stored.operators) && stored.operators.length > 0) {
            datasetPool = stored.operators;
          }
        }

        // Jika masih kosong, fetch langsung dari Google Sheets API v4
        if (datasetPool.length === 0) {
          try {
            const direct = await fetchDirectFromGoogleSheets();
            if (direct && Array.isArray(direct.operators) && direct.operators.length > 0) {
              datasetPool = direct.operators;
            }
          } catch (directErr) {
            console.warn('Direct Google Sheets fallback in search failed:', directErr);
          }
        }

        // Filter ketat dataset: HANYA operator yang cocok dengan kata kunci yang dikembalikan
        const filteredFallback = datasetPool.filter((op) => matchOperatorRecord(op, q));

        searchCacheRef.current.set(q, { data: filteredFallback, timestamp: Date.now() });
        setRawSearchResults(filteredFallback);
        setVisibleCount(BATCH_SIZE);
        setIsLoading(false);
      }
    };

    executeFetch();

    return () => {
      isSubscribed = false;
    };
  }, [debouncedQuery, operators]);

  // Enrich data operator yang ditemukan
  const enrichedOperators = useMemo(() => {
    if (!rawSearchResults || rawSearchResults.length === 0) return [];

    const uniqueMap = new Map<string, any>();
    for (const op of rawSearchResults) {
      const rawNik = (op.nik || op.id || '').trim();
      const rawName = (op.name || '').trim();
      if (!rawNik && !rawName) continue;

      const totalPoints = getOperatorTotalPoints(op);
      const tenureMonths = op.workTimeMonths ?? op.workMonth ?? calculateWorkTimeMonths(op.doj) ?? 0;
      const isHelper = op.status?.toUpperCase() === 'HELPER' || String(op.grade || '').toUpperCase() === 'HELPER' || totalPoints === 0;
      const gradeInfo = getGradeFromTotalPoints(totalPoints, isHelper);
      const activeMachineCol = getOperatorActiveMachineColumn(op);

      // Machine Breakdown
      const machineBreakdown = [
        { code: 'SN', label: 'Lockstitch', category: 'LOCKSTITCH', points: Math.round(op.lockstitch ?? 0) },
        { code: 'OL', label: 'Overlock', category: 'OVERLOCK', points: Math.round(op.overlock ?? 0) },
        { code: 'FS', label: 'Flatseam', category: 'FLATSEAM', points: Math.round(op.flatseam ?? 0) },
        { code: 'SP', label: 'Special', category: 'SPECIAL', points: Math.round(op.special ?? 0) },
        { code: 'BH', label: 'Button Hole', category: 'BUTTON_HOLE', points: Math.round(op.buttonHole ?? 0) },
        { code: 'BS', label: 'Button Set', category: 'BUTTON_SET', points: Math.round(op.buttonSet ?? 0) },
        { code: 'CS', label: 'Chainstitch', category: 'SPECIAL', points: Math.round(op.chainstitch ?? 0) },
        { code: 'BT', label: 'Bartack', category: 'SPECIAL', points: Math.round(op.bartack ?? 0) },
      ];

      const activeMachines = machineBreakdown.filter(m => m.points > 0);
      const multiSkillCount = activeMachines.length > 0 ? activeMachines.length : getOperatorMultiSkillCount(op);

      const enriched = {
        ...op,
        totalPoints,
        tenureMonths,
        tenureText: formatTenure(tenureMonths),
        isHelper,
        gradeInfo,
        activeMachineCol,
        machineBreakdown,
        activeMachines,
        multiSkillCount,
        currentOperationDisplay: op.currentOperation || op.process || op.machine || '-',
      };

      const key = rawNik || op.id;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, enriched);
      } else {
        const prev = uniqueMap.get(key);
        if (enriched.totalPoints > prev.totalPoints || (!prev.currentOperation && enriched.currentOperation)) {
          uniqueMap.set(key, enriched);
        }
      }
    }

    return Array.from(uniqueMap.values());
  }, [rawSearchResults, formatTenure]);

  // Dynamic factories and lines from search results or available options
  const factoryOptions = useMemo(() => {
    const list = new Set<string>();
    if (availableFactories && availableFactories.length > 0) {
      availableFactories.forEach(f => list.add(f));
    }
    enrichedOperators.forEach(op => {
      if (op.factory) list.add(op.factory);
    });
    return sortFactoriesNumerically(Array.from(list));
  }, [availableFactories, enrichedOperators]);

  const lineOptions = useMemo(() => {
    const list = new Set<string>();
    if (availableLines && availableLines.length > 0) {
      availableLines.forEach(l => list.add(l));
    }
    enrichedOperators.forEach(op => {
      if (selectedFactory === 'ALL' || op.factory === selectedFactory) {
        if (op.line) list.add(op.line);
      }
    });
    return sortLinesNumerically(Array.from(list));
  }, [availableLines, enrichedOperators, selectedFactory]);

  // Filter and Sort operators
  const filteredOperators = useMemo(() => {
    return enrichedOperators.filter(op => {
      // Factory filter
      if (selectedFactory !== 'ALL' && op.factory !== selectedFactory) return false;

      // Line filter
      if (selectedLine !== 'ALL' && op.line !== selectedLine) return false;

      // Grade filter
      if (selectedGrade !== 'ALL') {
        const opGrade = op.gradeInfo.grade.toUpperCase();
        if (selectedGrade === 'HELPER') {
          if (!op.isHelper && opGrade !== 'HELPER') return false;
        } else {
          if (opGrade !== selectedGrade) return false;
        }
      }

      // Skill filter
      if (selectedSkill !== 'ALL') {
        if (selectedSkill === 'MULTI' && op.multiSkillCount < 2) return false;
        if (selectedSkill === 'SINGLE' && (op.multiSkillCount !== 1 || op.isHelper)) return false;
        if (selectedSkill === 'HELPER' && (!op.isHelper && op.multiSkillCount > 0)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'NAME_DESC') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'TENURE_DESC') return (b.tenureMonths || 0) - (a.tenureMonths || 0);
      if (sortBy === 'TENURE_ASC') return (a.tenureMonths || 0) - (b.tenureMonths || 0);
      if (sortBy === 'POINTS_DESC') return (b.totalPoints || 0) - (a.totalPoints || 0);
      if (sortBy === 'NIK_ASC') return (a.nik || '').localeCompare(b.nik || '');
      return 0;
    });
  }, [enrichedOperators, selectedFactory, selectedLine, selectedGrade, selectedSkill, sortBy]);

  // ============================================================================
  // STRATEGI PAGINATION / INFINITE SCROLL (20 - 30 DATA PER BATCH):
  // Menghindari rendering ratusan / ribuan node DOM secara langsung.
  // Hanya me-render 'visibleCount' data (batch 24), dan menambah batch berikutnya
  // saat tombol 'Muat Lebih Banyak' diklik atau user scroll mendekati bagian bawah.
  // ============================================================================
  const displayedOperators = useMemo(() => {
    return filteredOperators.slice(0, visibleCount);
  }, [filteredOperators, visibleCount]);

  const hasMore = visibleCount < filteredOperators.length;

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filteredOperators.length));
  }, [filteredOperators.length]);

  // Infinite Scroll Trigger via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        handleLoadMore();
      }
    }, { rootMargin: '300px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, handleLoadMore, isLoading]);

  // Reset pagination saat filter sekunder berubah
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [selectedFactory, selectedLine, selectedGrade, selectedSkill, sortBy]);

  // Statistics dari hasil pencarian
  const stats = useMemo(() => {
    const total = filteredOperators.length;
    if (total === 0) return { total: 0, multiSkill: 0, multiSkillPct: 0, avgPoints: '0.0', avgTenure: '0.0' };

    const multiCount = filteredOperators.filter(op => op.multiSkillCount >= 2).length;
    const totalPointsSum = filteredOperators.reduce((acc, op) => acc + (op.totalPoints || 0), 0);
    const totalMonthsSum = filteredOperators.reduce((acc, op) => acc + (op.tenureMonths || 0), 0);

    return {
      total,
      multiSkill: multiCount,
      multiSkillPct: Math.round((multiCount / total) * 100),
      avgPoints: (totalPointsSum / total).toFixed(1),
      avgTenure: (totalMonthsSum / total).toFixed(1),
    };
  }, [filteredOperators]);

  const hasActiveFilters = selectedFactory !== 'ALL' || selectedLine !== 'ALL' || selectedGrade !== 'ALL' || selectedSkill !== 'ALL';

  const handleResetFilters = () => {
    setSelectedFactory('ALL');
    setSelectedLine('ALL');
    setSelectedGrade('ALL');
    setSelectedSkill('ALL');
    setSortBy('NAME_ASC');
  };

  const handleClearAll = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setRawSearchResults([]);
    handleResetFilters();
  };

  const isSearchEmpty = searchInput.trim() === '';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      
      {/* 1. HERO HEADER & SEARCH INPUT BANNER */}
      <div className="bg-gradient-to-r from-[#2C3E3E] via-[#354D4D] to-[#405858] rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-white/10 relative overflow-hidden">
        {/* Subtle decorative background shapes */}
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-[#2AAFA3]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 translate-y-12 w-48 h-48 bg-[#D0A018]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#2AAFA3]/25 text-emerald-300 text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border border-[#2AAFA3]/40">
              PT. Winners International IE & Lean System
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <User className="w-7 h-7 text-[#2AAFA3]" />
            <span>{t.searchTab.title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-[#C8D8D8] mt-1.5 leading-relaxed max-w-2xl">
            {t.searchTab.subtitle}
          </p>

          {/* Primary Search Input Bar with Debounce 400ms & In-input Spinner */}
          <div className="mt-5 relative max-w-3xl">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-[#2AAFA3] pointer-events-none" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Ketik NIK atau nama operator untuk mulai mencari..."
                className="w-full pl-12 pr-32 py-3 sm:py-3.5 bg-black/30 hover:bg-black/40 focus:bg-black/50 text-white placeholder:text-[#A0B5B5] border border-white/20 focus:border-[#2AAFA3] rounded-2xl outline-none text-sm transition-all shadow-inner focus:ring-4 focus:ring-[#2AAFA3]/20"
                autoFocus
              />

              {/* Action & Loading Indicator di dalam Search Box */}
              <div className="absolute right-3 flex items-center gap-2">
                {/* Spinner kecil di dalam search box saat fetch / debounce API berjalan */}
                {isLoading && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/50 border border-[#2AAFA3]/50 text-[#2AAFA3] text-[11px] font-semibold animate-in fade-in duration-150">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2AAFA3]" />
                    <span className="hidden sm:inline text-white/90">Mencari...</span>
                  </div>
                )}

                {/* Tombol Hapus Input jika ada teks dan tidak sedang loading */}
                {searchInput && !isLoading && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[#C8D8D8] hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {t.sidebar.clearSearch}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTER & TOOLBAR PANEL (Hanya tampil jika ada kata kunci atau sedang loading/memiliki hasil) */}
      {!isSearchEmpty && (
        <div className="bg-white rounded-2xl p-4 border border-[#E0E8E8] shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Filters Group */}
            <div className="flex flex-wrap items-center gap-2 text-xs flex-1">
              <div className="flex items-center gap-1.5 text-[#5A6E6E] font-semibold pr-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#2AAFA3]" />
                <span className="hidden sm:inline">Filter:</span>
              </div>

              {/* Factory Filter */}
              <div className="relative">
                <select
                  value={selectedFactory}
                  onChange={(e) => {
                    setSelectedFactory(e.target.value);
                    setSelectedLine('ALL');
                  }}
                  aria-label={t.searchTab.filterFactory}
                  className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
                >
                  <option value="ALL">{t.searchTab.allFactories}</option>
                  {factoryOptions.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Line Filter */}
              <div className="relative">
                <select
                  value={selectedLine}
                  onChange={(e) => setSelectedLine(e.target.value)}
                  aria-label={t.searchTab.filterLine}
                  className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
                >
                  <option value="ALL">{t.searchTab.allLines}</option>
                  {lineOptions.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Grade Filter */}
              <div className="relative">
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  aria-label={t.searchTab.filterGrade}
                  className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
                >
                  <option value="ALL">{t.searchTab.allGrades}</option>
                  <option value="S">Grade S (&gt;13 Pts)</option>
                  <option value="A">Grade A (8-13 Pts)</option>
                  <option value="B">Grade B (4-7 Pts)</option>
                  <option value="C">Grade C (1-3 Pts)</option>
                  <option value="HELPER">Helper (0 Pts)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Skill Filter */}
              <div className="relative">
                <select
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                  aria-label={t.searchTab.filterSkill}
                  className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
                >
                  <option value="ALL">{t.searchTab.allSkills}</option>
                  <option value="MULTI">Multi-Skill (≥2 Mesin)</option>
                  <option value="SINGLE">Single-Skill (1 Mesin)</option>
                  <option value="HELPER">Helper (Non-Mesin)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Reset Secondary Filters Button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-[#E05252] hover:text-[#C53030] hover:bg-rose-50 px-2.5 py-1.5 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t.searchTab.clearFilters}</span>
                </button>
              )}
            </div>

            {/* Sort & View Mode Switcher */}
            <div className="flex items-center gap-2 text-xs">
              {/* Sort Select */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label={t.searchTab.sortBy}
                  className="appearance-none bg-[#F5F8F8] hover:bg-[#EDF3F3] border border-[#D5DFDF] rounded-xl px-3 py-1.5 pr-7 font-semibold text-[#304848] outline-none cursor-pointer focus:border-[#2AAFA3] transition-colors"
                >
                  <option value="NAME_ASC">{t.searchTab.sortNameAsc}</option>
                  <option value="NAME_DESC">{t.searchTab.sortNameDesc}</option>
                  <option value="TENURE_DESC">{t.searchTab.sortTenureDesc}</option>
                  <option value="TENURE_ASC">{t.searchTab.sortTenureAsc}</option>
                  <option value="POINTS_DESC">{t.searchTab.sortPointsDesc}</option>
                  <option value="NIK_ASC">{t.searchTab.sortNikAsc}</option>
                </select>
                <ChevronDown className="w-3 h-3 text-[#788888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center bg-[#F0F4F4] p-0.5 rounded-xl border border-[#D5DFDF]">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                    viewMode === 'cards' 
                      ? 'bg-white text-[#2AAFA3] shadow-xs' 
                      : 'text-[#788888] hover:text-[#304848]'
                  }`}
                  title={t.searchTab.viewCard}
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                    viewMode === 'table' 
                      ? 'bg-white text-[#2AAFA3] shadow-xs' 
                      : 'text-[#788888] hover:text-[#304848]'
                  }`}
                  title={t.searchTab.viewTable}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

          {/* Results Counter & Stats Strip */}
          {!isLoading && filteredOperators.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF2F2] text-xs">
              <span className="text-[#5A6E6E] font-medium">
                {t.searchTab.showingCount
                  .replace('{count}', String(displayedOperators.length))
                  .replace('{total}', String(filteredOperators.length))}
              </span>

              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 text-[#304848] font-semibold">
                  <Award className="w-3.5 h-3.5 text-[#D0A018]" />
                  <span>Multi-Skill:</span>
                  <strong className="text-emerald-700">{stats.multiSkill} ({stats.multiSkillPct}%)</strong>
                </span>
                <span className="inline-flex items-center gap-1 text-[#304848] font-semibold">
                  <span>Avg Poin:</span>
                  <strong className="text-[#2AAFA3]">{stats.avgPoints} Pts</strong>
                </span>
                <span className="inline-flex items-center gap-1 text-[#304848] font-semibold">
                  <Clock className="w-3.5 h-3.5 text-sky-600" />
                  <span>Avg Masa Kerja:</span>
                  <strong className="text-sky-700">{stats.avgTenure} Bln</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. HASIL PENCARIAN ATAU EMPTY STATES */}
      {isSearchEmpty ? (
        /* ============================================================================
           EMPTY STATE AWAL: Muncul saat search box masih kosong.
           Jangan fetch semua data operator saat halaman pertama kali dimuat!
           ============================================================================ */
        <div className="bg-white rounded-3xl p-8 sm:p-14 border border-[#E0E8E8] text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[#EAF7F6] border border-[#BCE5E2] text-[#2AAFA3] flex items-center justify-center mx-auto shadow-2xs">
            <Search className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-[#2C3E3E]">
              Ketik NIK atau nama operator untuk mulai mencari
            </h3>
            <p className="text-xs sm:text-sm text-[#788888] leading-relaxed">
              Ketik minimal 1 karakter pada kotak pencarian di atas untuk memuat profil operator, rincian keahlian mesin, grade IE, dan penempatan lini.
            </p>
          </div>

          {/* Quick Search Suggestions */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-[#889898] font-medium text-[11px]">Contoh pencarian:</span>
            <button
              type="button"
              onClick={() => setSearchInput('10')}
              className="px-3 py-1 rounded-xl bg-[#F5F8F8] hover:bg-[#EAF7F6] hover:text-[#2AAFA3] text-[#405858] font-mono text-[11px] font-semibold border border-[#D5DFDF] transition-colors cursor-pointer"
            >
              NIK "10..."
            </button>
            <button
              type="button"
              onClick={() => setSearchInput('Siti')}
              className="px-3 py-1 rounded-xl bg-[#F5F8F8] hover:bg-[#EAF7F6] hover:text-[#2AAFA3] text-[#405858] text-[11px] font-semibold border border-[#D5DFDF] transition-colors cursor-pointer"
            >
              Nama "Siti"
            </button>
            <button
              type="button"
              onClick={() => setSearchInput('Sri')}
              className="px-3 py-1 rounded-xl bg-[#F5F8F8] hover:bg-[#EAF7F6] hover:text-[#2AAFA3] text-[#405858] text-[11px] font-semibold border border-[#D5DFDF] transition-colors cursor-pointer"
            >
              Nama "Sri"
            </button>
            <button
              type="button"
              onClick={() => setSearchInput('Line 1')}
              className="px-3 py-1 rounded-xl bg-[#F5F8F8] hover:bg-[#EAF7F6] hover:text-[#2AAFA3] text-[#405858] text-[11px] font-semibold border border-[#D5DFDF] transition-colors cursor-pointer"
            >
              Lini "Line 1"
            </button>
          </div>
        </div>
      ) : isLoading ? (
        /* ============================================================================
           SKELETON LOADING CARD (MENGGANTIKAN SPINNER BIASA):
           Placeholder abu-abu dengan proporsi & bentuk sama persis seperti card operator asli.
           Menghilangkan layout shift (CLS) saat fetch berlangsung.
           ============================================================================ */
        viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col justify-between space-y-3 animate-pulse shadow-xs"
              >
                {/* 1. Header Skeleton: Name, NIK Pill, & Grade Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded-md w-3/4" />
                    <div className="h-5 bg-gray-150 rounded-lg w-24" />
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded-xl shrink-0" />
                </div>

                {/* 2. Specs Box Skeleton */}
                <div className="bg-[#F8FAFA] rounded-xl p-2.5 border border-gray-200 space-y-2.5">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <div className="h-3.5 bg-gray-200 rounded w-28" />
                    <div className="h-3.5 bg-gray-200 rounded w-20" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 bg-gray-200 rounded-full shrink-0" />
                    <div className="h-3.5 bg-gray-200 rounded w-44 flex-1" />
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                    <div className="h-3.5 bg-gray-200 rounded w-32" />
                    <div className="h-4 bg-gray-200 rounded w-14" />
                  </div>
                </div>

                {/* 3. Machine Chips Skeleton */}
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-gray-200 rounded w-32" />
                  <div className="flex flex-wrap gap-1">
                    {[...Array(6)].map((_, chipIdx) => (
                      <div key={chipIdx} className="h-5 w-12 bg-gray-200 rounded-md" />
                    ))}
                  </div>
                </div>

                {/* 4. Action Button Skeleton */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="h-8 bg-gray-200 rounded-xl w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden animate-pulse">
            <table className="w-full text-xs">
              <thead className="bg-[#F5F8F8] border-b border-gray-200">
                <tr>
                  {[...Array(10)].map((_, thIdx) => (
                    <th key={thIdx} className="p-3">
                      <div className="h-3 bg-gray-200 rounded w-12 mx-auto" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150">
                {[...Array(6)].map((_, rowIdx) => (
                  <tr key={`skel-row-${rowIdx}`} className="py-3 px-3">
                    <td className="p-3"><div className="h-3 w-6 bg-gray-200 rounded mx-auto" /></td>
                    <td className="p-3"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
                    <td className="p-3"><div className="h-4 w-36 bg-gray-200 rounded" /></td>
                    <td className="p-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                    <td className="p-3"><div className="h-3 w-16 bg-gray-200 rounded" /></td>
                    <td className="p-3"><div className="h-3 w-32 bg-gray-200 rounded" /></td>
                    <td className="p-3"><div className="h-4 w-16 bg-gray-200 rounded mx-auto" /></td>
                    <td className="p-3"><div className="h-3 w-20 bg-gray-200 rounded" /></td>
                    <td className="p-3"><div className="h-5 w-14 bg-gray-200 rounded mx-auto" /></td>
                    <td className="p-3"><div className="h-7 w-20 bg-gray-200 rounded ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : filteredOperators.length === 0 ? (
        /* Empty Results (Operator tidak ditemukan sesuai kata kunci/filter) */
        <div className="bg-white rounded-3xl p-10 border border-[#E0E8E8] text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <User className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-[#304848]">{t.searchTab.noResults}</h3>
          <p className="text-xs text-[#788888] max-w-md mx-auto leading-relaxed">
            {t.searchTab.noResultsDesc}
          </p>
          {(hasActiveFilters || searchInput) && (
            <button
              type="button"
              onClick={handleClearAll}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-[#2AAFA3] text-white rounded-xl text-xs font-bold hover:bg-[#23958B] transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Pencarian & Filter</span>
            </button>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        /* CARD GRID VIEW (BATCH PAGINATION / INFINITE SCROLL) */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayedOperators.map((op) => {
              const hasCopied = copiedNik === (op.nik || op.id);

              return (
                <div
                  key={op.id || op.nik}
                  className="bg-white rounded-2xl border border-[#E0E8E8] hover:border-[#2AAFA3]/60 hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between space-y-3 group"
                >
                  {/* 1. Header: Name, NIK with Copy, and Grade Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-[#2C3E3E] group-hover:text-[#2AAFA3] transition-colors truncate">
                        {op.name || 'Unknown Operator'}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyNik(op.nik || op.id, e)}
                          className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#405858] bg-[#F2F6F6] hover:bg-[#E5EEEE] px-2 py-0.5 rounded-lg border border-[#D5DFDF] transition-colors cursor-pointer"
                          title={hasCopied ? t.searchTab.copyNikSuccess : 'Salin NIK'}
                        >
                          <span>{op.nik || op.id}</span>
                          {hasCopied ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 text-[#788888] opacity-70" />
                          )}
                        </button>

                        {op.status && op.status !== 'ACTIVE' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            {op.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Grade Badge */}
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase shadow-2xs shrink-0 ${op.gradeInfo.cssBadge}`}>
                      {op.gradeInfo.label}
                    </span>
                  </div>

                  {/* 2. Specs Grid: Factory/Line, Tenure, Current Operation, Skill */}
                  <div className="bg-[#F8FAFA] rounded-xl p-2.5 border border-[#E8EEEE] text-xs space-y-2">
                    {/* Factory & Line + Tenure */}
                    <div className="grid grid-cols-2 gap-2 border-b border-[#E2EBEB] pb-2">
                      <div className="flex items-center gap-1.5 text-[#5A6E6E] truncate">
                        <Building2 className="w-3.5 h-3.5 text-[#2AAFA3] shrink-0" />
                        <span className="font-bold text-[#304848] truncate">
                          {op.factory} • {op.line}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#5A6E6E] truncate justify-end">
                        <Clock className="w-3.5 h-3.5 text-[#D0A018] shrink-0" />
                        <span className="font-bold text-[#304848] truncate" title={`Tenure: ${op.tenureText}`}>
                          {op.tenureText}
                        </span>
                      </div>
                    </div>

                    {/* Current Operation */}
                    <div className="flex items-center gap-2">
                      <Workflow className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <div className="truncate flex-1">
                        <span className="text-[10px] text-[#788888] block leading-none">Operasi Saat Ini:</span>
                        <span className="font-semibold text-[#2C3E3E] text-xs truncate block mt-0.5" title={op.currentOperationDisplay}>
                          {op.currentOperationDisplay}
                        </span>
                      </div>
                    </div>

                    {/* Skill Status */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#E2EBEB] text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-[#D0A018] shrink-0" />
                        <span className="font-bold text-emerald-800">
                          {op.isHelper
                            ? 'Helper (Non-Mesin)'
                            : op.multiSkillCount >= 2
                            ? `Multi-Skill (${op.multiSkillCount} Mesin)`
                            : 'Single-Skill (1 Mesin)'}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[#D0A018] bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-xs">
                        {op.totalPoints} Pts
                      </span>
                    </div>
                  </div>

                  {/* 3. Poin Mesin Chips Breakdown */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[#788888] uppercase tracking-wider block">
                      Poin Mesin ({op.activeMachines.length} Mesin Aktif)
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {op.machineBreakdown.map((m: any) => {
                        const hasPoints = m.points > 0;
                        const isCurrentOpMachine = op.activeMachineCol === m.category;

                        if (isCurrentOpMachine && !op.isHelper) {
                          return (
                            <span
                              key={m.code}
                              className="px-2 py-0.5 rounded text-[10px] font-mono font-black flex items-center gap-1.5 bg-emerald-600 text-white border border-emerald-700 shadow-sm ring-2 ring-emerald-400/40 transition-colors"
                              title={`${m.label}: ${m.points} Poin (Sedang Digunakan pada Operasi Saat Ini: ${op.currentOperationDisplay})`}
                            >
                              <span>{m.code}</span>
                              <span className="font-black">{m.points}p</span>
                              <span className="text-[8px] bg-emerald-800/80 px-1 py-0.2 rounded font-sans uppercase font-bold tracking-tight">Active</span>
                            </span>
                          );
                        }

                        return (
                          <span
                            key={m.code}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 border transition-colors ${
                              m.points === 3
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : m.points === 2
                                ? 'bg-sky-50 text-sky-800 border-sky-300'
                                : m.points === 1
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                            }`}
                            title={`${m.label}: ${m.points} Poin`}
                          >
                            <span>{m.code}</span>
                            <span className={hasPoints ? 'font-black' : ''}>{m.points}p</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Action Button */}
                  <div className="pt-2 border-t border-[#EEF2F2]">
                    <button
                      type="button"
                      onClick={() => onNavigateToLine(op.factory || 'Factory 1', op.line || 'Line 1', op.id)}
                      className="w-full py-2 px-3 rounded-xl bg-[#2AAFA3]/10 hover:bg-[#2AAFA3] text-[#2AAFA3] hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer shadow-2xs group/btn"
                    >
                      <span>{t.searchTab.openInMatrix}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls & Infinite Scroll Sentinel */}
          {hasMore && (
            <div className="pt-4 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-[#EAF7F6] text-[#2AAFA3] hover:text-[#1F8F85] font-bold text-xs border border-[#2AAFA3]/30 shadow-xs transition-all cursor-pointer"
              >
                <span>Muat Lebih Banyak ({filteredOperators.length - displayedOperators.length} Operator Lagi)</span>
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
              <span className="text-[11px] text-[#788888]">
                Menampilkan {displayedOperators.length} dari {filteredOperators.length} hasil
              </span>
              {/* IntersectionObserver Sentinel for smooth background infinite loading */}
              <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />
            </div>
          )}
        </div>
      ) : (
        /* TABULAR EXCEL/IE VIEW (BATCH PAGINATION / INFINITE SCROLL) */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E0E8E8] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F5F8F8] text-[#405858] font-bold border-b border-[#E0E8E8] uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-3 w-12 text-center">No</th>
                    <th className="px-3 py-3">NIK</th>
                    <th className="px-3 py-3">Nama Operator</th>
                    <th className="px-3 py-3">Lokasi (Pabrik & Lini)</th>
                    <th className="px-3 py-3">Masa Kerja</th>
                    <th className="px-3 py-3">Operasi Saat Ini</th>
                    <th className="px-3 py-3 text-center">Poin Mesin</th>
                    <th className="px-3 py-3">Kategori Skill</th>
                    <th className="px-3 py-3 text-center">Grade IE</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F2]">
                  {displayedOperators.map((op, idx) => {
                    const hasCopied = copiedNik === (op.nik || op.id);

                    return (
                      <tr key={op.id || op.nik} className="hover:bg-[#F9FCFC] transition-colors">
                        <td className="px-3 py-2.5 text-center text-[#788888] font-mono">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#304848]">
                          <button
                            type="button"
                            onClick={(e) => handleCopyNik(op.nik || op.id, e)}
                            className="inline-flex items-center gap-1 hover:text-[#2AAFA3] cursor-pointer"
                            title="Klik untuk salin NIK"
                          >
                            <span>{op.nik || op.id}</span>
                            {hasCopied ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 text-[#788888] opacity-60" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-[#2C3E3E]">
                          {op.name}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 text-[#405858] font-semibold bg-[#F0F5F5] px-2 py-0.5 rounded-md border border-[#E0E8E8]">
                            <Building2 className="w-3 h-3 text-[#2AAFA3]" />
                            {op.factory} • {op.line}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[#405858]">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#D0A018]" />
                            {op.tenureText}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[#304848] max-w-xs truncate" title={op.currentOperationDisplay}>
                          {op.currentOperationDisplay}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                            <span className="font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              {op.totalPoints} Pts
                            </span>
                            {op.activeMachineCol && !op.isHelper && (
                              <span 
                                className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                                title={`Mesin sedang aktif: ${op.activeMachineCol}`}
                              >
                                <span>{op.activeMachineCol === 'LOCKSTITCH' ? 'SN' :
                                       op.activeMachineCol === 'OVERLOCK' ? 'OL' :
                                       op.activeMachineCol === 'FLATSEAM' ? 'FS' :
                                       op.activeMachineCol === 'BUTTON_HOLE' ? 'BH' :
                                       op.activeMachineCol === 'BUTTON_SET' ? 'BS' : 'SP'} Aktif</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-emerald-800">
                          {op.isHelper
                            ? 'Helper'
                            : op.multiSkillCount >= 2
                            ? `Multi-Skill (${op.multiSkillCount})`
                            : 'Single-Skill'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-black uppercase ${op.gradeInfo.cssBadge}`}>
                            {op.gradeInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onNavigateToLine(op.factory || 'Factory 1', op.line || 'Line 1', op.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2AAFA3]/10 hover:bg-[#2AAFA3] text-[#2AAFA3] hover:text-white font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            <span>{t.searchTab.openInMatrix}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Pagination Controls & Infinite Scroll Sentinel */}
          {hasMore && (
            <div className="pt-2 flex flex-col items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-[#EAF7F6] text-[#2AAFA3] hover:text-[#1F8F85] font-bold text-xs border border-[#2AAFA3]/30 shadow-xs transition-all cursor-pointer"
              >
                <span>Muat Lebih Banyak ({filteredOperators.length - displayedOperators.length} Operator Lagi)</span>
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
              <span className="text-[11px] text-[#788888]">
                Menampilkan {displayedOperators.length} dari {filteredOperators.length} operator
              </span>
              <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />
            </div>
          )}
        </div>
      )}

    </div>
  );
};
