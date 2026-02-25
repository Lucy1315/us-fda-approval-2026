import { useState } from "react";
import { Calendar, Database, FileText, Cloud, CloudUpload, Loader2 } from "lucide-react";
import { ExcelUpload } from "./ExcelUpload";
import { FdaNovelDrugsExport } from "./FdaNovelDrugsExport";
import { FdaValidation } from "./FdaValidation";
import { UsageGuide } from "./UsageGuide";
import { DrugApproval } from "@/data/fdaData";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface HeaderProps {
  onDataUpdate: (data: DrugApproval[]) => void;
  data: DrugApproval[];
  filteredData: DrugApproval[];
  saveToCloud: (data: DrugApproval[], notes?: string) => Promise<boolean>;
  isFromCloud: boolean;
  cloudVersion: number | null;
}

export function Header({ onDataUpdate, data, filteredData, saveToCloud, isFromCloud, cloudVersion }: HeaderProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleConfirm = async () => {
    if (data.length === 0) {
      toast.error("저장할 데이터가 없습니다.");
      return;
    }

    setIsSaving(true);
    try {
      const success = await saveToCloud(data, "데이터 확정");
      if (success) {
        toast.success(`v${(cloudVersion || 0) + 1} 저장 완료! 대시보드가 갱신되었습니다.`);
      } else {
        toast.error("클라우드 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error("Confirm save error:", error);
      toast.error("저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-3">
        {/* 타이틀 */}
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">
            US FDA 승인 전문의약품
          </h1>
          {isFromCloud && (
            <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded">
              <Cloud className="h-3 w-3" />
              v{cloudVersion}
            </span>
          )}
        </div>
        
        {/* 서브타이틀 + 데이터 정보 + 액션 버튼 */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="text-muted-foreground">미국 FDA 전문의약품 승인 데이터 대시보드</span>
          
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Database className="h-4 w-4" />
            <span>데이터: <strong className="text-foreground">{data.length}건</strong></span>
          </div>
          
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>수집일: <strong className="text-foreground">2026-01-29</strong></span>
          </div>
          
          <div className="flex items-center gap-2">
            <UsageGuide />
            <FdaValidation data={data} onDataUpdate={onDataUpdate} />
            <FdaNovelDrugsExport data={data} filteredData={filteredData} />
            <ExcelUpload onDataUpdate={onDataUpdate} currentData={data} />
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2"
              onClick={handleConfirm}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <CloudUpload className="h-4 w-4" />
                  확정
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* 데이터 소스 태그 */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="px-2 py-1 rounded bg-muted">FDA Official</span>
          <span className="px-2 py-1 rounded bg-muted">Drugs.com</span>
          <span className="px-2 py-1 rounded bg-muted">ASCO Post</span>
          <span className="px-2 py-1 rounded bg-muted">NeurologyLive</span>
        </div>
      </div>
    </header>
  );
}
