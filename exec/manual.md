 S15P11A504\frontend\.claude\rules\00-baseline.md

# 방방봐(bangbangbwa) 포팅 매뉴얼

> 작성일: 2026-08-10 · 저장소: https://lab.ssaf
y.com/s15-webmobile1-sub1/S15P11A504.git
> 배포  ssafy.io`
(Ubuntu)

---

## 1. 기술 스택 및 버전 요약

| 구분 | 제품 | 버전 | 비고 |
| --- | --- | --- | --- |
| JVM | ckend/buil
d.gradle`의 Gradle toolchain으로 강제 (`JavaLan
guageVer
| 빌드 도구(BE) | Gradle | **9.5.1** | Gradle W
rapper 사용 (`gradle-wrapper.properties`) — 로
컬 Gradl
4.1.0** | `spring-boot-starter-webmvc` 기반.
별도 외장 WAS 없음 |
| 웹서버 | Nginx | `nginx:alpine` (태그 미고정)
 | 프론 호스트 Ngi
nx가 TLS 종료 후 프록시 |
| 프론트node:24-al
pine`) | Docker 빌드 스테이지에서만 사용 |
| 패키지0** | `pac
kage.json`의 `packageManager` 필드로 고정, core
pack으로 활성화 |
| 프론트TypeScript
d S15P11A504\frontend\CLAUDE.md
Loaded S15P11A504\frontend\AGENTS.md
Loaded 3 skills from S15P11A504\frontend\.claude\skills
3 skills available
LoadedS15P11A504\frontend\.claude\rules\50-error-security.md
LoadedS15P11A504\frontend\.claude\rules\60-dependencies-tests.md
Loaded S15P110-baseline.md

● Write(C:\Users\SSAFY\Desktop\bangbangbwa\S15P11A504\exec\porti
       ng-manual.m

Wrote 163 lines to C:\Users\SSAFY\Desktop\bangbangbwa\S15P11A504\exec\porting-manual.md
# 방방봐

> 작성일//lab.ssaf
y.com/s15-webmobile1-sub1/S15P11A504.git
> 배포  ssafy.io`
(Ubuntu)

---

## 1. 기

| 구분 | 제품 | 버전 | 비고 |
| --- | --- | --- | --- |
| JVM | Java (OpenJDK) | **21** | `backend/buil
d.gradle (`JavaLan
guageVersion.of(21)`) |
| 빌드  | Gradle W
rapper 사용 (`gradle-wrapper.properties`) — 로
컬 Gradl
| WAS | Spring Boot 내장 Tomcat | Spring Boot *
*4.1.0** | `spring-boot-starter-webmvc` 기반.
별도 외
| 웹서버 | Nginx | `nginx:alpine` (태그 미고정)
 | 프론트 정적 파일 서빙용 컨테이너. 호스트 Ngi
nx가 TLS 종료 후 프록시 |
| 프론트node:24-al
pine`) | Docker 빌드 스테이지에서만 사용 |
| 패키지0** | `pac
kage.json`의 `packageManager` 필드로 고정, core
pack으로
| 프론트 프레임워크 | React / Vite / TypeScript
 | 19.2 SS 4, TanS
tack Query 5 |
| DB 드라이버 | H2 / PostgreSQL | Spring Boot B
OM 관리 sole), 운
영 DB는 PostgreSQL 예정 |
| TURN 서버 | coturn | **4.6** (`coturn/coturn:
4.6`) | WebRTC 미디어 중계 (CGNAT·대칭 NAT 대응
) |
| 컨테이| EC2 설치
 버전 | `frontend/docker-compose.yml`로 web·cot
urn 기동

---

## 2. WAS / 웹서버 설정 값

### 2-1. 백엔드 (Spring Boot, 내장 Tomcat)

- 설정 파일: `backend/src/main/resources/applic
ation.ya
  - 현재 정의된 값: `spring.application.name=ba
ngbangbwsource는
ation.yaml`
  - 현재on.name=ba
ngbangbwa` 뿐이며 **server.port, datasource는
아직 미
- 운영 포트: **8081** (프론트 `.env`의 `VITE_AP
I_BASE_URL=http://i15a504.p.ssafy.io:8081/` 기
준).
  `application.yaml`에 포트가 없으므로 기동 시
