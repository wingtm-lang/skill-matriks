import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

// Process-level safety guards to prevent unhandled rejections from crashing Cloud Run
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception thrown:", error);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, exiting gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, exiting gracefully");
  process.exit(0);
});

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy initializer for GoogleGenAI
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Mock/heuristic fallback will be used.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: apiKey || "placeholder-key",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return geminiClient;
}

const IE_SYSTEM_INSTRUCTION = `
Anda adalah Senior Industrial Engineer (IE) & Lean Garment Manufacturing Specialist di PT. Winners International.
Spesialisasi Anda meliputi:
1. Analisis Skill Matrix Operator Garmen (Lockstitch/Single Needle, Overlock, Flatseam/Coverstitch, Special Machines seperti Bar Tack, Button Hole, Button Set, Heat Press).
2. Perhitungan Line Balancing Garmen: Pitch Time, Takt Time, SAM/SMV (GSD/MOST), Cycle Time, Line Efficiency (%), Balance Delay (%), Smoothness Index (SI).
3. Analisis dan Mitigasi Bottleneck di Line Jahit Garmen (Polo Shirt, Jacket, T-Shirt, Pants, Sportswear).
4. Rekomendasi Alokasi Manpower & Multi-Skilling Operator (pengembangan skill operator Grade C/D/E menuju Grade A/S).
5. Lean Manufacturing 5S, Kaizen, SMED (Quick Changeover style garmen), Poka-Yoke, Ergonomi meja jahit, dan Yamazumi Chart.

Berikan jawaban terstruktur, praktis, profesional, dan berbasis data teknis dengan tone ramah dan berorientasi solusi manufaktur garmen nyata. Gunakan Bahasa Indonesia profesional dengan istilah standar IE Apparel.
`;

// Health endpoint
app.get(["/health", "/api/health"], (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), company: "PT. Winners International" });
});

// Helper function to calculate Grade from Production Rate % according to GRADE_BENCHMARKS
function getGradeFromEfficiency(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || rate <= 0 || isNaN(rate)) return "HELPER";
  if (rate >= 100) return "S";
  if (rate >= 80) return "A";
  if (rate >= 60) return "B";
  return "C";
}

// Fungsi kalkulasi selisih bulan dari string DOJ (Format: DD-MM-YYYY atau YYYY-MM-DD)
function calculateWorkTimeMonths(dojStr: string | null | undefined): number {
  if (!dojStr || dojStr === "-" || dojStr.trim() === "") return 0;

  let dojDate: Date;

  // Jika formatnya DD-MM-YYYY (contoh: 05-05-2025)
  if (dojStr.includes("-") && dojStr.split("-")[0].length === 2) {
    const parts = dojStr.split("-");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month index JS: 0-11
    const year = parseInt(parts[2], 10);
    dojDate = new Date(year, month, day);
  } else {
    // Fallback parsing baku (YYYY-MM-DD / ISO format)
    dojDate = new Date(dojStr);
  }

  if (isNaN(dojDate.getTime())) return 0;

  const now = new Date();
  
  // Hitung selisih tahun dan bulan
  let months = (now.getFullYear() - dojDate.getFullYear()) * 12 + (now.getMonth() - dojDate.getMonth());
  
  // Jika hari pada bulan berjalan belum melewati hari tanggal join, kurangi 1 bulan
  if (now.getDate() < dojDate.getDate()) {
    months--;
  }

  return Math.max(0, months);
}

