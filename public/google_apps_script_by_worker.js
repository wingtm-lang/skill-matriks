/**
 * =========================================================================
 * GOOGLE APPS SCRIPT WEB APP - PT. WINNERS INTERNATIONAL IE SYSTEM (v3.0)
 * Target Spreadsheet: 1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag
 * Target Sheet: "by_worker", "date_of_join"
 * =========================================================================
 * 
 * TUTORIAL DEPLOY / UPDATE (WAJIB DIIKUTI DENGAN TELITI):
 * 1. Buka Google Spreadsheet data IE Anda
 * 2. Klik menu: Extensions (Ekstensi) > Apps Script
 * 3. Hapus SEMUA kode lama yang ada di file Code.gs, lalu TEMPEL (PASTE) seluruh kode di bawah ini.
 * 4. Klik ikon Disket (Save / Simpan).
 * 5. PENTING (Agar perubahan aktif):
 *    - Klik tombol biru "Deploy" (Terapkan) di pojok kanan atas
 *    - Pilih "Manage deployments" (Kelola penerapan)
 *    - Klik ikon PENSIL (Edit) di samping deployment yang aktif
 *    - Di dropdown "Version", WAJIB pilih: "New version" (Versi baru)
 *    - Pastikan "Execute as": "Me" (email Anda)
 *    - Pastikan "Who has access": "Anyone" (Siapa saja, bahkan tanpa akun Google)
 *    - Klik tombol "Deploy"
 * 6. Salin Web App URL yang berakhiran "/exec"
 * =========================================================================
 */

// ID Spreadsheet Utama
var SPREADSHEET_ID = "1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag";

/**
 * Helper untuk mendapatkan objek Spreadsheet secara aman,
 * baik skrip dipasang langsung (bound) maupun standalone (script.google.com)
 */
function getTargetSpreadsheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Helper mencari Sheet dengan toleransi huruf besar/kecil dan spasi
 */
function getSheetCaseInsensitive(ss, targetName) {
  var cleanTarget = targetName.toLowerCase().replace(/[\s_-]/g, "");
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().toLowerCase().replace(/[\s_-]/g, "");
    if (name === cleanTarget) {
      return sheets[i];
    }
  }
  return ss.getSheetByName(targetName);
}

/**
 * Helper Response JSON dengan header CORS lengkap
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handler GET - Berfungsi untuk membaca data DAN sebagai fallback jika POST di Vercel terhambat CORS
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || "read";

    // 1. Aksi Penanaman via GET (Tahan Banting 100% untuk Vercel)
    if (action === "appendByWorker") {
      var opData = {};
      if (params.data) {
        try {
          opData = JSON.parse(params.data);
        } catch (err) {
          opData = params;
        }
      } else if (params.operator) {
        try {
          opData = JSON.parse(params.operator);
        } catch (err) {
          opData = params;
        }
      } else {
        opData = params;
      }

      return handleAppendByWorker(opData);
    }

    // 2. Aksi Lookup Date of Join (DOJ) via GET
    if (action === "lookupDateOfJoin") {
      var targetNik = params.nik || params.workerCode || "";
      return handleLookupDateOfJoin(targetNik);
    }

    // 3. Aksi Set Resigned via GET
    if (action === "setResigned") {
      return handleSetResigned(params);
    }

    // 4. Aksi Test / Ping Koneksi
    if (action === "ping") {
      return createJsonResponse({
        status: "success",
        message: "Google Apps Script IE System Aktif & Siap Menerima Data!",
        timestamp: new Date().toISOString()
      });
    }

    // 5. Default: Baca Data dari sheet 'by_worker'
    var ss = getTargetSpreadsheet();
    var sheet = getSheetCaseInsensitive(ss, "by_worker");
    if (!sheet) {
      return createJsonResponse({
        status: "error",
        message: "Sheet 'by_worker' tidak ditemukan dalam spreadsheet"
      });
    }

    var values = sheet.getDataRange().getValues();
    return createJsonResponse({
      status: "success",
      count: Math.max(0, values.length - 1),
      data: values
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Error di doGet: " + err.toString()
    });
  }
}

/**
 * Handler POST - Menerima payload JSON dari Vercel / Express Backend
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action || (payload.operator ? "appendByWorker" : "unknown");

    if (action === "appendByWorker") {
      var op = payload.operator || payload;
      return handleAppendByWorker(op);
    }

    if (action === "lookupDateOfJoin") {
      var targetNik = payload.nik || payload.workerCode || (payload.operator && payload.operator.nik) || "";
      return handleLookupDateOfJoin(targetNik);
    }

    if (action === "setResigned") {
      return handleSetResigned(payload);
    }

    return createJsonResponse({
      status: "error",
      message: "Aksi '" + action + "' tidak dikenali"
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: "Error di doPost: " + err.toString()
    });
  }
}

/**
 * Fungsi Utama: Menanamkan 18 Kolom ke Sheet 'by_worker'
 */
