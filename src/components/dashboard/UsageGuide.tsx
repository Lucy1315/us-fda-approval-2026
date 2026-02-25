import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function UsageGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          사용 방법
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HelpCircle className="h-5 w-5 text-primary" />
            대시보드 사용 방법
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            {/* 워크플로우 요약 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">🚀 데이터 관리 워크플로우</h3>
              <div className="space-y-2 pl-2 text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-foreground">1.</span>
                  <span><strong className="text-foreground">엑셀 업로드</strong> → 대시보드에 즉시 반영 (세션 임시 저장)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-foreground">2.</span>
                  <span><strong className="text-foreground">FDA 검증</strong> → 불일치 항목 확인 및 수정</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-foreground">3.</span>
                  <span><strong className="text-foreground">"확정" 버튼</strong> → 클라우드에 영구 저장 + 대시보드 갱신</span>
                </div>
              </div>
            </section>

            {/* 필터 사용법 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">📊 필터 사용법</h3>
              <div className="space-y-3 pl-2">
                <div>
                  <h4 className="font-medium mb-1">승인일 필터</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>드롭다운에서 <strong className="text-foreground">"직접 선택"</strong>을 클릭하면 달력이 표시됩니다</li>
                    <li>시작일과 종료일을 <strong className="text-foreground">YY-MM-DD</strong> 형태로 선택하여 기간 필터링이 가능합니다</li>
                    <li>사전 설정된 옵션(전체, 최근 7일, 최근 30일 등)도 사용 가능합니다</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-1">기타 필터</h4>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><strong className="text-foreground">신청유형:</strong> NDA(화학의약품) / BLA(생물의약품) 구분</li>
                    <li><strong className="text-foreground">제약사:</strong> 특정 제약회사별 필터링</li>
                    <li><strong className="text-foreground">치료영역:</strong> 치료 분야별 필터링</li>
                    <li><strong className="text-foreground">항암제/바이오시밀러/신약/희귀의약품:</strong> 각 카테고리별 필터링</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 엑셀 다운로드 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">📥 엑셀 다운로드</h3>
              <div className="space-y-3 pl-2">
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>우측 상단의 <strong className="text-foreground">"엑셀 다운로드"</strong> 버튼을 클릭합니다</li>
                  <li>현재 화면에 적용된 필터 조건에 맞는 데이터가 엑셀로 저장됩니다</li>
                  <li>다운로드되는 엑셀 파일에는 다음 시트가 포함됩니다:
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li><strong className="text-foreground">요약:</strong> 승인 현황 통계 및 치료영역 분포</li>
                      <li><strong className="text-foreground">상세 (한글):</strong> 한글 상세 정보</li>
                      <li><strong className="text-foreground">Details (English):</strong> 영문 상세 정보</li>
                      <li><strong className="text-foreground">최초승인 (ORIG-1):</strong> 신약 최초 승인 목록</li>
                      <li><strong className="text-foreground">변경승인 (SUPPL):</strong> 적응증 추가 등 변경 승인 목록</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            {/* 데이터 업로드 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">📤 데이터 업로드</h3>
              <div className="space-y-3 pl-2">
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>우측 상단의 <strong className="text-foreground">"엑셀 업로드"</strong> 버튼을 클릭합니다</li>
                  <li>엑셀 파일(.xlsx, .xls)을 선택하여 데이터를 업데이트할 수 있습니다</li>
                  <li>업로드된 데이터는 기존 데이터에 <strong className="text-foreground">병합(추가)</strong>됩니다 (기존 데이터를 대체하지 않음)</li>
                  <li>허가번호, 승인일, 승인유형이 동일한 항목은 중복으로 처리되어 추가되지 않습니다</li>
                  <li>업로드 후 <strong className="text-foreground">"확정"</strong> 버튼을 눌러야 클라우드에 영구 저장됩니다</li>
                </ul>
              </div>
            </section>

            {/* FDA 검증 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">🔍 FDA 검증</h3>
              <div className="space-y-3 pl-2">
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>상단의 <strong className="text-foreground">"FDA 검증"</strong> 버튼을 클릭합니다</li>
                  <li>openFDA API를 통해 현재 데이터의 브랜드명, 스폰서 정보가 공식 데이터와 일치하는지 검증합니다</li>
                  <li>불일치 항목이 발견되면 목록으로 표시되며, 개별적으로 수정 여부를 선택할 수 있습니다</li>
                  <li>수정 후 <strong className="text-foreground">"적용"</strong> 버튼을 눌러야 대시보드에 반영됩니다</li>
                  <li>검증 완료 후 <strong className="text-foreground">"확정"</strong> 버튼을 눌러 클라우드에 저장하세요</li>
                </ul>
              </div>
            </section>

            {/* 데이터 확정 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">☁️ 데이터 확정 (클라우드 저장)</h3>
              <div className="space-y-3 pl-2">
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>우측 상단의 <strong className="text-foreground">"확정"</strong> 버튼을 클릭합니다</li>
                  <li>현재 세션의 데이터가 클라우드에 영구 저장됩니다</li>
                  <li>저장된 데이터는 <strong className="text-foreground">프리뷰/공개 사이트 모두에서 동일하게</strong> 표시됩니다</li>
                  <li>엑셀 다운로드 시에도 확정된 최신 데이터가 반영됩니다</li>
                </ul>
              </div>
            </section>

            {/* 통계 카드 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">📈 통계 카드</h3>
              <div className="space-y-3 pl-2">
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>상단의 7개 통계 카드에서 주요 승인 현황을 한눈에 확인할 수 있습니다</li>
                  <li>필터를 적용하면 통계 수치가 실시간으로 업데이트됩니다</li>
                </ul>
              </div>
            </section>

            {/* 차트 및 테이블 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">📋 차트 및 테이블</h3>
              <div className="space-y-3 pl-2">
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li><strong className="text-foreground">치료영역별 분포:</strong> 바 차트로 치료영역별 승인 건수 확인</li>
                  <li><strong className="text-foreground">승인유형/약물분류:</strong> 파이 차트로 승인 유형 및 항암제 비율 확인</li>
                  <li><strong className="text-foreground">주요 하이라이트:</strong> 주목할 만한 승인 건 요약</li>
                  <li><strong className="text-foreground">상세 테이블:</strong> 전체 승인 목록을 테이블 형태로 확인
                    <ul className="list-disc list-inside ml-4 mt-1">
                      <li>제품명 클릭 시 FDA 공식 페이지로 이동</li>
                      <li>검색창에서 제품명, 성분, 제약사 등으로 검색 가능</li>
                      <li>"초기화" 버튼으로 검색 조건 초기화</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            {/* 색상 범례 */}
            <section>
              <h3 className="font-semibold text-base mb-3 text-primary">🎨 색상 범례</h3>
              <div className="space-y-2 pl-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-accent/60"></div>
                  <span className="text-muted-foreground">항암제 (Oncology)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-biosimilar/60"></div>
                  <span className="text-muted-foreground">바이오시밀러 (Biosimilar)</span>
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
