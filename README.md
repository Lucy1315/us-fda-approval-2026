# US FDA 승인 전문의약품 대시보드

미국 FDA 전문의약품 승인 데이터를 시각화하고 관리하는 대시보드 애플리케이션입니다.

## 📋 문서

- **[기술 문서 (DASHBOARD_IMPLEMENTATION.md)](docs/DASHBOARD_IMPLEMENTATION.md)** - 데이터 아키텍처, 워크플로우, 개발 가이드

---

## 🚀 주요 기능

### 데이터 시각화
- 통계 카드 (전체, 항암제, 바이오시밀러, 신약, 희귀의약품, NDA/BLA)
- 치료영역별 도넛 차트
- 주요 하이라이트 요약

### 필터링 & 검색
- 기간별 필터 (1개월/3개월/6개월/1년/2년/직접선택)
- 신청 유형 (NDA/BLA)
- 제약사, 치료영역
- 항암제/바이오시밀러/신약/희귀의약품 여부
- 통합 검색 (제품명, 성분명, 스폰서, 허가번호)

### 데이터 관리
- 엑셀 업로드 (기존 데이터와 병합)
- 엑셀 내보내기 (다중 시트)
- FDA API 검증
- 클라우드 저장 (버전 관리)

---

## 🛠 기술 스택

| 분류 | 기술 |
|------|------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Charts** | Recharts |
| **Excel** | ExcelJS |
| **Backend** | Lovable Cloud (Edge Functions) |
| **Database** | PostgreSQL (Supabase) |

---

## 📦 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/Lucy1315/us-fda-dashbord.git

# 디렉토리 이동
cd us-fda-dashbord

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

---

## 📁 프로젝트 구조

```
src/
├── pages/
│   └── Index.tsx              # 메인 대시보드
├── components/dashboard/      # 대시보드 컴포넌트
│   ├── Header.tsx
│   ├── Filters.tsx
│   ├── DrugTable.tsx
│   ├── StatCard.tsx
│   ├── TherapeuticAreaChart.tsx
│   ├── FdaValidation.tsx
│   ├── ExcelUpload.tsx
│   ├── FdaNovelDrugsExport.tsx
│   ├── DataCommit.tsx
│   └── UsageGuide.tsx
├── data/
│   └── fdaData.ts             # 기본 데이터 및 타입
├── hooks/
│   └── useCloudData.ts        # 클라우드 데이터 관리
└── integrations/supabase/     # 백엔드 연동

supabase/functions/            # Edge Functions
├── validate-fda-data/         # FDA API 검증
└── persist-fda-data/          # 클라우드 저장

docs/
└── DASHBOARD_IMPLEMENTATION.md  # 기술 문서
```

---

## 🔄 워크플로우

### 일반 사용
1. 대시보드 접속 → 자동 데이터 로드
2. 필터/검색으로 데이터 조회
3. 상세 정보 확인 또는 엑셀 내보내기

### 데이터 업데이트
1. **소스 코드 수정** 또는 **엑셀 업로드**
2. FDA 검증 (선택)
3. **확정 버튼** 클릭 → 클라우드 저장

---

## 🔗 링크

| 환경 | URL |
|------|-----|
| **Preview** | https://id-preview--bd00b1a0-3925-46e7-b5b1-36e545a7d2ab.lovable.app |
| **Production** | https://us-fda-approval.lovable.app |
| **GitHub** | https://github.com/Lucy1315/us-fda-dashbord |

---

## 📊 데이터 범위

### 포함
- 신약 승인 (NDA/BLA)
- 제형 변경, 적응증 추가 등 주요 변경 승인

### 제외
- 제네릭 의약품 (ANDA)
- 일반의약품 (OTC)

---

## 📄 라이선스

MIT License

---

*최종 업데이트: 2026-01-30*