// Endpoint untuk menarik data dari Google Sheets tab 'by_worker' dan mengagregasikannya per-operator
app.get("/api/sheets/operators", async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    const spreadsheetId = process.env.SPREADSHEET_ID || "1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag";

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "GOOGLE_SHEETS_API_KEY belum dikonfigurasi di file .env",
      });
    }

    const sheets = google.sheets({ version: "v4", auth: apiKey });

    // Ambil baris dari tab sheet 'by_worker'
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "by_worker!A2:Q2000", // Diperbarui sampai kolom Q (A-Q)
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Tidak ada baris data ditemukan di tab 'by_worker' Google Sheets" 
      });
    }

    // Map agregasi per NIK + Date (atau Month) operator agar snapshot bulanan tidak saling menimpa
    const operatorMap = new Map<string, {
      nik: string;
      name: string;
      doj: string;
      factory: string;
      line: string;
      status: string;
      dateOfResign?: string;
      recordDate?: string;
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

    // Helper formatter Factory & Line
    const formatFactory = (raw: any): string => {
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
    };

    const formatLine = (raw: any): string => {
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
    };

    const dataRows = (Array.isArray(rows[0]) && typeof rows[0][0] === 'string' && isNaN(Number(rows[0][0])))
      ? rows.slice(1)
      : rows;

    dataRows.forEach((row) => {
      // Normalisasi Kolom A (Factory) & Kolom B (Line)
      const rawFactory = (row[0] !== undefined && row[0] !== null) ? row[0].toString().trim() : "";
      const rawLine = (row[1] !== undefined && row[1] !== null) ? row[1].toString().trim() : "";
      const nik = (row[4] || "").toString().trim(); // Kolom E (Worker Code)
      const name = (row[5] || "").toString().trim(); // Kolom F (Worker)
      const doj = (row[6] || "").toString().trim(); // Kolom G (DOJ / Date of Join)
      
      if (!nik || nik.toLowerCase() === "worker code" || nik.toLowerCase() === "nik") return;

      // Ambil Kolom Tanggal dari Kolom D (row[3]) atau scan fallback
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

      // Parse Kolom M / Indeks 12 (Production Rate %) dengan fallback ke Indeks 11
      const rawProdVal = (row[12] !== undefined && row[12] !== "") ? row[12] : (row[11] || "");
      const rawProdRate = rawProdVal.toString().replace('%', '').replace(',', '.').trim();
      const prodRate = parseFloat(rawProdRate) || 0;

      // Parse Kolom N / Indeks 13 (POINT) - Standar PT. Winners International: Maksimal 3 Poin per mesin
      const rawPointVal = (row[13] !== undefined && row[13] !== "") ? row[13] : "";
      const parsedPoint = parseFloat(rawPointVal.toString().replace(',', '.').replace(/[^0-9.]/g, '').trim()) || 0;
      // Nilai poin per mesin di kolom N murni berkisar 1 - 3 (maksimal 3 poin per mesin)
      const pointVal = parsedPoint > 0 ? Math.min(3, Math.max(1, Math.round(parsedPoint))) : 0;
      
      // Normalisasi Kolom Q / Indeks 16 (Machine Category) dengan fallback ke Kolom H / Indeks 7 (Machine)
      const rawCatVal = (row[16] && row[16].toString().trim()) || "";
      const rawMachineName = (row[7] && row[7].toString().trim()) || "";
      const machineCategory = rawCatVal.toUpperCase();
      const machineName = rawMachineName.toUpperCase();

      // Parse Kolom P / Indeks 15 (Date of Resign)
      const rawDateOfResign = (row[15] !== undefined && row[15] !== null) ? row[15].toString().trim() : "";

      // Parse Kolom R / Indeks 17 (Status: ACTIVE, INACTIVE, RESIGNED, TRANSFERRED, dll.)
      const rawStatusVal = (row[17] !== undefined && row[17] !== null) ? row[17].toString().trim() : "";
      const status = rawStatusVal || "ACTIVE";

      if (!nik) return;

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

      // Update DOJ, Factory, Line, Status & Date jika ada record terbaru
      if (doj && op.doj === "-") op.doj = doj;
      if (formattedFactory) op.factory = formattedFactory;
      if (formattedLine) op.line = formattedLine;
      if (rawStatusVal) op.status = rawStatusVal;
      if (rawDateOfResign && !op.dateOfResign) op.dateOfResign = rawDateOfResign;
      if (rowDate && !op.recordDate) op.recordDate = rowDate;
      if (name && !op.name) op.name = name;

      // Kelompokkan nilai poin dari Kolom N per Machine Category (bukan nilai production rate)
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
        } else if (
          machineCategory.includes("SPECIAL") || machineCategory.includes("OTOMATIS") || machineCategory.includes("SP") ||
          (!machineCategory && (machineName.includes("PRESS") || machineName.includes("HEAT TRANSFER") || machineName.includes("SPECIAL")))
        ) {
          op.specialRates.push(pointVal);
        } else {
          op.specialRates.push(pointVal);
        }
      }
    });

    // Format hasil agregasi per Operator
    const formattedOperators = Array.from(operatorMap.values()).map((op, idx) => {
      // Ambil poin paling tinggi di Kolom N untuk setiap mesin history (maksimal 3 poin per mesin)
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

      // Hitung penjumlahan seluruh poin yang didapat dari mesin-mesin yang dikuasai
      const activePoints = [lockstitch, overlock, flatseam, special, buttonHole, buttonSet, bartack, chainstitch]
        .filter((r): r is number => r !== null && r > 0);
      
      const totalPoints = activePoints.reduce((a, b) => a + b, 0);

      // Standarisasi Grade Operator PT. Winners International:
      // Grade S: > 13 Poin
      // Grade A: 8 – 13 Poin
      // Grade B: 4 – 7 Poin
      // Grade C: 1 – 3 Poin
      // Helper: 0 Poin (Input Manual)
      const isHelper = op.status?.toUpperCase() === 'HELPER';
      let overallGrade: "S" | "A" | "B" | "C" | "HELPER" = "HELPER";
      if (!isHelper && totalPoints > 0) {
        if (totalPoints > 13) overallGrade = "S";
        else if (totalPoints >= 8) overallGrade = "A";
        else if (totalPoints >= 4) overallGrade = "B";
        else overallGrade = "C";
      }

      return {
        no: idx + 1,
        id: op.recordDate ? `op-${op.nik}-${op.recordDate}` : `op-${op.nik}-${idx}`,
        nik: op.nik,
        name: op.name,
        doj: op.doj || "-",
        workTimeMonths: calculateWorkTimeMonths(op.doj),
        factory: op.factory,
        line: op.line,
        status: (op.status && op.status.trim()) ? op.status.trim() : 'ACTIVE',
        dateOfResign: op.dateOfResign || undefined,
        resignDate: op.dateOfResign || undefined,
        recordDate: op.recordDate || undefined,
        date: op.recordDate || undefined,
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
        overallGrade,
        notes: `Tersinkronisasi dari Google Sheets 'by_worker' (${activePoints.length} jenis mesin dikuasai, total ${totalPoints} poin)`
      };
    });

    // Ambil daftar unique factories & lines dengan pengurutan numerik alami (natural sort)
    const uniqueFactories = Array.from(new Set(formattedOperators.map(o => o.factory)))
      .sort((a, b) => {
        const matchA = a.match(/\d+/);
        const matchB = b.match(/\d+/);
        const numA = matchA ? parseInt(matchA[0], 10) : NaN;
        const numB = matchB ? parseInt(matchB[0], 10) : NaN;
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });

    const uniqueLines = Array.from(new Set(formattedOperators.map(o => o.line)))
      .sort((a, b) => {
        const matchA = a.match(/\d+/);
        const matchB = b.match(/\d+/);
        const numA = matchA ? parseInt(matchA[0], 10) : NaN;
        const numB = matchB ? parseInt(matchB[0], 10) : NaN;
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });

    res.json({ 
      success: true, 
      count: formattedOperators.length, 
      factories: uniqueFactories,
      lines: uniqueLines,
      operators: formattedOperators,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error fetching Google Sheets:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch from Google Sheets" 
    });
  }
});

