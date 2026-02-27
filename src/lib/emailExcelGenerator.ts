import ExcelJS from "exceljs";
import { DrugApproval } from "@/data/fdaData";
import { format, parseISO } from "date-fns";
import { therapeuticAreaEnMap } from "@/data/therapeuticAreaMap";

// 승인유형 영문 매핑
const getApprovalTypeEn = (drug: DrugApproval): string => {
  const isSuppl = isSupplementalApproval(drug);

  if (isSuppl) {
    if (drug.notes?.includes("라벨링") || drug.notes?.includes("Labeling")) {
      return "Supplemental Approval (Labeling)";
    }
    if (drug.notes?.includes("효능") || drug.notes?.includes("Efficacy")) {
      return "Supplemental Approval (Efficacy)";
    }
    return "Supplemental Approval";
  }

  if (drug.isNovelDrug) {
    return "Original Approval (Type 1 - New Molecular Entity)";
  }
  if (drug.isBiosimilar) {
    return "Original Approval (Biosimilar)";
  }
  if (drug.notes?.includes("신규 제형") || drug.notes?.includes("New Dosage Form")) {
    return "Original Approval (Type 3 - New Dosage Form)";
  }
  return "Original Approval";
};

// 변경승인 여부 판단
export const isSupplementalApproval = (drug: DrugApproval): boolean => {
  const notes = drug.notes || "";
  return (
    notes.includes("변경승인") ||
    notes.includes("적응증 추가") ||
    notes.includes("적응증 확대") ||
    notes.includes("보충신청") ||
    notes.includes("라벨링") ||
    notes.includes("Supplemental")
  );
};

// 한글 감지 → 영문 폴백
const ensureEnglish = (value: string, fallback: string) => {
  if (!value) return fallback;
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(value) ? fallback : value;
};

// 데이터 행 색상 적용
const applyRowColor = (row: ExcelJS.Row, drug: DrugApproval, columns: number) => {
  if (drug.isOncology) {
    for (let i = 1; i <= columns; i++) {
      row.getCell(i).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFED7AA" },
      };
    }
  } else if (drug.isBiosimilar) {
    for (let i = 1; i <= columns; i++) {
      row.getCell(i).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFBBF7D0" },
      };
    }
  }
};

// 색상 범례 추가
const addColorLegend = (sheet: ExcelJS.Worksheet, startRow: number) => {
  let rowNum = startRow + 2;

  const legendRow1 = sheet.getRow(rowNum);
  legendRow1.getCell(1).value = "🎨 색상 범례";
  legendRow1.getCell(1).font = { bold: true, size: 10 };
  rowNum++;

  const legendRow2 = sheet.getRow(rowNum);
  legendRow2.getCell(1).value = "🟠 주황색 = 항암제";
  legendRow2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
  legendRow2.getCell(2).value = "🟢 연두색 = 바이오시밀러";
  legendRow2.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } };
  legendRow2.getCell(3).value = "⬜ 색상 없음 = 비항암제";
};

// 영문 요약 생성
const buildEnglishSummary = (drug: DrugApproval, isSuppl: boolean): string => {
  const therapeuticAreaEn = ensureEnglish(
    therapeuticAreaEnMap[drug.therapeuticArea] || drug.therapeuticArea,
    "Unmapped Therapeutic Area"
  );
  const indication = ensureEnglish(
    therapeuticAreaEn.split(" - ")[1] || therapeuticAreaEn,
    "unmapped indication"
  );

  if (drug.isNovelDrug) {
    let summary = `Novel drug (${drug.activeIngredient}) approved for ${indication.toLowerCase()}.`;
    if (drug.isOrphanDrug) summary += " Designated as Orphan Drug.";
    return summary;
  }
  if (drug.isBiosimilar) {
    const prefix = isSuppl ? "Supplemental approval for" : "Biosimilar";
    return `${prefix} (${drug.activeIngredient}) ${isSuppl ? "biosimilar " : ""}for ${indication.toLowerCase()}.`;
  }
  if (isSuppl) {
    return `Supplemental approval for ${drug.activeIngredient} for ${indication.toLowerCase()}.`;
  }
  return `${drug.activeIngredient} approved for ${indication.toLowerCase()}.`;
};

