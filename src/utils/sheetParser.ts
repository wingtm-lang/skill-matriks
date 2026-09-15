import { Operator } from "../types";
import { calculateWorkTimeMonths } from "./ieCalculations";

export const DEFAULT_SPREADSHEET_ID = "1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag";
export const DEFAULT_SHEETS_API_KEY = "AIzaSyBA08ZGyorJcsIXqe77sTuuNPxsOMWVabw";
export const CACHE_STORAGE_KEY = "WINNERS_OPERATORS_CACHE_V2";

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function formatFactory(raw: any): string {
  if (raw === undefined || raw === null || raw === "") return "Factory 1";
  const str = String(raw).trim();
  if (!str || str === "-") return "Factory 1";
  if (/^factory\s*\d+/i.test(str)) {
    const num = str.match(/\d+/)?.[0];
    return `Factory ${num}`;
  }
  if (/^\d+$/.test(str)) {
    return `Factory ${str}`;
  }
  if (str.toLowerCase().startsWith("factory")) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  return `Factory ${str}`;
}

export function formatLine(raw: any): string {
  if (raw === undefined || raw === null || raw === "") return "Line 1";
  const str = String(raw).trim();
  if (!str || str === "-") return "Line 1";
  if (/^line\s*\d+/i.test(str)) {
    const num = str.match(/\d+/)?.[0];
    return `Line ${num}`;
  }
  if (/^\d+$/.test(str)) {
    return `Line ${str}`;
  }
  if (str.toLowerCase().startsWith("line")) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  return `Line ${str}`;
}