// Endpoint untuk lookup operator di sheet "date_of_join" berdasarkan NIK
app.get("/api/sheets/date-of-join", async (req, res) => {
  try {
    const requestedNik = String(req.query.nik || "").trim();
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    const spreadsheetId = process.env.SPREADSHEET_ID || "1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag";

    if (!requestedNik) {
      return res.status(400).json({
        success: false,
        error: "Parameter NIK diperlukan (?nik=...)",
      });
    }

    // 1. Coba baca via Google Sheets API jika apiKey tersedia
    if (apiKey) {
      try {
        const sheets = google.sheets({ version: "v4", auth: apiKey });
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "date_of_join!A1:Z5000",
        });

        const rows = response.data.values;
        if (rows && rows.length > 0) {
          const headers: any[] = rows[0] || [];
          const dataRows = rows.slice(1);

          const findColIdx = (candidates: string[], fallbackIdx: number) => {
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

          const idxNik = findColIdx(["Worker Code", "NIK", "ID", "No. Induk", "Karyawan ID"], 0);
          const idxName = findColIdx(["Nama Lengkap", "Nama", "Worker", "Worker Name", "Employee Name", "Name"], 1);
          const idxDoj = findColIdx(["Date of Join", "DOJ", "Tanggal Masuk", "Tgl Masuk", "Join Date", "D.O.J"], 2);
          const idxFactory = findColIdx(["Factory", "Pabrik"], 3);
          const idxLine = findColIdx(["Line", "Jalur", "Section"], 4);
          const idxStatus = findColIdx(["Status"], 5);

          const matchRow = dataRows.find((row) => {
            const rowNik = (row[idxNik] || "").toString().trim();
            return rowNik.toUpperCase() === requestedNik.toUpperCase();
          });

          if (matchRow) {
            const nik = (matchRow[idxNik] || "").toString().trim();
            const name = (matchRow[idxName] || "").toString().trim().toUpperCase();
            const doj = (matchRow[idxDoj] || "").toString().trim();
            const factory = (matchRow[idxFactory] || "").toString().trim();
            const line = (matchRow[idxLine] || "").toString().trim();
            const status = (matchRow[idxStatus] || "").toString().trim();
            const workTimeMonths = calculateWorkTimeMonths(doj);

            return res.json({
              success: true,
              found: true,
              data: {
                nik,
                name,
                doj,
                workTimeMonths,
                factory,
                line,
                status: status || "ACTIVE",
              },
            });
          }
        }
      } catch (sheetsErr: any) {
        console.warn("Google Sheets API fetch error on date_of_join:", sheetsErr.message);
      }
    }

    // 2. Fallback: Coba panggil Google Apps Script Web App
    const gasUrls = [
      "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec",
      "https://script.google.com/macros/s/AKfycbyfi3iPH2UPpA_SOIt8hUWLTybF30icj_X-IT0V4TyfZGQAmCTWPIrij1LZmmi4oUWDng/exec",
    ];

    for (const gasUrl of gasUrls) {
      try {
        const gasRes = await fetch(`${gasUrl}?action=lookupDateOfJoin&nik=${encodeURIComponent(requestedNik)}`);
        if (gasRes.ok) {
          const gasData: any = await gasRes.json();
          if (gasData.status === "success" && gasData.data) {
            const doj = gasData.data.doj || "";
            return res.json({
              success: true,
              found: true,
              data: {
                nik: gasData.data.nik || requestedNik,
                name: (gasData.data.name || "").toUpperCase(),
                doj,
                workTimeMonths: calculateWorkTimeMonths(doj),
                factory: gasData.data.factory || "",
                line: gasData.data.line || "",
                status: gasData.data.status || "ACTIVE",
              },
            });
          }
        }
      } catch (gasErr: any) {
        console.warn("GAS fetch error:", gasErr.message);
      }
    }

    return res.json({
      success: true,
      found: false,
      message: `NIK ${requestedNik} tidak ditemukan pada sheet 'date_of_join'`,
    });
  } catch (error: any) {
    console.error("Error in /api/sheets/date-of-join:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Gagal mencari data di sheet date_of_join",
    });
  }
});

