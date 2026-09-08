export type Language = 'id' | 'en';

export interface Translations {
  // Common
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    detail: string;
    close: string;
    filter: string;
    search: string;
    refresh: string;
    sync: string;
    syncing: string;
    error: string;
    success: string;
    loading: string;
    warning: string;
    actions: string;
    status: string;
    active: string;
    resigned: string;
    personnel: string;
    points: string;
    target: string;
    all: string;
    seconds: string;
    months: string;
    hours: string;
    retry: string;
    yes: string;
    no: string;
    none: string;
  };

  // Header
  header: {
    companyName: string;
    systemSubtitle: string;
    liveBadge: string;
    mockBadge: string;
    factory: string;
    line: string;
    period: string;
    role: string;
    roleViewer: string;
    roleEditor: string;
    roleAdmin: string;
    syncTooltip: string;
    language: string;
    indonesian: string;
    english: string;
  };

  // Sidebar
  sidebar: {
    brandTitle: string;
    brandSubtitle: string;
    activeLine: string;
    activeOpsLabel: string;
    totalPopLabel: string;
    navMatrix: string;
    navMatrixSub: string;
    navBalancing: string;
    navBalancingSub: string;
    navTraining: string;
    navTrainingSub: string;
    navChat: string;
    navChatSub: string;
    navSheets: string;
    navSheetsSub: string;
    quickStats: string;
    targetIELabel: string;
    rebalanceReadyLabel: string;
    footerVersion: string;
  };

  // Metrics Overview
  metrics: {
    totalOperators: string;
    readyToWork: string;
    avgLineGrade: string;
    targetIE: string;
    multiSkillTitle: string;
    multiSkillSubtitle: string;
    ofPopulation: string;
    rebalancingReadiness: string;
    pointSystemTitle: string;
    pointSystemBadge: string;
    pointSystemSubtitle: string;
    hideDetails: string;
    showDetails: string;
    p0Points: string;
    p0Eff: string;
    p0Title: string;
    p0Desc: string;
    p0Limit: string;
    p1Points: string;
    p1Eff: string;
    p1Title: string;
    p1Desc: string;
    p1Limit: string;
    p2Points: string;
    p2Eff: string;
    p2Title: string;
    p2Desc: string;
    p2Limit: string;
    p3Points: string;
    p3Eff: string;
    p3Title: string;
    p3Desc: string;
    p3Limit: string;
  };

  // Skill Matrix Tab
  matrix: {
    resignSuccess: string;
    resignFailed: string;
    gradeFilter: string;
    legendTitle: string;
    searchPlaceholder: string;
    multiSkillOnly: string;
    exportCSV: string;
    addOperator: string;
    category: string;
    allMachines: string;
    showing: string;
    of: string;
    operatorsLabel: string;
    thNo: string;
    thNik: string;
    thName: string;
    thTenure: string;
    thSkill: string;
    thGrade: string;
    thAction: string;
    noOperators: string;
    noDataRegistered: string;
    adjustFilter: string;
    gradeStandard: string;
    addTitle: string;
    editTitle: string;
    nikLabel: string;
    nameLabel: string;
    tenureLabel: string;
    dojLabel: string;
    machinePointsHeader: string;
    max3Points: string;
    resignTitle: string;
    resignConfirmPrompt: string;
    resignWarning: string;
    sendingToSheets: string;
    confirmResign: string;
    editTooltip: string;
    resignTooltip: string;
  };
  skillMatrix: {
    filterGradeLabel: string;
    allGrades: string;
    pointLegendTitle: string;
    searchPlaceholder: string;
    allMachines: string;
    multiSkillOnly: string;
    exportCsv: string;
    addOperator: string;
    colNo: string;
    colNik: string;
    colName: string;
    colTenure: string;
    colMultiSkill: string;
    colTotalPoints: string;
    colGrade: string;
    colActions: string;
    actionEdit: string;
    actionDetail: string;
    actionResign: string;
    noData: string;
    noDataDesc: string;
    
    // Resign Modal
    resignModalTitle: string;
    resignWarningText: string;
    resignConfirmPrompt: string;
    resignCancelBtn: string;
    resignConfirmBtn: string;
    resignProcessing: string;
    resignSuccessToast: string;
    resignErrorToast: string;

    // Add / Edit Modal
    modalAddTitle: string;
    modalEditTitle: string;
    fieldNik: string;
    fieldName: string;
    fieldDoj: string;
    fieldTenure: string;
    fieldFactory: string;
    fieldLine: string;
    fieldStatus: string;
    sectionMachinePoints: string;
    sectionMachinePointsDesc: string;
    saveOperatorBtn: string;

    // Detail Modal
    modalDetailTitle: string;
    detailSummary: string;
    detailCompetencies: string;
    detailRadarTitle: string;
  };

  // Line Balancing Tab
  lineBalancing: {
    selectStyle: string;
    positionsCount: string;
    targetPcsHour: string;
    aiAutoBalanceBtn: string;
    aiAnalyzing: string;
    pitchTime: string;
    lineEfficiency: string;
    balanceDelay: string;
    bottleneckCycle: string;
    smoothnessIndex: string;
    projectedOutput: string;
    pitchFormula: string;
    leanTarget: string;
    balanceDelayFormula: string;
    criticalStation: string;
    lowerIsSmoother: string;
    pcsPerDay: string;
    pcsPerHour: string;
    seconds: string;
    aiKaizenTitle: string;
    aiKaizenBadge: string;
    workstationTitle: string;
    stationsCountLabel: string;
    tabList: string;
    tabLayout: string;
    tabYamazumi: string;
    colWorkstation: string;
    colProcess: string;
    colMachine: string;
    colSmv: string;
    colCycleTime: string;
    colOperator: string;
    colLoading: string;
    colStatus: string;
    statusBottleneck: string;
    statusNormal: string;
    statusStar: string;
    unassignedOperator: string;
    bottleneckNotice: string;
    backupRecommendation: string;
    yamazumiTitle: string;
    yamazumiSubtitle: string;
    balancedLegend: string;
    bottleneckLegend: string;
    targetPitchLegend: string;
    totalSamLabel: string;
    visualLayoutTitle: string;
    visualLayoutSubtitle: string;
    aiRecommendationTitle: string;
  };

  // Multi-Skill Tab
  multiSkill: {
    headerTitle: string;
    headerSubtitle: string;
    selectOperator: string;
    targetMachine: string;
    generatePlanBtn: string;
    generatingPlan: string;
    machineCoverageTitle: string;
    machineCoverageSubtitle: string;
    coverageStatusSafe: string;
    coverageStatusCritical: string;
    coverageStatusModerate: string;
    operatorUnit: string;
    plannerTitle: string;
    plannerSubtitle: string;
    selectOperatorLabel: string;
    noOperatorsInLine: string;
    operatorTenure: string;
    currentSkillsLabel: string;
    targetMachineLabel: string;
    curriculumTitle: string;
    curriculumActive: string;
    designingModule: string;
    designingModuleSub: string;
    noRoadmapTitle: string;
    noRoadmapDesc: string;
    skillGapTitle: string;
    skillGapSubtitle: string;
    aiPlanResultTitle: string;
    aiPlanPlaceholder: string;
    currentMatrixPoints: string;
    trainingCandidatesTitle: string;
  };

  // IE Chat Tab
  ieChat: {
    headerTitle: string;
    headerSubtitle: string;
    specialistTitle: string;
    specialistSubtitle: string;
    expertBadge: string;
    statusReady: string;
    clearChat: string;
    clearChatTooltip: string;
    quick1: string;
    quick2: string;
    quick3: string;
    quick4: string;
    inputPlaceholder: string;
    sendBtn: string;
    thinking: string;
    defaultWelcome: string;
    serverError: string;
    abortError: string;
    clearedMessage: string;
    analyzingProduction: string;
    suggestionsLabel: string;
  };

  // Google Sheets Tab
  googleSheets: {
    headerTitle: string;
    headerSubtitle: string;
    openInSheets: string;
    syncStatusTitle: string;
    syncStatusLive: string;
    syncStatusSyncing: string;
    syncStatusIdle: string;
    lastSyncedLabel: string;
    syncNowBtn: string;
    webAppUrlLabel: string;
    openSheetBtn: string;
    syncLogsTitle: string;
    logTime: string;
    logStatus: string;
    logRows: string;
    logUser: string;
    logDetails: string;
    guideTitle: string;
    guide1: string;
    guide2: string;
    guide3: string;
    connectedStatus: string;
    spreadsheetIdLabel: string;
    targetUrlLabel: string;
    pullDataBtn: string;
    pullingData: string;
    pullSuccessToast: string;
    pullSuccessSpreadsheet: string;
    pullSuccessGeneric: string;
    apiInfoTitle: string;
    apiInfoHint: string;
    rbacTitle: string;
    thUserLevel: string;
    thAppAccess: string;
    thYourStatus: string;
    viewerTitle: string;
    viewerAccess: string;
    editorTitle: string;
    editorAccess: string;
    adminTitle: string;
    adminAccess: string;
    activeNow: string;
    totalRecordsLabel: string;
  };

  // App General
  app: {
    footerRights: string;
    footerStandard: string;
    retryBtn: string;
  };

  // Months
  months: {
    1: string;
    2: string;
    3: string;
    4: string;
    5: string;
    6: string;
    7: string;
    8: string;
    9: string;
    10: string;
    11: string;
    12: string;
  };
}

