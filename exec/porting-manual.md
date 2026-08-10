# 방방봐(bangbangbwa) 포팅 매뉴얼

> 작성일: 2026-08-10 · 저장소: https://lab.ssafy.com/s15-webmobile1-sub1/S15P11A504.git
> 배포 대상 서버: AWS EC2 `i15a504.p.ssafy.io` (Ubuntu)

---

## 1. 기술 스택 및 버전 요약

| 구분 | 제품 | 버전 | 비고 |
| --- | --- | --- | --- |
| JVM | Java (OpenJDK) | **21** | `backend/build.gradle`의 Gradle toolchain으로 강제 (`JavaLanguageVersion.of(21)`) |
| 빌드 도구(BE) | Gradle | **9.5.1** | Gradle Wrapper 사용 (`gradle-wrapper.properties`) — 로컬 Gradle 설치 불필요 |
| WAS | Spring Boot 내장 Tomcat | Spring Boot **4.1.0** | `spring-boot-starter-webmvc` 기반. 별도 외장 WAS 없음 |
| 웹서버 | Nginx | `nginx:alpine` (태그 미고정) | 프론트 정적 파일 서빙용 컨테이너. 호스트 Nginx가 TLS 종료 후 프록시 |
| 프론트 런타임 | Node.js | **24** (`node:24-alpine`) | Docker 빌드 스테이지에서만 사용 |
| 패키지 매니저(FE) | pnpm | **11.10.0** | `package.json`의 `packageManager` 필드로 고정, corepack으로 활성화 |
| 프론트 프레임워크 | React / Vite / TypeScript | 19.2 / 8.1 / 5.9 | SPA, Tailwind CSS 4, TanStack Query 5 |
| DB 드라이버 | H2 / PostgreSQL | Spring Boot BOM 관리 | H2는 개발용(runtime + h2console), 운영 DB는 PostgreSQL 예정 |
| TURN 서버 | coturn | **4.6** (`coturn/coturn:4.6`) | WebRTC 미디어 중계 (CGNAT·대칭 NAT 대응) |
| 컨테이너 | Docker + docker compose | EC2 설치 버전 | `frontend/docker-compose.yml`로 web·coturn 기동 |

---

## 2. WAS / 웹서버 설정 값

### 2-1. 백엔드 (Spring Boot, 내장 Tomcat)

- 설정 파일: `backend/src/main/resources/application.yaml`
  - 현재 정의된 값: `spring.application.name=bangbangbwa` 뿐이며 **server.port, datasource는 아직 미정의**.
- 운영 포트: **8081** (프론트 `.env`의 `VITE_API_BASE_URL=http://i15a504.p.ssafy.io:8081/` 기준).
  `application.yaml`에 포트가 없으므로 기동 시 명시해야 함:
  ```bash
  cd backend
  ./gradlew bootJar
  java -jar build/libs/bangbangbwa-0.0.1-SNAPSHOT.jar --server.port=8081
  ```
- 주요 의존성: `data-jpa`, `security`, `security-oauth2-client`, `validation`, `webmvc`, `h2console`, Lombok.

### 2-2. 프론트엔드 (Nginx 컨테이너)

- 설정 파일: `frontend/nginx.conf` → 컨테이너의 `/etc/nginx/conf.d/default.conf`
  - `listen 3000` (IPv4), `root /usr/share/nginx/html`
  - SPA 라우팅: `try_files $uri $uri/ /index.html` 폴백
  - gzip on (`comp_level 5`, `min_length 1024`)
  - `/assets/`(해시 붙은 빌드 산출물): `expires 1y`, `Cache-Control: public, immutable`
- 포트 매핑: `127.0.0.1:3000 → 3000` (외부 직접 노출 없음). **호스트 Nginx가 TLS를 종료하고 이 포트로 `proxy_pass`** 하는 구조.

### 2-3. TURN 서버 (coturn)

- 설정 파일: `infra/coturn/turnserver.conf`
  - `listening-port=3478`, 중계 포트 범위 `min-port=49160` ~ `max-port=49200`
  - `external-ip=<공인IP>/<사설IP>` — `infra/coturn/setup.sh` 실행 시 자동 채움
  - 인증: `lt-cred-mech` 고정 계정 방식, `realm=i15a504.p.ssafy.io`
  - 사설 대역 릴레이 차단(`denied-peer-ip`), 세션당 대역폭 `max-bps=1500000`(약 1.5Mbps)
- `network_mode: host`로 기동 (중계 포트 범위를 도커 NAT로 매핑하지 않기 위함).

---

## 3. 빌드 시 사용되는 환경 변수

### 3-1. 프론트엔드 — `frontend/.env` (VITE_*)

Vite는 **빌드 시점**에 `VITE_*` 값을 번들에 인라인한다. 따라서 `.env`는 `.dockerignore`에서 의도적으로 제외되어 있지 않으며(빌드 컨텍스트에 포함되어야 함), 값 변경 시 **재빌드가 필요**하다. `VITE_*` 값은 전부 클라이언트에 노출된다고 간주할 것.

