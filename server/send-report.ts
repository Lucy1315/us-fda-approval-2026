/**
 * FDA 승인 데이터 이메일 발송 스크립트
 * 사용법: npx tsx server/send-report.ts
 */
import { config } from "dotenv";
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const EMAIL_API = `http://localhost:${process.env.EMAIL_PORT || "3001"}`;
const DASHBOARD_URL = process.env.VITE_DASHBOARD_URL || "https://us-fda-approval.lovable.app";

import { therapeuticAreaEnMap } from "../src/data/therapeuticAreaMap";

interface DrugApproval {
  approvalMonth: string;
  approvalDate: string;
  ndaBlaNumber: string;
  applicationNo: string;
  applicationType: string;
  brandName: string;
  activeIngredient: string;
  sponsor: string;
  indicationFull: string;
  therapeuticArea: string;
  isOncology: boolean;
  isBiosimilar: boolean;
  isNovelDrug: boolean;
  isOrphanDrug: boolean;
  isCberProduct?: boolean;
  approvalType: string;
  supplementCategory?: string;
  notes: string;
  fdaUrl?: string;
}

interface DrugStats {
  total: number;
  oncologyCount: number;
  nonOncologyCount: number;
  biosimilarCount: number;
  novelDrugCount: number;
  orphanDrugCount: number;
  blaCount: number;
  ndaCount: number;
}

// ── 헬퍼 함수들 ──

const isSupplementalApproval = (drug: DrugApproval): boolean => {
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

const getApprovalTypeEn = (drug: DrugApproval): string => {
  const isSuppl = isSupplementalApproval(drug);
  if (isSuppl) {
    if (drug.notes?.includes("라벨링") || drug.notes?.includes("Labeling")) return "Supplemental Approval (Labeling)";
    if (drug.notes?.includes("효능") || drug.notes?.includes("Efficacy")) return "Supplemental Approval (Efficacy)";
    return "Supplemental Approval";
  }
  if (drug.isNovelDrug) return "Original Approval (Type 1 - New Molecular Entity)";
  if (drug.isBiosimilar) return "Original Approval (Biosimilar)";
  if (drug.notes?.includes("신규 제형") || drug.notes?.includes("New Dosage Form")) return "Original Approval (Type 3 - New Dosage Form)";
  return "Original Approval";
};

const ensureEnglish = (value: string, fallback: string) => {
  if (!value) return fallback;
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(value) ? fallback : value;
};

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
  if (isSuppl) return `Supplemental approval for ${drug.activeIngredient} for ${indication.toLowerCase()}.`;
  return `${drug.activeIngredient} approved for ${indication.toLowerCase()}.`;
};

// ── 1. Supabase에서 데이터 로드 ──
async function loadCloudData(): Promise<DrugApproval[]> {
  console.log("☁️  Supabase에서 데이터 로드 중...");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/persist-fda-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ action: "load" }),
  });
  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error("클라우드 데이터 로드 실패: " + JSON.stringify(json));
  }
  console.log(`   총 ${json.data.length}건 로드 (v${json.version})`);
  return json.data as DrugApproval[];
}

// ── 2. 날짜 필터링 ──
function filterByDateRange(data: DrugApproval[], start: string, end: string): DrugApproval[] {
  return data.filter((d) => d.approvalDate >= start && d.approvalDate <= end);
}

