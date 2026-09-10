/**
 * GOOGLE APPS SCRIPT WEB APP - PT. WINNERS INTERNATIONAL IE SYSTEM
 * Sheet Name Target: "by_worker" & "date_of_join"
 *
 * Petunjuk Instalasi:
 * 1. Buka Google Spreadsheet (ID: 1tA8YyHxFr1xwGWvdwHLOXaF9q8SjgbDuxDinzuH6kag)
 * 2. Klik Extensions > Apps Script
 * 3. Hapus kode lama dan tempel (paste) seluruh skrip ini
 * 4. Klik Deploy > New Deployment
 * 5. Pilih Type: "Web App"
 * 6. Description: "IE Skill Matrix By Worker Sync"
 * 7. Execute as: "Me" (email pemilik sheet)
 * 8. Who has access: "Anyone" (Siapa saja, penting agar Vercel & client bisa akses)
 * 9. Klik Deploy dan salin URL Web App yang berakhiran "/exec"
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("by_worker");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sheet 'by_worker' tidak ditemukan"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const data = sheet.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      count: data.length - 1,
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const contents = e.postData ? e.postData.contents : "{}";
    const payload = JSON.parse(contents);
    const action = payload.action;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("by_worker");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sheet 'by_worker' tidak ditemukan"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "appendByWorker") {
      const op = payload.operator || {};
      const lastRow = sheet.getLastRow();
      const nextRow = lastRow + 1;

      // Nilai Kolom
      const factory = op.factory || "1";
      const line = op.line || "1";
      const tableCode = op.tableCode || op.table || "1";
      const dateStr = op.date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
      const nik = String(op.nik || "").trim();
      const name = String(op.name || "").trim().toUpperCase();
      const machineName = op.machineName || op.machine || "1Needle Lockstitch Auto Trim";
      const styleNo = op.styleNo || op.style || "NB17HQ271140";
      const process = String(op.process || "MANUAL").trim().toUpperCase();
      const meta = Number(op.meta || 0);
      const production = Number(op.production || 0);
      const prodRate = Number(op.productionRate || 0);
      const points = Number(op.points !== undefined ? op.points : 0);

      // Rumus Penanaman Google Sheets Otomatis:
      // Kolom G (Date of Join): XLOOKUP ke date_of_join
      const formulaG = `=IFERROR(XLOOKUP(E${nextRow},date_of_join!$A$2:$A$19392,date_of_join!$C$2:$C$19392), "${op.doj || '-'}")`;
      
      // Kolom N (POIN): Jika Helper / 0%, maka 0. Jika >0 gunakan rumus IFS
      const formulaN = points === 0 && prodRate === 0 
        ? 0 
        : `=IFS(M${nextRow}<=0,0,M${nextRow}<=60.99,1,AND(M${nextRow}>=61,M${nextRow}<=89.99),2,M${nextRow}>=90,3)`;

      // Kolom O (Work Month): DATEDIF dari DOJ ke Date
      const formulaO = `=IFERROR(DATEDIF(G${nextRow}, D${nextRow}, "M"), ${op.workMonth || 1})`;

      // Kolom P (Date of Resign): XLOOKUP ke date_of_join kolom D
      const formulaP = `=IFERROR(XLOOKUP(E${nextRow},date_of_join!$A$2:$A$9996,date_of_join!$D$2:$D$9996), "")`;

      // Kolom Q (Machine Category): INDEX MATCH ke tabel referensi mesin
      const formulaQ = `=IFERROR(INDEX($Y$2:$Y$74,MATCH(H${nextRow},$Z$2:$Z$74,0)), "${op.machineCategory || 'LOCKSTITCH'}")`;

      // Susun 18 Kolom Sesuai Format Asli by_worker
      const newRow = [
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
        "ACTIVE"          // R: Status (ACTIVE)
      ];

      // Tanamkan baris baru
      sheet.appendRow(newRow);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: `Operator ${name} (${nik}) berhasil ditanamkan ke baris ${nextRow} datasheet by_worker`,
        rowNumber: nextRow,
        insertedRow: newRow
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: `Aksi '${action}' tidak dikenali`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