| 변수 | 용도 | 현재 값(개발 기준) |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 백엔드 API 주소 | `http://i15a504.p.ssafy.io:8081/` |
| `VITE_KAKAO_KEY` | Kakao Developers JavaScript 키 (지도) | `9ec2bd99e0e833e11645a517081209cd` |
| `VITE_KAKAO_CLIENT_ID` | 카카오 OAuth REST API 키 | `8647505cf8a1ab8b1548033183f46de5` |
| `VITE_KAKAO_AUTH_REDIRECT_URI` | 카카오 OAuth 콜백 | `http://localhost:5173/oauth/callback/kakao` |
| `VITE_GOOGLE_CLIENT_ID` | 구글 OAuth 클라이언트 ID | `822005504578-…apps.googleusercontent.com` |
| `VITE_GOOGLE_CLIENT_SECRET` | 구글 OAuth 클라이언트 시크릿 | `GOCSPX-…` (프론트 노출 값 — 교체·서버 이관 권장) |
| `VITE_GOOGLE_AUTH_REDIRECT_URI` | 구글 OAuth 콜백 | `http://localhost:5173/oauth/callback/google` |
| `VITE_AI_BASE_URL` | AI 분석 서버(RunPod) 주소 | `https://xwn46julgtjwjn-8000.proxy.runpod.net` |
| `VITE_TURN_URLS` | TURN 서버 URI 목록(콤마 구분) | `turn:i15a504.p.ssafy.io:3478?transport=udp,…?transport=tcp` |
| `VITE_TURN_USERNAME` | TURN 계정 | `bangbangbwa` |
| `VITE_TURN_CREDENTIAL` | TURN 비밀번호 | `turnserver.conf`의 `user=` 값과 동일해야 함 |

- `.env`는 git에 커밋되지 않는다 (`.gitignore`: `.env`, `.env.*`, `!.env.example`). **팀원·서버에 별도 채널로 공유**해야 한다.
- 프론트 빌드 명령: `pnpm build` = `tsc -b && vite build` (검증: `pnpm lint`).

### 3-2. 백엔드

- 현재 빌드에 필요한 환경 변수 없음. Java 21만 있으면 `./gradlew bootJar`로 빌드 가능 (toolchain이 JDK 자동 확보).
- DB·OAuth 서버 측 설정이 확정되면 `application.yaml` 또는 기동 환경 변수(`SPRING_DATASOURCE_URL` 등)로 주입 예정 — 5장 참고.

---

## 4. 배포 방법 및 특이사항

### 4-1. 프론트엔드 + coturn (EC2)

```bash
# 1) 소스 준비 후 frontend/.env 배치 (git 미포함이므로 별도 복사)
# 2) 배포용 값으로 수정: OAuth redirect URI를 localhost:5173 → 실제 도메인으로
cd frontend
docker compose up -d --build
```

- Dockerfile은 2-stage: `node:24-alpine`에서 `pnpm install --frozen-lockfile` + `pnpm build` → `nginx:alpine`에 `dist/`와 `nginx.conf` 복사.
- coturn 최초 기동 전(그리고 **EC2 공인 IP가 바뀔 때마다**) 반드시 실행:
  ```bash
  bash ../infra/coturn/setup.sh   # external-ip 자동 기입 후 docker compose up -d
  ```

### 4-2. 배포 시 특이사항 (주의)

1. **호스트 Nginx TLS 종료 구조**: web 컨테이너는 `127.0.0.1:3000`에만 바인딩된다. 외부 트래픽은 호스트 Nginx(443)가 받아 `proxy_pass http://127.0.0.1:3000`으로 전달한다.
2. **헬스체크는 반드시 `127.0.0.1`**: 컨테이너 내부에서 `localhost`는 `::1`(IPv6)로 풀리는데 Nginx는 IPv4만 listen하므로, `localhost`로 두면 정상 상태에서도 unhealthy가 된다 (`docker-compose.yml`에 반영됨).
3. **EC2 보안 그룹 인바운드**: `3478/udp`, `3478/tcp`(TURN), `49160–49200/udp`(중계 포트), 그 외 80/443(호스트 Nginx), 8081(백엔드 API).
4. **TURN 계정 동기화**: `infra/coturn/turnserver.conf`의 `user=`와 `frontend/.env`의 `VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL`은 반드시 같은 값. 한쪽을 바꾸면 양쪽 모두 변경 후 프론트 재빌드.
5. **OAuth 콜백 URI**: 현재 `.env` 값은 개발용(`localhost:5173`). 배포 시 실제 도메인으로 바꾸고, Kakao Developers·Google Cloud Console의 승인된 리디렉션 URI에도 동일하게 등록해야 한다.
6. **TURN 동작 확인**: [Trickle ICE 테스트 페이지](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)에서 `relay` 타입 후보가 나오면 성공. 실패 시 `docker compose logs -f coturn`.
7. **AI 서버(RunPod)는 비상시 주소가 바뀜**: RunPod 인스턴스 재기동 시 `VITE_AI_BASE_URL` 프록시 주소가 달라질 수 있으므로 확인 후 재빌드.
8. 개발 모드(`pnpm dev`, 5173 포트)에서는 `vite-plugin-signaling.ts`가 WebRTC 시그널링 WebSocket 서버(방당 최대 2명)를 Vite dev 서버에 내장해 띄운다. 운영 시그널링 구성은 별도 확인 필요.