function handleAppendByWorker(op) {
  var ss = getTargetSpreadsheet();
  var sheet = getSheetCaseInsensitive(ss, "by_worker");

  if (!sheet) {
    return createJsonResponse({
      status: "error",
      message: "Sheet 'by_worker' tidak ditemukan di Spreadsheet ID: " + SPREADSHEET_ID
    });
  }

  var lastRow = sheet.getLastRow();
  var nextRow = lastRow + 1;

  // Normalisasi Data Input
  var factory = String(op.factory || "1").replace(/factory\s*/i, "").trim() || "1";
  var line = String(op.line || "1").replace(/line\s*/i, "").trim() || "1";
  var tableCode = String(op.tableCode || op.table || op.styleCode || "1").trim();
  
  var dateStr = op.date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  var nik = String(op.nik || "").trim();
  var name = String(op.name || "").trim().toUpperCase();
  var doj = String(op.doj || "-").trim();
  
  var machineName = String(op.machineName || op.machine || "1Needle Lockstitch Auto Trim").trim();
  var styleNo = String(op.styleNo || op.style || "NB17HQ271140").trim();
  var process = String(op.process || "SEWING").trim().toUpperCase();
  
  var meta = Number(op.meta !== undefined ? op.meta : 0);
  var production = Number(op.production !== undefined ? op.production : 0);
  var prodRate = Number(op.productionRate !== undefined ? op.productionRate : 0);
  var points = Number(op.points !== undefined && op.points !== null ? op.points : 0);

  var workMonth = Number(op.workTimeMonths || op.workMonth || 1);
  var machineCategory = String(op.machineCategory || "LOCKSTITCH").trim().toUpperCase();
  var status = "ACTIVE";

  // RUMUS FORMULA GOOGLE SHEETS ASLI:
  // Kolom G (DOJ): XLOOKUP dari sheet date_of_join
  var formulaG = '=IFERROR(XLOOKUP(E' + nextRow + ',date_of_join!$A$2:$A$19392,date_of_join!$C$2:$C$19392), "' + doj + '")';
  
  // Kolom N (POIN): Jika Helper / 0%, maka nilai 0 murni. Jika >0 gunakan rumus IFS
  var formulaN = (points === 0 && prodRate === 0) 
    ? 0 
    : '=IFS(M' + nextRow + '<=0,0,M' + nextRow + '<=60.99,1,AND(M' + nextRow + '>=61,M' + nextRow + '<=89.99),2,M' + nextRow + '>=90,3)';

  // Kolom O (Work Month): DATEDIF dari DOJ (Kolom G) ke Tanggal (Kolom D)
  var formulaO = '=IFERROR(DATEDIF(G' + nextRow + ', D' + nextRow + ', "M"), ' + workMonth + ')';

  // Kolom P (Date of Resign): XLOOKUP dari sheet date_of_join Kolom D
  var formulaP = '=IFERROR(XLOOKUP(E' + nextRow + ',date_of_join!$A$2:$A$9996,date_of_join!$D$2:$D$9996), "")';

  // Kolom Q (Machine Category): INDEX MATCH ke daftar referensi mesin
  var formulaQ = '=IFERROR(INDEX($Y$2:$Y$74,MATCH(H' + nextRow + ',$Z$2:$Z$74,0)), "' + machineCategory + '")';

  // Susun 18 Kolom Sesuai Standar 'by_worker'
  var newRow = [
    factory,          // A: Factory
    line,             // B: Line
    tableCode,        // C: Table
    dateStr,          // D: Date
    nik,              // E: Worker Code
    name,             // F: Worker
    formulaG,         // G: Date of Join (Formula)
    machineName,      // H: Machine
    styleNo,          // I: Style No
    process,          // J: Process
    meta,             // K: Meta
    production,       // L: Production
    prodRate,         // M: Production Rate (%)
    formulaN,         // N: POIN (0 untuk Helper / Formula)
    formulaO,         // O: Work Month (Formula)
    formulaP,         // P: Date of Resign (Formula)
    formulaQ,         // Q: Machine Category (Formula)
    status            // R: Status (ACTIVE)
  ];

  // Tanamkan baris baru ke sheet
  sheet.appendRow(newRow);

  return createJsonResponse({
    status: "success",
    message: "Operator " + name + " (" + nik + ") berhasil ditanamkan ke baris " + nextRow + " sheet 'by_worker'!",
    rowNumber: nextRow,
    insertedData: {
      factory: factory,
      line: line,
      nik: nik,
      name: name,
      points: points
    }
  });
}

