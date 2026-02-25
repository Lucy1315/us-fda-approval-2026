import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, Download, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DrugApproval } from "@/data/fdaData";

interface DataCommitProps {
  data: DrugApproval[];
}

export function DataCommit({ data }: DataCommitProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateFdaDataCode = () => {
    const sortedData = [...data].sort((a, b) => 
      a.approvalDate.localeCompare(b.approvalDate)
    );

    const items = sortedData.map((drug) => {
      const lines = [
        `  {`,
        `    approvalMonth: "${drug.approvalMonth}",`,
        `    approvalDate: "${drug.approvalDate}",`,
        `    ndaBlaNumber: "${drug.ndaBlaNumber}",`,
        `    applicationNo: "${drug.applicationNo}",`,
        `    applicationType: "${drug.applicationType}",`,
        `    brandName: "${drug.brandName}",`,
        `    activeIngredient: "${drug.activeIngredient}",`,
        `    sponsor: "${drug.sponsor}",`,
        `    indicationFull: "${drug.indicationFull.replace(/"/g, '\\"')}",`,
        `    therapeuticArea: "${drug.therapeuticArea}",`,
        `    isOncology: ${drug.isOncology},`,
        `    isBiosimilar: ${drug.isBiosimilar},`,
        `    isNovelDrug: ${drug.isNovelDrug},`,
        `    isOrphanDrug: ${drug.isOrphanDrug},`,
      ];

      if (drug.isCberProduct) {
        lines.push(`    isCberProduct: true,`);
      }

      lines.push(`    approvalType: "${drug.approvalType}",`);

      if (drug.supplementCategory) {
        lines.push(`    supplementCategory: "${drug.supplementCategory}",`);
      }

      lines.push(`    notes: "${drug.notes.replace(/"/g, '\\"')}",`);

      if (drug.fdaUrl) {
        lines.push(`    fdaUrl: "${drug.fdaUrl}",`);
      }

      lines.push(`  },`);

      return lines.join("\n");
    });

    return `export const fdaApprovals: DrugApproval[] = [\n${items.join("\n")}\n];`;
  };

  const handleCopyToClipboard = async () => {
    const code = generateFdaDataCode();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("클립보드에 복사되었습니다. 채팅창에 붙여넣기하면 코드에 반영해드립니다.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const handleDownload = () => {
    const code = generateFdaDataCode();
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fdaApprovals_${new Date().toISOString().slice(0, 10)}.ts`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("파일이 다운로드되었습니다.");
  };

  const exportedCode = generateFdaDataCode();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">데이터 확정</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            현재 데이터를 코드에 확정하기
          </DialogTitle>
          <DialogDescription>
            현재 수정된 데이터를 소스 코드에 반영하면 Publish 후에도 모든 사용자가 동일한 데이터를 볼 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            <p className="font-medium">📌 사용 방법</p>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>"클립보드 복사" 버튼을 클릭합니다.</li>
              <li>채팅창에 붙여넣기 후 "이 데이터로 fdaData.ts 업데이트해줘"라고 요청합니다.</li>
              <li>코드 반영 후 Publish하면 모든 사용자에게 적용됩니다.</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopyToClipboard} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "복사됨!" : "클립보드 복사"}
            </Button>
            <Button variant="outline" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" />
              파일 다운로드
            </Button>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">
              현재 데이터 ({data.length}건) - fdaApprovals 배열 코드:
            </p>
            <Textarea
              value={exportedCode}
              readOnly
              className="font-mono text-xs h-[300px]"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
