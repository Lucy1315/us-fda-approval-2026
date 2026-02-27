# US FDA 신약 승인 대시보드 (2026)

미국 FDA 신약 승인 데이터를 실시간으로 모니터링하고 분석하는 대시보드 웹 애플리케이션입니다.

---

## 주요 기능

### 데이터 시각화
- 통계 카드 7종 (전체 승인, 항암제, 신약, 희귀의약품, 바이오시밀러, BLA, NDA)
- 치료 영역별 바 차트 (상위 8개 영역 + 항암 적응증 Top 6)
- 주요 하이라이트 요약 (희귀의약품/신약 비율, 주요 신약 소개)

### 필터링 & 검색
- 기간별 필터 (1개월/3개월/6개월/1년/2년/직접선택)
- 신청 유형 (NDA/BLA)
- 제약사, 치료영역별 필터
- 항암제/바이오시밀러/신약/희귀의약품 여부
- 통합 검색 (제품명, 성분명, 스폰서, 허가번호)

### 데이터 관리 (관리자)
- 엑셀 업로드 (기존 데이터와 자동 병합·중복 제거)
- 엑셀 내보내기 (5시트: 요약, 국문상세, English, 최초승인, 변경승인)
- openFDA API 대조를 통한 데이터 검증
- 대기 승인 목록 관리 (openFDA 연동)
- 클라우드 저장 (Supabase 버전 관리)

### 이메일 보고서
- Outlook 호환 HTML 보고서 자동 생성
- 엑셀 첨부파일 자동 발송
- 대시보드 UI 및 CLI 스크립트 양방향 지원

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프론트엔드 | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| 차트 | Recharts |
| 백엔드/DB | Supabase (PostgreSQL + Edge Functions) |
| 엑셀 | ExcelJS |
| 이메일 | Express + Nodemailer (Gmail SMTP) |
| 라우팅 | React Router DOM v6 |
| 테스트 | Vitest + Testing Library |

---

## 설치 및 실행

### 사전 요구사항

- Node.js 18+
- npm

### 설치

```bash
git clone https://github.com/Lucy1315/us-fda-approval-2026.git
cd us-fda-approval-2026
npm install
```

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다:

```env
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"
VITE_SUPABASE_URL="https://your-project.supabase.co"

# Gmail SMTP 설정 (이메일 발송용)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="FDA Dashboard <your-email@gmail.com>"
```

### 실행

```bash
# 개발 서버 (Vite + 이메일 서버 동시 실행)
npm run dev

# Vite만 실행
npm run dev:vite

# 프로덕션 빌드
npm run build

# 테스트
npm run test
```

---

## 프로젝트 구조

```
src/
├── pages/
│   └── Index.tsx                    # 메인 대시보드 페이지
├── components/
│   ├── dashboard/                   # 대시보드 핵심 컴포넌트
│   │   ├── Header.tsx               # 헤더 (제목, 통계, 관리자 메뉴)
│   │   ├── Filters.tsx              # 필터 패널
│   │   ├── StatCard.tsx             # 통계 카드
│   │   ├── TherapeuticAreaChart.tsx  # 치료 영역 차트
│   │   ├── DrugTable.tsx            # 약물 상세 테이블
│   │   ├── Highlights.tsx           # 주요 수치 하이라이트
│   │   ├── ExcelUpload.tsx          # 엑셀 업로드
│   │   ├── FdaNovelDrugsExport.tsx  # 엑셀 다운로드
│   │   ├── EmailExportDialog.tsx    # 이메일 발송 다이얼로그
│   │   ├── FdaValidation.tsx        # FDA 데이터 검증
│   │   ├── PendingApprovals.tsx     # 대기 승인 관리
│   │   └── UsageGuide.tsx           # 사용 가이드
│   └── ui/                          # shadcn/ui 컴포넌트
├── data/
│   ├── fdaData.ts                   # FDA 데이터 타입 및 초기 데이터셋
│   └── therapeuticAreaMap.ts        # 치료 영역 매핑 (한↔영)
├── hooks/
│   ├── useCloudData.ts              # 클라우드 데이터 동기화
│   ├── useFdaFetch.ts               # openFDA API 연동
│   └── useAdminMode.ts              # 관리자 모드
└── lib/
    ├── generateSummaryHtml.ts       # 이메일 HTML 생성
    └── emailExcelGenerator.ts       # 이메일용 엑셀 생성

server/
├── email.ts                         # Express 이메일 서버 (포트 3001)
└── send-report.ts                   # 보고서 일괄 발송 스크립트

supabase/
├── functions/                       # Edge Functions
└── migrations/                      # DB 마이그레이션
```

---

## 워크플로우

### 일반 사용
1. 대시보드 접속 → 자동 데이터 로드
2. 필터/검색으로 데이터 조회
3. 상세 정보 확인 또는 엑셀 내보내기

### 관리자 데이터 업데이트
1. 관리자 로그인
2. 엑셀 업로드 또는 대기 승인 목록에서 신규 데이터 추가
3. FDA 검증으로 데이터 정합성 확인
4. 확정 버튼 → Supabase 클라우드 저장

### 이메일 보고서 발송
```bash
# 이메일 서버 확인
lsof -i :3001 | grep LISTEN

# 보고서 발송 (수신자/날짜: server/send-report.ts에서 설정)
npx tsx server/send-report.ts
```

---

## 데이터 범위

### 포함
- 신약 승인 (NDA/BLA)
- 제형 변경, 적응증 추가 등 주요 변경 승인 (Supplemental)
- CBER 제품 (세포/유전자 치료제)

### 제외
- 제네릭 의약품 (ANDA)
- 일반의약품 (OTC)

---

## 라이선스

MIT License

---

*최종 업데이트: 2026-02-27*