/**
 * Fungsi Pencarian Data NIK di sheet 'date_of_join'
 */
function handleLookupDateOfJoin(targetNik) {
  var ss = getTargetSpreadsheet();
  var sheet = getSheetCaseInsensitive(ss, "date_of_join");
  if (!sheet) {
    return createJsonResponse({
      status: "error",
      message: "Sheet 'date_of_join' tidak ditemukan"
    });
  }

  var cleanNik = String(targetNik || "").trim();
  if (!cleanNik) {
    return createJsonResponse({
      status: "error",
      message: "NIK wajib diisi"
    });
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowNik = String(data[i][0] || "").trim();
    if (rowNik === cleanNik) {
      return createJsonResponse({
        status: "success",
        found: true,
        data: {
          nik: rowNik,
          name: String(data[i][1] || "").trim().toUpperCase(),
          doj: String(data[i][2] || "").trim(),
          resignDate: String(data[i][3] || "").trim(),
          factory: String(data[i][4] || "").trim(),
          line: String(data[i][5] || "").trim(),
          status: data[i][3] ? "RESIGNED" : "ACTIVE"
        }
      });
    }
  }

  return createJsonResponse({
    status: "error",
    found: false,
    message: "NIK " + cleanNik + " tidak ditemukan di sheet date_of_join"
  });
}

/**
 * Fungsi Pengubahan Status Resigned di Sheet 'by_worker'
 */
function handleSetResigned(payload) {
  var ss = getTargetSpreadsheet();
  var sheet = getSheetCaseInsensitive(ss, "by_worker");

  if (!sheet) {
    return createJsonResponse({
      status: "error",
      message: "Sheet 'by_worker' tidak ditemukan"
    });
  }

  var targetNik = String(payload.nik || "").trim();
  if (!targetNik) {
    return createJsonResponse({
      status: "error",
      message: "NIK wajib disertakan untuk mengubah status resign"
    });
  }

  var data = sheet.getDataRange().getValues();
  var updatedCount = 0;
  var resignDateStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");

  for (var r = 1; r < data.length; r++) {
    var rowNik = String(data[r][4] || "").trim(); // Kolom E (indeks 4)
    if (rowNik === targetNik) {
      // Kolom P (indeks 16 di baris 1-indexed = Kolom 16)
      sheet.getRange(r + 1, 16).setValue(resignDateStr);
      // Kolom R (indeks 18 = Kolom 18)
      sheet.getRange(r + 1, 18).setValue("RESIGNED");
      updatedCount++;
    }
  }

  return createJsonResponse({
    status: "success",
    message: "Status operator " + targetNik + " diubah menjadi RESIGNED (" + updatedCount + " baris diperbarui)"
  });
}

/**
 * =========================================================================
 * FUNGSI UJI COBA LANGSUNG DI APPS SCRIPT (TEST RUNNER)
 * Anda bisa memilih fungsi 'testAppendWorker()' di menu dropdown atas 
 * lalu klik 'Run' (Jalankan) untuk menguji penanaman langsung tanpa lewat web!
 * =========================================================================
 */
function testAppendWorker() {
  var dummyOp = {
    factory: "1",
    line: "1",
    tableCode: "1",
    nik: "99999999",
    name: "OPERATOR TEST SYSTEM",
    doj: "01-01-2025",
    machineName: "1Needle Lockstitch Auto Trim",
    machineCategory: "LOCKSTITCH",
    styleNo: "TEST-STYLE-001",
    process: "SEWING",
    points: 0, // Helper test
    meta: 0,
    production: 0,
    productionRate: 0,
    status: "ACTIVE"
  };

  var res = handleAppendByWorker(dummyOp);
  Logger.log(res.getContent());
}