// Endpoint untuk menanamkan data operator baru ke Google Sheets tab 'by_worker'
app.post("/api/sheets/append-by-worker", async (req, res) => {
  try {
    const operator = req.body;
    if (!operator || !operator.nik || !operator.name) {
      return res.status(400).json({
        success: false,
        error: "Data operator tidak lengkap. NIK dan Nama wajib diisi.",
      });
    }

    const nik = String(operator.nik).trim();
    const name = String(operator.name).trim().toUpperCase();
    const doj = String(operator.doj || "-").trim();
    const factory = operator.factory || "Factory 1";
    const line = operator.line || "Line 1";
    const status = (operator.status || "ACTIVE").toUpperCase();
    const workMonth = typeof operator.workTimeMonths === "number" 
      ? operator.workTimeMonths 
      : (typeof operator.workMonth === "number" ? operator.workMonth : calculateWorkTimeMonths(doj));

    const today = new Date();
    const formattedToday = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
    const dateStr = operator.date || operator.recordDate || formattedToday;

    // Kumpulkan baris untuk setiap mesin yang dievaluasi/diberi poin
    const machineEntries: Array<{ category: string; machineName: string; points: number }> = [];
    if (operator.lockstitch && operator.lockstitch > 0) {
      machineEntries.push({ category: "LOCKSTITCH", machineName: "LOCKSTITCH / SN", points: Math.min(3, Math.round(operator.lockstitch)) });
    }
    if (operator.overlock && operator.overlock > 0) {
      machineEntries.push({ category: "OVERLOCK", machineName: "OVERLOCK / OBRAS", points: Math.min(3, Math.round(operator.overlock)) });
    }
    if (operator.flatseam && operator.flatseam > 0) {
      machineEntries.push({ category: "FLATSEAM", machineName: "FLATSEAM / COVERSTITCH", points: Math.min(3, Math.round(operator.flatseam)) });
    }
    if (operator.special && operator.special > 0) {
      machineEntries.push({ category: "SPECIAL", machineName: "SPECIAL MACHINE", points: Math.min(3, Math.round(operator.special)) });
    }
    if (operator.buttonHole && operator.buttonHole > 0) {
      machineEntries.push({ category: "BUTTON HOLE", machineName: "BUTTON HOLE", points: Math.min(3, Math.round(operator.buttonHole)) });
    }
    if (operator.buttonSet && operator.buttonSet > 0) {
      machineEntries.push({ category: "BUTTON SET", machineName: "BUTTON SET", points: Math.min(3, Math.round(operator.buttonSet)) });
    }

    // Jika belum ada mesin yang dipilih, default 1 baris mesin LOCKSTITCH (1 poin)
    if (machineEntries.length === 0) {
      machineEntries.push({ category: "LOCKSTITCH", machineName: "LOCKSTITCH", points: 1 });
    }

    // Susun baris 18 kolom sesuai datasheet 'by_worker'
    const rowsToAppend = machineEntries.map((entry) => [
      factory,                    // Kolom A: Factory
      line,                       // Kolom B: Line
      "BASIC",                    // Kolom C: Style
      dateStr,                    // Kolom D: Date
      nik,                        // Kolom E: Worker Code
      name,                       // Kolom F: Worker
      doj,                        // Kolom G: Date of Join
      entry.machineName,          // Kolom H: Machine
      "BASIC",                    // Kolom I: Style No
      "SEWING",                   // Kolom J: Process
      0,                          // Kolom K: SMV
      0,                          // Kolom L: Target
      100,                        // Kolom M: Production Rate (%)
      entry.points,               // Kolom N: POINT (1-3)
      workMonth,                  // Kolom O: Work Month
      "",                         // Kolom P: Date of Resign
      entry.category,             // Kolom Q: Machine Category
      status,                     // Kolom R: Status (ACTIVE)
    ]);

    // Kirim data ke Google Apps Script Web App untuk ditanamkan ke sheet 'by_worker'
    const gasUrls = [
      "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec",
      "https://script.google.com/macros/s/AKfycbyfi3iPH2UPpA_SOIt8hUWLTybF30icj_X-IT0V4TyfZGQAmCTWPIrij1LZmmi4oUWDng/exec",
    ];

    let gasSuccess = false;
    let gasMessage = "";

    for (const gasUrl of gasUrls) {
      try {
        const gasRes = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "appendByWorker",
            operator: {
              factory,
              line,
              nik,
              name,
              doj,
              workMonth,
              status,
              date: dateStr,
              machines: machineEntries,
              rows: rowsToAppend,
            },
          }),
        });

        if (gasRes.ok) {
          const gasJson: any = await gasRes.json();
          if (gasJson.status === "success") {
            gasSuccess = true;
            gasMessage = gasJson.message || "Berhasil ditanamkan ke sheet by_worker";
            break;
          }
        }
      } catch (err: any) {
        console.warn("GAS append error:", err.message);
      }
    }

    return res.json({
      success: true,
      gasSuccess,
      message: gasSuccess 
        ? `Operator ${name} (${nik}) dengan status ${status} berhasil ditanamkan ke datasheet 'by_worker'!` 
        : `Data operator ${name} (${nik}) dengan status ${status} telah dipersiapkan dan dicatat di sistem.`,
      rowsAppended: rowsToAppend.length,
      rows: rowsToAppend,
    });
  } catch (error: any) {
    console.error("Error in /api/sheets/append-by-worker:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Gagal menanamkan data ke datasheet by_worker",
    });
  }
});

// Google Sheets live fetch API endpoint using GOOGLE_SHEETS_API_KEY & SPREADSHEET_ID
app.get("/api/sheets/fetch", async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
    const spreadsheetId = process.env.SPREADSHEET_ID || "1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag";

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "GOOGLE_SHEETS_API_KEY belum dikonfigurasi di file .env",
      });
    }

    // 1. Fetch spreadsheet metadata (sheet tabs, title)
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
    const metaRes = await fetch(metaUrl);
    
    if (!metaRes.ok) {
      const errBody = await metaRes.text();
      return res.status(metaRes.status).json({
        success: false,
        error: `Gagal membaca Google Spreadsheet (${metaRes.status}): ${errBody}`,
      });
    }

    const metaData: any = await metaRes.json();
    const sheetTitles = metaData.sheets?.map((s: any) => s.properties.title) || [];
    const firstSheet = sheetTitles[0] || "Sheet1";

    // 2. Fetch sheet values from the primary sheet
    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheet)}?key=${apiKey}`;
    const valuesRes = await fetch(valuesUrl);
    const valuesData: any = valuesRes.ok ? await valuesRes.json() : null;

    res.json({
      success: true,
      spreadsheetTitle: metaData.properties?.title || "Master Data Garmen",
      spreadsheetId,
      sheets: sheetTitles,
      rowCount: valuesData?.values?.length || 0,
      headers: valuesData?.values?.[0] || [],
      rows: valuesData?.values?.slice(1) || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error in /api/sheets/fetch:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Gagal sinkronisasi dengan Google Sheets API",
    });
  }
});

// Helper to check if a real Gemini API Key is configured
function isRealGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed === "" || trimmed === "placeholder-key" || trimmed.startsWith("your-") || trimmed.length < 20) {
    return false;
  }
  return true;
}

// Helper function for calling Gemini models with automatic fallback across models when high demand (503/429) occurs
async function generateGeminiWithFallback(
  prompt: string,
  systemInstruction: string = IE_SYSTEM_INSTRUCTION,
  temperature: number = 0.7
): Promise<string> {
  if (!isRealGeminiKey()) {
    throw new Error("GEMINI_API_KEY is not configured or is a placeholder");
  }

  const ai = getGeminiClient();
  const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.7-flash", "gemini-flash-latest"];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const timeoutMs = 6000;
      const apiCall = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature,
        },
      });

      const timer = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout calling Gemini model ${model}`)), timeoutMs)
      );

      const response = await Promise.race([apiCall, timer]);

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      console.warn(`[Gemini API] Model ${model} unavailable (${errMsg}). Trying next candidate...`);
      if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("Quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini models are temporarily unavailable");
}

