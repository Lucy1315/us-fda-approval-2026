import { useState, useMemo } from "react";
import { Download, FileSpreadsheet, Loader2, Calendar, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DrugApproval } from "@/data/fdaData";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import ExcelJS from "exceljs";
import { cn } from "@/lib/utils";
import { therapeuticAreaEnMap } from "@/data/therapeuticAreaMap";

interface FdaNovelDrugsExportProps {
  data: DrugApproval[];
  filteredData: DrugApproval[];
}

type ExportMode = "all" | "filtered" | "custom";

// 승인유형 영문 매핑
const getApprovalTypeEn = (drug: DrugApproval): string => {
  const isSupplemental = isSupplementalApproval(drug);
  
  if (isSupplemental) {
    // 변경승인 상세 분류
    if (drug.notes?.includes("라벨링") || drug.notes?.includes("Labeling")) {
      return "Supplemental Approval (Labeling)";
    }
    if (drug.notes?.includes("효능") || drug.notes?.includes("Efficacy")) {
      return "Supplemental Approval (Efficacy)";
    }
    return "Supplemental Approval";
  }
  
  // 최초승인 상세 분류
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

// 변경승인 여부 판단 함수
const isSupplementalApproval = (drug: DrugApproval): boolean => {
  const notes = drug.notes || "";
  return notes.includes("변경승인") || 
         notes.includes("적응증 추가") || 
         notes.includes("적응증 확대") ||
         notes.includes("보충신청") ||
         notes.includes("라벨링") ||
         notes.includes("Supplemental");
};

// Ensure English-only output for the English sheet.
// If Korean characters are detected (unmapped), fall back to a safe English placeholder.
const ensureEnglish = (value: string, fallback: string) => {
  if (!value) return fallback;
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(value) ? fallback : value;
};

export function FdaNovelDrugsExport({ data, filteredData }: FdaNovelDrugsExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("filtered");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(startOfMonth(subMonths(new Date(), 1)));
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(endOfMonth(subMonths(new Date(), 1)));
  const { toast } = useToast();

  // 내보내기 대상 데이터 계산
  const exportData = useMemo(() => {
    switch (exportMode) {
      case "all":
        return data;
      case "filtered":
        return filteredData;
      case "custom":
        if (!customStartDate || !customEndDate) return [];
        return data.filter((drug) => {
          const approvalDate = parseISO(drug.approvalDate);
          return isWithinInterval(approvalDate, { start: customStartDate, end: customEndDate });
        });
      default:
        return filteredData;
    }
  }, [exportMode, data, filteredData, customStartDate, customEndDate]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = exportData.length;
    const oncologyCount = exportData.filter(d => d.isOncology).length;
    const nonOncologyCount = total - oncologyCount;
    const biosimilarCount = exportData.filter(d => d.isBiosimilar).length;
    const novelDrugCount = exportData.filter(d => d.isNovelDrug).length;
    const orphanDrugCount = exportData.filter(d => d.isOrphanDrug).length;
    
    return { total, oncologyCount, nonOncologyCount, biosimilarCount, novelDrugCount, orphanDrugCount };
  }, [exportData]);

  // 기간 표시 텍스트
  const periodText = useMemo(() => {
    if (exportData.length === 0) return "데이터 없음";
    const dates = exportData.map(d => parseISO(d.approvalDate)).sort((a, b) => a.getTime() - b.getTime());
    const minDate = format(dates[0], "yyyy-MM-dd");
    const maxDate = format(dates[dates.length - 1], "yyyy-MM-dd");
    return `${minDate} ~ ${maxDate}`;
  }, [exportData]);

  // 데이터 행에 색상 적용
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

  // 색상 범례를 시트에 추가
  const addColorLegend = (sheet: ExcelJS.Worksheet, startRow: number, colCount: number) => {
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

  const generateExcel = async () => {
    if (exportData.length === 0) {
      toast({
        title: "내보내기 실패",
        description: "내보낼 데이터가 없습니다. 필터 조건을 확인해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FDA Drug Approval Dashboard";
      workbook.created = new Date();

      // ===== Sheet 1: 요약 (Summary) =====
      const summarySheet = workbook.addWorksheet("요약");
      
      // 컬럼 너비 설정
      summarySheet.getColumn(1).width = 25;
      summarySheet.getColumn(2).width = 55;
      summarySheet.getColumn(3).width = 10;

      let rowNum = 1;

      // 제목
      const titleRow = summarySheet.getRow(rowNum);
      titleRow.getCell(1).value = "☑ US FDA 전문의약품 승인 현황";
      titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF4338CA" } };
      summarySheet.mergeCells(`A${rowNum}:C${rowNum}`);
      rowNum += 2;

      // 대상 기간
      const dates = exportData.map(d => parseISO(d.approvalDate)).sort((a, b) => a.getTime() - b.getTime());
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

      // 승인 현황 섹션
      const statsHeaderRow = summarySheet.getRow(rowNum);
      statsHeaderRow.getCell(1).value = "☑ 승인 현황";
      statsHeaderRow.getCell(1).font = { bold: true, size: 12 };
      rowNum++;

      // 테이블 헤더
      const tableHeaderRow = summarySheet.getRow(rowNum);
      tableHeaderRow.getCell(1).value = "구분";
      tableHeaderRow.getCell(2).value = "";
      tableHeaderRow.getCell(3).value = "건수";
      tableHeaderRow.font = { bold: true };
      tableHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
      rowNum++;

      // 통계 데이터
      const statsRows = [
        { label: "전체 승인", indent: "", value: stats.total },
        { label: "├── 항암제", indent: "", value: stats.oncologyCount },
        { label: "└── 비항암제", indent: "", value: stats.nonOncologyCount },
        { label: "", indent: "", value: "" },
        { label: "바이오시밀러", indent: "", value: stats.biosimilarCount },
        { label: "신약 (Novel Drug)", indent: "", value: stats.novelDrugCount },
        { label: "희귀의약품 (Orphan Drug)", indent: "", value: stats.orphanDrugCount },
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

      // 치료영역별 분포 섹션
      const areaHeaderRow = summarySheet.getRow(rowNum);
      areaHeaderRow.getCell(1).value = "📊 치료영역별 분포";
      areaHeaderRow.getCell(1).font = { bold: true, size: 12 };
      rowNum++;

      // 치료영역 집계
      const areaMap = new Map<string, number>();
      exportData.forEach((drug) => {
        const area = drug.therapeuticArea;
        areaMap.set(area, (areaMap.get(area) || 0) + 1);
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

      // 승인 약물 목록 섹션
      const drugListHeaderRow = summarySheet.getRow(rowNum);
      drugListHeaderRow.getCell(1).value = "💊 승인 약물 목록";
      drugListHeaderRow.getCell(1).font = { bold: true, size: 12 };
      rowNum++;

      // 약물 목록 테이블 헤더
      const drugTableHeaderRow = summarySheet.getRow(rowNum);
      drugTableHeaderRow.getCell(1).value = "제품명";
      drugTableHeaderRow.getCell(2).value = "치료영역";
      drugTableHeaderRow.font = { bold: true };
      drugTableHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
      rowNum++;

      // 약물 목록
      exportData.forEach((drug) => {
        const row = summarySheet.getRow(rowNum);
        row.getCell(1).value = `• ${drug.brandName}`;
        row.getCell(2).value = drug.therapeuticArea;
        
        // 색상 적용
        if (drug.isOncology) {
          row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
        } else if (drug.isBiosimilar) {
          row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } };
        }
        rowNum++;
      });
      rowNum++;

      // 주요 출처 섹션
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

      // 색상 범례 섹션
      const legendHeaderRow = summarySheet.getRow(rowNum);
      legendHeaderRow.getCell(1).value = "🎨 색상 범례";
      legendHeaderRow.getCell(1).font = { bold: true, size: 12 };
      rowNum++;

      // 주황색 = 항암제
      const legendRow1 = summarySheet.getRow(rowNum);
      legendRow1.getCell(1).value = "🟠 주황색";
      legendRow1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
      legendRow1.getCell(2).value = "항암제";
      legendRow1.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFED7AA" } };
      rowNum++;

      // 연두색 = 바이오시밀러
      const legendRow2 = summarySheet.getRow(rowNum);
      legendRow2.getCell(1).value = "🟢 연두색";
      legendRow2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } };
      legendRow2.getCell(2).value = "바이오시밀러";
      legendRow2.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBF7D0" } };
      rowNum++;

      // 색상 없음 = 비항암제
      const legendRow3 = summarySheet.getRow(rowNum);
      legendRow3.getCell(1).value = "⬜ 색상 없음";
      legendRow3.getCell(2).value = "비항암제 (바이오시밀러 제외)";

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
      krSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF059669" },
      };
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
      addColorLegend(krSheet, exportData.length + 1, krColumns.length);

      // ===== Sheet 3: English Details (영문만) =====
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
      enSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF7C3AED" },
      };
      enSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

      exportData.forEach((drug) => {
        const therapeuticAreaEn = ensureEnglish(
          therapeuticAreaEnMap[drug.therapeuticArea] || drug.therapeuticArea,
          "Unmapped Therapeutic Area"
        );
        const approvalTypeEn = getApprovalTypeEn(drug);
        
        // 순수 영문 요약 생성 (한글 notes 제외)
        let summaryEn = "";
        const indication = ensureEnglish(
          therapeuticAreaEn.split(" - ")[1] || therapeuticAreaEn,
          "unmapped indication"
        );
        
        if (drug.isNovelDrug) {
          summaryEn = `Novel drug (${drug.activeIngredient}) approved for ${indication.toLowerCase()}.`;
          if (drug.isOrphanDrug) {
            summaryEn += " Designated as Orphan Drug.";
          }
        } else if (drug.isBiosimilar) {
          summaryEn = `Biosimilar (${drug.activeIngredient}) approved for ${indication.toLowerCase()}.`;
        } else {
          const isSuppl = isSupplementalApproval(drug);
          if (isSuppl) {
            summaryEn = `Supplemental approval for ${drug.activeIngredient} for ${indication.toLowerCase()}.`;
          } else {
            summaryEn = `${drug.activeIngredient} approved for ${indication.toLowerCase()}.`;
          }
        }
        
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
      addColorLegend(enSheet, exportData.length + 1, enColumns.length);

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
      origSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" }, // 파란색 헤더
      };
      origSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

      // 최초승인 필터 (변경승인이 아닌 것들)
      const originalApprovals = exportData.filter(d => !isSupplementalApproval(d));
      
      originalApprovals.forEach((drug) => {
        const therapeuticAreaEn = ensureEnglish(
          therapeuticAreaEnMap[drug.therapeuticArea] || drug.therapeuticArea,
          "Unmapped Therapeutic Area"
        );
        const approvalTypeEn = getApprovalTypeEn(drug);
        const summaryKr = drug.indicationFull + (drug.notes ? ` ${drug.notes}` : "");
        
        // 영문 요약 생성 - 순수 영문만 (한글 notes 제외)
        let summaryEn = "";
        const indication = ensureEnglish(
          therapeuticAreaEn.split(" - ")[1] || therapeuticAreaEn,
          "unmapped indication"
        );

        if (drug.isBiosimilar) {
          summaryEn = `Biosimilar (${drug.activeIngredient}) for ${indication.toLowerCase()}.`;
        } else if (drug.isNovelDrug) {
          summaryEn = `Novel drug (${drug.activeIngredient}) approved for ${indication.toLowerCase()}.`;
          if (drug.isOrphanDrug) summaryEn += " Designated as Orphan Drug.";
        } else {
          summaryEn = `${drug.activeIngredient} approved for ${indication.toLowerCase()}.`;
        }
        
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
      addColorLegend(origSheet, originalApprovals.length + 1, origColumns.length);

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

      supplSheet.getRow(1).font = { bold: true, color: { argb: "FF000000" } }; // 검정 텍스트
      supplSheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFBBF24" }, // 노란색 헤더
      };
      supplSheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

      // 변경승인 필터
      const supplementalApprovals = exportData.filter(d => isSupplementalApproval(d));
      
      supplementalApprovals.forEach((drug) => {
        const therapeuticAreaEn = ensureEnglish(
          therapeuticAreaEnMap[drug.therapeuticArea] || drug.therapeuticArea,
          "Unmapped Therapeutic Area"
        );
        const approvalTypeEn = getApprovalTypeEn(drug);
        const summaryKr = drug.indicationFull + (drug.notes ? ` ${drug.notes}` : "");
        
        // 영문 요약 생성 - 순수 영문만 (한글 notes 제외)
        let summaryEn = "";
        const indication = ensureEnglish(
          therapeuticAreaEn.split(" - ")[1] || therapeuticAreaEn,
          "unmapped indication"
        );

        if (drug.isBiosimilar) {
          summaryEn = `Supplemental approval for ${drug.activeIngredient} biosimilar for ${indication.toLowerCase()}.`;
        } else {
          summaryEn = `Supplemental approval for ${drug.activeIngredient} for ${indication.toLowerCase()}.`;
        }
        
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
      addColorLegend(supplSheet, supplementalApprovals.length + 1, supplColumns.length);

      // 파일명 생성
      let fileName = "US-FDA-Approvals";
      if (exportMode === "custom" && customStartDate && customEndDate) {
        fileName = `US-FDA-Approvals_${format(customStartDate, "yyyyMMdd")}-${format(customEndDate, "yyyyMMdd")}`;
      } else if (exportMode === "filtered") {
        fileName = `US-FDA-Approvals_filtered_${format(new Date(), "yyyyMMdd")}`;
      } else {
        fileName = `US-FDA-Approvals_all_${format(new Date(), "yyyyMMdd")}`;
      }

      // 엑셀 파일 다운로드
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "엑셀 다운로드 완료",
        description: `US FDA 승인 의약품 ${exportData.length}건이 다운로드되었습니다.`,
      });
      setIsOpen(false);
    } catch (error) {
      console.error("Excel generation error:", error);
      toast({
        title: "엑셀 생성 오류",
        description: "엑셀 파일 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          엑셀 다운로드
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            US FDA 전문의약품 엑셀 내보내기
          </DialogTitle>
          <DialogDescription>
            선택한 기간 또는 필터 조건에 맞는 데이터를 엑셀로 다운로드합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 내보내기 범위 선택 */}
          <div className="space-y-2">
            <Label>내보내기 범위</Label>
            <Select value={exportMode} onValueChange={(v) => setExportMode(v as ExportMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <span>전체 데이터</span>
                    <span className="text-xs text-muted-foreground">({data.length}건)</span>
                  </div>
                </SelectItem>
                <SelectItem value="filtered">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3" />
                    <span>현재 필터 적용</span>
                    <span className="text-xs text-muted-foreground">({filteredData.length}건)</span>
                  </div>
                </SelectItem>
                <SelectItem value="custom">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3" />
                    <span>기간 직접 선택</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 커스텀 기간 선택 */}
          {exportMode === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">시작일</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "yyyy-MM-dd") : "시작일 선택"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      locale={ko}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">종료일</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "yyyy-MM-dd") : "종료일 선택"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      locale={ko}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* 통계 미리보기 */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">대상 기간</span>
              <span className="font-medium">{periodText}</span>
            </div>
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">전체 승인</span>
                <span className="text-primary font-bold">{stats.total}건</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>항암제</span>
                  <span>{stats.oncologyCount}건</span>
                </div>
                <div className="flex justify-between">
                  <span>비항암제</span>
                  <span>{stats.nonOncologyCount}건</span>
                </div>
                <div className="flex justify-between">
                  <span>바이오시밀러</span>
                  <span>{stats.biosimilarCount}건</span>
                </div>
                <div className="flex justify-between">
                  <span>신약</span>
                  <span>{stats.novelDrugCount}건</span>
                </div>
                <div className="flex justify-between">
                  <span>희귀의약품</span>
                  <span>{stats.orphanDrugCount}건</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">포함 시트 (5개):</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>요약 (국문+영문 혼합)</li>
              <li>국문 상세</li>
              <li>English Details (영문만)</li>
              <li>최초승인 (ORIG-1)</li>
              <li>변경승인 (SUPPL)</li>
            </ul>
            <p className="mt-2 text-muted-foreground/80">* 모든 시트에 색상 범례가 포함됩니다.</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            취소
          </Button>
          <Button onClick={generateExcel} disabled={isGenerating || exportData.length === 0} className="gap-2">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                엑셀 다운로드 ({exportData.length}건)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