명시해야 함:
  ```bash
  cd backend
  ./grad
  java -jar build/libs/bangbangbwa-0.0.1-SNAPSH
OT.jar -
  ```
- 주요  , `securit
y-oauth2-client`, `validation`, `webmvc`, `h2co
nsole`, Lombok.

### 2-2. 프론트엔드 (Nginx 컨테이너)

- 설정 파일: `frontend/nginx.conf` → 컨테이너의
 `/etc/n
  - `listen 3000` (IPv4), `root /usr/share/ngin
x/html`
  - SPA 라우팅: `try_files $uri $uri/ /index.ht
ml` 폴백
  - gzip on (`comp_level 5`, `min_length 1024`)
  - `/as: `expires
 1y`, `Cache-Control: public, immutable`
- 포트 매핑: `127.0.0.1:3000 → 3000` (외부 직접
 노출 없 료하고 이
 포트로 `proxy_pass`** 하는 구조.

### 2-3. TURN 서버 (coturn)

- 설정 파일: `infra/coturn/turnserver.conf`
  - `lis범위 `min-
port=49160` ~ `max-port=49200`
  - `ext `infra/co
turn/setup.sh` 실행 시 자동 채움
  - 인증식, `realm
=i15a504.p.ssafy.io`
  - 사설 대역 릴레이 차단(`denied-peer-ip`), 세
션당 대 bps)
 `network_mode: host`로 기동 (중계 포트 범위를
 도커 NAT로 매핑하지 않기 위함).

---

## 3. 빌드 시 사용되는 환경 변수

### 3-1. 프론트엔드 — `frontend/.env` (VITE_*)

Vite는 **빌드 시점**에 `VITE_*` 값을 번들에 인
라인한다. 따라서 `.env`는 `.dockerignore`에서
의도적으컨텍스트에
포함되어야 함), 값 변경 시 **재빌드가 필요**하
다. `VITE_*` 값은 전부 클라이언트에 노출된다고
간주할 것.

| 변수 | 용도 | 현재 값(개발 기준) |
| --- |
| `VITE_API_BASE_URL` | 백엔드 API 주소 | `http
://i15a5
| `VITE_KAKAO_KEY` | Kakao Developers JavaScrip
t 키 (지도) | `9ec2bd99e0e833e11645a517081209cd
` |
 `VITE_KAKAO_CLIENT_ID` | 카카오 OAuth REST AP
I 키 | `8647505cf8a1ab8b1548033183f46de5` |
| `VITE_KAKAO_AUTH_REDIRECT_URI` | 카카오 OAuth
 콜백 | callback/k
akao` |
| `VITE_h 클라이언
트 ID | `822005504578-…apps.googleusercontent.c
om` |
| `VITE_GOOGLE_CLIENT_SECRET` | 구글 OAuth 클라
이언트 시크릿 | `GOCSPX-…` (프론트 노출 값 — 교
체·서버
백 | `http://localhost:5173/oauth/callback/go
ogle` |
| `VITE_AI_BASE_URL` | AI 분석 서버(RunPod) 주
소 | `htxy.runpod.
net` |
| `VITE_록(콤마 구
분) | `turn:i15a504.p.ssafy.io:3478?transport=u
dp,…?tra
| `VITE_TURN_USERNAME` | TURN 계정 | `bangbangb
wa` |
| `VITE_ 호 | `tur

- `.env`는 git에 커밋되지 않는다 (`.gitignore`:
 `.env`, `.env.*`, `!.env.example`). **팀원·서
버에 별
- 프론트 빌드 명령: `pnpm build` = `tsc -b && v
ite buil

### 3-2.

- 현재 빌드에 필요한 환경 변수 없음. Java 21만
있으면 `  (toolcha
n이 JDK 자동 확보).
- DB·OAuth 서버 측 설정이 확정되면 `application
.yaml` 또는 기동 환경 변수(`SPRING_DATASOURCE_U
RL` 등)

---

## 4. 배

### 4-1.

```bash
# 1) 소 (git 미포
 2) 배포용 값으로 수정: OAuth redirect URI를 l