// Heuristic Garment IE Knowledge Engine for instant fallback if offline/API unreachable
function generateIEExpertFallback(query: string, context?: any, lang: string = 'id'): string {
  const q = query.toLowerCase();
  const line = context?.selectedLine || "Line Sewing";
  const factory = context?.selectedFactory || "Factory 1";
  const ops: any[] = Array.isArray(context?.operators) ? context.operators : [];
  const isEn = lang === 'en';

  if (q.includes("flatseam") || q.includes("cross-train") || q.includes("cross train") || q.includes("retraining")) {
    const overlockOps = ops.filter(o => (o.overlock && o.overlock >= 60) || o.grade === 'A' || o.grade === 'S');
    let candidateList = "";
    if (overlockOps.length > 0) {
      if (isEn) {
        candidateList = `\n\n**Top Recommended Operator Candidates from ${line}:**\n` +
          overlockOps.slice(0, 4).map((o, idx) => 
            `${idx + 1}. **${o.name}** (NIK: ${o.nik}) — Grade: ${o.grade || 'A'} | Overlock: ${o.overlock || 0}% | Points: ${o.points || 0}`
          ).join("\n") + "\n";
      } else {
        candidateList = `\n\n**Rekomendasi Kandidat Operator Terbaik dari ${line}:**\n` +
          overlockOps.slice(0, 4).map((o, idx) => 
            `${idx + 1}. **${o.name}** (NIK: ${o.nik}) — Grade: ${o.grade || 'A'} | Overlock: ${o.overlock || 0}% | Poin: ${o.points || 0}`
          ).join("\n") + "\n";
      }
    }

    if (isEn) {
      return `### IE Consultation: Operator Cross-Training to Flatseam Machine
Location Evaluated: **${factory} • ${line}**

The **Flatseam (Feed-off-the-Arm 4-Needle 6-Thread)** machine possesses the highest technical complexity in garment production (*sportswear & knitwear*) because it requires synchronized differential knife trimming, precise tension control across 6 thread cones, and handling of fabric elasticity.
${candidateList}
**IE Operator Selection Criteria for Flatseam Readiness:**
1. **Priority 1 — Overlock Operators (Grade A/B+)**: Already possess muscle memory in knife-edge fabric trimming and differential feed control on stretch fabrics.
2. **Priority 2 — Coverstitch / Kam Operators**: Familiar with multi-needle threading and looper timing, cutting training time by 40%.
3. **Performance Prerequisite**: Efficiency $\\ge 80\\%$, DHU defect rate $< 1.5\\%$, and attendance discipline $> 95\\%$.

**5-Day Rapid Training Roadmap:**
- **Day 1**: Machine anatomy, 6-thread path threading, needle and trimmer replacement.
- **Day 2**: Straight and curved seam sewing on scrap fabric (Target: zero fabric puckering).
- **Day 3**: Handling cross-seam intersections and multi-layer bulk (T-joints).
- **Day 4**: Real component run targeting 70% SMV.
- **Day 5**: Full line integration with a target of 85% SMV.`;
    }

    return `### Konsultasi IE: Pemilihan Operator Cross-Training ke Mesin Flatseam
Lokasi Evaluasi: **${factory} • ${line}**

Mesin **Flatseam (Feed-off-the-Arm 4-Needle 6-Thread)** memiliki tingkat kompleksitas tertinggi di lini garmen (*sportswear / knitwear*) karena memerlukan sinkronisasi pisau potong (*knife trimmer*), tensi 6 benang, dan kontrol elastisitas bahan.
${candidateList}
**Kriteria Seleksi Operator Siap Flatseam (Standar IE):**
1. **Prioritas 1 — Operator Overlock (Grade A/B+)**: Sudah memiliki *muscle memory* dalam kontrol pisau pemotong dan *differential feed* kain melar (*stretch*).
2. **Prioritas 2 — Operator Coverstitch/Kam**: Sudah terbiasa dengan multi-needle dan *looper threading*, memangkas adaptasi *threading*.
3. **Syarat Kinerja**: Efisiensi $\\ge 80\\%$, tingkat defect (DHU) $< 1.5\\%$, serta kedisiplinan kehadiran $> 95\\%$.

**Roadmap Training Cepat 5 Hari:**
- **Hari 1**: Anatomi mesin, jalur 6 benang, penggantian jarum & pisau.
- **Hari 2**: Jahit lurus & melengkung di bahan *scrap/perca* (target tidak ada *fabric puckering*).
- **Hari 3**: Melewati jahitan silang (*cross-seam / T-joint*).
- **Hari 4**: Produksi komponen riil dengan target 70% SMV.
- **Hari 5**: Integrasi penuh ke line dengan target 85% SMV.`;
  }

  if (q.includes("bottleneck") || q.includes("hambatan") || q.includes("penumpukan")) {
    if (isEn) {
      return `### Garment IE Bottleneck Analysis & Mitigation — ${factory} • ${line}

**4 Tactical Steps for Sewing Line Bottleneck Resolution:**
1. **Motion Study & Workplace Ergonomic Layout (Motion Economy)**:
   - Ensure the fabric bundle sits inside the *Primary Working Zone* (radius < 35 cm from the needle).
   - Install auto-slide discharge troughs so operators do not waste cycle seconds manually putting aside finished pieces.
2. **Sub-Motion Splitting**:
   - If a workstation cycle time exceeds Pitch Time, split sub-motions (e.g., notch marking, label fusing, or preparatory basting handled by an off-line helper).
3. **Deploy Multi-Skilled Floater**:
   - Assign Grade S/A operators as active floaters to assist bottleneck stations whenever WIP exceeds 5 bundles.
4. **Pitch Time Control**: Keep maximum workstation cycle time strictly $\\le 105\\%$ of the target line pitch time.`;
    }

    return `### Analisis & Mitigasi Bottleneck IE — ${factory} • ${line}

**4 Langkah Taktis Penanganan Bottleneck di Line Jahit Garmen:**
1. **Motion Study & Workplace Layout (Kaizen Gerakan)**:
   - Pastikan bundle kain diletakkan di *Primary Working Zone* (radius < 35 cm dari jarum).
   - Pasang *slide board* atau *trough* pembuangan otomatis agar operator tidak membuang waktu meletakkan baju selesai.
2. **Sub-Motion Splitting**:
   - Jika proses melebihi Pitch Time, pisahkan sub-gerak (misal: *marking* atau penempelan *interlining/label* dikerjakan oleh helper/stasiun persiapan).
3. **Deploy Multi-Skilled Floater**:
   - Tugaskan operator Grade S/A sebagai *floater* untuk membantu proses stasiun bottleneck saat WIP (*Work-in-Process*) menumpuk > 5 bundle.
4. **Target Pitch Time**: Pertahankan *Cycle Time* stasiun maksimum tidak lebih dari $105\\%$ dari Pitch Time line.`;
  }

  if (q.includes("efficiency") || q.includes("efisiensi") || q.includes("naikkan") || q.includes("meningkatkan") || q.includes("increase")) {
    if (isEn) {
      return `### IE Production Strategy: Increasing Sewing Line Efficiency to > 80%
Target Line: **${factory} • ${line}**

**1. Core Apparel IE Formula:**
$$\\text{Line Efficiency (\\%)} = \\frac{\\text{Total Output (pcs)} \\times \\text{Total SMV/SAM (minutes)}}{\\text{Total Sewing Manpower} \\times \\text{Available Working Minutes}} \\times 100\\%$$

**2. 3-Week Action Plan:**
- **Week 1 (Eliminate Micro-Stops)**: Eliminate thread breakages (check needle size vs thread tex), and prepare pre-wound bobbins at every single-needle workstation.
- **Week 2 (Yamazumi Line Balancing)**: Reduce *Balance Delay* from 25% down to < 12% by redistributing sewing elements across adjacent stations.
- **Week 3 (Hourly Production Pacing)**: Implement visible *Hourly Production Boards* at the line end to keep operators focused on pacing and prevent end-of-shift dropoffs.`;
    }

    return `### Strategi IE: Menaikkan Line Efficiency dari 68% Menjadi > 80%
Target Lini: **${factory} • ${line}**

**1. Rumus Dasar IE Garment:**
$$\\text{Line Efficiency (\\%)} = \\frac{\\text{Total Output (pcs)} \\times \\text{Total SMV/SAM (menit)}}{\\text{Jumlah Manpower} \\times \\text{Jam Kerja (menit)}} \\times 100\\%$$

**2. Langkah Aksi 3 Minggu:**
- **Minggu 1 (Eliminasi Micro-Stops)**: Atasi *thread breakage* (periksa nomor jarum vs ketebalan benang) dan siapkan *bobbin* cadangan di setiap meja Single Needle.
- **Minggu 2 (Yamazumi Re-balancing)**: Turunkan *Balance Delay* dari 25% ke < 12% dengan menyeimbangkan beban kerja antar stasiun kerja.
- **Minggu 3 (Hourly Target Management)**: Pasang papan *Hourly Production Board* di ujung line dengan target per jam yang jelas agar operator termotivasi menjaga *pace*.`;
  }

  if (q.includes("pitch time") || q.includes("balance delay") || q.includes("rumus") || q.includes("formula") || q.includes("sam") || q.includes("smv")) {
    if (isEn) {
      return `### Garment Industrial Engineering Standard Formulas (GSD & MOST)

1. **Pitch Time (Ideal Station Cycle Time)**:
   $$\\text{Pitch Time (seconds)} = \\frac{\\text{Total Style SMV (seconds)}}{\\text{Number of Sewing Operators}}$$

2. **Takt Time (Pace Required by Customer Demand)**:
   $$\\text{Takt Time (seconds)} = \\frac{\\text{Net Available Operating Time (seconds)}}{\\text{Target Output Requirement (pcs)}}$$

3. **Balance Delay (%)**:
   $$\\text{Balance Delay} = \\left(1 - \\frac{\\text{Total SMV}}{\\text{Total Workstations} \\times \\text{Bottleneck Cycle Time}}\\right) \\times 100\\%$$

4. **Smoothness Index (SI)**:
   $$SI = \\sqrt{\\sum (\\text{Maximum Cycle Time} - \\text{Cycle Time Station } i)^2}$$
   *Rule: Closer to 0 indicates perfect line balance.*`;
    }

    return `### Standar Rumus IE Garment (GSD & MOST)

1. **Pitch Time (Waktu Siklus Ideal)**:
   $$\\text{Pitch Time (detik)} = \\frac{\\text{Total SMV Style (detik)}}{\\text{Jumlah Operator Sewing}}$$

2. **Takt Time (Kecepatan Permintaan Buyer)**:
   $$\\text{Takt Time (detik)} = \\frac{\\text{Waktu Kerja Bersih Tersedia (detik)}}{\\text{Target Permintaan Output (pcs)}}$$

3. **Balance Delay (%)**:
   $$\\text{Balance Delay} = \\left(1 - \\frac{\\text{Total SMV}}{\\text{Jumlah Stasiun} \\times \\text{Cycle Time Tertinggi}}\\right) \\times 100\\%$$

4. **Smoothness Index (SI)**:
   $$SI = \\sqrt{\\sum (\\text{Cycle Time Maksimum} - \\text{Cycle Time Stasiun } i)^2}$$
   *Indikator: Semakin mendekati 0, lini semakin seimbang sempurna.*`;
  }

  if (isEn) {
    return `### Industrial Engineering Technical Consultation — PT. Winners International
Evaluation Context: **${factory} • ${line}**

Regarding your query: *"${query}"*

1. **Core Apparel IE Principles**: Ensure all Standard Allowed Minutes (SAM/SMV) have undergone proper standard allowance validation (Personal 5%, Fatigue 4%, Machine/Unavoidable Delay 2%).
2. **Workplace Motion Study**: Eliminate non-value added motion such as excessive fabric twisting or reaching outside the 40 cm ergonomic zone.
3. **Line Balancing Stability**: Maintain Bottleneck Ratio = (Max Cycle Time / Pitch Time) $\\times 100\\% \\le 105\\%$.

*Would you like a specific calculation for a particular garment style, sewing machine type, or operator skill matrix?*`;
  }

  return `### Konsultasi Industrial Engineering PT. Winners International
Lokasi: **${factory} • ${line}**

Untuk pertanyaan Anda: *"${query}"*

1. **Prinsip Utama IE Garmen**: Pastikan standard time (SAM/SMV) telah divalidasi dengan allowance standar (Personal 5%, Fatigue 4%, Delay 2%).
2. **Studi Gerakan (Method Study)**: Eliminasi gerakan non-value added seperti memutar kain berlebih atau penjangkauan bundle melebihi zona ergonomis (radius 40 cm).
3. **Keseimbangan Lini**: Selalu pantau Bottleneck Ratio = (Cycle Time Maksimum / Pitch Time) × 100% agar tidak melebihi 105%.

*Ada analisis spesifik terkait operator, mesin jahit, atau style tertentu yang ingin kita hitung bersama?*`;
}

