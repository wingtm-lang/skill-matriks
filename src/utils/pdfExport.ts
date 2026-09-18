import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Operator, LineLeader } from '../types';
import { 
  getOperatorTotalPoints, 
  getGradeFromTotalPoints,
  DEFAULT_LINE_LEADERS,
  getLineLeader
} from '../data/mockData';
import { 
  getOperatorMultiSkillCount, 
  MONTH_NAMES_ID,
  isOperatorResignedAtPeriod 
} from './ieCalculations';
import { WINNERS_LOGO_BASE64 } from '../assets/logo';

export interface PDFExportOptions {
  operators: Operator[];
  selectedFactory: string;
  selectedLine: string;
  selectedMonth: number;
  selectedYear: number;
  includeResigned?: boolean;
  includeSummary?: boolean;
  includeSignatures?: boolean;
  includeCurrentOperation?: boolean;
  language?: 'id' | 'en';
  orientation?: 'portrait' | 'landscape';
  lineLeaders?: LineLeader[];
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
    includeCurrentOperation = true,
    language = 'id',
    orientation = 'portrait',
    lineLeaders
  } = options;

  const isEn = language === 'en';
  const isPortrait = orientation === 'portrait';

  const monthName = isEn 
    ? new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long' })
    : (MONTH_NAMES_ID[selectedMonth - 1]?.label || `Bulan ${selectedMonth}`);

  // Page Dimensions (Narrow Margins)
  const pageWidth = isPortrait ? 210 : 297;
  const pageHeight = isPortrait ? 297 : 210;
  const margin = isPortrait ? 4.5 : 5.5;
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
      const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER' || (op as any).grade === 'H';
      const gradeObj = getGradeFromTotalPoints(pts, isHelper);
      const gradeLetter = gradeObj.letter;
      if (gradeLetter === 'H' || gradeObj.grade === 'HELPER' || isHelper) {
        gradeCounts.HELPER++;
      } else if (gradeLetter === 'S') {
        gradeCounts.S++;
      } else if (gradeLetter === 'A') {
        gradeCounts.A++;
      } else if (gradeLetter === 'B') {
        gradeCounts.B++;
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

  // --- BRAND & REPORT HEADER (WITH OFFICIAL LOGO) ---
  const logoSize = isPortrait ? 6.5 : 7.2;
  const logoX = margin;
  const logoY = isPortrait ? 8.6 : 8.2;
  
  try {
    doc.addImage(WINNERS_LOGO_BASE64, 'PNG', logoX, logoY, logoSize, logoSize);
  } catch (err) {
    console.warn('Could not add logo to PDF:', err);
  }

  const headerTextX = margin + logoSize + (isPortrait ? 2.2 : 2.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isPortrait ? 13 : 14.5);
  doc.setTextColor(30, 41, 59);
  doc.text('PT.WINNERS INTERNATIONAL', headerTextX, isPortrait ? 13.8 : 13.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isPortrait ? 9.5 : 11);
  doc.setTextColor(36, 70, 70); // #244646
  doc.text('MULTI SKILL OPERATOR DEVELOPMENT', headerTextX, isPortrait ? 19.2 : 19.5);

  // --- METADATA CARD (TOP RIGHT) ---
  const metaBoxW = isPortrait ? 66 : 75;
  const metaBoxH = isPortrait ? 14 : 15.5;
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

  // 1. Doc ID (Paling Atas)
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Doc ID:`, metaTextLeft, metaBoxY + 3.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(196, 142, 20); // #C48E14
  doc.text('WI.FR.LEAN.02.03', metaValLeft, metaBoxY + 3.8);

  // 2. Factory / Line
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${isEn ? 'Factory / Line' : 'Pabrik / Lini'}:`, metaTextLeft, metaBoxY + 7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`${selectedFactory} • ${selectedLine}`, metaValLeft, metaBoxY + 7.5);

  // 3. Period
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${isEn ? 'Period' : 'Periode'}:`, metaTextLeft, metaBoxY + 11.2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`${monthName} ${selectedYear}`, metaValLeft, metaBoxY + 11.2);

  let currentY = isPortrait ? 27.5 : 28;

  // --- UNIFIED EXECUTIVE KPI STRIP (SLIM, ARTISTIC & COMPACT) ---
  if (includeSummary) {
    const stripH = isPortrait ? 13 : 13.5;
    const colW = contentWidth / 4;

    // Outer unified container
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, stripH, 1.2, 1.2, 'FD');

    // Vertical column dividers
    doc.setDrawColor(226, 232, 240);
    for (let i = 1; i < 4; i++) {
      const divX = margin + (i * colW);
      doc.line(divX, currentY + 1.2, divX, currentY + stripH - 1.2);
    }

    // --- Metric 1: Total Manpower ---
    const col0X = margin + 2.5;
    // Dot indicator
    doc.setFillColor(36, 70, 70);
    doc.circle(col0X + 0.6, currentY + 3.3, 0.6, 'F');
    // Header label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? 'TOTAL MANPOWER' : 'TOTAL OPERATOR (MP)', col0X + 2.2, currentY + 3.6);
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(36, 70, 70);
    doc.text(`${totalActive} ${isEn ? 'Active' : 'Aktif'}`, col0X, currentY + 8.8);

    // --- Metric 2: Multi-Skill Ratio ---
    const col1X = margin + colW + 2.5;
    // Dot indicator
    doc.setFillColor(16, 185, 129);
    doc.circle(col1X + 0.6, currentY + 3.3, 0.6, 'F');
    // Header label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? 'MULTI-SKILL RATIO' : 'RASIO MULTI-SKILL', col1X + 2.2, currentY + 3.6);
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(22, 101, 52);
    doc.text(`${multiSkillPercent}%`, col1X, currentY + 7.8);
    // Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(74, 114, 94);
    doc.text(`${multiSkillCount} / ${totalActive} ${isEn ? 'qualified' : 'kompeten'}`, col1X, currentY + 11.2);

    // --- Metric 3: Grade Distribution ---
    const col2X = margin + (colW * 2) + 2.5;
    // Dot indicator
    doc.setFillColor(245, 158, 11);
    doc.circle(col2X + 0.6, currentY + 3.3, 0.6, 'F');
    // Header label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? 'GRADE DISTRIBUTION' : 'DISTRIBUSI GRADE', col2X + 2.2, currentY + 3.6);
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(30, 41, 59);
    doc.text(`S:${gradeCounts.S}   A:${gradeCounts.A}   B:${gradeCounts.B}   C:${gradeCounts.C}`, col2X, currentY + 7.8);
    // Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Helper: ${gradeCounts.HELPER} · ${isEn ? 'Avg Pts' : 'Rata Poin'}: ${avgPoints}`, col2X, currentY + 11.2);

    // --- Metric 4: Machine Population ---
    const col3X = margin + (colW * 3) + 2.5;
    // Dot indicator
    doc.setFillColor(14, 165, 233);
    doc.circle(col3X + 0.6, currentY + 3.3, 0.6, 'F');
    // Header label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(100, 116, 139);
    doc.text(isEn ? 'MACHINE POPULATION' : 'POPULASI MESIN', col3X + 2.2, currentY + 3.6);
    // Value (Line 1)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(`SN:${machineCounts.lockstitch} · OL:${machineCounts.overlock} · FS:${machineCounts.flatseam}`, col3X, currentY + 7.8);
    // Value (Line 2: SP, BTN Hole, BTN Set formatted like SN, OL, FS)
    doc.text(`SP:${machineCounts.special} · BTN Hole:${machineCounts.buttonHole} · BTN Set:${machineCounts.buttonSet}`, col3X, currentY + 11.2);

    currentY += stripH + 3.5;
  } else {
    currentY += 2;
  }

  // --- PREPARE TABLE HEADERS & BODY ---
  const headerRow = [
    'NO',
    'NIK',
    isEn ? 'OPERATOR NAME' : 'NAMA OPERATOR',
    isEn ? 'TENURE' : 'MASA\nKERJA',
    ...(includeCurrentOperation ? ['CURRENT\nOPERATION'] : []),
    'SN\n(Lock)',
    'OL\n(Obras)',
    'FS\n(Flat)',
    'SP\n(Special)',
    'BTN\n(Hole)',
    'BTN\n(Set)',
    'MULTI\nSKILL',
    isEn ? 'TOTAL\nPTS' : 'TOTAL\nPOIN',
    'GRADE'
  ];
  const headers = [headerRow];

  const bodyData = targetOperators.map((op, idx) => {
    const isResigned = isOperatorResignedAtPeriod(op, selectedMonth, selectedYear);
    const totalPts = getOperatorTotalPoints(op);
    const isHelper = op.status?.toUpperCase() === 'HELPER' || (op as any).grade === 'HELPER' || (op as any).grade === 'H';
    const gradeObj = getGradeFromTotalPoints(totalPts, isHelper);
    const msCount = getOperatorMultiSkillCount(op);

    const formatSkillVal = (val: number | null | undefined) => {
      if (val === null || val === undefined || isNaN(val)) return '-';
      if (val === 0) return '-';
      return `${val}`;
    };

    const tenureStr = op.workTimeMonths ? `${op.workTimeMonths} bln` : '-';

    return [
      idx + 1,
      op.nik || '-',
      op.name || '-',
      tenureStr,
      ...(includeCurrentOperation ? [op.process || (op as any).currentOperation || '-'] : []),
      formatSkillVal(op.lockstitch),
      formatSkillVal(op.overlock),
      formatSkillVal(op.flatseam),
      formatSkillVal(op.special),
      formatSkillVal(op.buttonHole),
      formatSkillVal(op.buttonSet),
      msCount > 0 ? `${msCount} Mesin` : '-',
      totalPts,
      gradeObj.letter || gradeObj.label
    ];
  });

  // Table Column Styles tailored for Portrait (201 mm content) vs Landscape (286 mm content)
  const columnStylesPortraitWithOp: { [key: number]: any } = {
    0: { cellWidth: 7, halign: 'center' }, // No
    1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }, // NIK
    2: { cellWidth: 40, halign: 'left', fontStyle: 'bold' }, // Name
    3: { cellWidth: 13, halign: 'center' }, // Tenure
    4: { cellWidth: 31, halign: 'left' }, // Current Operation
    5: { cellWidth: 9, halign: 'center' }, // SN
    6: { cellWidth: 9, halign: 'center' }, // OL
    7: { cellWidth: 9, halign: 'center' }, // FS
    8: { cellWidth: 9, halign: 'center' }, // SP
    9: { cellWidth: 9, halign: 'center' }, // BTN Hole
    10: { cellWidth: 9, halign: 'center' }, // BTN Set
    11: { cellWidth: 14, halign: 'center' }, // Multi skill
    12: { cellWidth: 13, halign: 'center', fontStyle: 'bold' }, // Total Points
    13: { cellWidth: 13, halign: 'center', fontStyle: 'bold' } // Grade
  };

  const columnStylesPortraitWithoutOp: { [key: number]: any } = {
    0: { cellWidth: 8, halign: 'center' }, // No
    1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // NIK
    2: { cellWidth: 49, halign: 'left', fontStyle: 'bold' }, // Name
    3: { cellWidth: 14, halign: 'center' }, // Tenure
    4: { cellWidth: 11, halign: 'center' }, // SN
    5: { cellWidth: 11, halign: 'center' }, // OL
    6: { cellWidth: 11, halign: 'center' }, // FS
    7: { cellWidth: 11, halign: 'center' }, // SP
    8: { cellWidth: 11, halign: 'center' }, // BTN Hole
    9: { cellWidth: 11, halign: 'center' }, // BTN Set
    10: { cellWidth: 15, halign: 'center' }, // Multi skill
    11: { cellWidth: 15, halign: 'center', fontStyle: 'bold' }, // Total Points
    12: { cellWidth: 16, halign: 'center', fontStyle: 'bold' } // Grade
  };

  const columnStylesLandscapeWithOp: { [key: number]: any } = {
    0: { cellWidth: 8, halign: 'center' }, // No
    1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // NIK
    2: { cellWidth: 55, halign: 'left', fontStyle: 'bold' }, // Name
    3: { cellWidth: 16, halign: 'center' }, // Tenure
    4: { cellWidth: 47, halign: 'left' }, // Current Operation
    5: { cellWidth: 14, halign: 'center' }, // SN
    6: { cellWidth: 14, halign: 'center' }, // OL
    7: { cellWidth: 14, halign: 'center' }, // FS
    8: { cellWidth: 14, halign: 'center' }, // SP
    9: { cellWidth: 14, halign: 'center' }, // BTN Hole
    10: { cellWidth: 14, halign: 'center' }, // BTN Set
    11: { cellWidth: 18, halign: 'center' }, // Multi skill
    12: { cellWidth: 19, halign: 'center', fontStyle: 'bold' }, // Total Points
    13: { cellWidth: 19, halign: 'center', fontStyle: 'bold' } // Grade
  };

  const columnStylesLandscapeWithoutOp: { [key: number]: any } = {
    0: { cellWidth: 10, halign: 'center' }, // No
    1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' }, // NIK
    2: { cellWidth: 75, halign: 'left', fontStyle: 'bold' }, // Name
    3: { cellWidth: 19, halign: 'center' }, // Tenure
    4: { cellWidth: 16, halign: 'center' }, // SN
    5: { cellWidth: 16, halign: 'center' }, // OL
    6: { cellWidth: 16, halign: 'center' }, // FS
    7: { cellWidth: 16, halign: 'center' }, // SP
    8: { cellWidth: 16, halign: 'center' }, // BTN Hole
    9: { cellWidth: 16, halign: 'center' }, // BTN Set
    10: { cellWidth: 20, halign: 'center' }, // Multi skill
    11: { cellWidth: 21, halign: 'center', fontStyle: 'bold' }, // Total Points
    12: { cellWidth: 21, halign: 'center', fontStyle: 'bold' } // Grade
  };

  const columnStyles = isPortrait
    ? (includeCurrentOperation ? columnStylesPortraitWithOp : columnStylesPortraitWithoutOp)
    : (includeCurrentOperation ? columnStylesLandscapeWithOp : columnStylesLandscapeWithoutOp);

  const gradeColIndex = includeCurrentOperation ? 13 : 12;
  const multiSkillColIndex = includeCurrentOperation ? 11 : 10;

  // Run AutoTable
  autoTable(doc, {
    startY: currentY,
    head: headers,
    body: bodyData,
    margin: { left: margin, right: margin, bottom: isPortrait ? 13 : 15 },
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
    columnStyles: columnStyles,
    alternateRowStyles: {
      fillColor: [248, 251, 251]
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const rawRow = targetOperators[data.row.index];
        const isResigned = rawRow ? isOperatorResignedAtPeriod(rawRow, selectedMonth, selectedYear) : false;

        if (isResigned) {
          data.cell.styles.textColor = [150, 150, 150];
        }

        // Color grade column
        if (data.column.index === gradeColIndex) {
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
        if (data.column.index === multiSkillColIndex) {
          const val = String(data.cell.raw || '');
          if (val.includes('2') || val.includes('3') || val.includes('4') || val.includes('5') || val.includes('6')) {
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

    const boxW = isPortrait ? 60 : 85;
    const boxH = isPortrait ? 24 : 26;
    const sigGap = (contentWidth - (boxW * 3)) / 2;

    const leader = getLineLeader(lineLeaders || DEFAULT_LINE_LEADERS, selectedFactory, selectedLine);

    const signBoxes = [
      {
        title: isEn ? 'PREPARED BY (IE OFFICER)' : 'DIBUAT OLEH (IE OFFICER)',
        subtitle: isEn ? 'Industrial Engineering Dept.' : 'Industrial Engineering Dept.',
        name: leader.ie && leader.ie !== '-' ? leader.ie : 'IE Specialist',
        role: '(IE Specialist)'
      },
      {
        title: isEn ? 'VERIFIED BY (SUPERVISOR)' : 'DIVERIFIKASI OLEH (SPV SEWING)',
        subtitle: isEn ? 'Sewing Production Line' : 'Line Supervisor Sewing',
        name: leader.supervisor && leader.supervisor !== '-' ? leader.supervisor : `${selectedLine} Supervisor`,
        role: `(Supervisor ${selectedLine})`
      },
      {
        title: 'APPROVED BY (CHIEF)',
        subtitle: isEn ? 'Sewing Production Dept.' : 'Sewing Production Dept.',
        name: leader.chief && leader.chief !== '-' ? leader.chief : 'Sewing Chief',
        role: '(Sewing Chief)'
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
      doc.line(bx + 5, sigY + (boxH - 8), bx + boxW - 5, sigY + (boxH - 8));
      doc.setLineDashPattern([], 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isPortrait ? 6 : 6.5);
      doc.setTextColor(50, 65, 65);
      doc.text(box.name, bx + (boxW / 2), sigY + (boxH - 4.5), { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(isPortrait ? 5 : 5.5);
      doc.setTextColor(120, 136, 136);
      doc.text(box.role, bx + (boxW / 2), sigY + (boxH - 1.8), { align: 'center' });
    });
  }

  // --- FOOTER ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    doc.setDrawColor(220, 230, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 7.5, pageWidth - margin, pageHeight - 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isPortrait ? 6.5 : 7.2);
    doc.setTextColor(120, 136, 136);
    doc.text(
      'PT.WINNERS INTERNATIONAL',
      margin,
      pageHeight - 4.2
    );

    // Center: Generated / Dicetak timestamp
    doc.text(
      `${isEn ? 'Generated' : 'Dicetak'}: ${printDateStr}`,
      pageWidth / 2,
      pageHeight - 4.2,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      isEn ? `Page ${p} of ${totalPages}` : `Halaman ${p} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 4.2,
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
