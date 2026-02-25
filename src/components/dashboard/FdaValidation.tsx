import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, XCircle, Loader2, AlertTriangle, Edit, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { DrugApproval } from "@/data/fdaData";
import { toast } from "sonner";

interface FdaValidationProps {
  data: DrugApproval[];
  onDataUpdate?: (data: DrugApproval[]) => void;
}

interface ValidationResult {
  applicationNo: string;
  brandName: string;
  isValid: boolean;
  fdaBrandNames: string[];
  fdaSponsor: string | null;
  error?: string;
}

interface EditState {
  applicationNo: string;
  newBrandName: string;
  newApplicationNo: string;
}

export function FdaValidation({ data, onDataUpdate }: FdaValidationProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [activeTab, setActiveTab] = useState("validate");
  const [editingItem, setEditingItem] = useState<EditState | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEditingItem(null);
  }, [isOpen]);

  const handleValidate = async () => {
    setIsValidating(true);
    setResults([]);
    
    const uniqueApps = new Map<string, { applicationNo: string; brandName: string; applicationType: string }>();
    
    data.forEach((drug) => {
      const key = drug.applicationNo;
      if (!uniqueApps.has(key)) {
        uniqueApps.set(key, {
          applicationNo: drug.applicationNo,
          brandName: drug.brandName,
          applicationType: drug.applicationType,
        });
      }
    });

    const items = Array.from(uniqueApps.values());
    setProgress({ current: 0, total: items.length });

    const batchSize = 10;
    const allResults: ValidationResult[] = [];

    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        const { data: responseData, error } = await supabase.functions.invoke(
          "validate-fda-data",
          { body: { items: batch } }
        );

        if (error) {
          console.error("Validation error:", error);
          toast.error(`검증 오류: ${error.message}`);
          break;
        }

        if (responseData?.results) {
          allResults.push(...responseData.results);
        }

        setProgress({ current: Math.min(i + batchSize, items.length), total: items.length });
        setResults([...allResults]);

        if (i + batchSize < items.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      const invalidCount = allResults.filter((r) => !r.isValid).length;
      if (invalidCount > 0) {
        toast.warning(`${invalidCount}건의 불일치 항목이 발견되었습니다.`);
        setActiveTab("fix");
      } else {
        toast.success("모든 데이터가 FDA 공식 데이터와 일치합니다.");
      }
    } catch (err) {
      console.error("Validation failed:", err);
      toast.error("검증 중 오류가 발생했습니다.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartEdit = (result: ValidationResult) => {
    setEditingItem({
      applicationNo: result.applicationNo,
      newBrandName: result.fdaBrandNames[0] || result.brandName,
      newApplicationNo: result.applicationNo,
    });
  };

  // Helper: strip "BLA " or "NDA " prefix from an application number if present
  const stripApplicationPrefix = (appNo: string): string => {
    return appNo.replace(/^(BLA|NDA)\s+/i, "").trim();
  };

  // Helper: Generate FDA URL based on application number (Drugs@FDA)
  const generateFdaUrl = (applicationNo: string): string => {
    return `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${applicationNo}`;
  };

  const isDrugsAtFdaUrl = (url?: string) => {
    if (!url) return false;
    return /accessdata\.fda\.gov\/scripts\/cder\/daf\/index\.cfm\?event=overview\.process&ApplNo=/i.test(url);
  };

  // Local helper to remove accidental duplicates before committing to the dashboard.
  // (Same logic as Index.tsx: applicationNo + approvalDate + brandName + supplementCategory)
  const deduplicate = (items: DrugApproval[]) => {
    const seen = new Set<string>();
    return items.filter((drug) => {
      const key = `${drug.applicationNo}-${drug.approvalDate}-${drug.brandName}-${drug.supplementCategory || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleApplyFix = (result: ValidationResult) => {
    if (!editingItem || !onDataUpdate) return;

    // Strip duplicate prefix from user input
    const cleanedAppNo = stripApplicationPrefix(editingItem.newApplicationNo);

    const updatedData = data.map((drug) => {
      if (drug.applicationNo === result.applicationNo) {
        const applicationType = drug.applicationType;
        const newFdaUrl = drug.isCberProduct
          ? drug.fdaUrl
          : (drug.fdaUrl && !isDrugsAtFdaUrl(drug.fdaUrl))
            ? drug.fdaUrl
            : generateFdaUrl(cleanedAppNo);
        return {
          ...drug,
          brandName: editingItem.newBrandName,
          applicationNo: cleanedAppNo,
          ndaBlaNumber: `${applicationType} ${cleanedAppNo}`,
          fdaUrl: newFdaUrl,
        };
      }
      return drug;
    });

    // 즉시 대시보드에 반영
    const committed = deduplicate(updatedData);
    onDataUpdate(committed);

    // Update the result in local state
    setResults((prev) =>
      prev.map((r) =>
        r.applicationNo === result.applicationNo
          ? { ...r, brandName: editingItem.newBrandName, applicationNo: cleanedAppNo, isValid: true }
          : r
      )
    );

    toast.success(`✅ ${result.brandName} → ${editingItem.newBrandName} 즉시 반영 완료`);
    setEditingItem(null);
  };

  const handleApplyFdaBrandName = (result: ValidationResult, fdaBrandName: string) => {
    if (!onDataUpdate) return;

    const updatedData = data.map((drug) => {
      if (drug.applicationNo === result.applicationNo) {
        return {
          ...drug,
          brandName: fdaBrandName,
        };
      }
      return drug;
    });

    // 즉시 대시보드에 반영
    const committed = deduplicate(updatedData);
    onDataUpdate(committed);

    setResults((prev) =>
      prev.map((r) =>
        r.applicationNo === result.applicationNo
          ? { ...r, brandName: fdaBrandName, isValid: true }
          : r
      )
    );

    toast.success(`✅ ${result.brandName} → ${fdaBrandName} 즉시 반영 완료`);
  };

  const handleApplyAllFixes = () => {
    if (!onDataUpdate) return;

    const fixableResults = invalidResults.filter(
      (r) => r.fdaBrandNames.length > 0 && !r.error?.includes("not found")
    );

    if (fixableResults.length === 0) {
      toast.warning("자동 수정 가능한 항목이 없습니다.");
      return;
    }

    let updatedData = [...data];
    const appliedFixes: string[] = [];

    fixableResults.forEach((result) => {
      const fdaBrandName = result.fdaBrandNames[0];
      updatedData = updatedData.map((drug) => {
        if (drug.applicationNo === result.applicationNo) {
          appliedFixes.push(`${result.brandName} → ${fdaBrandName}`);
          return {
            ...drug,
            brandName: fdaBrandName,
          };
        }
        return drug;
      });
    });

    // 즉시 대시보드에 반영
    const committed = deduplicate(updatedData);
    onDataUpdate(committed);

    setResults((prev) =>
      prev.map((r) => {
        const fixable = fixableResults.find((f) => f.applicationNo === r.applicationNo);
        if (fixable) {
          return { ...r, brandName: fixable.fdaBrandNames[0], isValid: true };
        }
        return r;
      })
    );

    toast.success(`✅ ${appliedFixes.length}건의 수정이 즉시 반영되었습니다.`);
  };

  const invalidResults = results.filter((r) => !r.isValid);
  const validResults = results.filter((r) => r.isValid);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Shield className="h-4 w-4" />
          <span className="hidden sm:inline">FDA 검증</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            openFDA API 데이터 검증
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="validate" className="gap-2">
              <Shield className="h-4 w-4" />
              검증
            </TabsTrigger>
            <TabsTrigger value="fix" className="gap-2" disabled={invalidResults.length === 0}>
              <Edit className="h-4 w-4" />
              불일치 수정 ({invalidResults.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validate" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">
              현재 데이터의 허가번호와 제품명이 FDA 공식 데이터베이스와 일치하는지 확인합니다.
            </div>

            <div className="flex items-center gap-4">
              <Button 
                onClick={handleValidate} 
                disabled={isValidating}
                className="gap-2"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    검증 중... ({progress.current}/{progress.total})
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    검증 시작
                  </>
                )}
              </Button>

              {results.length > 0 && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-primary">
                    <CheckCircle className="h-4 w-4" />
                    일치: {validResults.length}
                  </span>
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    불일치: {invalidResults.length}
                  </span>
                </div>
              )}
            </div>

            {validResults.length > 0 && invalidResults.length === 0 && (
              <div className="p-4 bg-primary/10 rounded-md border border-primary/20">
                <div className="flex items-center gap-2 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">모든 데이터가 FDA 공식 데이터와 일치합니다.</span>
                </div>
              </div>
            )}

            {invalidResults.length > 0 && (
              <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{invalidResults.length}건의 불일치 항목이 발견되었습니다.</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setActiveTab("fix")}
                    className="gap-1"
                  >
                    <Edit className="h-3 w-3" />
                    수정하기
                  </Button>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground border-t pt-3">
              <p>※ openFDA API를 통해 Drugs@FDA 데이터베이스를 조회합니다.</p>
              <p>※ CBER 제품(혈액제제, 백신 등)은 이 API에 포함되지 않을 수 있습니다.</p>
            </div>
          </TabsContent>

          <TabsContent value="fix" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                FDA 공식 데이터와 불일치하는 항목을 수정합니다. FDA 등록 제품명을 클릭하면 자동으로 적용됩니다.
              </div>
              {invalidResults.length > 0 && invalidResults.some((r) => r.fdaBrandNames.length > 0) && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleApplyAllFixes}
                  disabled={!onDataUpdate}
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  모두 적용
                </Button>
              )}
            </div>


            {invalidResults.length === 0 ? (
              <div className="p-4 bg-primary/10 rounded-md border border-primary/20 text-center">
                <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
                {results.length > 0 ? (
                  <>
                    <p className="font-medium text-primary">모든 데이터가 일치합니다.</p>
                    <p className="text-sm text-muted-foreground mt-1">수정할 항목이 없습니다.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-primary">수정할 항목이 없습니다.</p>
                    <p className="text-sm text-muted-foreground mt-1">먼저 검증을 실행해주세요.</p>
                  </>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[400px] border rounded-md">
                <div className="p-3 space-y-3">
                  {invalidResults.map((result, idx) => (
                    <div 
                      key={idx} 
                      className="p-4 bg-card rounded-md border"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {result.applicationNo}
                            </Badge>
                            <Badge variant="destructive" className="text-xs">
                              {result.error || "제품명 불일치"}
                            </Badge>
                          </div>
                          
                          <div>
                            <Label className="text-xs text-muted-foreground">현재 제품명</Label>
                            <div className="font-medium text-destructive">{result.brandName}</div>
                          </div>

                          {result.fdaBrandNames.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">FDA 등록 제품명 (클릭하여 적용)</Label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {result.fdaBrandNames.map((name, i) => (
                                  <Button
                                    key={i}
                                    variant="outline"
                                    size="sm"
                                    className="gap-1 text-primary border-primary/50 hover:bg-primary/10"
                                    onClick={() => handleApplyFdaBrandName(result, name)}
                                    disabled={!onDataUpdate}
                                  >
                                    <Check className="h-3 w-3" />
                                    {name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}

                          {result.fdaSponsor && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">FDA 스폰서: </span>
                              <span>{result.fdaSponsor}</span>
                            </div>
                          )}

                          {editingItem?.applicationNo === result.applicationNo ? (
                            <div className="space-y-2 p-3 bg-muted/50 rounded-md mt-2">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">허가번호</Label>
                                  <Input
                                    value={editingItem.newApplicationNo}
                                    onChange={(e) =>
                                      setEditingItem((prev) =>
                                        prev ? { ...prev, newApplicationNo: e.target.value } : null
                                      )
                                    }
                                    className="h-8"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">제품명</Label>
                                  <Input
                                    value={editingItem.newBrandName}
                                    onChange={(e) =>
                                      setEditingItem((prev) =>
                                        prev ? { ...prev, newBrandName: e.target.value } : null
                                      )
                                    }
                                    className="h-8"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingItem(null)}
                                >
                                  <X className="h-4 w-4" />
                                  취소
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleApplyFix(result)}
                                      disabled={!onDataUpdate}
                                >
                                  <Check className="h-4 w-4" />
                                  적용
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 mt-2"
                              onClick={() => handleStartEdit(result)}
                            >
                              <Edit className="h-3 w-3" />
                              직접 수정
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {!onDataUpdate && (
              <div className="text-xs text-destructive border-t pt-3">
                ※ 수정 기능을 사용하려면 데이터 업데이트 핸들러가 필요합니다.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