// AI Line Balancing Analysis & Optimization Endpoint
app.post("/api/gemini/line-balance", async (req, res) => {
  try {
    const { styleData, operators, currentBalancing } = req.body;

    const fallbackAnalysis = `### Analisis Line Balancing IE (Heuristic Rule Engine)
- **Efisiensi Line Aktual**: ${currentBalancing?.lineEfficiency || 68}%
- **Target Pitch Time**: ${currentBalancing?.pitchTime || 28} detik/pcs
- **Total SMV Garmen**: ${currentBalancing?.totalSmv || 650} detik
- **Temuan Bottleneck**: Terdeteksi ${currentBalancing?.aiRecommendations?.bottleneckAlerts?.length || 2} stasiun dengan cycle time tinggi.
- **Rekomendasi Tindakan**:
  1. Relayout meja bundle feeder untuk memangkas *motion waste* (handling kain).
  2. Bantuan Floater serbaguna di area perakitan kritis.
  3. Lakukan micro-motion study pada operator dengan cycle time tertinggi.`;

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        success: true,
        source: "fallback",
        analysis: fallbackAnalysis,
        recommendations: currentBalancing?.aiRecommendations || {}
      });
    }

    const prompt = `
Berikut adalah data line balancing untuk style: "${styleData?.styleName || 'Polo Shirt'}" (Target: ${styleData?.targetPcsPerHour || 100} pcs/jam, Pitch Time: ${currentBalancing?.pitchTime} detik, Total SMV: ${currentBalancing?.totalSmv} detik):

Data Stasiun Kerja & Alokasi Operator Saat Ini:
${JSON.stringify(currentBalancing?.assignments?.map((a: any) => ({
  pos: a.stationNumber,
  process: a.process.name,
  machine: a.process.machineType,
  smv: a.process.smvSeconds,
  operator: a.assignedOperator?.name || "None",
  rate: a.operatorEfficiency,
  cycleTime: a.actualCycleTime,
  isBottleneck: a.isBottleneck
})), null, 2)}

Tolong berikan:
1. Executive Summary IE mengenai performa line balance ini (apakah efisiensi sudah optimal, di mana titik hambatan terbesar).
2. Taktik Penanganan Bottleneck Spesifik (pisahkan sub-gerak, relayout penempatan bundle kain, atau bantuan helper).
3. Rekomendasi Penyesuaian Operator (siapa operator yang cocok ditukar atau dijadikan floater).
4. Kaizen Action Plan untuk supervisor line.

Format respon dengan Markdown yang rapi dan mudah dibaca oleh IE Manager dan Supervisor Jahit.
`;

    try {
      const generatedText = await generateGeminiWithFallback(prompt, IE_SYSTEM_INSTRUCTION, 0.7);
      return res.json({
        success: true,
        source: "gemini-ai",
        analysis: generatedText,
        recommendations: currentBalancing?.aiRecommendations || {}
      });
    } catch (genErr: any) {
      console.warn("Using fallback IE analysis due to Gemini API temporary unavailability:", genErr?.message);
      return res.json({
        success: true,
        source: "fallback-ie",
        analysis: fallbackAnalysis,
        recommendations: currentBalancing?.aiRecommendations || {}
      });
    }
  } catch (error: any) {
    console.error("Error in /api/gemini/line-balance:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Gagal memproses analisis AI Line Balancing",
      fallback: "Analisis sistem IE lokal tetap aktif."
    });
  }
});