export function parseSheetRowsToOperators(rows: any[][]): {
  operators: Operator[];
  factories: string[];
  lines: string[];
} {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { operators: [], factories: [], lines: [] };
  }

  const operatorMap = new Map<string, {
    nik: string;
    name: string;
    doj: string;
    factory: string;
    line: string;
    status: string;
    dateOfResign?: string;
    recordDate?: string;
    workMonth?: number;
    styleNo?: string;
    process?: string;
    machine?: string;
    machineCategory?: string;
    table?: string;
    productionRate?: number;
    pointsRates: number[];
    lockstitchRates: number[];
    overlockRates: number[];
    flatseamRates: number[];
    specialRates: number[];
    buttonHoleRates: number[];
    buttonSetRates: number[];
    bartackRates: number[];
    chainstitchRates: number[];
  }>();

  // Jika baris pertama adalah header, lewati
  const dataRows = (Array.isArray(rows[0]) && typeof rows[0][0] === "string" && isNaN(Number(rows[0][0])))
    ? rows.slice(1)
    : rows;

  dataRows.forEach((row) => {
    if (!row || row.length === 0) return;

    const rawFactory = row[0] !== undefined && row[0] !== null ? row[0].toString().trim() : "";
    const rawLine = row[1] !== undefined && row[1] !== null ? row[1].toString().trim() : "";
    const rawTable = row[2] !== undefined && row[2] !== null ? row[2].toString().trim() : "";
    const nik = (row[4] || "").toString().trim();
    const name = (row[5] || "").toString().trim();
    const doj = (row[6] || "").toString().trim();

    if (!nik || nik.toLowerCase() === "worker code" || nik.toLowerCase() === "nik") return;

    let rowDate = (row[3] || "").toString().trim();
    if (!rowDate) {
      for (let c = 0; c < Math.min(row.length, 7); c++) {
        const cellVal = (row[c] || "").toString().trim();
        if (
          /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(cellVal) ||
          /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(cellVal) ||
          /^\d{1,2}[-\s/][A-Za-z]{3,10}[-\s/]\d{2,4}/.test(cellVal)
        ) {
          rowDate = cellVal;
          break;
        }
      }
    }

    const rawProdVal = row[12] !== undefined && row[12] !== "" ? row[12] : (row[11] || "");
    const rawProdRate = rawProdVal.toString().replace("%", "").replace(",", ".").trim();
    const prodRate = parseFloat(rawProdRate) || 0;

    const rawPointVal = row[13] !== undefined && row[13] !== "" ? row[13] : "";
    const parsedPoint = parseFloat(rawPointVal.toString().replace(",", ".").replace(/[^0-9.]/g, "").trim()) || 0;
    let pointVal = parsedPoint > 0 ? Math.min(3, Math.max(1, Math.round(parsedPoint))) : 0;
    if (rawPointVal === "" && prodRate > 0) {
      if (prodRate >= 100) pointVal = 3;
      else if (prodRate >= 70) pointVal = 2;
      else pointVal = 1;
    }

    const rawMachineName = (row[7] && row[7].toString().trim()) || "";
    const rawStyleNo = (row[8] && row[8].toString().trim()) || "";
    const rawProcess = (row[9] && row[9].toString().trim()) || "";

    const rawWorkMonth = row[14] !== undefined && row[14] !== null ? row[14].toString().trim() : "";
    const parsedWorkMonth = parseInt(rawWorkMonth, 10);

    const rawDateOfResign = row[15] !== undefined && row[15] !== null ? row[15].toString().trim() : "";

    const rawCatVal = (row[16] && row[16].toString().trim()) || "";
    const machineCategory = rawCatVal.toUpperCase();
    const machineName = rawMachineName.toUpperCase();

    const rawStatusVal = row[17] !== undefined && row[17] !== null ? row[17].toString().trim() : "";
    const status = rawStatusVal || "ACTIVE";

    const formattedFactory = formatFactory(rawFactory);
    const formattedLine = formatLine(rawLine);
    const mapKey = rowDate ? `${nik}_${rowDate}` : nik;

    if (!operatorMap.has(mapKey)) {
      operatorMap.set(mapKey, {
        nik,
        name: name || `Operator ${nik}`,
        doj: doj || "-",
        factory: formattedFactory,
        line: formattedLine,
        status,
        dateOfResign: rawDateOfResign || undefined,
        recordDate: rowDate || undefined,
        workMonth: !isNaN(parsedWorkMonth) && parsedWorkMonth > 0 ? parsedWorkMonth : undefined,
        styleNo: rawStyleNo || undefined,
        process: rawProcess || undefined,
        machine: rawMachineName || undefined,
        machineCategory: rawCatVal || undefined,
        table: rawTable || undefined,
        productionRate: prodRate || undefined,
        pointsRates: [],
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

    const op = operatorMap.get(mapKey)!;
    if (pointVal > 0) {
      op.pointsRates.push(pointVal);
    }

    if (doj && op.doj === "-") op.doj = doj;
    if (formattedFactory) op.factory = formattedFactory;
    if (formattedLine) op.line = formattedLine;
    if (rawStatusVal) op.status = rawStatusVal;
    if (rawDateOfResign && !op.dateOfResign) op.dateOfResign = rawDateOfResign;
    if (rowDate && !op.recordDate) op.recordDate = rowDate;
    if (name && !op.name) op.name = name;
    if (rawStyleNo) op.styleNo = rawStyleNo;
    if (rawProcess) op.process = rawProcess;
    if (rawMachineName && !op.machine) op.machine = rawMachineName;
    if (rawCatVal && !op.machineCategory) op.machineCategory = rawCatVal;
    if (rawTable && !op.table) op.table = rawTable;
    if (prodRate > 0 && !op.productionRate) op.productionRate = prodRate;
    if (!isNaN(parsedWorkMonth) && parsedWorkMonth > 0 && !op.workMonth) {
      op.workMonth = parsedWorkMonth;
    }

    if (pointVal > 0) {
      if (
        machineCategory.includes("LOCKSTITCH") || machineCategory === "SN" || machineCategory === "SINGLE NEEDLE" ||
        (!machineCategory && (machineName.includes("LOCKSTITCH") || machineName.includes("1NEEDLE") || machineName.includes("SN")))
      ) {
        op.lockstitchRates.push(pointVal);
      } else if (
        machineCategory.includes("OVERLOCK") || machineCategory === "OL" || machineCategory.includes("OBRAS") ||
        (!machineCategory && (machineName.includes("OVERLOCK") || machineName.includes("OBRAS") || machineName.includes("2NEEDLE OVERLOCK")))
      ) {
        op.overlockRates.push(pointVal);
      } else if (
        machineCategory.includes("FLATSEAM") || machineCategory.includes("COVERSTITCH") || machineCategory === "FS" || machineCategory.includes("KAM") ||
        (!machineCategory && (machineName.includes("FLAT SEAM") || machineName.includes("COVERSTITCH") || machineName.includes("FLATSEAM")))
      ) {
        op.flatseamRates.push(pointVal);
      } else if (
        machineCategory.includes("BUTTON_HOLE") || machineCategory.includes("BUTTON HOLE") || machineCategory.includes("BH") || machineCategory.includes("LUBANG KANCING") ||
        (!machineCategory && (machineName.includes("BUTTON HOLE") || machineName.includes("LUBANG KANCING")))
      ) {
        op.buttonHoleRates.push(pointVal);
      } else if (
        machineCategory.includes("BUTTON_SET") || machineCategory.includes("BUTTON SET") || machineCategory.includes("BS") || machineCategory.includes("PASANG KANCING") ||
        (!machineCategory && (machineName.includes("BUTTON SET") || machineName.includes("PASANG KANCING")))
      ) {
        op.buttonSetRates.push(pointVal);
      } else if (
        machineCategory.includes("BARTACK") || machineCategory.includes("BAR TACK") || machineCategory.includes("BT") ||
        (!machineCategory && (machineName.includes("BARTACK") || machineName.includes("BAR TACK")))
      ) {
        op.bartackRates.push(pointVal);
      } else if (
        machineCategory.includes("CHAINSTITCH") || machineCategory.includes("CHAIN STITCH") || machineCategory.includes("CS") || machineCategory.includes("KANSAI") ||
        (!machineCategory && (machineName.includes("CHAINSTITCH") || machineName.includes("KANSAI") || machineName.includes("CHAIN STITCH")))
      ) {
        op.chainstitchRates.push(pointVal);
      } else {
        op.specialRates.push(pointVal);
      }
    }
  });

  const formattedOperators: Operator[] = Array.from(operatorMap.values()).map((op, idx) => {
    const calcMax = (rates: number[]): number | null => {
      if (rates.length === 0) return null;
      const max = Math.max(...rates);
      return max > 0 ? Math.min(3, max) : null;
    };

    const lockstitch = calcMax(op.lockstitchRates);
    const overlock = calcMax(op.overlockRates);
    const flatseam = calcMax(op.flatseamRates);
    const special = calcMax(op.specialRates);
    const buttonHole = calcMax(op.buttonHoleRates);
    const buttonSet = calcMax(op.buttonSetRates);
    const bartack = calcMax(op.bartackRates);
    const chainstitch = calcMax(op.chainstitchRates);

    const activePoints = [lockstitch, overlock, flatseam, special, buttonHole, buttonSet, bartack, chainstitch]
      .filter((r): r is number => r !== null && r > 0);

    const totalPoints = activePoints.reduce((a, b) => a + b, 0);

    const isHelper = op.status?.toUpperCase() === "HELPER";
    let overallGrade: "S" | "A" | "B" | "C" | "HELPER" = "HELPER";
    if (!isHelper && totalPoints > 0) {
      if (totalPoints > 13) overallGrade = "S";
      else if (totalPoints >= 8) overallGrade = "A";
      else if (totalPoints >= 4) overallGrade = "B";
      else overallGrade = "C";
    }

    const tenureMonths = op.workMonth || calculateWorkTimeMonths(op.doj) || 0;

    return {
      no: idx + 1,
      id: op.recordDate ? `op-${op.nik}-${op.recordDate}` : `op-${op.nik}-${idx}`,
      nik: op.nik,
      name: op.name,
      doj: op.doj || "-",
      workTimeMonths: tenureMonths,
      workMonth: tenureMonths,
      factory: op.factory,
      line: op.line,
      status: op.status && op.status.trim() ? op.status.trim() : "ACTIVE",
      dateOfResign: op.dateOfResign || undefined,
      resignDate: op.dateOfResign || undefined,
      recordDate: op.recordDate || undefined,
      date: op.recordDate || undefined,
      styleNo: op.styleNo || undefined,
      process: op.process || undefined,
      currentOperation: op.process || undefined,
      machine: op.machine || undefined,
      machineCategory: op.machineCategory || undefined,
      table: op.table || undefined,
      productionRate: op.productionRate || undefined,
      lockstitch,
      overlock,
      flatseam,
      special,
      buttonHole,
      buttonSet,
      bartack,
      chainstitch,
      avgRate: totalPoints,
      points: totalPoints,
      grade: overallGrade,
      overallGrade,
      notes: `Tersinkronisasi dari Google Sheets 'by_worker' (${activePoints.length} jenis mesin dikuasai, total ${totalPoints} poin)`,
    };
  });

  const uniqueFactories = Array.from(new Set(formattedOperators.map((o) => o.factory))).sort((a, b) => {
    const matchA = a.match(/\d+/);
    const matchB = b.match(/\d+/);
    const numA = matchA ? parseInt(matchA[0], 10) : NaN;
    const numB = matchB ? parseInt(matchB[0], 10) : NaN;
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });

  const uniqueLines = Array.from(new Set(formattedOperators.map((o) => o.line))).sort((a, b) => {
    const matchA = a.match(/\d+/);
    const matchB = b.match(/\d+/);
    const numA = matchA ? parseInt(matchA[0], 10) : NaN;
    const numB = matchB ? parseInt(matchB[0], 10) : NaN;
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numA - numB;
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  });

  return {
    operators: formattedOperators,
    factories: uniqueFactories,
    lines: uniqueLines,
  };
}

/**
 * Direct Google Sheets fetch from browser (Works on Vercel, Netlify, or any static host)
 * Uses official Google Sheets API v4 with public API key or GViz CSV fallback.
 */
export async function fetchDirectFromGoogleSheets(): Promise<{
  operators: Operator[];
  factories: string[];
  lines: string[];
  source: string;
}> {
  const spreadsheetId = (typeof process !== "undefined" && process.env?.VITE_SPREADSHEET_ID) || DEFAULT_SPREADSHEET_ID;
  const apiKey = (typeof process !== "undefined" && process.env?.VITE_GOOGLE_SHEETS_API_KEY) || DEFAULT_SHEETS_API_KEY;

  // 1. Google Sheets API v4 Official Direct Browser Fetch (CORS open to all origins, fast, compressed)
  try {
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/by_worker!A2%3AR?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds timeout

    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.values) && data.values.length > 0) {
        const parsed = parseSheetRowsToOperators(data.values);
        if (parsed.operators.length > 0) {
          // Save to LocalStorage cache
          try {
            localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({
              timestamp: Date.now(),
              operators: parsed.operators,
              factories: parsed.factories,
              lines: parsed.lines,
            }));
          } catch {
            // ignore storage quota errors
          }
          return {
            ...parsed,
            source: `Google Sheets API v4 Direct (${parsed.operators.length} records)`,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("Direct Sheets API v4 fetch error:", err?.message || err);
  }

  // 2. Google Visualization CSV Direct Fetch
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=by_worker`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const gvizResp = await fetch(gvizUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (gvizResp.ok) {
      const csvText = await gvizResp.text();
      const csvLines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (csvLines.length > 1) {
        const rows = csvLines.slice(1).map((l) => parseCsvLine(l));
        const parsed = parseSheetRowsToOperators(rows);
        if (parsed.operators.length > 0) {
          try {
            localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify({
              timestamp: Date.now(),
              operators: parsed.operators,
              factories: parsed.factories,
              lines: parsed.lines,
            }));
          } catch {
            // ignore
          }
          return {
            ...parsed,
            source: `Google Visualization CSV Direct (${parsed.operators.length} records)`,
          };
        }
      }
    }
  } catch (gvizErr: any) {
    console.warn("GViz CSV fetch error:", gvizErr?.message || gvizErr);
  }

  throw new Error("Semua metode sinkronisasi langsung Google Sheets gagal");
}

/**
 * Get cached operators from previous session
 */
export function getStoredOperatorsCache(): {
  operators: Operator[];
  factories: string[];
  lines: string[];
} | null {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed && Array.isArray(parsed.operators) && parsed.operators.length > 0) {
      return {
        operators: parsed.operators,
        factories: parsed.factories || [],
        lines: parsed.lines || [],
      };
    }
  } catch {
    // ignore
  }
  return null;
}
