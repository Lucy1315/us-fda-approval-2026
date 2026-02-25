import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DrugApproval } from "@/data/fdaData";
import { Eye, ExternalLink, Search, RotateCcw, FilePlus, FileEdit } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// 최초승인/변경승인 여부 판단
function isSupplementApproval(drug: DrugApproval): boolean {
  const cat = drug.supplementCategory || "";
  return cat.includes("SUPPL");
}

interface DrugTableProps {
  data: DrugApproval[];
}

function getFdaProductUrl(drug: DrugApproval): string {
  // Rule:
  // 1) Default to Drugs@FDA (CDER) lookup for consistency.
  // 2) Add explicit exceptions ONLY for products that are not in Drugs@FDA
  //    (e.g., CBER-regulated tissue / cellular & gene therapy products).
  // Use brandName as key to prevent URL breakage when applicationNo is corrected via FDA validation.
  const cberByBrandName: Record<string, string> = {
    // AVANCE: Tissue product (CBER)
    "AVANCE": "https://www.fda.gov/vaccines-blood-biologics/avance",
    // BREYANZI: CAR-T Cellular/Gene Therapy (CBER)
    "BREYANZI": "https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/breyanzi-lisocabtagene-maraleucel",
    // WASKYRA: Gene Therapy (CBER)
    "WASKYRA": "https://www.fda.gov/vaccines-blood-biologics/waskyra",
  };

  // Check by brandName (case-insensitive, uppercase normalized)
  const normalizedBrandName = drug.brandName.toUpperCase().trim();
  if (cberByBrandName[normalizedBrandName]) return cberByBrandName[normalizedBrandName];

  // Prefer the explicit dataset URL when present.
  // - CBER products are frequently NOT in Drugs@FDA, so their fdaUrl must be honored.
  // - Many approvals have official press-release pages; those are acceptable and stable enough.
  if (drug.fdaUrl && /^https?:\/\//i.test(drug.fdaUrl)) {
    return drug.fdaUrl;
  }

  // Default: Drugs@FDA database lookup - works for NDA and most CDER BLAs
  return `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${drug.applicationNo}`;
}

// 승인 유형 요약 생성
function getApprovalTypeSummary(drug: DrugApproval): string {
  const category = drug.supplementCategory || "";
  const notes = drug.notes || "";
  
  // ORIG-1: 최초승인 (신약)
  if (category.includes("ORIG-1") || category.includes("New Molecular Entity")) {
    if (drug.isNovelDrug) {
      return "🆕 최초승인 (신규 분자 실체, NME) - FDA 최초 승인 신약";
    }
    return "🆕 최초승인 (신규 분자 실체)";
  }
  
  // Biosimilar
  if (category.includes("Biosimilar") || drug.isBiosimilar) {
    return "🧬 최초승인 (바이오시밀러) - 기존 생물의약품의 동등 생물의약품";
  }
  
  // Type 3: New Dosage Form (최초승인이지만 새 제형)
  if (category.includes("Type 3") || category.includes("New Dosage Form")) {
    return "📦 최초승인 (신규 제형) - 기존 성분의 새로운 제형";
  }
  
  // SUPPL - Efficacy (New Indication)
  if (category.includes("SUPPL") && (category.includes("Efficacy") || category.includes("New Indication"))) {
    return "📝 변경승인 (적응증 추가) - 기존 승인 의약품의 새로운 적응증";
  }
  
  // SUPPL - New Dosage Form
  if (category.includes("SUPPL") && category.includes("Dosage Form")) {
    return "📝 변경승인 (제형 추가) - 기존 승인 의약품의 새로운 제형";
  }
  
  // SUPPL - Labeling
  if (category.includes("SUPPL") && category.includes("Labeling")) {
    return "📝 변경승인 (라벨링) - 허가사항 변경";
  }
  
  // Generic SUPPL
  if (category.includes("SUPPL") || notes.includes("변경승인")) {
    return "📝 변경승인 - 기존 승인 의약품의 허가사항 변경";
  }
  
  // 비고에서 추정
  if (notes.includes("적응증 추가") || notes.includes("적응증 확대")) {
    return "📝 변경승인 (적응증 추가)";
  }
  
  if (notes.includes("FDA 최초 승인")) {
    return "🆕 최초승인 - FDA 최초 승인";
  }
  
  // Default
  return "🆕 최초승인";
}