// Interactive Industrial Engineer Garment Chat Endpoint
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, prompt, history, context, language } = req.body;
    const userMessage = (message || prompt || "").trim();
    const lang = language === 'en' ? 'en' : 'id';

    if (!userMessage) {
      return res.status(400).json({ error: lang === 'en' ? "Message cannot be empty" : "Pesan tidak boleh kosong" });
    }

    // Build enriched prompt with context if available
    let enrichedPrompt = userMessage;
    if (context) {
      const parts: string[] = [];
      if (context.selectedFactory || context.selectedLine) {
        parts.push(`Lokasi / Location: ${context.selectedFactory || 'Factory 1'} • ${context.selectedLine || 'Line 1'}`);
      }
      if (context.activeStyle) {
        parts.push(`Style Aktif / Active Style: ${context.activeStyle}`);
      }
      if (context.totalOperators) {
        parts.push(`Total Operator: ${context.totalOperators} people`);
      }
      if (Array.isArray(context.operators) && context.operators.length > 0) {
        parts.push(`Data Operator Terkait (${context.operators.length} ops):\n` + 
          JSON.stringify(context.operators.slice(0, 25).map((o: any) => ({
            nik: o.nik,
            name: o.name,
            grade: o.grade,
            points: o.points,
            skills: {
              lockstitch: o.lockstitch,
              overlock: o.overlock,
              flatseam: o.flatseam,
              special: o.special
            }
          })), null, 1));
      }
      if (parts.length > 0) {
        enrichedPrompt = `${userMessage}\n\n[Garment Manufacturing Context]:\n${parts.join("\n")}\n\nPlease respond in ${lang === 'en' ? 'English' : 'Bahasa Indonesia'}.`;
      }
    }

    if (!isRealGeminiKey()) {
      return res.json({
        reply: generateIEExpertFallback(userMessage, context, lang)
      });
    }

    try {
      const systemInstruction = lang === 'en'
        ? `${IE_SYSTEM_INSTRUCTION}\nAlways respond in fluent, professional English with apparel industrial engineering precision.`
        : IE_SYSTEM_INSTRUCTION;
      const reply = await generateGeminiWithFallback(enrichedPrompt, systemInstruction, 0.7);
      return res.json({ reply });
    } catch (chatErr: any) {
      console.warn("Gemini chat fallback triggered:", chatErr?.message);
      return res.json({
        reply: generateIEExpertFallback(userMessage, context, lang)
      });
    }
  } catch (error: any) {
    console.error("Error in /api/gemini/chat:", error);
    const lang = req.body?.language === 'en' ? 'en' : 'id';
    return res.json({
      reply: generateIEExpertFallback(req.body?.message || "", req.body?.context, lang)
    });
  }
});

