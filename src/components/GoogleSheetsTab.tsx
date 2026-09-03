import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Link2, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  Lock, 
  UserCheck, 
  Database,
  ExternalLink,
  Download,
  Building2,
  Table
} from 'lucide-react';
import { Operator } from '../types';

interface GoogleSheetsTabProps {
  operators: Operator[];
  selectedFactory: string;
  selectedLine: string;
  userRole: 'VIEWER' | 'EDITOR' | 'ADMIN';
  onSyncOperators?: (newOperators: Operator[]) => void;
}


// Helper untuk mengonversi baris mentah Google Sheets (tab by_worker) menjadi array Operator
const parseSheetRowsToOperators = (rows: any[]): Operator[] => {
  if (!rows || rows.length === 0) return [];
  
  // Jika sudah merupakan array of object Operator
  if (typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    return rows as Operator[];
  }

  // Jika berupa array 2D baris Google Sheets
  const isHeaderFirst = Array.isArray(rows[0]) && (
    rows[0].some((c: any) => typeof c === 'string' && /worker|nik|factory|line|name/i.test(c))
  );
  const dataRows = isHeaderFirst ? rows.slice(1) : rows;

  const operatorMap = new Map<string, {
    nik: string;
    name: string;
    doj: string;
    factory: string;
    line: string;
    status: string;
    recordDate?: string;
    lockstitchRates: number[];
    overlockRates: number[];
    flatseamRates: number[];
    specialRates: number[];
    buttonHoleRates: number[];
    buttonSetRates: number[];
    bartackRates: number[];
    chainstitchRates: number[];
  }>();

  dataRows.forEach((row: any, idx: number) => {
    if (!Array.isArray(row)) return;
    const rawFactory = (row[0] !== undefined && row[0] !== null) ? row[0].toString().trim() : "Factory 1";
    const rawLine = (row[1] !== undefined && row[1] !== null) ? row[1].toString().trim() : "Line 1";
    const nik = (row[4] || row[0] || `OP-${idx + 1}`).toString().trim();
    const name = (row[5] || row[1] || `Operator ${nik}`).toString().trim();
    const doj = (row[6] || "-").toString().trim();

    let rowDate = "";
    for (let c = 0; c < Math.min(row.length, 7); c++) {
      const cellVal = (row[c] || "").toString().trim();
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(cellVal) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(cellVal)) {
        rowDate = cellVal;
        break;
      }
    }

    const rawProdVal = (row[12] !== undefined && row[12] !== "") ? row[12] : (row[11] || "75");
    const prodRate = parseFloat(String(rawProdVal).replace('%', '').replace(',', '.').trim()) || 75;
    const rawCatVal = (row[16] && row[16].toString().trim()) || (row[15] && row[15].toString().trim()) || "";
    const machineCategory = rawCatVal.toString().trim().toUpperCase();
    const rawStatusVal = (row[17] !== undefined && row[17] !== null) ? row[17].toString().trim() : "ACTIVE";

    if (!operatorMap.has(nik)) {
      operatorMap.set(nik, {
        nik,
        name: name || `Operator ${nik}`,
        doj: doj || "-",
        factory: rawFactory.startsWith("Factory") ? rawFactory : `Factory ${rawFactory}`,
        line: rawLine.startsWith("Line") ? rawLine : `Line ${rawLine}`,
        status: rawStatusVal || "ACTIVE",
        recordDate: rowDate || undefined,
        lockstitchRates: [],
        overlockRates: [],
        flatseamRates: [],
        specialRates: [],
        buttonHoleRates: [],
        buttonSetRates: [],
        bartackRates: [],
        chainstitchRates: [],
      });
    }

    const op = operatorMap.get(nik)!;
    if (doj && op.doj === "-") op.doj = doj;
    if (name && !op.name) op.name = name;

    if (machineCategory.includes("LOCKSTITCH") || machineCategory === "SN") {
      op.lockstitchRates.push(prodRate);
    } else if (machineCategory.includes("OVERLOCK") || machineCategory === "OL") {
      op.overlockRates.push(prodRate);
    } else if (machineCategory.includes("FLATSEAM") || machineCategory === "FS") {
      op.flatseamRates.push(prodRate);
    } else if (machineCategory.includes("BUTTON HOLE") || machineCategory === "BH") {
      op.buttonHoleRates.push(prodRate);
    } else if (machineCategory.includes("BUTTON SET") || machineCategory === "BS") {
      op.buttonSetRates.push(prodRate);
    } else if (machineCategory.includes("BARTACK") || machineCategory === "BT") {
      op.bartackRates.push(prodRate);
    } else if (machineCategory.includes("CHAINSTITCH") || machineCategory === "CS") {
      op.chainstitchRates.push(prodRate);
    } else if (machineCategory.includes("SPECIAL") || machineCategory === "SP") {
      op.specialRates.push(prodRate);
    } else {
      op.lockstitchRates.push(prodRate);
    }
  });

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  return Array.from(operatorMap.values()).map((item, index): Operator => ({
    id: `op-sheet-${item.nik}-${index + 1}`,
    no: index + 1,
    nik: item.nik,
    name: item.name,
    doj: item.doj,
    workTimeMonths: 12,
    factory: item.factory,
    line: item.line,
    status: (item.status as any) || 'ACTIVE',
    recordDate: item.recordDate,
    lockstitch: avg(item.lockstitchRates),
    overlock: avg(item.overlockRates),
    flatseam: avg(item.flatseamRates),
    special: avg(item.specialRates),
    buttonHole: avg(item.buttonHoleRates),
    buttonSet: avg(item.buttonSetRates),
    chainstitch: avg(item.chainstitchRates),
    bartack: avg(item.bartackRates),
  }));
};