export const translations: Record<Language, Translations> = {
  id: {
    common: {
      save: 'Simpan',
      cancel: 'Batal',
      delete: 'Hapus',
      edit: 'Edit',
      detail: 'Detail',
      close: 'Tutup',
      filter: 'Filter',
      search: 'Cari',
      refresh: 'Segarkan',
      sync: 'Sinkronkan',
      syncing: 'Menyinkronkan...',
      error: 'Terjadi Kesalahan',
      success: 'Berhasil',
      loading: 'Memuat...',
      warning: 'Peringatan',
      actions: 'Aksi',
      status: 'Status',
      active: 'Aktif',
      resigned: 'Resigned',
      personnel: 'Personil',
      points: 'Poin',
      target: 'Target',
      all: 'Semua',
      seconds: 'detik',
      months: 'bulan',
      hours: 'jam',
      retry: 'Coba Lagi',
      yes: 'Ya',
      no: 'Tidak',
      none: 'Tidak ada',
    },
    header: {
      companyName: 'PT. Winners International',
      systemSubtitle: 'Sewing Skill Matrix & Automated Line Balancing',
      liveBadge: 'Google Sheets Live',
      mockBadge: 'Dataset Lokal',
      factory: 'Pabrik',
      line: 'Lini',
      period: 'Periode:',
      role: 'Role:',
      roleViewer: 'Viewer (GM/Manager)',
      roleEditor: 'Editor (IE Staff)',
      roleAdmin: 'Admin (Akses Penuh)',
      syncTooltip: 'Sinkronkan Ulang dari Google Sheets',
      language: 'Bahasa',
      indonesian: 'Indonesia',
      english: 'Inggris',
    },
    sidebar: {
      brandTitle: 'PT. Winners',
      brandSubtitle: 'IE & Lean System',
      activeLine: 'Lini Aktif',
      activeOpsLabel: 'Operator Aktif',
      totalPopLabel: 'Total Populasi',
      navMatrix: 'Skill Matrix',
      navMatrixSub: 'Operator & Kompetensi',
      navBalancing: 'AI Line Balancing',
      navBalancingSub: 'Yamazumi & Cycle Time',
      navTraining: 'Multi-Skill Matrix',
      navTrainingSub: 'Retraining & Cross-Skill',
      navChat: 'IE Specialist AI',
      navChatSub: 'Konsultan Garment',
      navSheets: 'Google Sheets Live',
      navSheetsSub: 'Sinkronisasi Cloud 2 Arah',
      quickStats: 'Ringkasan IE',
      targetIELabel: 'Target IE Line',
      rebalanceReadyLabel: 'Kesiapan Rebalance',
      footerVersion: 'Winners IE System v2.4',
    },
    metrics: {
      totalOperators: 'Total Operator Line',
      readyToWork: '100% Siap Kerja',
      avgLineGrade: 'RATA-RATA GRADE OPERATOR LINE',
      targetIE: 'Target IE',
      multiSkillTitle: 'Multi-Skill (≥2 Mesin)',
      multiSkillSubtitle: 'Kesiapan Rebalancing',
      ofPopulation: 'dari populasi',
      rebalancingReadiness: 'Kesiapan Rebalancing',
      pointSystemTitle: 'Sistem Penilaian Poin Operator (Standar Efisiensi IE)',
      pointSystemBadge: 'IE Benchmark',
      pointSystemSubtitle: 'Standar konversi efisiensi kerja aktual ke satuan poin untuk setiap kategori mesin jahit (Lockstitch, Overlock, Flatseam, Special).',
      hideDetails: 'Sembunyikan',
      showDetails: 'Tampilkan Rincian',
      p0Points: '0 Poin',
      p0Eff: 'Eff 0%',
      p0Title: 'Belum Menguasai / Non-Aktif',
      p0Desc: 'Belum memenuhi waktu standar (SMV) atau belum pernah dioperasikan pada jenis mesin jahit ini.',
      p0Limit: 'Batas Efisiensi: 0%',
      p1Points: '1 Poin',
      p1Eff: 'Eff 1 – 60%',
      p1Title: 'Tahap Belajar (Novice)',
      p1Desc: 'Mampu menjahit jahitan dasar dengan supervisi, cycle time masih di atas rata-rata SMV standar.',
      p1Limit: 'Batas Efisiensi: 1 – 60%',
      p2Points: '2 Poin',
      p2Eff: 'Eff 61 – 89%',
      p2Title: 'Standar Produksi (Competent)',
      p2Desc: 'Memenuhi target ritme output harian mandiri dengan tingkat defect (DHU) yang rendah dan stabil.',
      p2Limit: 'Batas Efisiensi: 61 – 89%',
      p3Points: '3 Poin',
      p3Eff: 'Eff > 90%',
      p3Title: 'Mahir / Ahli (Expert / Star)',
      p3Desc: 'Kecepatan tinggi melampaui target SMV, konsisten presisi, kandidat utama floater dan trainer.',
      p3Limit: 'Batas Efisiensi: > 90%',
    },
    matrix: {
      resignSuccess: 'Status RESIGNED berhasil dikirim ke Google Sheets untuk',
      resignFailed: 'Gagal memperbarui status resigned operator di Google Sheets.',
      gradeFilter: 'Filter Grade',
      legendTitle: 'Sistem Poin IE:',
      searchPlaceholder: 'Cari Operator (Nama atau NIK)...',
      multiSkillOnly: 'Multi-Skill Saja',
      exportCSV: 'Export CSV',
      addOperator: 'Tambah Operator',
      category: 'Kategori',
      allMachines: 'Semua Mesin',
      showing: 'Menampilkan',
      of: 'dari',
      operatorsLabel: 'Operator',
      thNo: 'No',
      thNik: 'NIK',
      thName: 'Nama Operator',
      thTenure: 'Masa (Bln)',
      thSkill: 'Skill',
      thGrade: 'Grade (Poin)',
      thAction: 'Aksi',
      noOperators: 'Tidak ada operator ditemukan',
      noDataRegistered: 'Belum ada data operator yang terdaftar di',
      adjustFilter: 'Coba sesuaikan kata kunci pencarian atau filter kategori.',
      gradeStandard: 'Standarisasi Grade / Penilaian Operator (PT. Winners International)',
      addTitle: 'Tambah Operator Baru',
      editTitle: 'Edit Data Operator',
      nikLabel: 'NIK Operator',
      nameLabel: 'Nama Lengkap',
      tenureLabel: 'Masa Kerja (Bulan)',
      dojLabel: 'Date of Joining (DOJ)',
      machinePointsHeader: 'Nilai Poin Mesin (Kolom N Spreadsheet)',
      max3Points: 'Maks. 3 Poin per mesin',
      resignTitle: 'Tandai Operator Resigned',
      resignConfirmPrompt: 'Apakah Anda yakin ingin menandai operator ini sebagai',
      resignWarning: 'Permintaan status Resigned akan dikirimkan langsung ke backend Google Apps Script Web App untuk sinkronisasi ke Google Sheets PT. Winners International.',
      sendingToSheets: 'Mengirim ke Sheets...',
      confirmResign: 'Konfirmasi Resign',
      editTooltip: 'Edit Data Operator',
      resignTooltip: 'Tandai Operator Resign (Kirim ke Google Sheets)',
    },
    skillMatrix: {
      filterGradeLabel: 'Filter Grade:',
      allGrades: 'Semua',
      pointLegendTitle: 'Sistem Poin IE:',
      searchPlaceholder: 'Cari Operator (Nama atau NIK)...',
      allMachines: 'Semua Mesin',
      multiSkillOnly: 'Hanya Multi-skill (≥2 Mesin)',
      exportCsv: 'Unduh CSV',
      addOperator: 'Tambah Operator',
      colNo: 'No',
      colNik: 'NIK',
      colName: 'Nama Operator',
      colTenure: 'Masa Kerja (Bulan)',
      colMultiSkill: 'Multi-Skill',
      colTotalPoints: 'Total Poin',
      colGrade: 'Grade',
      colActions: 'Aksi',
      actionEdit: 'Edit Data',
      actionDetail: 'Lihat Detail',
      actionResign: 'Tandai Resigned',
      noData: 'Tidak ada data operator yang cocok.',
      noDataDesc: 'Coba ubah kata kunci pencarian atau reset filter di atas.',
      resignModalTitle: 'Konfirmasi Operator Resign',
      resignWarningText: 'Operator yang ditandai resign tidak akan ditampilkan pada lini aktif untuk periode bulan setelah tanggal pengunduran diri.',
      resignConfirmPrompt: 'Apakah Anda yakin ingin memperbarui status operator berikut menjadi RESIGNED?',
      resignCancelBtn: 'Batalkan',
      resignConfirmBtn: 'Ya, Tandai Resigned',
      resignProcessing: 'Menyimpan status ke Cloud...',
      resignSuccessToast: 'Status RESIGNED berhasil disimpan dan diperbarui!',
      resignErrorToast: 'Gagal memperbarui status resigned operator di Google Sheets.',
      modalAddTitle: 'Tambah Operator Baru',
      modalEditTitle: 'Edit Data Kompetensi Operator',
      fieldNik: 'Nomor Induk Karyawan (NIK)',
      fieldName: 'Nama Lengkap Operator',
      fieldDoj: 'Tanggal Masuk (D.O.J)',
      fieldTenure: 'Masa Kerja (Bulan)',
      fieldFactory: 'Pabrik',
      fieldLine: 'Lini Jahit',
      fieldStatus: 'Status Karyawan',
      sectionMachinePoints: 'Poin Kompetensi Per Kategori Mesin (0 - 3 Poin)',
      sectionMachinePointsDesc: '0 = Belum Menguasai (0%), 1 = 1-60%, 2 = 61-89%, 3 = >90%',
      saveOperatorBtn: 'Simpan Perubahan',
      modalDetailTitle: 'Profil Kompetensi Operator',
      detailSummary: 'Ringkasan Kinerja & Evaluasi IE',
      detailCompetencies: 'Daftar Penguasaan Mesin Jahit',
      detailRadarTitle: 'Distribusi Kemampuan Multi-Mesin',
    },
    lineBalancing: {
      selectStyle: 'Pilih Style Garment (Standard Production):',
      positionsCount: 'Posisi',
      targetPcsHour: 'Target Output (Pcs/Jam):',
      aiAutoBalanceBtn: 'AI Auto-Balancing',
      aiAnalyzing: 'Gemini Menganalisis...',
      pitchTime: 'Pitch Time',
      lineEfficiency: 'Line Efficiency',
      balanceDelay: 'Balance Delay',
      bottleneckCycle: 'Bottleneck Cycle',
      smoothnessIndex: 'Smoothness Index',
      projectedOutput: 'Proyeksi Output',
      pitchFormula: '3600 detik / Target Output',
      leanTarget: 'Target LEAN ≥ 75%',
      balanceDelayFormula: '100% - Line Efficiency',
      criticalStation: 'Stasiun Kritis',
      lowerIsSmoother: 'Makin rendah makin rata',
      pcsPerDay: 'pcs/hari',
      pcsPerHour: 'pcs/jam',
      seconds: 'detik',
      aiKaizenTitle: 'Analisis & Rekomendasi Alokasi Industrial Engineer (Gemini 3.7 Flash)',
      aiKaizenBadge: 'AI Powered Kaizen',
      workstationTitle: 'Alokasi Stasiun Kerja & Operator',
      stationsCountLabel: 'Stasiun',
      tabList: 'Daftar Stasiun',
      tabLayout: 'Visual Layout',
      tabYamazumi: 'Yamazumi Chart',
      colWorkstation: 'Stasiun Kerja',
      colProcess: 'Proses / Operasi',
      colMachine: 'Jenis Mesin',
      colSmv: 'SMV (detik)',
      colCycleTime: 'Cycle Time',
      colOperator: 'Operator Penugasan',
      colLoading: 'Beban (%)',
      colStatus: 'Kondisi Lini',
      statusBottleneck: 'Bottleneck Lini',
      statusNormal: 'Seimbang',
      statusStar: 'Kapasitas Cadangan',
      unassignedOperator: 'Belum ada operator teralokasi',
      bottleneckNotice: 'Bottleneck',
      backupRecommendation: 'Rekomendasi Helper/Backup:',
      yamazumiTitle: 'Yamazumi Cycle Time Balancing Graph (Detik / Stasiun)',
      yamazumiSubtitle: 'Garis penanda vertikal tebal menunjukkan Pitch Time. Balok yang melampaui garis merupakan stasiun bottleneck.',
      balancedLegend: 'Balanced (Cycle ≤ Pitch)',
      bottleneckLegend: 'Bottleneck (Cycle > Pitch)',
      targetPitchLegend: 'Target Pitch Time',
      totalSamLabel: 'Total SAM:',
      visualLayoutTitle: 'Visual Sewing Floor Layout (U-Shape Modular Assembly)',
      visualLayoutSubtitle: 'Arah pergerakan bundle material dari Posisi 1 hingga Finishing.',
      aiRecommendationTitle: 'Analisis & Rekomendasi Alokasi Industrial Engineer (Gemini 3.7 Flash)',
    },
    multiSkill: {
      headerTitle: 'Kesiapan Populasi Operator per Kategori Mesin',
      headerSubtitle: 'Analisis fleksibilitas line saat ada absensi atau rebalancing cepat.',
      selectOperator: 'Pilih Operator:',
      targetMachine: 'Target Mesin Baru yang Hendak Dipelajari:',
      generatePlanBtn: 'Buat Roadmap Pelatihan AI',
      generatingPlan: 'Merancang Kurikulum IE...',
      machineCoverageTitle: 'Kesiapan Populasi Operator per Kategori Mesin',
      machineCoverageSubtitle: 'Analisis fleksibilitas line saat ada absensi atau rebalancing cepat.',
      coverageStatusSafe: 'Aman',
      coverageStatusCritical: 'Kritis (Perlu Training)',
      coverageStatusModerate: 'Cukup',
      operatorUnit: 'Op',
      plannerTitle: 'AI Multi-Skill Development Planner',
      plannerSubtitle: 'Pilih operator untuk dibuatkan roadmap pelatihan mesin baru secara terstruktur.',
      selectOperatorLabel: 'Pilih Operator:',
      noOperatorsInLine: 'Tidak ada operator di line ini',
      operatorTenure: 'Masa',
      currentSkillsLabel: 'Keahlian Saat Ini:',
      targetMachineLabel: 'Target Mesin Baru yang Hendak Dipelajari:',
      curriculumTitle: 'Rencana Kurikulum Pelatihan & Target Milestone',
      curriculumActive: 'Kurikulum Aktif',
      designingModule: 'Sedang Merancang Modul IE Training...',
      designingModuleSub: 'Menyesuaikan kurikulum dengan background skill operator dan standar MOST/GSD.',
      noRoadmapTitle: 'Belum Ada Roadmap Pelatihan Terpilih',
      noRoadmapDesc: 'Pilih operator dan mesin target di panel sebelah kiri, lalu klik "Buat Roadmap Pelatihan AI" untuk menyusun modul pelatihan bertahap.',
      skillGapTitle: 'Analisis Kesenjangan Keterampilan',
      skillGapSubtitle: 'Perbandingan penguasaan mesin operator terhadap kebutuhan fleksibilitas lini.',
      aiPlanResultTitle: 'Rencana Pelatihan Silang Terstruktur (IE Curriculum)',
      aiPlanPlaceholder: 'Pilih operator dan mesin target, lalu klik tombol di atas untuk membuat modul pelatihan komprehensif.',
      currentMatrixPoints: 'Poin Saat Ini',
      trainingCandidatesTitle: 'Kandidat Pelatihan Prioritas',
    },
    ieChat: {
      headerTitle: 'IE Garment Specialist AI',
      headerSubtitle: 'Konsultan Cerdas Line Balancing, SAM & Kaizen Sewing Floor',
      specialistTitle: 'IE Garment Specialist AI',
      specialistSubtitle: 'Konsultan Cerdas Line Balancing, SAM & Kaizen Sewing Floor',
      expertBadge: 'PT. Winners Expert',
      statusReady: 'Siap Membantu Lini',
      clearChat: 'Bersihkan Percakapan',
      clearChatTooltip: 'Bersihkan Percakapan',
      quick1: 'Analisis bottleneck terbesar pada line ini dan rekomendasi solusinya',
      quick2: 'Bagaimana cara menaikkan Line Efficiency menjadi di atas 80%?',
      quick3: 'Siapa operator yang paling siap untuk di-cross-train ke mesin Flatseam?',
      quick4: 'Jelaskan rumus Pitch Time dan Balance Delay menurut standar GSD IE',
      inputPlaceholder: 'Tanyakan analisis line balancing, rumus SMV, atau kendala sewing...',
      sendBtn: 'Kirim',
      thinking: 'IE Assistant sedang menganalisis data lantai produksi...',
      defaultWelcome: 'Halo! Saya adalah **AI Asisten Industrial Engineering (IE) Garment** spesialis PT. Winners International.\n\nSaya siap membantu Anda dengan:\n- **Analisis Bottleneck & Line Balancing** untuk lini jahit\n- **Perhitungan SMV, SAM, Pitch Time, dan Line Efficiency** (GSD / MOST Standard)\n- **Rekomendasi Mutasi & Rebalancing Operator** berdasarkan keahlian Skill Matrix\n- **Metode Kaizen Gerakan Kerja (Motion Economy)** dan setting layout sewing.\n\nSilakan pilih pertanyaan rekomendasi di bawah atau ketik pertanyaan teknis Anda!',
      serverError: 'Maaf, terjadi kendala sesaat pada server AI. Silakan ulangi pertanyaan Anda.',
      abortError: 'Respon memerlukan waktu lebih lama karena beban sistem. Silakan ulangi pertanyaan Anda atau pilih salah satu rekomendasi pertanyaan di bawah.',
      clearedMessage: 'Riwayat chat telah dibersihkan. Ada yang ingin Anda konsultasikan terkait Industrial Engineering garment?',
      analyzingProduction: 'IE Assistant sedang menganalisis data lantai produksi...',
      suggestionsLabel: 'Saran:',
    },
    googleSheets: {
      headerTitle: 'Google Sheets Live Connection',
      headerSubtitle: 'Sinkronisasi data mentah Skill Matrix dan Master Style dari Google Spreadsheet PT. Winners International.',
      openInSheets: 'Buka di Google Sheets',
      syncStatusTitle: 'Status Koneksi Spreadsheet',
      syncStatusLive: 'Terhubung & Aktif',
      syncStatusSyncing: 'Menghubungkan...',
      syncStatusIdle: 'Terkoneksi Standby',
      lastSyncedLabel: 'Terakhir sinkronisasi:',
      syncNowBtn: 'Tarik Data Baru',
      webAppUrlLabel: 'URL Web App Google Apps Script (GAS):',
      openSheetBtn: 'Buka di Google Sheets',
      syncLogsTitle: 'Riwayat Aktivitas Sinkronisasi',
      logTime: 'Waktu',
      logStatus: 'Status',
      logRows: 'Jumlah Baris',
      logUser: 'Pengguna / Role',
      logDetails: 'Keterangan',
      guideTitle: 'Panduan Integrasi Spreadsheet',
      guide1: 'Pastikan Google Apps Script telah di-deploy sebagai Web App dengan hak akses "Anyone".',
      guide2: 'Format tab wajib memiliki sheet bernama "by_worker" dengan kolom NIK, Nama, Mesin, dan POIN.',
      guide3: 'Perubahan status resign dari dashboard otomatis tercatat pada kolom Date of Resign di spreadsheet.',
      connectedStatus: 'Status: Terhubung & Aktif (.env Configured)',
      spreadsheetIdLabel: 'ID Spreadsheet:',
      targetUrlLabel: 'Google Sheet URL Target:',
      pullDataBtn: 'Tarik Data Baru',
      pullingData: 'Menghubungkan...',
      pullSuccessToast: 'Berhasil menarik dan mengagregasikan data operator dari tab by_worker Google Sheets!',
      pullSuccessSpreadsheet: 'Berhasil tersambung ke spreadsheet!',
      pullSuccessGeneric: 'Data Operator tersinkronisasi!',
      apiInfoTitle: 'Info Akses Google Sheets API:',
      apiInfoHint: 'Pastikan Spreadsheet diset ke "Anyone with the link can view" atau kredensial API Key memiliki izin akses.',
      rbacTitle: 'Pengaturan Hak Akses Edit & Review (RBAC):',
      thUserLevel: 'Level Pengguna',
      thAppAccess: 'Akses Aplikasi',
      thYourStatus: 'Status Anda',
      viewerTitle: 'Viewer (GM / Factory Mgr)',
      viewerAccess: 'Lihat Matrix, Ekspor CSV, Pantau Yamazumi & AI Consultant',
      editorTitle: 'Editor (IE Staff / Leader)',
      editorAccess: 'Input Skill Rate, Ubah Nilai SMV, Tambah Data Operator Baru',
      adminTitle: 'Admin (Head of IE & IT)',
      adminAccess: 'Full Control: Hapus Data, Setting Master Garment Style, Cloud Sync',
      activeNow: 'Aktif Saat Ini',
      totalRecordsLabel: 'Total Rekor:',
    },
    app: {
      footerRights: 'PT. Winners International © 2026 — Industrial Engineering & Lean Manufacturing System',
      footerStandard: 'GSD & MOST Standard Compliance',
      retryBtn: 'Coba Lagi',
    },
    months: {
      1: 'Januari',
      2: 'Februari',
      3: 'Maret',
      4: 'April',
      5: 'Mei',
      6: 'Juni',
      7: 'Juli',
      8: 'Agustus',
      9: 'September',
      10: 'Oktober',
      11: 'November',
      12: 'Desember',
    },
  },
  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      detail: 'Details',
      close: 'Close',
      filter: 'Filter',
      search: 'Search',
      refresh: 'Refresh',
      sync: 'Sync',
      syncing: 'Syncing...',
      error: 'An Error Occurred',
      success: 'Success',
      loading: 'Loading...',
      warning: 'Warning',
      actions: 'Actions',
      status: 'Status',
      active: 'Active',
      resigned: 'Resigned',
      personnel: 'Personnel',
      points: 'Points',
      target: 'Target',
      all: 'All',
      seconds: 'seconds',
      months: 'months',
      hours: 'hours',
      retry: 'Retry',
      yes: 'Yes',
      no: 'No',
      none: 'None',
    },
    header: {
      companyName: 'PT. Winners International',
      systemSubtitle: 'Sewing Skill Matrix & Automated Line Balancing',
      liveBadge: 'Google Sheets Live',
      mockBadge: 'Local Dataset',
      factory: 'Factory',
      line: 'Line',
      period: 'Period:',
      role: 'Role:',
      roleViewer: 'Viewer (GM/Manager)',
      roleEditor: 'Editor (IE Staff)',
      roleAdmin: 'Admin (Full Access)',
      syncTooltip: 'Resync from Google Sheets',
      language: 'Language',
      indonesian: 'Indonesian',
      english: 'English',
    },
    sidebar: {
      brandTitle: 'PT. Winners',
      brandSubtitle: 'IE & Lean System',
      activeLine: 'Active Line',
      activeOpsLabel: 'Active Operators',
      totalPopLabel: 'Total Population',
      navMatrix: 'Skill Matrix',
      navMatrixSub: 'Operators & Competencies',
      navBalancing: 'AI Line Balancing',
      navBalancingSub: 'Yamazumi & Cycle Time',
      navTraining: 'Multi-Skill Matrix',
      navTrainingSub: 'Retraining & Cross-Skill',
      navChat: 'IE Specialist AI',
      navChatSub: 'Garment Consultant',
      navSheets: 'Google Sheets Live',
      navSheetsSub: '2-Way Cloud Sync',
      quickStats: 'IE Summary',
      targetIELabel: 'Line IE Target',
      rebalanceReadyLabel: 'Rebalance Readiness',
      footerVersion: 'Winners IE System v2.4',
    },
    metrics: {
      totalOperators: 'Total Line Operators',
      readyToWork: '100% Ready to Work',
      avgLineGrade: 'AVERAGE LINE OPERATOR GRADE',
      targetIE: 'IE Target',
      multiSkillTitle: 'Multi-Skill (≥2 Machines)',
      multiSkillSubtitle: 'Rebalancing Readiness',
      ofPopulation: 'of population',
      rebalancingReadiness: 'Rebalancing Readiness',
      pointSystemTitle: 'Operator Point Rating System (IE Efficiency Standards)',
      pointSystemBadge: 'IE Benchmark',
      pointSystemSubtitle: 'Standard conversion of actual work efficiency into operator points for each sewing machine category (Lockstitch, Overlock, Flatseam, Special).',
      hideDetails: 'Hide',
      showDetails: 'Show Details',
      p0Points: '0 Points',
      p0Eff: 'Eff 0%',
      p0Title: 'Unqualified / Inactive',
      p0Desc: 'Has not met standard cycle time (SMV) or has not been operated on this machine category.',
      p0Limit: 'Efficiency Threshold: 0%',
      p1Points: '1 Point',
      p1Eff: 'Eff 1 – 60%',
      p1Title: 'Learning Stage (Novice)',
      p1Desc: 'Able to sew basic seams with supervision, cycle time is still above standard SMV.',
      p1Limit: 'Efficiency Threshold: 1 – 60%',
      p2Points: '2 Points',
      p2Eff: 'Eff 61 – 89%',
      p2Title: 'Production Standard (Competent)',
      p2Desc: 'Meets independent daily output pace with low and stable defect rates (DHU).',
      p2Limit: 'Efficiency Threshold: 61 – 89%',
      p3Points: '3 Points',
      p3Eff: 'Eff > 90%',
      p3Title: 'Expert / Master (Star)',
      p3Desc: 'High speed exceeding target SMV, consistently precise, prime candidate for floater and trainer.',
      p3Limit: 'Efficiency Threshold: > 90%',
    },
    matrix: {
      resignSuccess: 'RESIGNED status successfully sent to Google Sheets for',
      resignFailed: 'Failed to update resigned operator status in Google Sheets.',
      gradeFilter: 'Filter Grade',
      legendTitle: 'IE Point System:',
      searchPlaceholder: 'Search Operator (Name or Worker ID)...',
      multiSkillOnly: 'Multi-Skill Only',
      exportCSV: 'Export CSV',
      addOperator: 'Add Operator',
      category: 'Category',
      allMachines: 'All Machines',
      showing: 'Showing',
      of: 'of',
      operatorsLabel: 'Operators',
      thNo: 'No',
      thNik: 'NIK',
      thName: 'Operator Name',
      thTenure: 'Tenure (Mo)',
      thSkill: 'Skill',
      thGrade: 'Grade (Points)',
      thAction: 'Action',
      noOperators: 'No operators found',
      noDataRegistered: 'No operator data registered in',
      adjustFilter: 'Try adjusting your search keyword or category filter.',
      gradeStandard: 'Operator Grade / Evaluation Standardization (PT. Winners International)',
      addTitle: 'Add New Operator',
      editTitle: 'Edit Operator Data',
      nikLabel: 'Operator NIK',
      nameLabel: 'Full Name',
      tenureLabel: 'Work Period (Months)',
      dojLabel: 'Date of Joining (DOJ)',
      machinePointsHeader: 'Machine Points Rating (Spreadsheet Column N)',
      max3Points: 'Max. 3 Points per machine',
      resignTitle: 'Mark Operator as Resigned',
      resignConfirmPrompt: 'Are you sure you want to mark this operator as',
      resignWarning: 'Resigned status request will be sent directly to the Google Apps Script Web App backend for synchronization to PT. Winners International Google Sheets.',
      sendingToSheets: 'Sending to Sheets...',
      confirmResign: 'Confirm Resignation',
      editTooltip: 'Edit Operator Data',
      resignTooltip: 'Mark Operator Resigned (Send to Google Sheets)',
    },
    skillMatrix: {
      filterGradeLabel: 'Filter Grade:',
      allGrades: 'All',
      pointLegendTitle: 'IE Point System:',
      searchPlaceholder: 'Search Operator (Name or Worker ID)...',
      allMachines: 'All Machines',
      multiSkillOnly: 'Multi-Skill Only (≥2 Machines)',
      exportCsv: 'Export CSV',
      addOperator: 'Add Operator',
      colNo: 'No',
      colNik: 'Worker ID',
      colName: 'Operator Name',
      colTenure: 'Tenure (Months)',
      colMultiSkill: 'Multi-Skill',
      colTotalPoints: 'Total Points',
      colGrade: 'Grade',
      colActions: 'Actions',
      actionEdit: 'Edit Data',
      actionDetail: 'View Details',
      actionResign: 'Mark Resigned',
      noData: 'No matching operators found.',
      noDataDesc: 'Try adjusting your search keywords or reset the filter above.',
      resignModalTitle: 'Confirm Operator Resignation',
      resignWarningText: 'Operators marked as resigned will not appear in the active line for periods following their resignation date.',
      resignConfirmPrompt: 'Are you sure you want to update the following operator status to RESIGNED?',
      resignCancelBtn: 'Cancel',
      resignConfirmBtn: 'Yes, Mark Resigned',
      resignProcessing: 'Saving status to Cloud...',
      resignSuccessToast: 'RESIGNED status successfully saved and updated!',
      resignErrorToast: 'Failed to update operator resigned status in Google Sheets.',
      modalAddTitle: 'Add New Operator',
      modalEditTitle: 'Edit Operator Competency Data',
      fieldNik: 'Worker ID (NIK)',
      fieldName: 'Full Operator Name',
      fieldDoj: 'Date of Join (D.O.J)',
      fieldTenure: 'Work Tenure (Months)',
      fieldFactory: 'Factory',
      fieldLine: 'Sewing Line',
      fieldStatus: 'Employee Status',
      sectionMachinePoints: 'Competency Points per Machine Category (0 - 3 Points)',
      sectionMachinePointsDesc: '0 = Unqualified (0%), 1 = 1-60%, 2 = 61-89%, 3 = >90%',
      saveOperatorBtn: 'Save Changes',
      modalDetailTitle: 'Operator Competency Profile',
      detailSummary: 'IE Performance & Assessment Summary',
      detailCompetencies: 'Sewing Machine Proficiency Matrix',
      detailRadarTitle: 'Multi-Machine Competency Distribution',
    },
    lineBalancing: {
      selectStyle: 'Select Garment Style (Standard Production):',
      positionsCount: 'Stations',
      targetPcsHour: 'Target Output (Pcs/Hour):',
      aiAutoBalanceBtn: 'AI Auto-Balancing',
      aiAnalyzing: 'Gemini Analyzing...',
      pitchTime: 'Pitch Time',
      lineEfficiency: 'Line Efficiency',
      balanceDelay: 'Balance Delay',
      bottleneckCycle: 'Bottleneck Cycle',
      smoothnessIndex: 'Smoothness Index',
      projectedOutput: 'Projected Output',
      pitchFormula: '3600 seconds / Target Output',
      leanTarget: 'LEAN Target ≥ 75%',
      balanceDelayFormula: '100% - Line Efficiency',
      criticalStation: 'Critical Station',
      lowerIsSmoother: 'Lower is smoother',
      pcsPerDay: 'pcs/day',
      pcsPerHour: 'pcs/hr',
      seconds: 'seconds',
      aiKaizenTitle: 'Industrial Engineer Allocation Analysis & Recommendations (Gemini 3.7 Flash)',
      aiKaizenBadge: 'AI Powered Kaizen',
      workstationTitle: 'Workstation & Operator Allocation',
      stationsCountLabel: 'Stations',
      tabList: 'Station List',
      tabLayout: 'Visual Layout',
      tabYamazumi: 'Yamazumi Chart',
      colWorkstation: 'Workstation',
      colProcess: 'Process / Operation',
      colMachine: 'Machine Type',
      colSmv: 'SMV (seconds)',
      colCycleTime: 'Cycle Time',
      colOperator: 'Assigned Operator',
      colLoading: 'Workload (%)',
      colStatus: 'Line Condition',
      statusBottleneck: 'Line Bottleneck',
      statusNormal: 'Balanced',
      statusStar: 'Buffer Capacity',
      unassignedOperator: 'No operator assigned yet',
      bottleneckNotice: 'Bottleneck',
      backupRecommendation: 'Helper/Backup Recommendation:',
      yamazumiTitle: 'Yamazumi Cycle Time Balancing Graph (Seconds / Station)',
      yamazumiSubtitle: 'The bold vertical line indicates Pitch Time. Bars exceeding this mark represent bottleneck stations.',
      balancedLegend: 'Balanced (Cycle ≤ Pitch)',
      bottleneckLegend: 'Bottleneck (Cycle > Pitch)',
      targetPitchLegend: 'Target Pitch Time',
      totalSamLabel: 'Total SAM:',
      visualLayoutTitle: 'Visual Sewing Floor Layout (U-Shape Modular Assembly)',
      visualLayoutSubtitle: 'Material bundle flow direction from Station 1 to Finishing.',
      aiRecommendationTitle: 'Industrial Engineer Allocation Analysis & Recommendations (Gemini 3.7 Flash)',
    },
    multiSkill: {
      headerTitle: 'Operator Population Readiness by Machine Category',
      headerSubtitle: 'Line flexibility analysis during absenteeism or rapid rebalancing.',
      selectOperator: 'Select Operator:',
      targetMachine: 'Target New Machine to Learn:',
      generatePlanBtn: 'Create AI Training Roadmap',
      generatingPlan: 'Designing IE Curriculum...',
      machineCoverageTitle: 'Operator Population Readiness by Machine Category',
      machineCoverageSubtitle: 'Line flexibility analysis during absenteeism or rapid rebalancing.',
      coverageStatusSafe: 'Safe',
      coverageStatusCritical: 'Critical (Training Needed)',
      coverageStatusModerate: 'Adequate',
      operatorUnit: 'Op',
      plannerTitle: 'AI Multi-Skill Development Planner',
      plannerSubtitle: 'Select an operator to generate a structured training roadmap for a new machine.',
      selectOperatorLabel: 'Select Operator:',
      noOperatorsInLine: 'No operators in this line',
      operatorTenure: 'Tenure',
      currentSkillsLabel: 'Current Skills:',
      targetMachineLabel: 'Target New Machine to Learn:',
      curriculumTitle: 'Training Curriculum Plan & Milestone Targets',
      curriculumActive: 'Active Curriculum',
      designingModule: 'Designing IE Training Module...',
      designingModuleSub: 'Tailoring curriculum to operator skill background and MOST/GSD standards.',
      noRoadmapTitle: 'No Training Roadmap Selected',
      noRoadmapDesc: 'Select an operator and target machine on the left panel, then click "Create AI Training Roadmap" to compile phased training modules.',
      skillGapTitle: 'Skill Gap Analysis',
      skillGapSubtitle: 'Comparison of operator machine proficiencies against line flexibility needs.',
      aiPlanResultTitle: 'Structured Cross-Training Curriculum (IE Standard)',
      aiPlanPlaceholder: 'Select an operator and target machine, then click the button above to generate a comprehensive training module.',
      currentMatrixPoints: 'Current Points',
      trainingCandidatesTitle: 'Priority Training Candidates',
    },
    ieChat: {
      headerTitle: 'IE Garment Specialist AI',
      headerSubtitle: 'Smart Consultant for Line Balancing, SAM & Sewing Floor Kaizen',
      specialistTitle: 'IE Garment Specialist AI',
      specialistSubtitle: 'Smart Consultant for Line Balancing, SAM & Sewing Floor Kaizen',
      expertBadge: 'PT. Winners Expert',
      statusReady: 'Ready to Assist Line',
      clearChat: 'Clear Conversation',
      clearChatTooltip: 'Clear Conversation',
      quick1: 'Analyze the biggest bottleneck on this line and recommend solutions',
      quick2: 'How can we increase Line Efficiency from 68% to above 80%?',
      quick3: 'Which operator is most ready to be cross-trained to a Flatseam machine?',
      quick4: 'Explain Pitch Time and Balance Delay formulas according to GSD IE standards',
      inputPlaceholder: 'Ask about line balancing analysis, SMV formulas, or sewing issues...',
      sendBtn: 'Send',
      thinking: 'IE Assistant is analyzing shop floor data...',
      defaultWelcome: 'Hello! I am your AI Industrial Engineering (IE) Garment Specialist at PT. Winners International.\n\nI am ready to help you with:\n- **Bottleneck & Line Balancing Analysis** for sewing lines\n- **SMV, SAM, Pitch Time, and Line Efficiency Calculations** (GSD / MOST Standard)\n- **Operator Allocation & Rebalancing Recommendations** based on the Skill Matrix\n- **Motion Economy Kaizen** and sewing layout configurations.\n\nPlease select one of the suggested questions below or type your technical inquiry!',
      serverError: 'Sorry, a momentary issue occurred on the AI server. Please try asking your question again.',
      abortError: 'Response took longer than expected due to server load. Please try again or pick one of the recommended prompts below.',
      clearedMessage: 'Chat history cleared. What would you like to consult regarding garment Industrial Engineering?',
      analyzingProduction: 'IE Assistant is analyzing shop floor production data...',
      suggestionsLabel: 'Suggestions:',
    },
    googleSheets: {
      headerTitle: 'Google Sheets Live Connection',
      headerSubtitle: 'Raw Skill Matrix and Master Style synchronization from PT. Winners International Google Spreadsheet.',
      openInSheets: 'Open in Google Sheets',
      syncStatusTitle: 'Spreadsheet Connection Status',
      syncStatusLive: 'Connected & Active',
      syncStatusSyncing: 'Connecting...',
      syncStatusIdle: 'Standby Connected',
      lastSyncedLabel: 'Last Synchronized:',
      syncNowBtn: 'Fetch Latest Data',
      webAppUrlLabel: 'Google Apps Script (GAS) Web App URL:',
      openSheetBtn: 'Open in Google Sheets',
      syncLogsTitle: 'Synchronization Activity Logs',
      logTime: 'Time',
      logStatus: 'Status',
      logRows: 'Row Count',
      logUser: 'User / Role',
      logDetails: 'Details',
      guideTitle: 'Spreadsheet Integration Guide',
      guide1: 'Ensure Google Apps Script is deployed as a Web App with access set to "Anyone".',
      guide2: 'The sheet must contain a tab named "by_worker" with columns for Worker ID, Name, Machine, and POIN.',
      guide3: 'Resignation updates from the dashboard are automatically recorded in the Date of Resign column.',
      connectedStatus: 'Status: Connected & Active (.env Configured)',
      spreadsheetIdLabel: 'Spreadsheet ID:',
      targetUrlLabel: 'Target Google Sheet URL:',
      pullDataBtn: 'Fetch Latest Data',
      pullingData: 'Connecting...',
      pullSuccessToast: 'Successfully fetched and aggregated operator data from the by_worker Google Sheets tab!',
      pullSuccessSpreadsheet: 'Successfully connected to spreadsheet!',
      pullSuccessGeneric: 'Operator data synchronized!',
      apiInfoTitle: 'Google Sheets API Access Info:',
      apiInfoHint: 'Ensure the spreadsheet is set to "Anyone with the link can view" or the API Key has access permissions.',
      rbacTitle: 'Edit & Review Access Permissions (RBAC):',
      thUserLevel: 'User Level',
      thAppAccess: 'App Access',
      thYourStatus: 'Your Status',
      viewerTitle: 'Viewer (GM / Factory Mgr)',
      viewerAccess: 'View Matrix, Export CSV, Monitor Yamazumi & AI Consultant',
      editorTitle: 'Editor (IE Staff / Leader)',
      editorAccess: 'Input Skill Rates, Update SMV, Add New Operator Records',
      adminTitle: 'Admin (Head of IE & IT)',
      adminAccess: 'Full Control: Delete Data, Configure Garment Master Style, Cloud Sync',
      activeNow: 'Active Now',
      totalRecordsLabel: 'Total Records:',
    },
    app: {
      footerRights: 'PT. Winners International © 2026 — Industrial Engineering & Lean Manufacturing System',
      footerStandard: 'GSD & MOST Standard Compliance',
      retryBtn: 'Retry',
    },
    months: {
      1: 'January',
      2: 'February',
      3: 'March',
      4: 'April',
      5: 'May',
      6: 'June',
      7: 'July',
      8: 'August',
      9: 'September',
      10: 'October',
      11: 'November',
      12: 'December',
    },
  },
};