// Retraining Roadmap Generator
app.post("/api/gemini/retraining-plan", async (req, res) => {
  try {
    const { operator, targetMachine } = req.body;

    if (!operator) {
      return res.status(400).json({ error: "Data operator diperlukan" });
    }

    const target = targetMachine || "Overlock / Flatseam";
    const opName = operator.name || "Operator";
    const opNik = operator.nik || "-";
    const workMonths = operator.workTimeMonths ?? 12;

    const fallbackPlan = `### Roadmap Pelatihan Multi-Skill 4 Minggu: ${opName} (NIK: ${opNik})
**Target Kompetensi:** Penguasaan Mesin **${target}** (Target Kelulusan: Grade B / Efisiensi ≥ 80%)

---

#### 📅 Minggu 1: Dasar Mesin & Kontrol Presisi (Skill Level 1)
- **Fokus:** Pengenalan anatomi mesin ${target}, threading (jalur benang), penyesuaian tegangan (tension control), dan penggantian jarum.
- **Latihan Mandiri:** Menjahit lurus dan melengkung pada kain perca (scrap fabric) 150 pcs/hari.
- **Target KPI:** Memahami *troubleshooting* dasar (benang putus/loncat), efisiensi awal 45%.

#### 📅 Minggu 2: Latihan Operasi Komponen Semi-Kritis (Skill Level 2)
- **Fokus:** Menjahit bagian sub-assembly (misal: jahit bis, sambung pundak, pasang rib leher/manset).
- **Aspek Ergonomi & K3:** Posisi duduk tegak 90°, penggunaan pelindung jari (*finger guard*), dan penataan *bundle feeder* ergonomis.
- **Target KPI:** Efisiensi mencapai 60% tanpa defect loncat jahitan atau *fabric puckering*.

#### 📅 Minggu 3: Integrasi ke Line Produksi Nyata (Skill Level 3)
- **Fokus:** Masuk ke line jahit dengan pendampingan instruktur / tandem sewing bersama operator Grade S.
- **Latihan:** Mengikuti alur *piece-rate* dan menjaga *cycle time* stabil mendekati Pitch Time line.
- **Target KPI:** Efisiensi mencapai 70-75%, defect rate < 1.5%.

#### 📅 Minggu 4: Uji Kompetensi Mandiri & Sertifikasi Skill Matrix (Grade B)
- **Fokus:** Evaluasi mandiri kecepatan dan kualitas 1 hari kerja penuh (8 jam).
- **Verifikasi QC:** Pemeriksaan SPI (Stitch Per Inch), kelurusan jahitan, dan kekuatan tarikan benang.
- **Target Kelulusan:** Lolos uji Skill Matrix dengan skor efisiensi rata-rata ≥ 80% (Grade B).`;

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ plan: fallbackPlan });
    }

    const prompt = `
Buat program pelatihan (Retraining / Multi-Skilling Roadmap) intensif 4 minggu untuk operator garmen berikut:
- Nama: ${opName}
- NIK: ${opNik}
- Masa Kerja: ${workMonths} bulan
- Mesin Target Pengembangan: ${target}
- Skill saat ini: Lockstitch: ${operator.lockstitch ?? '-'}%, Overlock: ${operator.overlock ?? '-'}%, Flatseam: ${operator.flatseam ?? '-'}%, Special: ${operator.special ?? '-'}%

Berikan kurikulum mingguan (Week 1-4), KPI target efisiensi, aspek K3 & ergonomi, serta standar verifikasi Quality Control (tidak ada loncat jahitan, pucker, atau seam slippage).
`;

    try {
      const generatedPlan = await generateGeminiWithFallback(prompt, IE_SYSTEM_INSTRUCTION, 0.6);
      return res.json({ plan: generatedPlan });
    } catch (planErr: any) {
      console.warn("Using fallback retraining plan due to Gemini API temporary unavailability:", planErr?.message);
      return res.json({ plan: fallbackPlan });
    }
  } catch (error: any) {
    console.error("Error in /api/gemini/retraining-plan:", error);
    res.status(500).json({ error: error.message || "Gagal membuat rencana retraining" });
  }
});

// Vite & Static file setup
async function startServer() {
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof __filename !== "undefined" && (__filename.endsWith(".cjs") || __filename.includes("dist"))) ||
    (typeof process.argv[1] === "string" && !process.argv[1].endsWith(".ts") && !process.argv[1].includes("tsx"));

  if (isProduction) {
    const candidatePaths = [
      typeof __dirname !== "undefined" ? __dirname : null,
      path.resolve(process.cwd(), "dist"),
      typeof __dirname !== "undefined" ? path.resolve(__dirname, "dist") : null,
      process.cwd(),
    ].filter(Boolean) as string[];

    const distPath = candidatePaths.find((p) => fs.existsSync(path.join(p, "index.html"))) || path.resolve(process.cwd(), "dist");

    console.log(`[Production] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send("PT. Winners International - Multi Skill System");
      }
    });
  } else {
    console.log(`[Development] Initializing Vite middleware...`);
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (Mode: ${isProduction ? "Production" : "Development"})`);
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});