ocalhost:5173 → 실제 도메인으로
cd frontend
docker c
```

- Dockerfile은 2-stage: `node:24-alpine`에서 `p
npm instm build` →
 `nginx:alpine`에 `dist/`와 `nginx.conf` 복사.
- coturn 최초 기동 전(그리고 **EC2 공인 IP가 바
뀔 때마
 ```bash
  bash ../infra/coturn/setup.sh   # external-ip
 자동 기입 후 docker compose up -d
  ```

### 4-2.

1. **호 b 컨테이너
는 `127.0.0.1:3000`에만 바인딩된다. 외부 트래픽
은 호스 ss http://
127.0.0.1:3000`으로 전달한다.
2. **헬스체크는 반드시 `127.0.0.1`**: 컨테이너
내부에서풀리는데 N
ginx는 IPv4만 listen하므로, `localhost`로 두면
정상 상태에서도 unhealthy가 된다 (`docker-compo
se.yml`
3. **EC2 보안 그룹 인바운드**: `3478/udp`, `347
8/tcp`(TURN), `49160–49200/udp`(중계 포트), 그
외 80/44API).
4. **TURN 계정 동기화**: `infra/coturn/turnserv
er.conf`  `VITE_TU
RN_USERNAME`/`VITE_TURN_CREDENTIAL`은 반드시 같
은 값.    프론트
재빌드.
5. **OAuth 콜백 URI**: 현재 `.env` 값은 개발용(
`localho 으로 바꾸
인된 리디렉션 URI에도 동일하게 등록해야 한다.
6. **TURN 동작 확인**: [Trickle ICE 테스트 페이
지](https://webrtc.github.io/samples/src/conten
t/peercoelay` 타입
 후보가 나오면 성공. 실패 시 `docker compose lo
gs -f co
7. **AI 서버(RunPod)는 비상시 주소가 바뀜**: Ru
nPod 인 _URL` 프록
시 주소가 달라질 수 있으므로 확인 후 재빌드.
8. 개발 모드(`pnpm dev`, 5173 포트)에서는 `vite
-plugin-링 WebSock
 띄운다. 운영 시그널링 구성은 별도 확인 필요.

---

## 5. DB 접속 정보

| 항목 | 내용 |
| --- |
| 운영 DB | PostgreSQL (드라이버 포함, **접속
정보 미확정 — TBD**) |
| 개발 Dt-h2consol
e` 포함) |
| 설정 위치 | `backend/src/main/resources/appli
cation.yaml` — 현재 datasource 미정의 |

현재 저   정의된
곳이 없다(백엔드 스켈레톤 단계). 확정 시 아래
형태로 ` 경 변수에
 기재하고 이 문서를 갱신할 것:

```yaml
spring:
  dataso
    url: jdbc:postgresql://<host>:5432/<db>
    username: <username>
    pass
```

---

## 6. 주파일 목록

| 파일 |
| --- | --- | --- |
| `frontend/.env` | API·AI 서버 주소, Kakao JS
키/REST Auth 콜백,
 **TURN 계정** | ❌ (별도 공유 필요) |
| `frontend/.env.example` | 환경 변수 템플릿 |
⭕ |
| `infra/coturn/turnserver.conf` | **TURN 계정(
`user=ba범위, 대역
폭 상한 | ⭕ (외부 공개 시 비밀번호 교체 필요)
|
| `backend/src/main/resources/application.yaml`
 | Sprin트 추후 기
재) | ⭕ |
| `backend/gradle/wrapper/gradle-wrapper.proper
ties` | |
| `frontend/docker-compose.yml` | web·coturn 서
비스 정의, 포트 바인딩, 헬스체크 | ⭕ |
| `frontend/nginx.conf` | 컨테이너 Nginx 서빙
설정 | ⭕ |
| `frontginx:alpin
e 2-stage 빌드 | ⭕ |
| `front 고정, 빌
드·검증 스크립트 | ⭕ |

### 외부 서비스 계정 (콘솔 접근 필요)

| 서비스
| --- | --- | --- |
| Kakao Developers | 지도 JS 키, 카카오 로그인
REST 키·redirect URI | developers.kakao.com 앱
콘솔 |
| Google 라이언트
ID/Secret·redirect URI | console.cloud.google.c
om |
| RunPod | AI 분석 서버 호스팅 (`*-8000.proxy.r
unpod.net`) | runpod.io |
| AWS EC  그룹 관
리 | SSAFY 제공 계정 |

> ⚠️ 이  번호(TURN
credential, Google client secret 등)는 팀 외부
에 공개될 경우 즉시 교체할 것.