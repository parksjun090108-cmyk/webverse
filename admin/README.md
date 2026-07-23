# WebVerse Control Center

WebVerse의 사이트 등록 요청을 검토하는 별도 관리자 프론트엔드입니다. Supabase에 직접 연결하지 않고 WebVerse 백엔드의 `/api/admin` API만 사용합니다.

## Local development

1. `.env.example`을 `.env`로 복사합니다.
2. WebVerse API 서버를 `http://localhost:4000`에서 실행합니다.
3. 아래 명령으로 관리자 사이트를 실행합니다.

```powershell
pnpm install
pnpm dev
```

기본 관리자 사이트 주소는 `http://localhost:5173`입니다.

## Vercel deployment

Vercel 환경변수:

```text
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/admin
VITE_WEB_URL=https://YOUR-WEBVERSE.vercel.app
```

Render의 `WEB_ORIGIN`에는 WebVerse와 관리자 사이트의 정확한 주소를 쉼표로 연결합니다. 주소 끝에는 `/`를 붙이지 않습니다.

```text
https://YOUR-WEBVERSE.vercel.app,https://YOUR-WEBVERSE-ADMIN.vercel.app
```

관리자 사이트 배포 후 Render를 다시 배포해야 변경된 CORS 설정이 반영됩니다.

## Included features

- 관리자 전용 로그인과 자동 세션 확인
- 검토 대기, 승인, 거절 요청 목록
- 발견자 수와 수집된 사이트 메타데이터 확인
- 카테고리 지정 및 메타데이터 수정 후 승인
- 필수 거절 사유 입력
- 관리자 감사 기록
- 관리자 비밀번호 변경
- 데스크톱 및 모바일 반응형 화면
