import { useState, useMemo } from "react";
import { RefreshCw, Check, CheckCheck, Trash2, ChevronDown, ChevronUp, Loader2, AlertCircle, ExternalLink, AlertTriangle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { DrugApproval } from "@/data/fdaData";
import { useFdaFetch, PendingItem } from "@/hooks/useFdaFetch";
import { format, subDays } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface PendingApprovalsProps {
  onDataUpdate: (data: DrugApproval[]) => void;
  data: DrugApproval[];
}

function getExistingTherapeuticAreas(data: DrugApproval[]): string[] {
  const areas = new Set<string>();
  data.forEach(d => areas.add(d.therapeuticArea));
  return Array.from(areas).sort();
}

function PendingItemCard({
  item,
  existingAreas,
  onUpdate,
  onApprove,
  onRemove,
}: {
  item: PendingItem;
  existingAreas: string[];
  onUpdate: (id: string, drug: DrugApproval) => void;
  onApprove: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const drug = item.drug;
  const isCber = drug.isCberProduct === true;
  const hasUnclassifiedArea = drug.therapeuticArea.startsWith("[미분류]");

  const updateField = <K extends keyof DrugApproval>(field: K, value: DrugApproval[K]) => {
    onUpdate(item.id, { ...drug, [field]: value });
  };

  return (
    <div className={cn(
      "border rounded-lg p-3 space-y-2 bg-card",
      isCber && "border-amber-400/50",
      hasUnclassifiedArea && "border-orange-400/50",
    )}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="shrink-0 text-xs">
            {drug.applicationType}
          </Badge>
          {isCber && (
            <Badge variant="outline" className="shrink-0 text-xs border-amber-400 text-amber-600">
              CBER
            </Badge>
          )}
          <span className="font-medium text-sm truncate">{drug.brandName}</span>
          <span className="text-xs text-muted-foreground truncate">{drug.activeIngredient}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => onRemove(item.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-7 gap-1" onClick={() => onApprove(item.id)}>
            <Check className="h-3 w-3" />
            승인
          </Button>
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <span>승인일: {drug.approvalDate}</span>
        <span>{drug.ndaBlaNumber}</span>
        <span>{drug.sponsor}</span>
      </div>

      {/* 자동 분류 미리보기 */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-xs">{drug.therapeuticArea}</Badge>
        {drug.isOncology && <Badge className="text-xs bg-orange-100 text-orange-700">항암제</Badge>}
        {drug.isBiosimilar && <Badge className="text-xs bg-green-100 text-green-700">바이오시밀러</Badge>}
        {drug.isNovelDrug && <Badge className="text-xs bg-blue-100 text-blue-700">신약</Badge>}
        {drug.isOrphanDrug && <Badge className="text-xs bg-purple-100 text-purple-700">희귀의약품</Badge>}
      </div>

      {/* 자동 생성 적응증 미리보기 */}
      <p className="text-xs text-muted-foreground line-clamp-2">{drug.indicationFull}</p>

      {/* CBER 경고 */}
      {isCber && !expanded && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          CBER 제품: FDA URL 수동 확인 필요
        </div>
      )}

      {/* 확장 편집 영역 */}
      {expanded && (
        <div className="space-y-3 pt-2 border-t">
          {/* CBER 경고 */}
          {isCber && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded p-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">CBER 규제 제품 (유전자/세포치료제)</p>
                <p>Drugs@FDA URL이 유효하지 않을 수 있습니다. FDA CBER 페이지에서 올바른 URL을 확인하세요.</p>
              </div>
            </div>
          )}

          {/* 적응증 (국문) */}
          <div className="space-y-1">
            <Label className="text-xs">적응증 (국문)</Label>
            <Textarea
              value={drug.indicationFull}
              onChange={(e) => updateField("indicationFull", e.target.value)}
              placeholder="국문 적응증을 입력하세요"
              className="text-sm min-h-[60px]"
            />
          </div>

          {/* 치료영역 */}
          <div className="space-y-1">
            <Label className="text-xs">치료영역</Label>
            <Select
              value={existingAreas.includes(drug.therapeuticArea) ? drug.therapeuticArea : "__custom__"}
              onValueChange={(v) => {
                if (v !== "__custom__") updateField("therapeuticArea", v);
              }}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="치료영역 선택" />
              </SelectTrigger>
              <SelectContent>
                {existingAreas.map(area => (
                  <SelectItem key={area} value={area} className="text-xs">{area}</SelectItem>
                ))}
                <SelectItem value="__custom__" className="text-xs">직접 입력</SelectItem>
              </SelectContent>
            </Select>
            {!existingAreas.includes(drug.therapeuticArea) && (
              <Input
                value={drug.therapeuticArea}
                onChange={(e) => updateField("therapeuticArea", e.target.value)}
                placeholder="치료영역 직접 입력 (예: 감염내과 - 항진균제)"
                className="text-sm"
              />
            )}
          </div>

          {/* 승인유형 */}
          <div className="space-y-1">
            <Label className="text-xs">승인유형</Label>
            <Select value={drug.approvalType} onValueChange={(v) => updateField("approvalType", v)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="정규승인">정규승인</SelectItem>
                <SelectItem value="가속승인">가속승인</SelectItem>
                <SelectItem value="우선심사">우선심사</SelectItem>
                <SelectItem value="혁신치료제">혁신치료제</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 비고 */}
          <div className="space-y-1">
            <Label className="text-xs">비고</Label>
            <Textarea
              value={drug.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="비고 입력"
              className="text-sm min-h-[40px]"
            />
          </div>

          {/* FDA URL */}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              FDA URL
              {drug.fdaUrl && (
                <a href={drug.fdaUrl} target="_blank" rel="noopener noreferrer" className="text-primary">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </Label>
            <Input
              value={drug.fdaUrl || ""}
              onChange={(e) => updateField("fdaUrl", e.target.value)}
              placeholder="https://www.accessdata.fda.gov/..."
              className="text-sm"
            />
          </div>

          {/* 분류 토글 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">항암제</Label>
              <Switch checked={drug.isOncology} onCheckedChange={(v) => updateField("isOncology", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">바이오시밀러</Label>
              <Switch checked={drug.isBiosimilar} onCheckedChange={(v) => updateField("isBiosimilar", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">신약 (Novel)</Label>
              <Switch checked={drug.isNovelDrug} onCheckedChange={(v) => updateField("isNovelDrug", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">희귀의약품</Label>
              <Switch checked={drug.isOrphanDrug} onCheckedChange={(v) => updateField("isOrphanDrug", v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">CBER 제품</Label>
              <Switch checked={drug.isCberProduct || false} onCheckedChange={(v) => updateField("isCberProduct", v || undefined)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PendingApprovals({ onDataUpdate, data }: PendingApprovalsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());

  const {
    pendingItems,
    isFetching,
    fetchError,
    fetchFdaData,
    updatePendingItem,
    removePendingItem,
    approveItem,
    approveAll,
    clearAll,
  } = useFdaFetch();

  const existingAreas = useMemo(() => getExistingTherapeuticAreas(data), [data]);

  const handleFetch = async () => {
    if (!startDate || !endDate) {
      toast.error("날짜 범위를 선택해주세요.");
      return;
    }
    const result = await fetchFdaData(startDate, endDate, data);
    if (result.added > 0) {
      toast.success(`${result.added}건의 새로운 승인 데이터를 가져왔습니다.`);
    } else {
      toast.info("새로운 승인 데이터가 없습니다.");
    }
  };

  const makeDedupKey = (d: DrugApproval) =>
    `${d.applicationNo}-${d.approvalDate}-${d.supplementCategory || ""}`;

  const handleApproveItem = (id: string) => {
    const drug = approveItem(id);
    if (drug) {
      const existingKeys = new Set(data.map(makeDedupKey));
      if (existingKeys.has(makeDedupKey(drug))) {
        toast.error(`${drug.brandName}은(는) 이미 대시보드에 존재합니다. (중복)`);
        return;
      }
      onDataUpdate([...data, drug]);
      toast.success(`${drug.brandName} 승인 완료. 대시보드에 반영되었습니다.`);
    }
  };

  const handleApproveAll = () => {
    if (pendingItems.length === 0) return;
    const drugs = approveAll();
    const existingKeys = new Set(data.map(makeDedupKey));
    const newDrugs = drugs.filter(d => {
      const key = makeDedupKey(d);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    const skipped = drugs.length - newDrugs.length;
    onDataUpdate([...data, ...newDrugs]);
    if (skipped > 0) {
      toast.success(`${newDrugs.length}건 승인 완료. ${skipped}건 중복 제외.`);
    } else {
      toast.success(`${newDrugs.length}건 전체 승인 완료. 대시보드에 반영되었습니다.`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 relative">
          <RefreshCw className="h-4 w-4" />
          FDA 수집
          {pendingItems.length > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 min-w-5 text-xs px-1">
              {pendingItems.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            FDA 실시간 데이터 수집
          </DialogTitle>
          <DialogDescription>
            openFDA API에서 최신 승인 데이터를 가져옵니다. 국문 번역을 확인/수정한 후 승인하세요.
          </DialogDescription>
        </DialogHeader>

        {/* 날짜 범위 + 가져오기 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">시작일</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                  {startDate ? format(startDate, "yyyy-MM-dd") : "시작일"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} locale={ko} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">종료일</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                  {endDate ? format(endDate, "yyyy-MM-dd") : "종료일"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} locale={ko} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <Button size="sm" className="gap-2" onClick={handleFetch} disabled={isFetching}>
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                수집 중...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                데이터 가져오기
              </>
            )}
          </Button>
        </div>

        {/* 에러 메시지 */}
        {fetchError && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded p-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {fetchError}
          </div>
        )}

        {/* 대기 목록 헤더 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            대기 목록 ({pendingItems.length}건)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs text-destructive hover:text-destructive"
              onClick={() => setShowClearConfirm(true)}
              disabled={pendingItems.length === 0}
            >
              <Trash2 className="h-3 w-3" />
              전체 삭제
            </Button>
            <Button
              size="sm"
              className="gap-1 text-xs"
              onClick={handleApproveAll}
              disabled={pendingItems.length === 0}
            >
              <CheckCheck className="h-3 w-3" />
              전체 승인
            </Button>
          </div>
        </div>

        {/* 전체 삭제 확인 */}
        {showClearConfirm && (
          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
            <TriangleAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-destructive">
                대기 목록 전체 삭제
              </p>
              <p className="text-xs text-muted-foreground">
                {pendingItems.length}건의 대기 데이터가 모두 삭제됩니다.
                삭제 후 다시 가져오면 최신 번역이 적용됩니다.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    clearAll();
                    setShowClearConfirm(false);
                    toast.success("대기 목록이 전체 삭제되었습니다.");
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  삭제 확인
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowClearConfirm(false)}
                >
                  취소
                </Button>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 pr-3">
            {pendingItems.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                대기 중인 데이터가 없습니다. 날짜를 선택하고 "데이터 가져오기"를 클릭하세요.
              </div>
            ) : (
              pendingItems.map(item => (
                <PendingItemCard
                  key={item.id}
                  item={item}
                  existingAreas={existingAreas}
                  onUpdate={updatePendingItem}
                  onApprove={handleApproveItem}
                  onRemove={removePendingItem}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