// ── 3. 통계 계산 ──
function computeStats(data: DrugApproval[]): DrugStats {
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

// ── 4. HTML 요약 생성 (Outlook 호환 테이블 레이아웃) ──
// 폰트 규격: 제목 20px, 부제목 13px, 본문 14px, 테이블데이터 12px, 테이블헤더/통계 11px, 푸터 11px
const FONT = "'Malgun Gothic','맑은 고딕',Dotum,Arial,sans-serif";

function buildSummaryHtml(data: DrugApproval[], stats: DrugStats, period: string): string {
  // 통계 카드 헬퍼
  const statCard = (label: string, value: number, bgColor: string, textColor: string, width: string) => {
    return `<td width="${width}" style="padding:5px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="background:${bgColor};padding:12px 10px;text-align:center;border:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;font-family:${FONT};color:#374151;font-weight:700;">${label}</p>
            <p style="margin:6px 0 0;font-size:22px;font-family:${FONT};font-weight:900;color:${textColor};line-height:1;">${value}<span style="font-size:11px;font-weight:700;color:#6b7280;margin-left:2px;">건</span></p>
          </td>
        </tr>
      </table>
    </td>`;
  };

  // 약물 행 HTML
  const drugRowHtml = (d: DrugApproval, idx: number) => {
    const rowBg = idx % 2 === 0 ? "#ffffff" : "#f1f5f9";
    const leftBorderColor = d.isOncology ? "#f97316" : d.isBiosimilar ? "#10b981" : "#e2e8f0";
    const tags: string[] = [];
    if (d.isOncology) tags.push(`<span style="display:inline-block;padding:1px 5px;font-size:10px;font-family:${FONT};color:#c2410c;background:#fff7ed;border:1px solid #fdba74;margin-left:3px;font-weight:700;">항암제</span>`);
    if (d.isNovelDrug) tags.push(`<span style="display:inline-block;padding:1px 5px;font-size:10px;font-family:${FONT};color:#7c3aed;background:#ede9fe;border:1px solid #c4b5fd;margin-left:3px;font-weight:700;">신약</span>`);
    if (d.isOrphanDrug) tags.push(`<span style="display:inline-block;padding:1px 5px;font-size:10px;font-family:${FONT};color:#d97706;background:#fef3c7;border:1px solid #fcd34d;margin-left:3px;font-weight:700;">희귀</span>`);
    if (d.isBiosimilar) tags.push(`<span style="display:inline-block;padding:1px 5px;font-size:10px;font-family:${FONT};color:#059669;background:#d1fae5;border:1px solid #6ee7b7;margin-left:3px;font-weight:700;">바이오시밀러</span>`);

    const typeLabel = d.notes?.includes("변경승인") ? "변경승인" : "최초승인";
    const typeBg = typeLabel === "최초승인" ? "#ede9fe" : "#dbeafe";
    const typeColor = typeLabel === "최초승인" ? "#7c3aed" : "#2563eb";

    return `<tr style="background:${rowBg};">
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-family:${FONT};color:#1e293b;border-left:4px solid ${leftBorderColor};">${d.approvalDate}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-family:${FONT};font-weight:700;color:#0f172a;">${d.brandName}${tags.join("")}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-family:${FONT};color:#1e293b;">${d.activeIngredient}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-family:${FONT};color:#1e293b;">${d.sponsor}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-family:${FONT};color:#1e293b;">${d.therapeuticArea}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;font-family:${FONT};text-align:center;"><span style="display:inline-block;padding:2px 8px;background:${typeBg};color:${typeColor};font-weight:700;">${typeLabel}</span></td>
    </tr>`;
  };

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;">
<tr><td align="center" style="padding:20px 10px;">

<table cellpadding="0" cellspacing="0" border="0" width="780" style="background-color:#ffffff;border:1px solid #e2e8f0;font-family:${FONT};">

  <!-- 헤더 -->
  <tr>
    <td style="background-color:#4338CA;padding:24px 32px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>
            <h1 style="margin:0;font-size:20px;font-family:${FONT};font-weight:800;color:#ffffff;">US FDA 전문의약품 승인 현황</h1>
            <p style="margin:8px 0 0;font-size:13px;font-family:${FONT};color:#e0e7ff;font-weight:600;">대상 기간: ${period}</p>
          </td>
          <td style="text-align:right;vertical-align:bottom;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${DASHBOARD_URL}" style="height:34px;v-text-anchor:middle;width:140px;" arcsize="10%" stroke="t" strokecolor="#a5b4fc" fillcolor="#5b50d6">
            <w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:12px;font-weight:bold;">대시보드 바로가기</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${DASHBOARD_URL}" target="_blank" style="display:inline-block;padding:8px 18px;background-color:#5b50d6;color:#ffffff;text-decoration:none;font-size:12px;font-family:${FONT};font-weight:700;border:1px solid #a5b4fc;">대시보드 바로가기</a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- 승인 현황 통계 카드 -->
  <tr>
    <td style="padding:24px 24px 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:10px;">
        <tr>
          <td style="font-size:14px;font-family:${FONT};font-weight:800;color:#0f172a;padding-bottom:12px;border-bottom:3px solid #4338CA;">승인 현황 Overview</td>
        </tr>
      </table>

      <!-- 전체 승인 -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:8px;">
        <tr>
          <td style="background-color:#eef2ff;padding:16px 20px;text-align:center;border:2px solid #c7d2fe;">
            <p style="margin:0;font-size:11px;font-family:${FONT};color:#4338CA;font-weight:800;letter-spacing:1px;">TOTAL APPROVALS / 전체 승인</p>
            <p style="margin:8px 0 0;font-size:36px;font-family:${FONT};font-weight:900;color:#4338CA;line-height:1;">${stats.total}<span style="font-size:14px;font-weight:700;color:#818cf8;margin-left:3px;">건</span></p>
          </td>
        </tr>
      </table>

      <!-- 항암제 / 신약 / 희귀의약품 / 바이오시밀러 -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:8px;">
        <tr>
          ${statCard("항암제", stats.oncologyCount, "#fff7ed", "#ea580c", "25%")}
          ${statCard("신약", stats.novelDrugCount, "#f5f3ff", "#7c3aed", "25%")}
          ${statCard("희귀의약품", stats.orphanDrugCount, "#fffbeb", "#d97706", "25%")}
          ${statCard("바이오시밀러", stats.biosimilarCount, "#ecfdf5", "#059669", "25%")}
        </tr>
      </table>

      <!-- BLA / NDA -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:24px;">
        <tr>
          ${statCard("BLA", stats.blaCount, "#eef2ff", "#4338CA", "50%")}
          ${statCard("NDA", stats.ndaCount, "#f0f9ff", "#0284c7", "50%")}
        </tr>
      </table>
    </td>
  </tr>

  <!-- 승인 약물 상세 목록 -->
  <tr>
    <td style="padding:0 24px 24px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
        <tr>
          <td style="font-size:14px;font-family:${FONT};font-weight:800;color:#0f172a;padding-bottom:12px;border-bottom:3px solid #0f172a;">승인 약물 상세 목록 <span style="font-size:12px;font-weight:600;color:#64748b;">(${data.length}건)</span></td>
        </tr>
      </table>

      <!-- 범례 -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:10px 0;">
        <tr>
          <td style="padding:8px 12px;background-color:#f1f5f9;font-size:11px;font-family:${FONT};color:#374151;font-weight:600;">
            <span style="display:inline-block;width:14px;height:10px;margin-right:3px;vertical-align:middle;border-left:4px solid #f97316;"></span><span style="display:inline-block;padding:1px 5px;font-size:10px;color:#c2410c;background:#fff7ed;border:1px solid #fdba74;vertical-align:middle;font-weight:700;">항암제</span> &nbsp;&nbsp;
            <span style="display:inline-block;width:14px;height:10px;margin-right:3px;vertical-align:middle;border-left:4px solid #10b981;"></span><span style="display:inline-block;padding:1px 5px;font-size:10px;color:#059669;background:#d1fae5;border:1px solid #6ee7b7;vertical-align:middle;font-weight:700;">바이오시밀러</span> &nbsp;&nbsp;
            <span style="display:inline-block;padding:1px 5px;font-size:10px;color:#7c3aed;background:#ede9fe;border:1px solid #c4b5fd;vertical-align:middle;font-weight:700;">신약</span> &nbsp;
            <span style="display:inline-block;padding:1px 5px;font-size:10px;color:#d97706;background:#fef3c7;border:1px solid #fcd34d;vertical-align:middle;font-weight:700;">희귀</span>
          </td>
        </tr>
      </table>

      <!-- 테이블 -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #cbd5e1;">
        <tr style="background-color:#0f172a;">
          <th style="padding:8px 10px;font-size:11px;font-family:${FONT};font-weight:700;color:#ffffff;text-align:left;border:1px solid #334155;">승인일</th>
          <th style="padding:8px 10px;font-size:11px;font-family:${FONT};font-weight:700;color:#ffffff;text-align:left;border:1px solid #334155;">제품명</th>
          <th style="padding:8px 10px;font-size:11px;font-family:${FONT};font-weight:700;color:#ffffff;text-align:left;border:1px solid #334155;">성분명</th>
          <th style="padding:8px 10px;font-size:11px;font-family:${FONT};font-weight:700;color:#ffffff;text-align:left;border:1px solid #334155;">제약사</th>
          <th style="padding:8px 10px;font-size:11px;font-family:${FONT};font-weight:700;color:#ffffff;text-align:left;border:1px solid #334155;">치료영역</th>
          <th style="padding:8px 10px;font-size:11px;font-family:${FONT};font-weight:700;color:#ffffff;text-align:center;border:1px solid #334155;">구분</th>
        </tr>
        ${data.map((d, i) => drugRowHtml(d, i)).join("")}
      </table>
    </td>
  </tr>

  <!-- 푸터 -->
  <tr>
    <td style="padding:18px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td style="font-size:11px;font-family:${FONT};color:#64748b;line-height:1.8;">
            <p style="margin:0;">데이터 출처: FDA Novel Drug Approvals | Drugs.com | ASCO Post</p>
            <p style="margin:3px 0 0;">생성일: ${new Date().toISOString().slice(0, 10)} | US FDA 승인 전문의약품 대시보드</p>
            <p style="margin:8px 0 0;">
              <a href="${DASHBOARD_URL}" target="_blank" style="color:#4338CA;text-decoration:underline;font-weight:700;font-size:11px;font-family:${FONT};">대시보드에서 상세 데이터 확인하기</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>

</td></tr>
</table>

</body>
</html>`;
}

// ── 엑셀 헬퍼: 행 색상 적용 ──
function applyRowColor(row: import("exceljs").Row, drug: DrugApproval, columns: number) {
  if (drug.isOncology) {
    for (let i = 1; i <= columns; i++)
      row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
  } else if (drug.isBiosimilar) {
    for (let i = 1; i <= columns; i++)
      row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } };
  }
}

// ── 엑셀 헬퍼: 색상 범례 추가 ──
function addColorLegend(sheet: import("exceljs").Worksheet, startRow: number) {
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
}

// ── 5. 엑셀 생성 (5개 시트) ──
async function buildExcelBase64(data: DrugApproval[]): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FDA Drug Approval Dashboard";
  workbook.created = new Date();

  const stats = computeStats(data);

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

  const dates = data.map((d) => d.approvalDate).sort();
  summarySheet.getRow(rowNum).getCell(1).value = "📅 대상 기간";
  summarySheet.getRow(rowNum).getCell(2).value = `${dates[0]} ~ ${dates[dates.length - 1]}`;
  rowNum++;
  summarySheet.getRow(rowNum).getCell(1).value = "🗓 데이터 수집일";
  summarySheet.getRow(rowNum).getCell(2).value = new Date().toISOString().slice(0, 10);
  rowNum++;
  summarySheet.getRow(rowNum).getCell(1).value = "🌐 데이터 출처";
  summarySheet.getRow(rowNum).getCell(2).value = "FDA Official + Drugs.com + ASCO Post";
  rowNum += 2;

  // 승인 현황
  summarySheet.getRow(rowNum).getCell(1).value = "☑ 승인 현황";
  summarySheet.getRow(rowNum).getCell(1).font = { bold: true, size: 12 };
  rowNum++;

  const tableHeaderRow = summarySheet.getRow(rowNum);
  tableHeaderRow.getCell(1).value = "구분";
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
    { label: "", value: "" as string | number },
    { label: "BLA", value: stats.blaCount },
    { label: "NDA", value: stats.ndaCount },
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
  summarySheet.getRow(rowNum).getCell(1).value = "📊 치료영역별 분포";
  summarySheet.getRow(rowNum).getCell(1).font = { bold: true, size: 12 };
  rowNum++;

  const areaMap = new Map<string, number>();
  data.forEach((drug) => areaMap.set(drug.therapeuticArea, (areaMap.get(drug.therapeuticArea) || 0) + 1));
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
  summarySheet.getRow(rowNum).getCell(1).value = "💊 승인 약물 목록";
  summarySheet.getRow(rowNum).getCell(1).font = { bold: true, size: 12 };
  rowNum++;

  const drugTableHeaderRow = summarySheet.getRow(rowNum);
  drugTableHeaderRow.getCell(1).value = "제품명";
  drugTableHeaderRow.getCell(2).value = "치료영역";
  drugTableHeaderRow.font = { bold: true };
  drugTableHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  rowNum++;

  data.forEach((drug) => {
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
  summarySheet.getRow(rowNum).getCell(1).value = "📚 주요 출처";
  summarySheet.getRow(rowNum).getCell(1).font = { bold: true, size: 12 };
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
  summarySheet.getRow(rowNum).getCell(1).value = "🎨 색상 범례";
  summarySheet.getRow(rowNum).getCell(1).font = { bold: true, size: 12 };
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

  data.forEach((drug) => {
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
  addColorLegend(krSheet, data.length + 1);

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

  data.forEach((drug) => {
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
  addColorLegend(enSheet, data.length + 1);

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

  const originalApprovals = data.filter((d) => !isSupplementalApproval(d));
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

  const supplementalApprovals = data.filter((d) => isSupplementalApproval(d));
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

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer).toString("base64");
}

// ── 메인 ──
async function main() {
  try {
    // 데이터 로드
    const allData = await loadCloudData();

    // 2026-02-01 ~ 2026-02-26 필터 + 승인일 오름차순 정렬
    const START = "2026-02-01";
    const END = "2026-02-26";
    const filtered = filterByDateRange(allData, START, END)
      .sort((a, b) => a.approvalDate.localeCompare(b.approvalDate));
    const PERIOD = `${START} ~ ${END}`;

    console.log(`📋 ${PERIOD} 데이터: ${filtered.length}건`);

    if (filtered.length === 0) {
      console.log("⚠️  데이터가 없습니다. 발송을 중단합니다.");
      process.exit(1);
    }

    // 통계
    const stats = computeStats(filtered);
    console.log(`   항암제: ${stats.oncologyCount} | 신약: ${stats.novelDrugCount} | 희귀: ${stats.orphanDrugCount} | BLA: ${stats.blaCount} | NDA: ${stats.ndaCount}`);

    // HTML 생성
    console.log("📝 이메일 HTML 생성 중...");
    const html = buildSummaryHtml(filtered, stats, PERIOD);

    // 엑셀 생성
    console.log("📊 엑셀 파일 생성 중...");
    const excelBase64 = await buildExcelBase64(filtered);
    console.log(`   엑셀 크기: ${Math.round(excelBase64.length * 0.75 / 1024)}KB`);

    // 파일명: US-FDA-Approvals_filtered_YYYYMMDD.xlsx
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `US-FDA-Approvals_filtered_${today}.xlsx`;

    // 이메일 발송
    const recipients = ["jisoo.kim@samyang.com"];
    console.log(`📧 발송 중... → ${recipients.join(", ")}`);
    console.log(`   첨부파일: ${fileName}`);

    const res = await fetch(`${EMAIL_API}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: recipients,
        subject: `US FDA 전문의약품 승인 현황 (${PERIOD})`,
        html,
        attachmentBase64: excelBase64,
        attachmentFilename: fileName,
      }),
    });

    const result = await res.json();
    if (result.success) {
      console.log(`✅ 발송 완료! (${result.messageId})`);
    } else {
      console.error("❌ 발송 실패:", result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ 오류:", err);
    process.exit(1);
  }
}

main();
