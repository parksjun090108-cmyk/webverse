# WebVerse 배포 가이드

WebVerse는 프론트엔드(Vercel), API(Render), PostgreSQL(Supabase)을 분리해 배포합니다. 로컬 개발에서는 기존 SQLite를 계속 사용합니다.

## 1. Supabase PostgreSQL

1. Supabase 프로젝트를 생성합니다.
2. Dashboard의 **Connect**에서 Session pooler 연결 문자열(포트 `5432`)을 복사합니다.
3. 비밀번호를 URL 인코딩한 뒤 Render의 `DATABASE_URL`로 등록합니다.
4. 운영 DB에는 로컬 `dev.db`를 업로드하지 않습니다. 최초 배포 시 PostgreSQL 마이그레이션과 공식 사이트 seed가 자동 실행됩니다.

공식 참고: https://supabase.com/docs/guides/database/prisma

## 2. Render API

1. Git 저장소를 Render에 연결하고 Blueprint 배포를 선택합니다.
2. 루트의 `render.yaml`을 사용합니다.
3. `DATABASE_URL`에 Supabase Session pooler URL을 입력합니다.
4. `WEB_ORIGIN`에 실제 Vercel 주소를 입력합니다. 여러 주소가 필요하면 쉼표로 구분합니다.
5. `JWT_SECRET`은 Blueprint가 안전한 임의 값으로 생성합니다.

배포 과정:

- Build: 의존성 설치, PostgreSQL Prisma Client 생성, 서버 컴파일
- Pre-deploy: `prisma migrate deploy`
- Initial deploy: 카테고리와 공식 사이트 seed
- Start: 컴파일된 Express API 실행
- Health check: `/api/ready`

공식 참고: https://render.com/docs/blueprint-spec

## 3. Vercel 프론트엔드

1. 같은 Git 저장소를 Vercel에 연결합니다.
2. Framework Preset은 Vite, Output Directory는 `dist`를 사용합니다.
3. 환경변수 `VITE_API_URL`을 `https://<render-domain>/api` 형태로 입력합니다.
4. 배포 후 생성된 Vercel URL을 Render의 `WEB_ORIGIN`에 반영하고 API를 다시 배포합니다.

루트의 `vercel.json`이 빌드와 SPA rewrite를 설정합니다.

## 4. 배포 전 확인

```powershell
pnpm check
```

운영 환경 필수값:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `WEB_ORIGIN`
- `VITE_API_URL`

실제 비밀번호, JWT secret, DB 연결 문자열은 Git에 커밋하지 않습니다.

## 5. 백업과 복구

로컬 SQLite 백업은 서버를 종료한 상태에서 실행합니다.

```powershell
pnpm db:backup
pnpm db:backup:verify -- backups/<생성된 파일>.db
```

복구 시에는 현재 DB가 `before-restore` 이름으로 먼저 백업됩니다.

```powershell
pnpm db:restore -- backups/<복구할 파일>.db
```

`backups/` 폴더는 Git에 포함되지 않습니다. 중요한 백업은 암호화된 별도 저장소에도 보관합니다.

Supabase 운영 DB는 Supabase의 자동 백업 기능을 우선 사용하고, 배포 전 `pnpm db:validate`로 로컬·운영 스키마와 초기 마이그레이션의 일치 여부를 확인합니다. 실제 운영 복구는 새 Supabase 프로젝트에서 먼저 시험한 뒤 본 DB에 적용합니다.

## 6. 브라우저 확장 프로그램

로컬 개발 설치 방법은 `extension/README.md`를 따릅니다. 운영 배포 전에는 다음 값을 실제 Render API 주소로 변경합니다.

- `extension/manifest.json`의 `host_permissions`
- `extension/background.js`의 `DEFAULT_API_URL`
- `extension/popup.html`, `extension/popup.js`의 기본 API 주소

그 후 `extension` 폴더를 ZIP으로 묶어 Chrome Web Store에 등록합니다. 확장 프로그램은 `history` 권한을 사용하므로 개인정보처리방침에 아래 내용을 명시해야 합니다.

- 계정 연결 전에는 방문 정보를 수집하지 않음
- 전체 URL, 검색어, 페이지 제목은 서버에 전송하지 않음
- 사용자가 발견한 사이트의 도메인과 방문 시각만 방문 횟수에 반영
- 연결 해제 시 확장 프로그램 토큰 즉시 폐기