---

## 5. DB 접속 정보

| 항목 | 내용 |
| --- | --- |
| 운영 DB | PostgreSQL (드라이버 포함, **접속 정보 미확정 — TBD**) |
| 개발 DB | H2 (인메모리, `spring-boot-h2console` 포함) |
| 설정 위치 | `backend/src/main/resources/application.yaml` — 현재 datasource 미정의 |

현재 저장소에는 DB URL/계정/비밀번호가 정의된 곳이 없다(백엔드 스켈레톤 단계). 확정 시 아래 형태로 `application.yaml` 또는 기동 환경 변수에 기재하고 이 문서를 갱신할 것:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://<host>:5432/<db>
    username: <username>
    password: <password>
```

---

## 6. 주요 계정 및 프로퍼티가 정의된 파일 목록

| 파일 | 내용 | git 포함 여부 |
| --- | --- | --- |
| `frontend/.env` | API·AI 서버 주소, Kakao JS 키/REST 키, Google OAuth ID·Secret, OAuth 콜백, **TURN 계정** | ❌ (별도 공유 필요) |
| `frontend/.env.example` | 환경 변수 템플릿 | ⭕ |
| `infra/coturn/turnserver.conf` | **TURN 계정(`user=bangbangbwa:…`)**, realm, 포트 범위, 대역폭 상한 | ⭕ (외부 공개 시 비밀번호 교체 필요) |
| `backend/src/main/resources/application.yaml` | Spring 설정 (현재 앱 이름만, DB·포트 추후 기재) | ⭕ |
| `backend/gradle/wrapper/gradle-wrapper.properties` | Gradle 9.5.1 배포판 URL | ⭕ |
| `frontend/docker-compose.yml` | web·coturn 서비스 정의, 포트 바인딩, 헬스체크 | ⭕ |
| `frontend/nginx.conf` | 컨테이너 Nginx 서빙 설정 | ⭕ |
| `frontend/Dockerfile` | Node 24 / nginx:alpine 2-stage 빌드 | ⭕ |
| `frontend/package.json` | pnpm 버전 고정, 빌드·검증 스크립트 | ⭕ |

### 외부 서비스 계정 (콘솔 접근 필요)

| 서비스 | 용도 | 관리 위치 |
| --- | --- | --- |
| Kakao Developers | 지도 JS 키, 카카오 로그인 REST 키·redirect URI | developers.kakao.com 앱 콘솔 |
| Google Cloud Console | 구글 OAuth 클라이언트 ID/Secret·redirect URI | console.cloud.google.com |
| RunPod | AI 분석 서버 호스팅 (`*-8000.proxy.runpod.net`) | runpod.io |
| AWS EC2 | `i15a504.p.ssafy.io`, 보안 그룹 관리 | SSAFY 제공 계정 |

## 2. 프로젝트에서 사용하는 외부 서비스 정보를 정리한 문서
| # | 서비스 | 용도 | 사용 위치 |
|---|--------|------|-----------|
| 1 | 카카오 디벨로퍼스 | 카카오 소셜 로그인(OAuth), 카카오맵(지도·주변 편의시설) | BE / FE |
| 2 | Google Cloud Console | 구글 소셜 로그인(OAuth) | BE / FE |
| 3 | AWS S3 | 매물 이미지, 중개사 인증 서류, 라이브 세션 캡처 저장 | BE |
| 4 | RunPod | YOLO 하자 탐지 AI 추론 서버(FastAPI) 호스팅 | AI / FE |
| 5 | SSAFY GMS | Claude API(claude-sonnet-4-6) 호출 게이트웨이 | BE |
| 6 | 서울 열린데이터광장 | 부동산 중개업소 공공데이터 — 중개업 등록번호 검증 | BE |
| 7 | (참고) STUN/TURN | WebRTC 연결용 — 공개 STUN + 자체 호스팅 coturn | FE / Infra |
| 8 | (개발용) ngrok | 로컬 서버 외부 노출(터널링) | 개발 편의 |

> ⚠️ 이 문서와 저장소에 포함된 키·비밀번호(TURN credential, Google client secret 등)는 팀 외부에 공개될 경우 즉시 교체할 것.
