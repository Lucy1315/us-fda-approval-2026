import { useState, useMemo } from "react";
import { Mail, Loader2, Send, Eye, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DrugApproval } from "@/data/fdaData";
import { generateExcelBase64, computeDrugStats } from "@/lib/emailExcelGenerator";
import { generateSummaryHtml } from "@/lib/generateSummaryHtml";
import { toast } from "sonner";

interface EmailExportDialogProps {
  data: DrugApproval[];
  filteredData: DrugApproval[];
}

// 이메일 유효성 검사
const validateEmails = (input: string): string[] => {
  return input
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
};

export function EmailExportDialog({ filteredData }: EmailExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [recipientInput, setRecipientInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // 대시보드 필터 결과를 그대로 사용
  const exportData = filteredData;

  // 통계
  const stats = useMemo(() => computeDrugStats(exportData), [exportData]);

  // 기간 텍스트 (데이터의 실제 날짜 범위)
  const periodText = useMemo(() => {
    if (exportData.length === 0) return "데이터 없음";
    const dates = exportData.map((d) => d.approvalDate).sort();
    return `${dates[0]} ~ ${dates[dates.length - 1]}`;
  }, [exportData]);

  // 파일명용 날짜 (오늘 날짜 기준)
  const filenameDate = useMemo(() => {
    return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  }, []);

  // 유효한 이메일 목록
  const validEmails = useMemo(() => validateEmails(recipientInput), [recipientInput]);

  // HTML 미리보기
  const previewHtml = useMemo(() => {
    if (exportData.length === 0) return "";
    return generateSummaryHtml(exportData, stats, periodText);
  }, [exportData, stats, periodText]);

  // 발송 가능 여부
  const canSend = validEmails.length > 0 && exportData.length > 0 && !isSending;

  const handleSend = async () => {
    if (!canSend) return;

    setIsSending(true);
    try {
      // 1. 엑셀 생성 (base64)
      const excelBase64 = await generateExcelBase64(exportData);

      // 2. HTML 요약 생성
      const summaryHtml = generateSummaryHtml(exportData, stats, periodText);

      // 3. 파일명 생성
      const fileName = `US-FDA-Approvals_filtered_${filenameDate}.xlsx`;

      // 4. 이메일 서버 호출
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: validEmails,
          subject: `US FDA 전문의약품 승인 현황 (${periodText})`,
          html: summaryHtml,
          attachmentBase64: excelBase64,
          attachmentFilename: fileName,
        }),
      });

      const response = await res.json();

      if (!res.ok || !response?.success) {
        throw new Error(response?.error || "이메일 전송 실패");
      }

      toast.success(`이메일이 ${validEmails.length}명에게 전송되었습니다.`);
      setIsOpen(false);
      setRecipientInput("");
      setActiveTab("settings");
    } catch (error) {
      console.error("Email send error:", error);
      toast.error(`이메일 전송 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Mail className="h-4 w-4" />
          이메일 발송
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            데이터 요약 이메일 발송
          </DialogTitle>
          <DialogDescription>
            대시보드 필터에서 선택된 데이터를 이메일로 발송합니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              설정
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5" disabled={exportData.length === 0}>
              <Eye className="h-3.5 w-3.5" />
              미리보기
            </TabsTrigger>
            <TabsTrigger value="send" className="gap-1.5" disabled={!canSend}>
              <Send className="h-3.5 w-3.5" />
              전송
            </TabsTrigger>
          </TabsList>

          {/* 설정 탭 */}
          <TabsContent value="settings" className="space-y-4 overflow-y-auto flex-1">
            {/* 현재 필터 정보 */}
            <div className="bg-primary/5 rounded-lg p-3 text-sm">
              <p className="font-medium text-primary mb-1">현재 대시보드 필터 적용 데이터</p>
              <p className="text-muted-foreground">
                대시보드의 승인일 필터를 변경하면 이메일 발송 데이터도 함께 변경됩니다.
              </p>
            </div>

            {/* 수신자 이메일 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">수신자 이메일</Label>
              <Input
                placeholder="email@example.com (쉼표로 여러 명 입력)"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
              />
              {recipientInput && (
                <p className="text-xs text-muted-foreground">
                  {validEmails.length > 0
                    ? `유효한 이메일: ${validEmails.join(", ")}`
                    : "유효한 이메일 주소를 입력해주세요."}
                </p>
              )}
            </div>

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

            {exportData.length === 0 && (
              <p className="text-sm text-destructive">
                현재 필터에 해당하는 데이터가 없습니다. 대시보드에서 필터를 조정해주세요.
              </p>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">이메일 내용:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>본문: 데이터 요약 (통계, 치료영역 분포, 약물 목록)</li>
                <li>첨부: 엑셀 파일 (5개 시트: 요약, 국문, 영문, 최초승인, 변경승인)</li>
              </ul>
            </div>
          </TabsContent>

          {/* 미리보기 탭 */}
          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <div className="h-full border rounded-lg overflow-hidden">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-[50vh] border-0"
                  title="이메일 미리보기"
                  sandbox=""
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  미리보기할 데이터가 없습니다.
                </div>
              )}
            </div>
          </TabsContent>

          {/* 전송 탭 */}
          <TabsContent value="send" className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm">전송 확인</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">대상 기간</span>
                  <span className="font-medium">{periodText}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">데이터 건수</span>
                  <span className="font-medium">{stats.total}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">수신자</span>
                  <span className="font-medium">{validEmails.length}명</span>
                </div>
                <div className="border-t pt-2">
                  <span className="text-xs text-muted-foreground">수신 이메일:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {validEmails.map((email) => (
                      <span
                        key={email}
                        className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-xs rounded"
                      >
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full gap-2"
              size="lg"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  전송 중...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  이메일 발송 ({validEmails.length}명, {stats.total}건)
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