// 통계 계산
export interface DrugStats {
  total: number;
  oncologyCount: number;
  nonOncologyCount: number;
  biosimilarCount: number;
  novelDrugCount: number;
  orphanDrugCount: number;
  blaCount: number;
  ndaCount: number;
}

export function computeDrugStats(data: DrugApproval[]): DrugStats {
  const total = data.length;
  const oncologyCount = data.filter((d) => d.isOncology).length;
  return {
    total,
    oncologyCount,
    nonOncologyCount: total - oncologyCount,
    biosimilarCount: data.filter((d) => d.isBiosimilar).length,
    novelDrugCount: data.filter((d) => d.isNovelDrug).length,
    orphanDrugCount: data.filter((d) => d.isOrphanDrug).length,
    blaCount: data.filter((d) => d.applicationType === "BLA").length,
    ndaCount: data.filter((d) => d.applicationType === "NDA").length,
  };
}

// 엑셀 워크북 생성 (5개 시트)
async function generateExcelWorkbook(exportData: DrugApproval[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FDA Drug Approval Dashboard";
  workbook.created = new Date();

  const stats = computeDrugStats(exportData);

  // ===== Sheet 1: 요약 =====
  const summarySheet = workbook.addWorksheet("요약");
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 55;
  summarySheet.getColumn(3).width = 10;

  let rowNum = 1;

  const titleRow = summarySheet.getRow(rowNum);
  titleRow.getCell(1).value = "☑ US FDA 전문의약품 승인 현황";
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF4338CA" } };
  summarySheet.mergeCells(`A${rowNum}:C${rowNum}`);
  rowNum += 2;

  const dates = exportData.map((d) => parseISO(d.approvalDate)).sort((a, b) => a.getTime() - b.getTime());
  const minDate = format(dates[0], "yyyy-MM-dd");
  const maxDate = format(dates[dates.length - 1], "yyyy-MM-dd");

  summarySheet.getRow(rowNum).getCell(1).value = "📅 대상 기간";
  summarySheet.getRow(rowNum).getCell(2).value = `${minDate} ~ ${maxDate}`;
  rowNum++;
  summarySheet.getRow(rowNum).getCell(1).value = "🗓 데이터 수집일";
  summarySheet.getRow(rowNum).getCell(2).value = format(new Date(), "yyyy-MM-dd");
  rowNum++;
  summarySheet.getRow(rowNum).getCell(1).value = "🌐 데이터 출처";
  summarySheet.getRow(rowNum).getCell(2).value = "FDA Official + Drugs.com + ASCO Post";
  rowNum += 2;

  // 승인 현황
  const statsHeaderRow = summarySheet.getRow(rowNum);
  statsHeaderRow.getCell(1).value = "☑ 승인 현황";
  statsHeaderRow.getCell(1).font = { bold: true, size: 12 };
  rowNum++;

  const tableHeaderRow = summarySheet.getRow(rowNum);
  tableHeaderRow.getCell(1).value = "구분";
  tableHeaderRow.getCell(2).value = "";
  tableHeaderRow.getCell(3).value = "건수";
  tableHeaderRow.font = { bold: true };
  tableHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  rowNum++;

  const statsRows = [
    { label: "전체 승인", value: stats.total },
    { label: "├── 항암제", value: stats.oncologyCount },
    { label: "└── 비항암제", value: stats.nonOncologyCount },
    { label: "", value: "" as string | number },
    { label: "바이오시밀러", value: stats.biosimilarCount },
    { label: "신약 (Novel Drug)", value: stats.novelDrugCount },
    { label: "희귀의약품 (Orphan Drug)", value: stats.orphanDrugCount },
  ];

  statsRows.forEach((stat) => {
    const row = summarySheet.getRow(rowNum);
    row.getCell(1).value = stat.label;
    row.getCell(3).value = stat.value;
    if (stat.label.includes("항암제") || stat.label.includes("비항암제")) {
      row.getCell(3).font = { color: { argb: stat.label.includes("├") ? "FFEA580C" : "FF059669" } };
    } else if (typeof stat.value === "number") {
      row.getCell(3).font = { color: { argb: "FF4338CA" } };
    }
    row.getCell(3).alignment = { horizontal: "right" };
    rowNum++;
  });
  rowNum++;

  // 치료영역별 분포
  const areaHeaderRow = summarySheet.getRow(rowNum);
  areaHeaderRow.getCell(1).value = "📊 치료영역별 분포";
  areaHeaderRow.getCell(1).font = { bold: true, size: 12 };
  rowNum++;

  const areaMap = new Map<string, number>();
  exportData.forEach((drug) => {
    areaMap.set(drug.therapeuticArea, (areaMap.get(drug.therapeuticArea) || 0) + 1);
  });
  const sortedAreas = Array.from(areaMap.entries()).sort((a, b) => b[1] - a[1]);

  sortedAreas.forEach(([area, count]) => {
    const row = summarySheet.getRow(rowNum);
    row.getCell(1).value = `• ${area}`;
    row.getCell(3).value = count;
    row.getCell(3).alignment = { horizontal: "right" };
    rowNum++;
  });
  rowNum++;

  // 승인 약물 목록
  const drugListHeaderRow = summarySheet.getRow(rowNum);
  drugListHeaderRow.getCell(1).value = "💊 승인 약물 목록";
  drugListHeaderRow.getCell(1).font = { bold: true, size: 12 };
  rowNum++;

  const drugTableHeaderRow = summarySheet.getRow(rowNum);
  drugTableHeaderRow.getCell(1).value = "제품명";
  drugTableHeaderRow.getCell(2).value = "치료영역";
  drugTableHeaderRow.font = { bold: true };
  drugTableHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  rowNum++;

  exportData.forEach((drug) => {
    const row = summarySheet.getRow(rowNum);
    row.getCell(1).value = `• ${drug.brandName}`;
    row.getCell(2).value = drug.therapeuticArea;
    if (drug.isOncology) {
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
    } else if (drug.isBiosimilar) {
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } };
    }
    rowNum++;
  });
  rowNum++;

  // 출처
  const sourceHeaderRow = summarySheet.getRow(rowNum);
  sourceHeaderRow.getCell(1).value = "📚 주요 출처";
  sourceHeaderRow.getCell(1).font = { bold: true, size: 12 };
  rowNum++;

  const sources = [
    { name: "FDA Novel Drug Approvals", url: "https://www.fda.gov/drugs/novel-drug-approvals-fda/novel-drug-approvals-2025" },
    { name: "Drugs.com New Approvals", url: "https://www.drugs.com/newdrugs.html" },
    { name: "FDA Drugs@FDA Database", url: "https://www.accessdata.fda.gov/scripts/cder/daf/" },
    { name: "ASCO Post", url: "https://ascopost.com" },
  ];
  sources.forEach((source) => {
    const row = summarySheet.getRow(rowNum);
    row.getCell(1).value = source.name;
    row.getCell(2).value = source.url;
    row.getCell(2).font = { color: { argb: "FF2563EB" } };
    rowNum++;
  });
  rowNum++;

  // 색상 범례
  const legendHeaderRow = summarySheet.getRow(rowNum);
  legendHeaderRow.getCell(1).value = "🎨 색상 범례";
  legendHeaderRow.getCell(1).font = { bold: true, size: 12 };
  rowNum++;

  const lr1 = summarySheet.getRow(rowNum);
  lr1.getCell(1).value = "🟠 주황색";
  lr1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
  lr1.getCell(2).value = "항암제";
  lr1.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
  rowNum++;

  const lr2 = summarySheet.getRow(rowNum);
  lr2.getCell(1).value = "🟢 연두색";
  lr2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } };
  lr2.getCell(2).value = "바이오시밀러";
  lr2.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } };
  rowNum++;

  const lr3 = summarySheet.getRow(rowNum);
  lr3.getCell(1).value = "⬜ 색상 없음";
  lr3.getCell(2).value = "비항암제 (바이오시밀러 제외)";

  // ===== Sheet 2: 국문 상세 =====
  const krSheet = workbook.addWorksheet("국문 상세");
  const krColumns = [
    { header: "승인일", key: "approvalDate", width: 12 },
    { header: "제품명", key: "brandName", width: 14 },
    { header: "성분명", key: "activeIngredient", width: 28 },
    { header: "NDA/BLA 번호", key: "ndaBlaNumber", width: 14 },
    { header: "제약사", key: "sponsor", width: 22 },
    { header: "승인유형", key: "approvalTypeKr", width: 10 },
    { header: "치료영역", key: "therapeuticArea", width: 18 },
    { header: "요약 (국문)", key: "summaryKr", width: 80 },
  ];
  krSheet.columns = krColumns;

  krSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  krSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
  krSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  exportData.forEach((drug) => {
    const approvalTypeKr = drug.notes?.includes("변경승인") ? "변경승인" : "최초승인";
    const summaryKr = drug.indicationFull + (drug.notes ? ` ${drug.notes}` : "");
    const row = krSheet.addRow({
      approvalDate: drug.approvalDate,
      brandName: drug.brandName,
      activeIngredient: drug.activeIngredient,
      ndaBlaNumber: drug.ndaBlaNumber,
      sponsor: drug.sponsor,
      approvalTypeKr,
      therapeuticArea: drug.therapeuticArea,
      summaryKr,
    });
    applyRowColor(row, drug, krColumns.length);
  });

  krSheet.getColumn("summaryKr").alignment = { wrapText: true };
  addColorLegend(krSheet, exportData.length + 1);

  // ===== Sheet 3: English Details =====
  const enSheet = workbook.addWorksheet("English Details");
  const enColumns = [
    { header: "Approval Date", key: "approvalDate", width: 14 },
    { header: "Brand Name", key: "brandName", width: 14 },
    { header: "Active Ingredient", key: "activeIngredient", width: 28 },
    { header: "NDA/BLA Number", key: "ndaBlaNumber", width: 16 },
    { header: "Sponsor", key: "sponsor", width: 22 },
    { header: "Approval Type", key: "approvalTypeEn", width: 45 },
    { header: "Therapeutic Area", key: "therapeuticAreaEn", width: 35 },
    { header: "Summary (English)", key: "summaryEn", width: 90 },
  ];
  enSheet.columns = enColumns;

  enSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  enSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
  enSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  exportData.forEach((drug) => {
    const therapeuticAreaEn = ensureEnglish(
      therapeuticAreaEnMap[drug.therapeuticArea] || drug.therapeuticArea,
      "Unmapped Therapeutic Area"
    );
    const approvalTypeEn = getApprovalTypeEn(drug);
    const summaryEn = buildEnglishSummary(drug, isSupplementalApproval(drug));

    const row = enSheet.addRow({
      approvalDate: drug.approvalDate,
      brandName: drug.brandName,
      activeIngredient: drug.activeIngredient,
      ndaBlaNumber: drug.ndaBlaNumber,
      sponsor: drug.sponsor,
      approvalTypeEn,
      therapeuticAreaEn,
      summaryEn,
    });
    applyRowColor(row, drug, enColumns.length);
  });

  enSheet.getColumn("summaryEn").alignment = { wrapText: true };
  addColorLegend(enSheet, exportData.length + 1);

  // ===== Sheet 4: 최초승인 (ORIG-1) =====
  const origSheet = workbook.addWorksheet("최초승인 (ORIG-1)");
  const origColumns = [
    { header: "승인일", key: "approvalDate", width: 12 },
    { header: "제품명", key: "brandName", width: 14 },
    { header: "성분명", key: "activeIngredient", width: 25 },
    { header: "NDA/BLA 번호", key: "ndaBlaNumber", width: 14 },
    { header: "제약사", key: "sponsor", width: 22 },
    { header: "승인유형", key: "approvalTypeEn", width: 42 },
    { header: "요약 (국문)", key: "summaryKr", width: 70 },
    { header: "Summary (English)", key: "summaryEn", width: 80 },
  ];
  origSheet.columns = origColumns;

  origSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  origSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  origSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  const originalApprovals = exportData.filter((d) => !isSupplementalApproval(d));
  originalApprovals.forEach((drug) => {
    const approvalTypeEn = getApprovalTypeEn(drug);
    const summaryKr = drug.indicationFull + (drug.notes ? ` ${drug.notes}` : "");
    const summaryEn = buildEnglishSummary(drug, false);

    const row = origSheet.addRow({
      approvalDate: drug.approvalDate,
      brandName: drug.brandName,
      activeIngredient: drug.activeIngredient,
      ndaBlaNumber: drug.ndaBlaNumber,
      sponsor: drug.sponsor,
      approvalTypeEn,
      summaryKr,
      summaryEn: summaryEn.trim(),
    });
    applyRowColor(row, drug, origColumns.length);
  });

  origSheet.getColumn("summaryKr").alignment = { wrapText: true };
  origSheet.getColumn("summaryEn").alignment = { wrapText: true };
  addColorLegend(origSheet, originalApprovals.length + 1);

  // ===== Sheet 5: 변경승인 (SUPPL) =====
  const supplSheet = workbook.addWorksheet("변경승인 (SUPPL)");
  const supplColumns = [
    { header: "승인일", key: "approvalDate", width: 12 },
    { header: "제품명", key: "brandName", width: 14 },
    { header: "성분명", key: "activeIngredient", width: 25 },
    { header: "NDA/BLA 번호", key: "ndaBlaNumber", width: 14 },
    { header: "제약사", key: "sponsor", width: 22 },
    { header: "승인유형", key: "approvalTypeEn", width: 32 },
    { header: "요약 (국문)", key: "summaryKr", width: 70 },
    { header: "Summary (English)", key: "summaryEn", width: 80 },
  ];
  supplSheet.columns = supplColumns;

  supplSheet.getRow(1).font = { bold: true, color: { argb: "FF000000" } };
  supplSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBBF24" } };
  supplSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  const supplementalApprovals = exportData.filter((d) => isSupplementalApproval(d));
  supplementalApprovals.forEach((drug) => {
    const approvalTypeEn = getApprovalTypeEn(drug);
    const summaryKr = drug.indicationFull + (drug.notes ? ` ${drug.notes}` : "");
    const summaryEn = buildEnglishSummary(drug, true);

    const row = supplSheet.addRow({
      approvalDate: drug.approvalDate,
      brandName: drug.brandName,
      activeIngredient: drug.activeIngredient,
      ndaBlaNumber: drug.ndaBlaNumber,
      sponsor: drug.sponsor,
      approvalTypeEn,
      summaryKr,
      summaryEn: summaryEn.trim(),
    });
    applyRowColor(row, drug, supplColumns.length);
  });

  supplSheet.getColumn("summaryKr").alignment = { wrapText: true };
  supplSheet.getColumn("summaryEn").alignment = { wrapText: true };
  addColorLegend(supplSheet, supplementalApprovals.length + 1);

  return workbook;
}

// 엑셀 → base64 문자열
export async function generateExcelBase64(exportData: DrugApproval[]): Promise<string> {
  const workbook = await generateExcelWorkbook(exportData);
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
