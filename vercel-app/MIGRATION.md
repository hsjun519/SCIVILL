# SCIVILL Vercel 이전 준비 (비프로덕션 브랜치)

이 디렉터리는 기존 GitHub Pages 웹사이트를 **바로 덮어쓰지 않는** 독립적인 Next.js/Vercel 전환 작업이다. 배포 성공·보안 테스트·기존 데이터 백업을 확인하기 전에는 기존 사이트를 닫지 않는다.

## 1. 현재 제공되는 범위

- Next.js 프론트엔드, Google/Firebase 로그인 화면
- Firebase ID 토큰 서버 측 JWT 서명·issuer·audience 검증
- 관리자 지정 이메일 또는 초대된 사용자만 회원 활성화
- 서버에서 PostgreSQL에 접근하는 팀 생성 / 신청 / 승인 API
- 중복 신청 방지, 팀 소유권 검사, 정원 검사 및 승인 트랜잭션
- 프로젝트/작업 API (서버 권한 검사)
- 검증되고 마감되지 않은 대회 PostgreSQL 조회 API
- 모든 데이터는 서버 DB에 저장하며 프론트엔드에 DB 연결문자열이 없다

**아직 구현되지 않은 것:** 기존 전체 SCIVILL 화면 및 데이터 전체 이전, 기존 대회 수집 결과의 신규 DB 동기화, 프로젝트/작업 웹 UI 전체, 운영급 요청 제한, Firebase App Check/회원가입 차단 정책, 이메일 전송, 통합 브라우저 테스트. 본 브랜치를 실제 서비스로 발표하지 않는다.

## 2. Vercel 초기 설정

1. Vercel에 GitHub 저장소 `hsjun519/SCIVILL` 연결.
2. 배포 브랜치는 `migration/vercel-secure-fullstack`, Root Directory는 `vercel-app`, Framework Preset은 Next.js.
3. 별도 서버리스 PostgreSQL 데이터베이스 생성 후 `db/schema.sql` 실행.
4. Vercel 환경변수에 `.env.example`의 값 설정. 실제 DB 비밀번호나 비밀값을 GitHub에 커밋하지 않는다.
5. Firebase Authentication에서 Google provider 활성화 및 실제 Vercel 도메인을 Authorized domains에 등록.
6. 관리자용 본인 확인된 Google 이메일만 `ADMIN_EMAIL`에 설정하고, 임의의 이메일이나 실존 부원 이름을 샘플 데이터에 쓰지 않는다.
7. 승인할 부원은 **서버 DB에서만** `INSERT INTO invitations(email,role) VALUES ('verified@example.com','member') ON CONFLICT (email) DO UPDATE SET role='member';` 등으로 초대한다.
8. `npm install && npm run typecheck && npm run build` 후 미리보기 배포한다.
9. 다른 계정으로 무단 접근, 회원 승인, 중복 신청, 권한 상승, 정원 초과, ID 토큰 위변조, 비로그인 API 요청을 테스트한다.

## 3. 기존 데이터 전환

- 원본 Cloudflare D1 데이터는 먼저 **백업**한다. 관리자 승인·검증 근거·출처·마감일을 보존한다.
- 공개 검증된 대회만 PostgreSQL에 이전한다. 이전되지 않은 경우 홈페이지는 빈 상태를 정확하게 표시한다.
- 기존 GitHub Actions/Python의 비공개 수집 API는 자동으로 PostgreSQL에 연결되지 않는다. 신규 수집 결과를 서버 인증된 전용 수집 엔드포인트 또는 승인된 관리 작업으로 이관해야 한다.
- 기존 localStorage 팀·프로젝트 내용은 장치별로 다르다. 사용자 동의 없는 자동 업로드는 하지 않는다. 필요하면 백업 및 명시적 가져오기 절차를 구현한다.
- 기존 루트 `index.html`의 **평문 4자리 PIN 및 소스에 들어 있는 부원 학번/성명은 보안 위험**. 레거시 Firestore Security Rules, 공유 링크, 민감정보 저장/노출, 비밀번호 재설정을 별도 점검한다. 레거시 로그인 코드를 새 앱에 복사하지 않는다.
- API URL 노출 자체는 비밀키 노출이 아니다. 브라우저로 받는 요청은 모든 CRUD 단계에서 인증·인가 검사한다.

## 4. 보안 점검 (필수)

- Vercel 환경변수 `DATABASE_URL`은 `NEXT_PUBLIC_`을 붙이지 않는다.
- Firebase 웹 API 키는 공개 클라이언트 설정이지만 보안/관리자 비밀키가 아니다.
- 초대되지 않은 Google 계정이 로그인할 수 있더라도 내부 API의 승인회원 데이터에 접근할 수 없어야 한다. 운영 전 Firebase 계정 생성 남용 방지 대책(예: 가입 차단 정책/보호·모니터링) 추가 검토.
- API의 rate limiting, abuse monitoring, 실패 로그, 세션 철회 정책, 데이터 삭제 절차는 별도 구축 후 실사용 전 점검한다.
- DB는 TLS, 최소 권한 계정, 정기 백업으로 보호하고 관련 비용을 확인한다.
- 학생 정보는 최소 수집하며 학교·지도교사의 개인정보 운영 기준을 따른다.
- PR Preview는 실제 운영 DB와 별도 DB를 사용해 테스트한다. 관리자 권한을 가진 Preview 앱에 운영 DB 연결 금지.

## 5. 배포 전 반드시 충족할 조건

기존 화면 기능 1:1 비교, 팀/프로젝트 UI 완성, 대회 자동수집 연결, 주요 API 단위/통합 테스트, 인증·권한 테스트, 데이터 마이그레이션, 백업·롤백, 운영 계정 연결과 실제 배포 확인.

**이 문서는 구현 준비 상태를 나타내며, 실제 Vercel 배포 완료 증거는 아니다.**
