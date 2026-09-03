import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

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
app.get("/api/health", (req, res) => {
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

    rows.forEach((row) => {
      // Normalisasi Kolom A (Factory) & Kolom B (Line)
      const rawFactory = (row[0] !== undefined && row[0] !== null) ? row[0].toString().trim() : "";
      const rawLine = (row[1] !== undefined && row[1] !== null) ? row[1].toString().trim() : "";
      const nik = (row[4] || "").toString().trim(); // Kolom E (Worker Code)
      const name = (row[5] || "").toString().trim(); // Kolom F (Worker)
      const doj = (row[6] || "").toString().trim(); // Kolom G (DOJ / Date of Join)
      
      // Deteksi Kolom Tanggal (misal '2026-09-01', '2026-08-28', '01/09/2026', '1-Sep-26')
      let rowDate = "";
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

      // Parse Kolom M / Indeks 12 (Production Rate %) dengan fallback ke Indeks 11
      const rawProdVal = (row[12] !== undefined && row[12] !== "") ? row[12] : (row[11] || "");
      const rawProdRate = rawProdVal.toString().replace('%', '').replace(',', '.').trim();
      const prodRate = parseFloat(rawProdRate) || 0;
      
      // Normalisasi Kolom Q / Indeks 16 (Machine Category) dengan fallback ke Indeks 15
      const rawCatVal = (row[16] && row[16].toString().trim()) || (row[15] && row[15].toString().trim()) || "";
      const machineCategory = rawCatVal.toString().trim().toUpperCase();

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

      const op = operatorMap.get(mapKey)!;

      // Update DOJ, Factory, Line, Status & Date jika ada record terbaru
      if (doj && op.doj === "-") op.doj = doj;
      if (formattedFactory) op.factory = formattedFactory;
      if (formattedLine) op.line = formattedLine;
      if (rawStatusVal) op.status = rawStatusVal;
      if (rowDate && !op.recordDate) op.recordDate = rowDate;
      if (name && !op.name) op.name = name;

      // Kelompokkan nilai efisiensi per Machine Category
      if (machineCategory.includes("LOCKSTITCH") || machineCategory === "SN" || machineCategory === "SINGLE NEEDLE") {
        op.lockstitchRates.push(prodRate);
      } else if (machineCategory.includes("OVERLOCK") || machineCategory === "OL" || machineCategory.includes("OBRAS")) {
        op.overlockRates.push(prodRate);
      } else if (machineCategory.includes("FLATSEAM") || machineCategory.includes("COVERSTITCH") || machineCategory === "FS") {
        op.flatseamRates.push(prodRate);
      } else if (machineCategory.includes("BUTTON_HOLE") || machineCategory.includes("BUTTON HOLE") || machineCategory.includes("LUBANG KANCING")) {
        op.buttonHoleRates.push(prodRate);
      } else if (machineCategory.includes("BUTTON_SET") || machineCategory.includes("BUTTON SET") || machineCategory.includes("PASANG KANCING")) {
        op.buttonSetRates.push(prodRate);
      } else if (machineCategory.includes("BARTACK") || machineCategory.includes("BAR TACK")) {
        op.bartackRates.push(prodRate);
      } else if (machineCategory.includes("CHAINSTITCH") || machineCategory.includes("CHAIN STITCH")) {
        op.chainstitchRates.push(prodRate);
      } else if (machineCategory.includes("SPECIAL") || machineCategory.includes("OTOMATIS")) {
        op.specialRates.push(prodRate);
      } else {
        // Default ke special / lockstitch jika tidak ada spesifik
        op.specialRates.push(prodRate);
      }
    });

    // Format hasil agregasi per Operator
    const formattedOperators = Array.from(operatorMap.values()).map((op, idx) => {
      const calcMax = (rates: number[]): number | null => {
        if (rates.length === 0) return null;
        const max = Math.max(...rates);
        return max > 0 ? Math.round(max * 10) / 10 : null;
      };

      const lockstitch = calcMax(op.lockstitchRates);
      const overlock = calcMax(op.overlockRates);
      const flatseam = calcMax(op.flatseamRates);
      const special = calcMax(op.specialRates);
      const buttonHole = calcMax(op.buttonHoleRates);
      const buttonSet = calcMax(op.buttonSetRates);
      const bartack = calcMax(op.bartackRates);
      const chainstitch = calcMax(op.chainstitchRates);

      // Hitung rata-rata rate untuk grade keseluruhan
      const activeRates = [lockstitch, overlock, flatseam, special, buttonHole, buttonSet, bartack, chainstitch]
        .filter((r): r is number => r !== null && r > 0);
      
      const avgRate = activeRates.length > 0 
        ? Math.round((activeRates.reduce((a, b) => a + b, 0) / activeRates.length) * 10) / 10 
        : 0;

      const overallGrade = getGradeFromEfficiency(avgRate);

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
        avgRate,
        overallGrade,
        notes: `Tersinkronisasi dari Google Sheets 'by_worker' (${activeRates.length} skill teruji)`
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

// Helper function for calling Gemini models with automatic fallback across models when high demand (503/429) occurs
async function generateGeminiWithFallback(
  prompt: string,
  systemInstruction: string = IE_SYSTEM_INSTRUCTION,
  temperature: number = 0.7
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = getGeminiClient();
  // Valid, modern models without deprecated gemini-2.5-flash
  const candidateModels = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of candidateModels) {
    // Try up to 2 attempts per model if 503 / high demand occurs
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature,
          },
        });

        if (response && response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const isTransient = err?.status === 503 || err?.code === 503 || String(err?.message || "").includes("high demand") || String(err?.message || "").includes("503");
        
        if (isTransient && attempt === 0) {
          // Wait 800ms before retrying same model once
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        // If not transient or second attempt failed, break to next model
        console.warn(`[Gemini API] Model ${model} unavailable (${err?.message || err}). Trying next model...`);
        break;
      }
    }
  }

  throw lastError || new Error("All Gemini models are temporarily unavailable");
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
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Pesan tidak boleh kosong" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({
        reply: `[Mode Offline IE Assistant]: Sebagai AI Industrial Engineer spesialis garmen PT. Winners International, saya siap membantu menjawab pertanyaan Anda seputar perhitungan SMV/SAM, Line Balancing, Yamazumi chart, Poka-yoke, dan matriks kompetensi operator.`
      });
    }

    try {
      const reply = await generateGeminiWithFallback(message, IE_SYSTEM_INSTRUCTION, 0.7);
      return res.json({ reply });
    } catch (chatErr: any) {
      console.warn("Gemini chat fallback triggered:", chatErr?.message);
      return res.json({
        reply: `**Konsultasi Industrial Engineering PT. Winners International**\n\nUntuk pertanyaan: *"${message}"*\n\n1. **Prinsip Utama IE Garmen**: Pastikan standard time (SAM/SMV) telah divalidasi dengan allowance standar (Personal 5%, Fatigue 4%, Delay 2%).\n2. **Studi Gerakan (Method Study)**: Eliminasi gerakan non-value added seperti memutar kain berlebih atau penjangkauan bundle melebihi zona ergonomis (radius 40 cm).\n3. **Keseimbangan Lini**: Selalu pantau Bottleneck Ratio = (Cycle Time Maksimum / Pitch Time) × 100% agar tidak melebihi 105%.\n\n*(Catatan: Server AI sedang dalam kondisi beban tinggi, respon disajikan melalui Heuristic Knowledge Base IE)*`
      });
    }
  } catch (error: any) {
    console.error("Error in /api/gemini/chat:", error);
    res.status(500).json({
      error: error.message || "Gagal menghubungi AI IE Specialist",
      reply: "Maaf, terjadi kendala saat memproses jawaban IE. Silakan coba kembali."
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

