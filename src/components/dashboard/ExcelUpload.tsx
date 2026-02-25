import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, Check, Loader2 } from "lucide-react";
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
import { DrugApproval } from "@/data/fdaData";
import { useToast } from "@/hooks/use-toast";
import ExcelJS from "exceljs";

interface ExcelUploadProps {
  onDataUpdate: (data: DrugApproval[]) => void;
  currentData: DrugApproval[];
}

// Merge new data with existing data, deduplicating by applicationNo + approvalDate + supplementCategory
function mergeData(existing: DrugApproval[], incoming: DrugApproval[]): DrugApproval[] {
  const seen = new Set<string>();
  const result: DrugApproval[] = [];
  
  // Add existing data first
  for (const drug of existing) {
    const key = `${drug.applicationNo}-${drug.approvalDate}-${drug.supplementCategory || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(drug);
    }
  }
  
  // Add new data (only if not duplicate)
  for (const drug of incoming) {
    const key = `${drug.applicationNo}-${drug.approvalDate}-${drug.supplementCategory || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(drug);
    }
  }
  
  return result;
}

export function ExcelUpload({ onDataUpdate, currentData }: ExcelUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<DrugApproval[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseExcel = async (buffer: ArrayBuffer): Promise<DrugApproval[]> => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("No worksheet found");
    }

    const headers: string[] = [];
    const firstRow = worksheet.getRow(1);
    firstRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || "").trim();
    });

    const results: DrugApproval[] = [];
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row
      
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });

      const getValue = (keys: string[]): string => {
        for (const key of keys) {
          const value = rowData[key] || rowData[key.toLowerCase()] || rowData[key.toUpperCase()];
          if (value !== undefined && value !== null && value !== "") {
            return String(value).trim();
          }
        }
        return "";
      };

      const getBoolValue = (keys: string[]): boolean => {
        const value = getValue(keys);
        return value.toLowerCase() === "true" || value === "Y" || value === "y" || value === "1";
      };

      // Helper: strip "BLA " or "NDA " prefix from application number
      const stripPrefix = (val: string): string => val.replace(/^(BLA|NDA)\s+/i, "").trim();

      // Helper: normalize ndaBlaNumber to prevent "BLA BLA xxx" or "NDA NDA xxx"
      const normalizeNdaBlaNumber = (ndaBla: string, appType: string, appNo: string): string => {
        // If ndaBlaNumber has duplicate prefix like "BLA BLA 123456", fix it
        const cleanNdaBla = ndaBla.replace(/^(BLA|NDA)\s+(BLA|NDA)\s+/i, "$1 ").trim();
        if (cleanNdaBla) return cleanNdaBla;
        // Fallback: construct from applicationType + applicationNo
        if (appType && appNo) return `${appType} ${stripPrefix(appNo)}`;
        return ndaBla;
      };

      const rawNdaBla = getValue(["nda_bla_number", "신청번호", "NDA_BLA_Number", "NDA/BLA번호"]);
      const rawAppNo = getValue(["application_no", "허가번호", "ApplicationNo", "신청번호"]);
      const rawAppType = getValue(["application_type", "신청유형", "ApplicationType"]);

      const drug: DrugApproval = {
        approvalMonth: getValue(["approval_month", "승인월", "ApprovalMonth"]),
        approvalDate: getValue(["approval_date", "승인일", "ApprovalDate"]),
        ndaBlaNumber: normalizeNdaBlaNumber(rawNdaBla, rawAppType, rawAppNo),
        applicationNo: stripPrefix(rawAppNo),
        applicationType: rawAppType,
        brandName: getValue(["brand_name", "제품명", "BrandName"]),
        activeIngredient: getValue(["active_ingredient", "주성분", "ActiveIngredient"]),
        sponsor: getValue(["sponsor", "제약사", "Sponsor"]),
        indicationFull: getValue(["indication_full", "적응증", "IndicationFull"]),
        therapeuticArea: getValue(["therapeutic_area", "치료영역", "TherapeuticArea"]),
        isOncology: getBoolValue(["is_oncology", "항암제", "IsOncology", "항암제여부"]),
        isBiosimilar: getBoolValue(["is_biosimilar", "바이오시밀러", "IsBiosimilar", "바이오시밀러여부"]),
        isNovelDrug: getBoolValue(["is_novel_drug", "신약", "IsNovelDrug", "신약여부"]),
        isOrphanDrug: getBoolValue(["is_orphan_drug", "희귀의약품", "IsOrphanDrug", "희귀의약품여부"]),
        approvalType: getValue(["approval_type", "승인유형", "ApprovalType"]),
        supplementCategory: getValue(["supplement_category", "변경카테고리", "SupplementCategory", "Supplement Categories or Approval Type"]),
        notes: getValue(["notes", "비고", "Notes"]),
        fdaUrl: getValue(["fda_url", "fdaUrl", "FDA_URL", "FDA승인페이지"]),
      };

      if (drug.brandName && drug.approvalDate) {
        results.push(drug);
      }
    });

    return results;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setParsedData(null);

    try {
      const buffer = await file.arrayBuffer();
      const data = await parseExcel(buffer);

      if (data.length === 0) {
        toast({
          title: "파싱 오류",
          description: "엑셀 파일에서 유효한 데이터를 찾을 수 없습니다.",
          variant: "destructive",
        });
        setFileName(null);
        return;
      }

      setParsedData(data);
      toast({
        title: "파일 로드 완료",
        description: `${data.length}건의 데이터를 찾았습니다. '적용' 버튼을 눌러 대시보드에 반영하세요.`,
      });
    } catch (error) {
      console.error("Excel parse error:", error);
      toast({
        title: "파일 읽기 오류",
        description: "엑셀 파일을 읽는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setFileName(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (!parsedData || parsedData.length === 0) return;
    
    const merged = mergeData(currentData, parsedData);
    const addedCount = merged.length - currentData.length;
    
    // Update local state only (no cloud save)
    onDataUpdate(merged);
    
    toast({
      title: "적용 완료",
      description: `신규 ${addedCount}건 추가, 총 ${merged.length}건이 대시보드에 반영되었습니다. '확정' 버튼을 눌러 클라우드에 저장하세요.`,
    });
    
    setIsOpen(false);
    setFileName(null);
    setParsedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClear = () => {
    setFileName(null);
    setParsedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      handleClear();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          엑셀 업로드
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            엑셀 데이터 업로드
          </DialogTitle>
          <DialogDescription>
            FDA 승인 데이터가 포함된 엑셀 파일(.xlsx, .xls)을 업로드하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="excel-upload"
            />
            <label 
              htmlFor="excel-upload" 
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">처리 중...</span>
                </>
              ) : parsedData ? (
                <>
                  <Check className="h-10 w-10 text-primary" />
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-xs text-primary font-medium">
                    {parsedData.length}건 데이터 준비됨
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={(e) => { e.preventDefault(); handleClear(); }}
                    className="gap-1"
                  >
                    <X className="h-3 w-3" />
                    다른 파일 선택
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    클릭하여 엑셀 파일 선택
                  </span>
                  <span className="text-xs text-muted-foreground">
                    .xlsx, .xls 지원
                  </span>
                </>
              )}
            </label>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">필수 컬럼:</p>
            <p>brand_name(제품명), approval_date(승인일), therapeutic_area(치료영역), sponsor(제약사)</p>
            <p className="font-medium mt-2">선택 컬럼:</p>
            <p>is_oncology(항암제), is_biosimilar(바이오시밀러), is_novel_drug(신약), is_orphan_drug(희귀의약품), approval_type(승인유형), notes(비고)</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={!parsedData || parsedData.length === 0}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
