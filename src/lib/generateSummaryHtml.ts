import { DrugApproval } from "@/data/fdaData";
import { DrugStats } from "@/lib/emailExcelGenerator";

// 폰트 규격: 제목 20px, 부제목 13px, 본문 14px, 테이블데이터 12px, 테이블헤더/통계 11px, 푸터 11px
const FONT = "'Malgun Gothic','맑은 고딕',Dotum,Arial,sans-serif";

// 이메일 본문 HTML 생성 (Outlook 호환 테이블 레이아웃, 인라인 스타일만 사용)
export function generateSummaryHtml(
  data: DrugApproval[],
  stats: DrugStats,
  periodText: string
): string {
  const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL || "https://us-fda-approval.lovable.app";

  // 통계 카드 생성 헬퍼
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

  // 약물 행 HTML (상세 목록용)
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
            <p style="margin:8px 0 0;font-size:13px;font-family:${FONT};color:#e0e7ff;font-weight:600;">대상 기간: ${periodText}</p>
          </td>
          <td style="text-align:right;vertical-align:bottom;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${dashboardUrl}" style="height:34px;v-text-anchor:middle;width:140px;" arcsize="10%" stroke="t" strokecolor="#a5b4fc" fillcolor="#5b50d6">
            <w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:12px;font-weight:bold;">대시보드 바로가기</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:8px 18px;background-color:#5b50d6;color:#ffffff;text-decoration:none;font-size:12px;font-family:${FONT};font-weight:700;border:1px solid #a5b4fc;">대시보드 바로가기</a>
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

      <!-- 전체 승인 (대형 카드) -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:8px;">
        <tr>
          <td style="background-color:#eef2ff;padding:16px 20px;text-align:center;border:2px solid #c7d2fe;">
            <p style="margin:0;font-size:11px;font-family:${FONT};color:#4338CA;font-weight:800;letter-spacing:1px;">TOTAL APPROVALS / 전체 승인</p>
            <p style="margin:8px 0 0;font-size:36px;font-family:${FONT};font-weight:900;color:#4338CA;line-height:1;">${stats.total}<span style="font-size:14px;font-weight:700;color:#818cf8;margin-left:3px;">건</span></p>
          </td>
        </tr>
      </table>

      <!-- 항암제 / 신약 / 희귀의약품 / 바이오시밀러 (4열) -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:8px;">
        <tr>
          ${statCard("항암제", stats.oncologyCount, "#fff7ed", "#ea580c", "25%")}
          ${statCard("신약", stats.novelDrugCount, "#f5f3ff", "#7c3aed", "25%")}
          ${statCard("희귀의약품", stats.orphanDrugCount, "#fffbeb", "#d97706", "25%")}
          ${statCard("바이오시밀러", stats.biosimilarCount, "#ecfdf5", "#059669", "25%")}
        </tr>
      </table>

      <!-- BLA / NDA (2열) -->
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
              <a href="${dashboardUrl}" target="_blank" style="color:#4338CA;text-decoration:underline;font-weight:700;font-size:11px;font-family:${FONT};">대시보드에서 상세 데이터 확인하기</a>
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