export const GoogleSheetsTab: React.FC<GoogleSheetsTabProps> = ({
  operators,
  selectedFactory,
  selectedLine,
  userRole,
  onSyncOperators,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Terkoneksi ke Google Sheets');
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncedCount, setSyncedCount] = useState<number | null>(null);
  const [sheetDetails, setSheetDetails] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const spreadsheetId = "1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag";
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Ganti bagian fetch atau variabel URL-nya menjadi langsung mengarah ke string URL GAS secara mutlak:
  const GAS_URL = "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Z5fnKejoelvuKkHQ1f.../exec";

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncSuccess(false);
    setSyncError(null);
    try {
      const res = await fetch(GAS_URL);
      const data = await res.json();
      
      if (data.status === "success" && Array.isArray(data.data)) {
        // Sesuaikan parsing data dari array rows Google Sheets
        setSyncedCount(data.data.length - 1); // dikurangi header
        setSyncSuccess(true);
        setLastSyncTime(new Date().toLocaleString('id-ID'));
        if (onSyncOperators) {
          const parsedOps = parseSheetRowsToOperators(data.data);
          onSyncOperators(parsedOps.length > 0 ? parsedOps : (data.data as any));
        }
      } else if (data.status === "success" && Array.isArray(data.operators)) {
        setSyncedCount(data.operators.length);
        setSyncSuccess(true);
        setLastSyncTime(new Date().toLocaleString('id-ID'));
        if (onSyncOperators) {
          onSyncOperators(data.operators);
        }
      } else {
        setSyncError(data.message || data.error || "Gagal sinkronisasi data dari Google Apps Script.");
      }
    } catch (err: any) {
      setSyncError(err.toString());
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      <div className="bg-white border border-[#E0E8E8] rounded-[20px] p-6 shadow-[0_8px_30px_rgba(48,72,72,0.06)]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between pb-5 border-b border-[#E0E8E8]">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-[#D9F1EF] text-[#247F77] rounded-2xl border border-[#BDE5E2]">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#304848]">Google Sheets Live Connection</h3>
              <p className="text-xs text-[#788888]">
                Sinkronisasi data mentah Skill Matrix dan Master Style dari Google Spreadsheet PT. Winners International.
              </p>
            </div>
          </div>
          <a
            href={sheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#C8D8D8] text-xs font-semibold text-[#405858] hover:bg-[#F0F5F5] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#2AAFA3]" />
            <span>Buka di Google Sheets</span>
          </a>
        </div>

        {/* CONNECTION STATUS */}
        <div className="py-5 space-y-4">
          
          <div className="flex items-center justify-between p-4 bg-[#F8FBFB] border border-[#C8D8D8] rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#2AAFA3] animate-pulse" />
              <div>
                <h4 className="text-xs font-bold text-[#304848]">Status: Terhubung & Aktif (.env Configured)</h4>
                <p className="text-[11px] text-[#788888]">
                  ID Spreadsheet: <code className="text-[#405858] font-mono font-semibold">{spreadsheetId}</code>
                </p>
              </div>
            </div>
            <span className="badge-teal text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#BDE5E2]">
              Google Sheets API v4
            </span>
          </div>

          {/* SPREADSHEET URL SETTING */}
          <div>
            <label className="block text-xs font-semibold text-[#506868] mb-1.5">
              Google Sheet URL Target:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={sheetUrl}
                className="flex-1 bg-[#F8F8F8] border border-[#E0E8E8] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#304848] select-all outline-none"
              />
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="bg-[#D0A018] hover:bg-[#B88C10] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Menghubungkan...' : 'Tarik Data Baru'}</span>
              </button>
            </div>
          </div>

          {syncSuccess && (
            <div className="p-3.5 bg-[#D9F1EF] border border-[#BDE5E2] rounded-xl text-xs text-[#247F77] flex items-center gap-2 animate-fade-in font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#2AAFA3] shrink-0" />
              <span>
                {syncedCount
                  ? `Berhasil menarik dan mengagregasikan ${syncedCount} Operator dari tab 'by_worker' Google Sheets!`
                  : sheetDetails?.spreadsheetTitle 
                    ? `Berhasil tersambung ke "${sheetDetails.spreadsheetTitle}" (${sheetDetails.sheets?.length || 1} sheet tab ditemukan).` 
                    : `Data ${operators.length} Operator di ${selectedFactory} • ${selectedLine} tersinkronisasi!`}
              </span>
            </div>
          )}

          {syncError && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Info Akses Google Sheets API:</p>
                <p className="text-[11px] text-amber-700">{syncError}</p>
                <p className="text-[11px] text-amber-700">Pastikan Spreadsheet diset ke "Anyone with the link can view" atau kredensial API Key memiliki izin akses.</p>
              </div>
            </div>
          )}

          {/* ACCESS PERMISSIONS TABLE */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-[#405858] mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#2AAFA3]" />
              <span>Pengaturan Hak Akses Edit & Review (RBAC):</span>
            </h4>
            
            <div className="bg-[#F8F8F8] border border-[#E0E8E8] rounded-2xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#E8EEEE] border-b border-[#E0E8E8] text-[#405858] font-bold text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Level Pengguna</th>
                    <th className="py-2.5 px-4">Akses Aplikasi</th>
                    <th className="py-2.5 px-4">Status Anda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E8E8] text-[#506868]">
                  <tr className={userRole === 'VIEWER' ? 'bg-[#D9F1EF]/30 font-semibold' : ''}>
                    <td className="py-2.5 px-4 font-bold text-[#304848]">Viewer (GM / Factory Mgr)</td>
                    <td className="py-2.5 px-4">Lihat Matrix, Ekspor CSV, Pantau Yamazumi & AI Consultant</td>
                    <td className="py-2.5 px-4">
                      {userRole === 'VIEWER' && <span className="text-[#2AAFA3] font-bold">Aktif Saat Ini</span>}
                    </td>
                  </tr>
                  <tr className={userRole === 'EDITOR' ? 'bg-[#D9F1EF]/30 font-semibold' : ''}>
                    <td className="py-2.5 px-4 font-bold text-[#304848]">Editor (IE Staff / Leader)</td>
                    <td className="py-2.5 px-4">Input Skill Rate, Ubah Nilai SMV, Tambah Data Operator Baru</td>
                    <td className="py-2.5 px-4">
                      {userRole === 'EDITOR' && <span className="text-[#2AAFA3] font-bold">Aktif Saat Ini</span>}
                    </td>
                  </tr>
                  <tr className={userRole === 'ADMIN' ? 'bg-[#D9F1EF]/30 font-semibold' : ''}>
                    <td className="py-2.5 px-4 font-bold text-[#304848]">Admin (Head of IE & IT)</td>
                    <td className="py-2.5 px-4">Full Control: Hapus Data, Setting Master Garment Style, Cloud Sync</td>
                    <td className="py-2.5 px-4">
                      {userRole === 'ADMIN' && <span className="text-[#2AAFA3] font-bold">Aktif Saat Ini</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[11px] text-[#788888] pt-2 flex items-center justify-between">
            <span>Terakhir sinkronisasi: <strong>{lastSyncTime}</strong></span>
            <span className="font-mono">Total Rekor: {operators.length} Operator</span>
          </div>

        </div>

      </div>

    </div>
  );
};