export function DrugTable({ data }: DrugTableProps) {
  const [selectedDrug, setSelectedDrug] = useState<DrugApproval | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(drug => 
      drug.brandName.toLowerCase().includes(term) ||
      drug.activeIngredient.toLowerCase().includes(term) ||
      drug.sponsor.toLowerCase().includes(term) ||
      drug.therapeuticArea.toLowerCase().includes(term) ||
      drug.ndaBlaNumber.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">승인 약물 상세 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            필터 조건에 맞는 데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">
            승인 약물 상세 목록 ({filteredData.length}건{searchTerm && ` / 전체 ${data.length}건`})
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="검색 (제품명, 성분, 제약사...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-[250px] h-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm("")}
              disabled={!searchTerm}
              className="h-9"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              초기화
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px]">승인일</TableHead>
                  <TableHead className="w-[150px]">제품명</TableHead>
                  <TableHead className="w-[150px]">주성분</TableHead>
                  <TableHead className="w-[140px]">제약사</TableHead>
                  <TableHead className="w-[130px]">치료영역</TableHead>
                  <TableHead className="w-[200px]">
                    <div className="flex items-center gap-2">
                      <span>구분</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        (<FilePlus className="h-3 w-3 text-violet-600 inline" />:최초
                        <FileEdit className="h-3 w-3 text-blue-600 inline" />:변경)
                      </span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px]">상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((drug) => (
                  <TableRow
                    key={`${drug.applicationNo}-${drug.approvalDate}-${drug.supplementCategory || ""}`}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <TableCell className="font-medium text-sm">
                      {drug.approvalDate}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <a 
                          href={getFdaProductUrl(drug)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-primary hover:underline hover:text-primary/80 transition-colors"
                        >
                          {drug.brandName}
                        </a>
                        <span className="text-xs text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded w-fit">
                          {drug.ndaBlaNumber}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {drug.activeIngredient}
                    </TableCell>
                    <TableCell className="text-sm">
                      {drug.sponsor.length > 20 ? drug.sponsor.slice(0, 20) + "..." : drug.sponsor}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={drug.isOncology ? "default" : "secondary"}
                        className={drug.isOncology ? "bg-chart-oncology hover:bg-chart-oncology/80" : ""}
                      >
                        {drug.therapeuticArea.split(" - ")[1] || drug.therapeuticArea}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 items-center">
                        {/* 최초/변경승인 아이콘 */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${isSupplementApproval(drug) ? "bg-blue-100 text-blue-600" : "bg-violet-100 text-violet-600"}`}>
                                {isSupplementApproval(drug) ? (
                                  <FileEdit className="h-3.5 w-3.5" />
                                ) : (
                                  <FilePlus className="h-3.5 w-3.5" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{isSupplementApproval(drug) ? "변경승인 (SUPPL)" : "최초승인 (ORIG)"}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {drug.isNovelDrug && (
                          <Badge variant="outline" className="text-xs border-violet-500 text-violet-600 bg-violet-50">
                            신약
                          </Badge>
                        )}
                        {drug.isOrphanDrug && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50">
                            희귀의약품
                          </Badge>
                        )}
                        {drug.isBiosimilar && (
                          <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600 bg-emerald-50">
                            바이오시밀러
                          </Badge>
                        )}
                        {drug.isCberProduct && (
                          <Badge variant="outline" className="text-xs border-rose-500 text-rose-600 bg-rose-50">
                            CBER
                          </Badge>
                        )}
                        {drug.approvalType === "신속승인" && (
                          <Badge variant="outline" className="text-xs border-secondary bg-secondary/10 text-secondary">
                            신속승인
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDrug(drug)}
                        className="text-primary hover:text-primary/80 hover:bg-primary/10"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        상세
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDrug} onOpenChange={(open) => !open && setSelectedDrug(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-primary">ℹ</span>
              승인 상세 정보
            </DialogTitle>
          </DialogHeader>
          
          {selectedDrug && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">제품명</p>
                <p className="font-semibold">{selectedDrug.brandName}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">주성분</p>
                <p className="text-primary">{selectedDrug.activeIngredient}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">제약사</p>
                <p>{selectedDrug.sponsor}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">적응증</p>
                <p className="text-sm">{selectedDrug.indicationFull}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">치료영역</p>
                <p>{selectedDrug.therapeuticArea}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">승인일</p>
                  <p>{selectedDrug.approvalDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">승인 유형</p>
                  <p>{selectedDrug.approvalType}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">NDA/BLA 번호</p>
                  <p>{selectedDrug.ndaBlaNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">신청 유형</p>
                  <p>{selectedDrug.applicationType}</p>
                </div>
              </div>
              
              {selectedDrug.supplementCategory && (
                <div>
                  <p className="text-sm text-muted-foreground">Supplement Categories or Approval Type</p>
                  <p className="text-sm font-medium text-blue-600">{selectedDrug.supplementCategory}</p>
                </div>
              )}
              
              <div>
                <p className="text-sm text-muted-foreground">비고</p>
                <p className="text-sm font-medium text-primary mb-1">
                  {getApprovalTypeSummary(selectedDrug)}
                </p>
                {selectedDrug.notes && (
                  <p className="text-sm text-muted-foreground">{selectedDrug.notes}</p>
                )}
              </div>
              
              <Button 
                className="w-full mt-4" 
                onClick={() => window.open(getFdaProductUrl(selectedDrug), '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                FDA 페이지 보기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
