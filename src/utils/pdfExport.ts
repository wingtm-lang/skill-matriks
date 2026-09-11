import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Operator } from '../types';
import { 
  getOperatorTotalPoints, 
  getGradeFromTotalPoints 
} from '../data/mockData';
import { 
  getOperatorMultiSkillCount, 
  MONTH_NAMES_ID,
  isOperatorResignedAtPeriod 
} from './ieCalculations';

export interface PDFExportOptions {
  operators: Operator[];
  selectedFactory: string;
  selectedLine: string;
  selectedMonth: number;
  selectedYear: number;
  includeResigned?: boolean;
  includeSummary?: boolean;
  includeSignatures?: boolean;
  language?: 'id' | 'en';
  orientation?: 'portrait' | 'landscape';
}

/**
 * Builds and returns the jsPDF document object for previewing or downloading.
 * Defaults to Portrait A4 orientation as requested for standard reporting.
 */
export function generateSkillMatrixPDF(options: PDFExportOptions): jsPDF {
  const {
    operators,
    selectedFactory,
    selectedLine,
    selectedMonth,
    selectedYear,
    includeResigned = true,
    includeSummary = true,
    includeSignatures = true,
    language = 'id',
    orientation = 'portrait'
  } = options;

  const isEn = language === 'en';
  const isPortrait = orientation === 'portrait';

  const monthName = isEn 
    ? new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' })
    : (MONTH_NAMES_ID[selectedMonth - 1]?.label || `Bulan ${selectedMonth}`);

  // Page Dimensions
  const pageWidth = isPortrait ? 210 : 297;
  const pageHeight = isPortrait ? 297 : 210;
  const margin = isPortrait ? 10 : 12;
  const contentWidth = pageWidth - (margin * 2);

  const doc = new jsPDF({
    orientation: isPortrait ? 'portrait' : 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Filter operators if requested
  const targetOperators = includeResigned 
    ? operators 
    : operators.filter(op => !isOperatorResignedAtPeriod(op, selectedMonth, selectedYear));

  // Compute key analytics
  let totalActive = 0;
  let totalResigned = 0;
  let multiSkillCount = 0;
  let totalPointsSum = 0;
  const gradeCounts = { S: 0, A: 0, B: 0, C: 0, HELPER: 0 };
  const machineCounts = {
    lockstitch: 0,
    overlock: 0,
    flatseam: 0,
    special: 0,
    buttonHole: 0,
    buttonSet: 0
  };

  targetOperators.forEach(op => {
    const isResigned = isOperatorResignedAtPeriod(op, selectedMonth, selectedYear);
    if (isResigned) {
      totalResigned++;
    } else {
      totalActive++;
      const pts = getOperatorTotalPoints(op);
      totalPointsSum += pts;
      const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
      const gradeObj = getGradeFromTotalPoints(pts, isHelper);
      const gradeLetter = gradeObj.letter as keyof typeof gradeCounts;
      if (gradeCounts[gradeLetter] !== undefined) {
        gradeCounts[gradeLetter]++;
      } else {
        gradeCounts.C++;
      }

      const ms = getOperatorMultiSkillCount(op);
      if (ms >= 2) multiSkillCount++;

      if (op.lockstitch && op.lockstitch > 0) machineCounts.lockstitch++;
      if (op.overlock && op.overlock > 0) machineCounts.overlock++;
      if (op.flatseam && op.flatseam > 0) machineCounts.flatseam++;
      if (op.special && op.special > 0) machineCounts.special++;
      if (op.buttonHole && op.buttonHole > 0) machineCounts.buttonHole++;
      if (op.buttonSet && op.buttonSet > 0) machineCounts.buttonSet++;
    }
  });

  const avgPoints = totalActive > 0 ? (totalPointsSum / totalActive).toFixed(1) : '0.0';
  const multiSkillPercent = totalActive > 0 ? Math.round((multiSkillCount / totalActive) * 100) : 0;
  const now = new Date();
  const currentMonthStr = isEn 
    ? now.toLocaleString('en-US', { month: 'long' }) 
    : (MONTH_NAMES_ID[now.getMonth()]?.label || `${now.getMonth() + 1}`);
  const printDateStr = `${now.getDate()} ${currentMonthStr} ${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;

  // --- BRAND & REPORT HEADER (NO RIBBON/PITA, STRICT IDENTITY) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isPortrait ? 13.5 : 15);
  doc.setTextColor(30, 41, 59);
  doc.text('PT. Winners International', margin, isPortrait ? 15 : 15.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isPortrait ? 10.5 : 12);
  doc.setTextColor(36, 70, 70); // #244646
  doc.text('MULTI SKILL OPERATOR DEVELOPMENT', margin, isPortrait ? 21.5 : 22.5);

  // --- METADATA CARD (TOP RIGHT) ---
  const metaBoxW = isPortrait ? 66 : 75;
  const metaBoxH = isPortrait ? 18 : 20;
  const metaBoxX = pageWidth - margin - metaBoxW;
  const metaBoxY = isPortrait ? 9.5 : 9;

  doc.setFillColor(245, 248, 248);
  doc.setDrawColor(200, 216, 216);
  doc.roundedRect(metaBoxX, metaBoxY, metaBoxW, metaBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isPortrait ? 6.5 : 7.5);
  doc.setTextColor(100, 116, 139);

  const metaTextLeft = metaBoxX + 2.5;
  const metaValLeft = metaBoxX + (isPortrait ? 22 : 26);

  doc.text(`${isEn ? 'Factory / Line' : 'Pabrik / Lini'}:`, metaTextLeft, metaBoxY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`${selectedFactory} • ${selectedLine}`, metaValLeft, metaBoxY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${isEn ? 'Period' : 'Periode'}:`, metaTextLeft, metaBoxY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`${monthName} ${selectedYear}`, metaValLeft, metaBoxY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${isEn ? 'Generated' : 'Dicetak'}:`, metaTextLeft, metaBoxY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(printDateStr, metaValLeft, metaBoxY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Doc ID:`, metaTextLeft, metaBoxY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(196, 142, 20);
  doc.text('WI.FR.LEAN.02.03', metaValLeft, metaBoxY + 16);

  let currentY = isPortrait ? 30.5 : 31;

  // --- EXECUTIVE KPI STAT CARDS ---
  if (includeSummary) {
    if (isPortrait) {
      // 2 x 2 GRID FOR PORTRAIT
      const gapX = 3;
      const gapY = 2.5;
      const cardW = (contentWidth - gapX) / 2;
      const cardH = 12.5;

      // Card 1: Total Manpower
      doc.setFillColor(241, 248, 248);
      doc.setDrawColor(190, 218, 218);
      doc.roundedRect(margin, currentY, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(70, 95, 95);
      doc.text(isEn ? 'TOTAL MANPOWER' : 'TOTAL OPERATOR (MP)', margin + 3, currentY + 3.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(36, 70, 70);
      doc.text(`${totalActive} ${isEn ? 'Active' : 'Aktif'}`, margin + 3, currentY + 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(140, 100, 100);
      doc.text(`(${totalResigned} ${isEn ? 'Resigned' : 'Resigned'})`, margin + 3, currentY + 11.2);

      // Card 2: Multi-Skill Ratio
      const c2X = margin + cardW + gapX;
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(c2X, currentY, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(22, 101, 52);
      doc.text(isEn ? 'MULTI-SKILL RATIO (>=2 MACHINES)' : 'RASIO MULTI-SKILL (>=2 MESIN)', c2X + 3, currentY + 3.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(22, 101, 52);
      doc.text(`${multiSkillPercent}%`, c2X + 3, currentY + 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(74, 114, 94);
      doc.text(`${multiSkillCount} / ${totalActive} ${isEn ? 'operators' : 'operator kompeten'}`, c2X + 3, currentY + 11.2);

      // Card 3: Grade Distribution
      const r2Y = currentY + cardH + gapY;
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(margin, r2Y, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(133, 77, 14);
      doc.text(isEn ? 'GRADE DISTRIBUTION (S / A / B / C)' : 'DISTRIBUSI GRADE (S / A / B / C)', margin + 3, r2Y + 3.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(113, 63, 18);
      doc.text(`S:${gradeCounts.S}  A:${gradeCounts.A}  B:${gradeCounts.B}  C:${gradeCounts.C}`, margin + 3, r2Y + 8.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(140, 110, 50);
      doc.text(`Helper: ${gradeCounts.HELPER} | ${isEn ? 'Avg Points' : 'Rata-rata Poin'}: ${avgPoints}`, margin + 3, r2Y + 11.2);

      // Card 4: Machine Coverage
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(186, 230, 253);
      doc.roundedRect(c2X, r2Y, cardW, cardH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(3, 105, 161);
      doc.text(isEn ? 'MACHINE POPULATION COVERAGE' : 'POPULASI KOMPETENSI MESIN', c2X + 3, r2Y + 3.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(3, 105, 161);
      doc.text(`SN:${machineCounts.lockstitch} | OL:${machineCounts.overlock} | FS:${machineCounts.flatseam}`, c2X + 3, r2Y + 8.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(80, 130, 160);
      doc.text(`SP:${machineCounts.special} | BTN:${machineCounts.buttonHole + machineCounts.buttonSet}`, c2X + 3, r2Y + 11.2);

      currentY = r2Y + cardH + 3.5;
    } else {
      // 4 CARDS IN A ROW FOR LANDSCAPE
      const cardGap = 3.5;
      const numCards = 4;
      const cardW = (contentWidth - ((numCards - 1) * cardGap)) / numCards;
      const cardH = 15;

      // Card 1
      doc.setFillColor(241, 248, 248);
      doc.setDrawColor(190, 218, 218);
      doc.roundedRect(margin, currentY, cardW, cardH, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(70, 95, 95);
      doc.text(isEn ? 'TOTAL MANPOWER' : 'TOTAL OPERATOR (MP)', margin + 3.5, currentY + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(36, 70, 70);
      doc.text(`${totalActive} ${isEn ? 'Active' : 'Aktif'}`, margin + 3.5, currentY + 10.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(140, 100, 100);
      doc.text(`(${totalResigned} ${isEn ? 'Resigned/Inactive' : 'Resigned'})`, margin + 3.5, currentY + 13.8);

      // Card 2
      const c2X = margin + cardW + cardGap;
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(c2X, currentY, cardW, cardH, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(22, 101, 52);
      doc.text(isEn ? 'MULTI-SKILL RATIO (>=2 MACHINES)' : 'RASIO MULTI-SKILL (>=2 MESIN)', c2X + 3.5, currentY + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(22, 101, 52);
      doc.text(`${multiSkillPercent}%`, c2X + 3.5, currentY + 10.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(74, 114, 94);
      doc.text(`${multiSkillCount} / ${totalActive} ${isEn ? 'qualified operators' : 'operator kompeten'}`, c2X + 3.5, currentY + 13.8);

      // Card 3
      const c3X = c2X + cardW + cardGap;
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(c3X, currentY, cardW, cardH, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(133, 77, 14);
      doc.text(isEn ? 'GRADE DISTRIBUTION (S / A / B / C)' : 'DISTRIBUSI GRADE (S / A / B / C)', c3X + 3.5, currentY + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(113, 63, 18);
      doc.text(`S:${gradeCounts.S}  A:${gradeCounts.A}  B:${gradeCounts.B}  C:${gradeCounts.C}`, c3X + 3.5, currentY + 10.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(140, 110, 50);
      doc.text(`Helper: ${gradeCounts.HELPER} ${isEn ? 'personnel' : 'orang'}`, c3X + 3.5, currentY + 13.8);

      // Card 4
      const c4X = c3X + cardW + cardGap;
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(186, 230, 253);
      doc.roundedRect(c4X, currentY, cardW, cardH, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(3, 105, 161);
      doc.text(isEn ? 'MACHINE POPULATION COVERAGE' : 'POPULASI KOMPETENSI MESIN', c4X + 3.5, currentY + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(3, 105, 161);
      doc.text(`SN: ${machineCounts.lockstitch} | OL: ${machineCounts.overlock} | FS: ${machineCounts.flatseam}`, c4X + 3.5, currentY + 10.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(80, 130, 160);
      doc.text(`Special: ${machineCounts.special} | Button: ${machineCounts.buttonHole + machineCounts.buttonSet} | Rata Pts: ${avgPoints}`, c4X + 3.5, currentY + 13.8);

      currentY += cardH + 4;
    }
  } else {
    currentY += 2;
  }

  // --- PREPARE TABLE HEADERS & BODY ---
  const headers = [
    [
      'NO',
      'NIK',
      isEn ? 'OPERATOR NAME' : 'NAMA OPERATOR',
      isEn ? 'TENURE' : 'MASA\nKERJA',
      'SN\n(Lock)',
      'OL\n(Obras)',
      'FS\n(Flat)',
      'SP\n(Special)',
      'BTN\n(Hole)',
      'BTN\n(Set)',
      'MULTI\nSKILL',
      isEn ? 'TOTAL\nPTS' : 'TOTAL\nPOIN',
      'GRADE',
      'STATUS'
    ]
  ];

  const bodyData = targetOperators.map((op, idx) => {
    const isResigned = isOperatorResignedAtPeriod(op, selectedMonth, selectedYear);
    const totalPts = getOperatorTotalPoints(op);
    const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER';
    const gradeObj = getGradeFromTotalPoints(totalPts, isHelper);
    const msCount = getOperatorMultiSkillCount(op);

    const formatSkillVal = (val: number | null | undefined) => {
      if (val === null || val === undefined || isNaN(val)) return '-';
      if (val === 0) return '-';
      return `${val}`;
    };

    const tenureStr = op.workTimeMonths ? `${op.workTimeMonths} bln` : '-';
    const statusStr = isResigned ? (isEn ? 'Resigned' : 'Keluar') : (isEn ? 'Active' : 'Aktif');

    return [
      idx + 1,
      op.nik || '-',
      op.name || '-',
      tenureStr,
      formatSkillVal(op.lockstitch),
      formatSkillVal(op.overlock),
      formatSkillVal(op.flatseam),
      formatSkillVal(op.special),
      formatSkillVal(op.buttonHole),
      formatSkillVal(op.buttonSet),
      msCount > 0 ? `${msCount} Mesin` : '-',
      totalPts,
      gradeObj.letter || gradeObj.label,
      statusStr
    ];
  });

  // Table Column Styles tailored for Portrait (190 mm) vs Landscape (273 mm)
  const columnStylesPortrait: { [key: number]: any } = {
    0: { cellWidth: 6, halign: 'center' }, // No
    1: { cellWidth: 17, halign: 'center', fontStyle: 'bold' }, // NIK
    2: { cellWidth: 39, halign: 'left', fontStyle: 'bold' }, // Name
    3: { cellWidth: 14, halign: 'center' }, // Tenure
    4: { cellWidth: 9.5, halign: 'center' }, // SN
    5: { cellWidth: 9.5, halign: 'center' }, // OL
    6: { cellWidth: 9.5, halign: 'center' }, // FS
    7: { cellWidth: 9.5, halign: 'center' }, // SP
    8: { cellWidth: 9.5, halign: 'center' }, // BTN Hole
    9: { cellWidth: 9.5, halign: 'center' }, // BTN Set
    10: { cellWidth: 14, halign: 'center' }, // Multi skill
    11: { cellWidth: 13, halign: 'center', fontStyle: 'bold' }, // Total Points
    12: { cellWidth: 14, halign: 'center', fontStyle: 'bold' }, // Grade
    13: { cellWidth: 16, halign: 'center' } // Status
  };

  const columnStylesLandscape: { [key: number]: any } = {
    0: { cellWidth: 8, halign: 'center' },
    1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
    2: { cellWidth: 50, halign: 'left', fontStyle: 'bold' },
    3: { cellWidth: 16, halign: 'center' },
    4: { cellWidth: 14, halign: 'center' },
    5: { cellWidth: 14, halign: 'center' },
    6: { cellWidth: 14, halign: 'center' },
    7: { cellWidth: 14, halign: 'center' },
    8: { cellWidth: 14, halign: 'center' },
    9: { cellWidth: 14, halign: 'center' },
    10: { cellWidth: 18, halign: 'center' },
    11: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
    12: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
    13: { cellWidth: 20, halign: 'center' }
  };

  // Run AutoTable
  autoTable(doc, {
    startY: currentY,
    head: headers,
    body: bodyData,
    margin: { left: margin, right: margin, bottom: isPortrait ? 16 : 18 },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: isPortrait ? 6.5 : 7.5,
      cellPadding: isPortrait ? 1.3 : 1.8,
      overflow: 'linebreak',
      halign: 'center',
      valign: 'middle',
      lineColor: [220, 230, 230],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [36, 70, 70],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: isPortrait ? 6.5 : 7.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: isPortrait ? 1.6 : 2.2
    },
    columnStyles: isPortrait ? columnStylesPortrait : columnStylesLandscape,
    alternateRowStyles: {
      fillColor: [248, 251, 251]
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rawRow = targetOperators[data.row.index];
        const isResigned = rawRow ? isOperatorResignedAtPeriod(rawRow, selectedMonth, selectedYear) : false;

        if (isResigned) {
          data.cell.styles.textColor = [140, 140, 140];
          if (data.column.index === 13) {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 242, 242];
          }
        } else if (data.column.index === 13) {
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        }

        // Color grade column
        if (data.column.index === 12) {
          const gradeVal = String(data.cell.raw || '');
          data.cell.styles.fontStyle = 'bold';
          if (gradeVal.includes('S')) {
            data.cell.styles.fillColor = [254, 240, 138];
            data.cell.styles.textColor = [133, 77, 14];
          } else if (gradeVal.includes('A')) {
            data.cell.styles.fillColor = [187, 247, 208];
            data.cell.styles.textColor = [20, 83, 45];
          } else if (gradeVal.includes('B')) {
            data.cell.styles.fillColor = [186, 230, 253];
            data.cell.styles.textColor = [3, 105, 161];
          } else if (gradeVal.includes('C')) {
            data.cell.styles.fillColor = [254, 215, 170];
            data.cell.styles.textColor = [154, 52, 18];
          } else {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.textColor = [71, 85, 105];
          }
        }

        // Highlight high multi-skill cells
        if (data.column.index === 10) {
          const val = String(data.cell.raw || '');
          if (val.includes('2') || val.includes('3') || val.includes('4') || val.includes('5')) {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    }
  });

  // Final Y coordinate after table
  const finalY = (doc as any).lastAutoTable.finalY || currentY + 50;

  // --- SIGNATURES & ENDORSEMENT BLOCK ---
  if (includeSignatures) {
    let sigY = finalY + 5;
    const requiredSigSpace = isPortrait ? 28 : 32;

    if (sigY + requiredSigSpace > pageHeight - 12) {
      doc.addPage();
      sigY = 16;
    }

    const boxW = isPortrait ? 56 : 55;
    const boxH = isPortrait ? 24 : 26;
    const sigGap = isPortrait ? 11 : ((contentWidth - (boxW * 3)) / 2);

    const signBoxes = [
      {
        title: isEn ? 'PREPARED BY (IE OFFICER)' : 'DIBUAT OLEH (IE OFFICER)',
        subtitle: isEn ? 'Industrial Engineering Dept.' : 'Industrial Engineering Dept.',
        name: 'IE Specialist'
      },
      {
        title: isEn ? 'VERIFIED BY (SUPERVISOR)' : 'DIVERIFIKASI OLEH (SPV SEWING)',
        subtitle: isEn ? 'Sewing Production Line' : 'Line Supervisor Sewing',
        name: `${selectedLine} Supervisor`
      },
      {
        title: isEn ? 'APPROVED BY (MANAGER)' : 'DISETUJUI OLEH (PABRIK / IE MGR)',
        subtitle: isEn ? 'Production / Factory Manager' : 'Factory & IE Manager',
        name: `${selectedFactory} Management`
      }
    ];

    signBoxes.forEach((box, i) => {
      const bx = margin + (i * (boxW + sigGap));
      doc.setFillColor(252, 253, 253);
      doc.setDrawColor(210, 225, 225);
      doc.roundedRect(bx, sigY, boxW, boxH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isPortrait ? 6 : 6.5);
      doc.setTextColor(36, 70, 70);
      doc.text(box.title, bx + (boxW / 2), sigY + 3.8, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isPortrait ? 5 : 5.5);
      doc.setTextColor(120, 136, 136);
      doc.text(box.subtitle, bx + (boxW / 2), sigY + 6.8, { align: 'center' });

      doc.setDrawColor(180, 195, 195);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(bx + 5, sigY + (boxH - 6), bx + boxW - 5, sigY + (boxH - 6));
      doc.setLineDashPattern([], 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isPortrait ? 6 : 6.5);
      doc.setTextColor(50, 65, 65);
      doc.text(`( ${box.name} )`, bx + (boxW / 2), sigY + (boxH - 2.5), { align: 'center' });
    });
  }

  // --- FOOTER ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    doc.setDrawColor(220, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isPortrait ? 5.8 : 6.5);
    doc.setTextColor(120, 136, 136);
    doc.text(
      'PT. WINNERS INTERNATIONAL — INDUSTRIAL ENGINEERING SYSTEM | DOKUMEN INTERNAL & RAHASIA',
      margin,
      pageHeight - 5.5
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      isEn ? `Page ${p} of ${totalPages}` : `Halaman ${p} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 5.5,
      { align: 'right' }
    );
  }

  return doc;
}

/**
 * Returns a Blob object of the generated PDF (ideal for live preview in iframe or object URLs).
 */
export function generateSkillMatrixPDFBlob(options: PDFExportOptions): Blob {
  const doc = generateSkillMatrixPDF(options);
  return doc.output('blob');
}

/**
 * Directly downloads the generated PDF with a sanitized filename.
 */
export function exportSkillMatrixPDF(options: PDFExportOptions): void {
  const {
    selectedFactory,
    selectedLine,
    selectedMonth,
    selectedYear,
    language = 'id',
    orientation = 'portrait'
  } = options;

  const isEn = language === 'en';
  const monthName = isEn 
    ? new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' })
    : (MONTH_NAMES_ID[selectedMonth - 1]?.label || `Bulan ${selectedMonth}`);

  const doc = generateSkillMatrixPDF(options);
  const orientStr = orientation === 'portrait' ? 'Portrait' : 'Landscape';
  const fileNameClean = `Skill_Matrix_${selectedFactory.replace(/\s+/g, '_')}_${selectedLine.replace(/\s+/g, '_')}_${monthName}_${selectedYear}_${orientStr}.pdf`;
  doc.save(fileNameClean);
}
