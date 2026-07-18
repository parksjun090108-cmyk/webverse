# WebVerse

인터넷 방문 습관을 우주로 시각화하는 개인 인터넷 플랫폼입니다. 웹 앱과 `extension/`의 WebExtensions 기반 방문 동기화 확장 프로그램으로 구성됩니다.

인터넷을 우주처럼 탐험하고 관리하는 개인 인터넷 시각화 플랫폼입니다.

## 현재 구현 범위

- React + TypeScript + Vite 기반 프로젝트
- React Three Fiber 3D 우주 화면
- 사용자 태양과 데모 사이트 천체
- 방문 횟수에 따른 천체 성장 단계
- 최근 활동에 따른 단계별 밝기
- 즐겨찾기 고리
- 우주 검색과 사이트 상세 패널
- 천체 클릭, 카메라 회전 및 확대·축소

## 실행

가장 간단한 방법은 프로젝트 폴더의 `start-webverse.cmd`를 더블클릭하는 것입니다. 프론트엔드와 API 서버가 함께 실행되고 브라우저가 자동으로 열립니다.

직접 실행하려면:

```powershell
pnpm install
pnpm dev
```

프로덕션 빌드:

```powershell
pnpm build
```

전체 자동 검사:

```powershell
pnpm check
```

검사 항목에는 URL 보안 규칙, 50개 표시 엔진, 회원가입부터 회원 탈퇴까지의 실제 API 통합 흐름이 포함됩니다.

## 다음 개발 단계

1. 카테고리 앵커와 Force Layout 적용
2. 성운 검색·발견 화면 구현
3. Express + Prisma 백엔드 구성
4. 사용자 인증과 영구 저장
5. Pending 사이트 승인 요청 흐름

## 백엔드

- API: `http://localhost:4000`
- 상태 확인: `http://localhost:4000/api/health`
- 로컬 DB: `prisma/dev.db`
