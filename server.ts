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
    ];

    for (const gasUrl of gasUrls) {
      try {
        const gasRes = await fetch(`${gasUrl}?action=lookupDateOfJoin&nik=${encodeURIComponent(requestedNik)}`, {
          headers: { "Accept": "application/json" }
        });
        if (gasRes.ok) {
          const rawText = await gasRes.text();
          if (rawText && !rawText.trim().startsWith("<")) {
            try {
              const gasData: any = JSON.parse(rawText);
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
            } catch (jsonErr) {
              console.warn("GAS JSON parse error:", jsonErr);
            }
          }
        }
      } catch (gasErr: any) {
        console.warn("GAS fetch warning (skipping to next fallback):", gasErr?.message || gasErr);
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
    
    // Format Factory: hanya angka (e.g. "Factory 1" -> "1", "1" -> "1")
    const rawFac = String(operator.factory || "1").trim();
    const facMatch = rawFac.match(/\d+/);
    const factory = facMatch ? facMatch[0] : (rawFac.replace(/factory\s*/i, "").trim() || "1");

    // Format Line: hanya nomor line (e.g. "Line 28" -> "28", "Line 1" -> "1", "28" -> "28")
    const rawLine = String(operator.line || "1").trim();
    const lineMatch = rawLine.match(/\d+/);
    const line = lineMatch ? lineMatch[0] : (rawLine.replace(/line\s*/i, "").trim() || "1");

    const status = (operator.status || "ACTIVE").toUpperCase();
    const workMonth = typeof operator.workTimeMonths === "number" 
      ? operator.workTimeMonths 
      : (typeof operator.workMonth === "number" ? operator.workMonth : calculateWorkTimeMonths(doj));

    const today = new Date();
    const formattedTodayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const dateStr = operator.date || operator.recordDate || formattedTodayYmd;

    // Mesin & Proses spesifik garmen
    const machineName = String(operator.machineName || operator.machine || "1Needle Lockstitch Auto Trim").trim();
    const machineCategory = String(operator.machineCategory || operator.category || "LOCKSTITCH").toUpperCase();
    const styleNo = String(operator.styleNo || operator.style || "NB17HQ271140").trim();
    const tableCode = String(operator.tableCode || operator.table || operator.styleCode || "1").trim();
    const process = String(operator.process || "SEWING").trim();

    // Nilai POIN (Mendukung 0, 1, 2, 3 - jika user mengetik 0, harus tetap 0)
    let rawPoints: number;
    if (typeof operator.points === "number") {
      rawPoints = operator.points;
    } else if (operator.points !== undefined && operator.points !== null && String(operator.points).trim() !== "") {
      rawPoints = parseInt(String(operator.points), 10);
    } else if (operator.lockstitch !== undefined && operator.lockstitch !== null) {
      rawPoints = Number(operator.lockstitch);
    } else {
      rawPoints = 0;
    }
    const pointVal = isNaN(rawPoints) ? 0 : Math.min(3, Math.max(0, Math.round(rawPoints)));

    // Production rate: jika poin 0 maka rate 0%, jika poin > 0 berikan nilai rate yang realistis
    const prodRate = pointVal === 0 ? 0 : Number(operator.productionRate || (pointVal === 1 ? 60 : pointVal === 2 ? 80 : 92.44));
    const targetMeta = pointVal === 0 ? 0 : Number(operator.meta || operator.target || 844);
    const actualProd = pointVal === 0 ? 0 : Number(operator.production || operator.actual || Math.round(targetMeta * (prodRate / 100)));

    // Susun baris 18 kolom sesuai datasheet asli 'by_worker'
    const rowsToAppend = [
      [
        factory,                    // Kolom A: Factory ("1")
        line,                       // Kolom B: Line ("28" atau "1")
        tableCode,                  // Kolom C: Table / Style Code ("19" atau "1")
        dateStr,                    // Kolom D: Date ("2026-09-08" atau YYYY-MM-DD)
        nik,                        // Kolom E: Worker Code ("25092882")
        name,                       // Kolom F: Worker ("M. FAUZIL ADZIM")
        doj,                        // Kolom G: Date of Join ("11-09-2025")
        machineName,                // Kolom H: Machine ("2Needle Flat Seam Auto Trim")
        styleNo,                    // Kolom I: Style No ("NB17HQ271140")
        process,                    // Kolom J: Process ("BIND 3PLIES ARMHOLE")
        targetMeta,                 // Kolom K: SMV / Target Meta (844 atau 0)
        actualProd,                 // Kolom L: Actual Production (781 atau 0)
        prodRate,                   // Kolom M: Production Rate (%) (92.44 atau 0)
        pointVal,                   // Kolom N: POINT (0, 1, 2, atau 3 - KETIKA KETIK 0 TETAP 0)
        workMonth,                  // Kolom O: Work Month (11 atau 57)
        "",                         // Kolom P: Date of Resign
        machineCategory,            // Kolom Q: Machine Category ("FLATSEAM (COVERS" atau "LOCKSTITCH")
        status,                     // Kolom R: Status ("ACTIVE")
      ]
    ];

    // Kirim data ke Google Apps Script Web App untuk ditanamkan ke sheet 'by_worker'
    const gasUrls = [
      "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec",
    ];

    let gasSuccess = false;
    let gasMessage = "";

    const appendQueryParams = new URLSearchParams({
      action: "appendByWorker",
      factory: String(factory),
      line: String(line),
      tableCode: String(tableCode),
      date: String(dateStr),
      nik: String(nik),
      name: String(name),
      doj: String(doj || "-"),
      machineName: String(machineName),
      styleNo: String(styleNo),
      process: String(process),
      meta: String(targetMeta),
      production: String(actualProd),
      productionRate: String(prodRate),
      points: String(pointVal),
      workMonth: String(workMonth),
      machineCategory: String(machineCategory),
      status: String(status || "ACTIVE"),
    });

    for (const gasUrl of gasUrls) {
      try {
        const gasRes = await fetch(`${gasUrl}?${appendQueryParams.toString()}`, {
          method: "GET",
        });

        if (gasRes.ok) {
          const rawText = await gasRes.text();
          if (rawText && !rawText.trim().startsWith("<")) {
            try {
              const gasJson: any = JSON.parse(rawText);
              if (gasJson.status === "success") {
                gasSuccess = true;
                gasMessage = gasJson.message || "Berhasil ditanamkan ke sheet by_worker";
                break;
              }
            } catch (jsonErr) {
              console.warn("GAS JSON parse error in append:", jsonErr);
            }
          }
        }
      } catch (err: any) {
        console.warn("GAS append error:", err?.message || err);
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

  // Port 3000 wajib selalu aktif untuk dev server dan reverse proxy container
  const mainServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (Mode: ${isProduction ? "Production" : "Development"})`);
  });

  mainServer.on("error", (err: any) => {
    console.error(`Error on port ${PORT}:`, err.message);
  });

  // Untuk live Cloud Run di mana Cloud Run menentukan PORT via environment variable (misal 8080)
  // Dengarkan juga port tersebut agar container health check probe Cloud Run langsung sukses
  if (isProduction && process.env.PORT) {
    const cloudRunPort = parseInt(process.env.PORT, 10);
    if (!isNaN(cloudRunPort) && cloudRunPort !== PORT) {
      try {
        const altServer = app.listen(cloudRunPort, "0.0.0.0", () => {
          console.log(`Cloud Run container port listening on http://0.0.0.0:${cloudRunPort}`);
        });
        altServer.on("error", (err: any) => {
          console.warn(`Additional port ${cloudRunPort} bind notice: ${err.message}`);
        });
      } catch (err: any) {
        console.warn(`Could not listen on secondary port ${cloudRunPort}:`, err.message);
      }
    }
  }
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});

