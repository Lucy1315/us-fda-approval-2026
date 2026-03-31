# CLAUDE.md

## Project

US FDA 신약 승인 대시보드 (React + TypeScript + Vite)

## Tech Stack

- React 18 + TypeScript
- Vite (빌드 도구)
- Tailwind CSS + shadcn/ui (UI 컴포넌트)
- Recharts (차트)
- Supabase (백엔드/DB)
- ExcelJS (엑셀 가져오기/내보내기)
- React Router DOM (라우팅)
- Vitest + Testing Library (테스트)

## Commands

- `npm install` - 의존성 설치
- `npm run dev` - 개발 서버 실행
- `npm run build` - 프로덕션 빌드
- `npm run lint` - ESLint 실행
- `npm run test` - 테스트 실행
- `npm run test:watch` - 테스트 워치 모드

## Structure

```
src/
  pages/              # 페이지 컴포넌트 (Index, NotFound)
  components/
    dashboard/        # 대시보드 핵심 컴포넌트
    ui/               # shadcn/ui 컴포넌트
  data/
    fdaData.ts        # FDA 데이터 타입 및 초기 데이터셋
  hooks/              # 커스텀 훅 (useCloudData, useAuth 등)
  integrations/
    supabase/         # Supabase 클라이언트 및 타입
  lib/                # 유틸리티 함수
  test/               # 테스트 파일
supabase/
  functions/          # Edge Functions (validate, persist)
  migrations/         # DB 마이그레이션
```

## Conventions

- 한국어: 주석, 문서, 커밋 메시지
- 영어: 코드 (변수명, 함수명)
- TypeScript strict mode
- 함수형 컴포넌트 + React hooks
- 컴포넌트 파일: PascalCase (예: DrugTable.tsx)
- 훅 파일: camelCase (예: useCloudData.ts)

## Email Report (이메일 보고서 발송)

### 발송 방법
1. 이메일 서버가 실행 중인지 확인: `lsof -i :3001 | grep LISTEN`
2. 실행 중이 아니면: `npm run dev` (vite + 이메일 서버 동시 실행) 또는 `npm run email-server`
3. 보고서 발송: `npx tsx server/send-report.ts`

### 주요 파일
- `server/email.ts` — Express 이메일 서버 (포트 3001, Nodemailer + Gmail SMTP)
- `server/send-report.ts` — 보고서 발송 스크립트 (Supabase 데이터 로드 → HTML + 엑셀 생성 → 이메일 전송)
- `src/lib/generateSummaryHtml.ts` — 프론트엔드용 이메일 HTML 생성 (대시보드 이메일 발송 다이얼로그에서 사용)
- `src/lib/emailExcelGenerator.ts` — 엑셀 파일 생성 (5시트: 요약, 국문상세, English, 최초승인, 변경승인)
- `src/components/dashboard/EmailExportDialog.tsx` — 대시보드 이메일 발송 UI

### 발송 설정 (server/send-report.ts 수정)
- **수신자**: `recipients` 배열 (예: `["jisoo.kim@samyang.com"]`)
- **날짜 범위**: `START`, `END` 상수 (예: `"2026-02-01"`, `"2026-02-26"`)
- **정렬**: 승인일 오름차순
- **첨부파일**: `US-FDA-Approvals_filtered_YYYYMMDD.xlsx`

### 이메일 본문 구성
- Outlook 호환 테이블 레이아웃 (인라인 스타일만 사용)
- 통계 카드: 전체승인 / 항암제 / 신약 / 희귀의약품 / 바이오시밀러 / BLA / NDA
- 약물 상세 목록: 좌측 컬러바(항암제=주황, 바이오시밀러=녹색) + 태그 박스(항암제/신약/희귀/바이오시밀러)
- 폰트: Malgun Gothic, 제목 20px / 부제목 13px / 본문 14px / 테이블 12px / 헤더·통계 11px / 푸터 11px

### SMTP 설정 (.env)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Vite 프록시: `/api` → `localhost:3001` (vite.config.ts)

### 주의사항
- `server/send-report.ts`와 `src/lib/generateSummaryHtml.ts`의 HTML 템플릿을 동기화할 것
- 포트 3001이 이미 사용 중이면 이메일 서버 시작 실패 → 기존 프로세스 종료 후 재시작
- 이메일 버튼/링크에 Outlook VML(`v:roundrect`) 사용 금지 — 클릭 안 되는 문제 있음. 일반 `<a>` 태그에 인라인 스타일로 버튼 구현할 것

## Git

- 커밋 메시지 한국어
- 브랜치: feature/, fix/, refactor/ 접두사
- 원격 저장소: `https://github.com/Lucy1315/us-fda-approval-2026.git` (origin)
