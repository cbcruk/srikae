# GraphQL Mock Extension — 설계 스펙

> 브라우저에서 GraphQL 응답을 operation 단위로 mock/modify 하는 Chrome 확장 프로그램.
> Requestly / tweak 유료 기능의 실사용 가치를 무료 + 학습 목적으로 직접 구현한다.

---

## 1. 동기 (Why)

- GraphQL은 **단일 엔드포인트 + POST**라서 Chrome DevTools의 native Local Override로는 operation별 응답 변조가 안 된다. 오버라이드 매칭이 **URL 단위**라서 같은 `/graphql`로 가는 모든 operation이 하나의 파일에 묶이기 때문.
- DevTools native override는 status code 변조도 아직 불가능.
- 기존 도구(tweak, Requestly)는 GraphQL 지원이 **유료**. 비용을 들일 만한 기능 깊이는 아니라고 판단.
- `@mswjs/interceptors`가 fetch/XHR 가로채기라는 가장 어려운 부분을 이미 해결해주므로, 직접 만들어도 코어는 얇다.

### 핵심 인사이트

tweak 문서를 보면 실제로 하는 일은 두 가지뿐이다:

1. **Partial payload matching** — 작성한 JSON 조각이 실제 request payload의 부분집합이면 가로챔 (no-code)
2. **JS 스니펫** — `operationName`/`variables`로 분기해서 mock을 return, 안 건드린 건 `return response`로 passthrough

이 멘탈 모델만 베끼면 충분하다. 자동 캡처 UX, subscription, batch 같은 건 **전부 스코프 밖**으로 던져도 실사용에 문제 없다.

---

## 2. 스코프 (Scope)

### v0에 포함

- 단발 query / mutation 인터셉션
- `operationName` 기반 매칭
- `variables` 부분집합(deep subset) 매칭 (optional)
- **mock**: 응답 body 전체 교체
- **modify**: JSON merge-patch(RFC 7386)로 응답 일부 덮어쓰기
- passthrough가 디폴트 (매칭 안 되면 실제 응답 그대로)
- DevTools 패널에서 룰 CRUD + import/export
- **no-eval**: 자유 JS 스니펫 없이 데이터/패치 선언만으로 동작

### 명시적으로 스코프 밖 (passthrough 처리)

- **Batch 쿼리** (body가 배열 — Apollo `BatchHttpLink`)
- **Subscription** (WebSocket / SSE, graphql-ws)
- **`@defer` / `@stream`** (`multipart/mixed` 점진 응답)
- **Persisted Query (APQ)** (query 본문 없이 해시만 옴)
- **multipart 파일 업로드** mutation
- 자동 요청 캡처 UX (캡처 채널과 변조 채널의 reconcile 문제 때문에 v0에서 제외)

> v0 매칭에서 `body`가 객체가 아니거나 `operationName`이 없으면 그냥 passthrough. 패널에는 "지원 안 함" 정도만 표기.

---

## 3. 아키텍처

### 컴포넌트 토폴로지

```
┌─ DevTools Panel (룰 에디터) ──────┐
│   chrome.storage.local.set(rules) │
└──────────────┬─────────────────────┘
               │ writes
       ┌───────▼────────┐
       │ chrome.storage │  ← 단일 source of truth
       └───────┬────────┘
               │ onChanged (모든 컨텍스트에 발화)
┌──────────────▼─────────────────────┐  (검사 중인 탭)
│  content.js  [ISOLATED world]      │
│  storage 읽기 + onChanged 구독       │
└──────────────┬──────────────────────┘
               │ CustomEvent('gqlmock:rules')
┌──────────────▼──────────────────────┐
│  injected.js  [MAIN world]          │
│  - native fetch 조기 캡처             │
│  - @mswjs/interceptors              │
│  - in-memory 룰 캐시                 │
│  - 매칭 + mock/modify               │
└───────────────────────────────────────┘
```

### 핵심 설계 판단

**① background SW를 룰 경로에서 제외**
`chrome.storage.onChanged`가 모든 컨텍스트에 발화하므로, 패널이 storage에 쓰면 → content script가 듣고 → MAIN으로 push 하면 끝. background relay가 불필요해져서 "3~4 hop 브릿지"와 "MV3 SW 30초 수명" 문제가 둘 다 사라진다. background는 설치 시 기본 룰 세팅 정도, 혹은 아예 없어도 됨.

**② ISOLATED content script는 단 하나의 이유로 존재**
MAIN world가 `chrome.storage`에 접근 못 하기 때문에, storage ↔ MAIN을 잇는 한 줄짜리 다리 역할만 한다.

**③ no-eval 우선**
MAIN world는 페이지의 CSP를 따른다. 대부분의 앱이 `unsafe-eval`을 막으므로 사용자 hook 문자열을 `new Function`으로 못 돌릴 수 있다. v0는 자유 JS 대신 선언적 데이터/패치로 제한해 이 문제를 원천 회피.

---

## 4. 데이터 모델

```typescript
interface Rule {
  id: string
  enabled: boolean
  endpoint: string // "*/graphql" 같은 glob (v0는 substring 매칭으로 시작)
  operationName: string // "GetAppointments"
  matchVariables?: Record<string, unknown> // 부분집합(deep subset) 매칭, optional
  action:
    | { type: 'mock'; data: unknown; errors?: unknown[] } // body 전체 교체
    | { type: 'modify'; mergePatch: unknown } // 응답에 deep merge
}
```

### mock vs modify

- **mock**: 전체 교체. 단순하고 안전. `{ data, errors }` 구조로 반환.
- **modify**: JSON merge-patch로 응답 일부만 수정. `{ data: { user: { status: 'CONFIRMED' } } }` 같은 **객체 값 덮어쓰기**는 깔끔하게 됨.
  - ⚠️ **한계**: 배열을 map해서 전부 바꾸는 건 안 됨 (예: `appointments[].status` 일괄 변경 불가). 이게 v1의 분기점.

### v1 분기점 — 배열 변환이 필요해질 때

- **path-DSL (eval 없음, 권장)**: `{ path: "appointments[].status", value: "CONFIRMED" }`를 작은 파서로 해석. 안전, CSP 무관, 표현력은 제한적. (grapheme/segment 파서와 비슷한 결이라 구현 자체가 재밌는 부분.)
- **sandboxed iframe eval**: tweak처럼 자유 JS 스니펫. 표현력 최대지만, `unsafe-eval` 막힌 앱에선 별도 sandbox iframe에서 실행해야 함.

> 권장 경로: **v0 = merge-patch → v1 = path-DSL**.

---

## 5. MAIN world 코어 — 두 개의 함정

```typescript
// ⚠️ 함정 1: interceptor.apply() 전에 native fetch를 잡아둬야 함
const nativeFetch = window.fetch.bind(window)

let rules: Rule[] = []
let resolveReady: () => void
const rulesReady = new Promise<void>((r) => {
  resolveReady = r
})

// ISOLATED에서 룰 받기
window.addEventListener('gqlmock:rules', (e: CustomEvent) => {
  rules = e.detail.rules
  resolveReady() // ⚠️ 함정 2: 첫 동기화 전 요청 레이스 방어
})

interceptor.on('request', async ({ request, controller }) => {
  if (request.method !== 'POST') return
  await rulesReady // 룰 도착 전이면 잠깐 대기

  const body = await request.clone().json()
  const rule = match(rules, request.url, body)
  if (!rule) return // passthrough = 아무것도 안 함

  if (rule.action.type === 'mock') {
    controller.respondWith(jsonResponse(rule.action))
  } else {
    // modify: 실제 응답을 받아서 변형 → 단, nativeFetch로!
    const real = await nativeFetch(request.clone()) // 안 그러면 재가로채기 무한루프
    const original = await real.json()
    const patched = deepMerge(original, rule.action.mergePatch)
    controller.respondWith(jsonResponse({ data: patched.data }))
  }
})

interceptor.apply()
```

### 함정 1 — native fetch 캡처

`modify`는 실제 서버 응답이 필요한데, interceptor 안에서 그냥 `fetch`를 쓰면 우리가 패치한 fetch라 **자기 자신을 재가로채서 무한루프**다. `apply()` 전에 잡아둔 `nativeFetch`를 써야 한다. `document_start` + MAIN world라 페이지 코드보다 먼저 실행되므로 안전하게 원본 캡처 가능.

### 함정 2 — 룰 동기화 레이스

MAIN의 interceptor는 `document_start`에 즉시 켜지지만, 룰은 ISOLATED가 `chrome.storage`를 async로 읽어와야 도착한다. 그 사이 첫 요청이 새면 mock이 안 먹는다. `rulesReady` 프로미스로 첫 동기화까지 매칭을 미루면 닫힌다.

---

## 6. 매칭 순서

요청당 다음 순서로 평가:

1. URL glob 매칭 (v0는 substring)
2. POST 메서드 확인
3. body JSON 파싱 (실패 시 passthrough)
4. `operationName` 일치
5. (있으면) `matchVariables` deep-subset 매칭
6. **enabled 룰 중 첫 매치 승리**

> 룰 순서가 의미를 가지므로, 패널에서 순서 조정 기능은 추후 고려.

---

## 7. 응답 충실도 (Fidelity)

Apollo Client는 응답 shape에 민감하므로 mock도 다음을 지켜야 캐시 정규화가 안 깨진다:

- `{ data, errors, extensions }` 구조 유지
- partial data + errors 공존 케이스 허용
- `Content-Type: application/json` 헤더 부여
- GraphQL 에러는 HTTP status 200 + `errors` 배열로 표현하는 케이스 지원

---

## 8. 빌드 / 툴링

- **Vite + `@crxjs/vite-plugin`** — mswjs를 content script에 번들링하는 걸 처리.
- `injected.js`(MAIN)도 또 하나의 content_script 엔트리로 선언.
- ⚠️ crxjs가 `world: "MAIN"` 엔트리를 클래식 스크립트로 잘 뽑는지 버전별 확인 필요 (최근 버전은 지원).

### manifest 핵심

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "devtools"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["injected.js"],
      "world": "MAIN",
      "run_at": "document_start"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "world": "ISOLATED",
      "run_at": "document_start"
    }
  ],
  "devtools_page": "devtools/devtools.html"
}
```

---

## 9. 의존성

- `@mswjs/interceptors` — fetch/XHR 인터셉션 엔진
  - `FetchInterceptor`, `XMLHttpRequestInterceptor` (Axios 기본/패치 어댑터 모두 커버)
- Vite, `@crxjs/vite-plugin`
- TypeScript

---

## 10. 마일스톤

### v0 (주말 프로젝트 규모)

- [x] 보일러플레이트: manifest + 두 content script + storage 브릿지 + 빈 패널
- [x] MAIN world interceptor: native fetch 캡처 + 레이스 방어 + 재진입 방어
- [x] `match()` — URL/operationName/variables-subset 매칭
- [x] `deepMerge()` — merge-patch 적용
- [x] mock(전체 교체) 동작
- [x] modify(merge-patch) 동작
- [x] 패널 룰 CRUD
- [x] 룰 import/export (JSON)

### v1

- [x] path-DSL (`appointments[].status` 형태 배열 변환)
- [x] 룰 순서 조정 UI
- [x] (선택) 자동 요청 캡처 — `chrome.devtools.network.onRequestFinished` 기반, operationName/variables로 reconcile (+ 실제 응답으로 mock 시드)

### 학습 가치가 큰 지점

인터셉션 자체보다 **MV3 멀티 컨텍스트 메시징 아키텍처**와 **인터셉터 재진입 방어**에 핵심 난이도가 있다.

---

## 부록 — 왜 DevTools native override는 안 되는가

| 방법                              | operation별 구분 | 무료 | 비고                                                                    |
| --------------------------------- | :--------------: | :--: | ----------------------------------------------------------------------- |
| DevTools native override          |        ❌        |  ✅  | URL 단위 매칭이라 단일 엔드포인트 GraphQL 부적합, status code 변조 불가 |
| tweak / Requestly                 |        ✅        |  ❌  | GraphQL은 유료                                                          |
| **본 프로젝트 (MSW + Extension)** |        ✅        |  ✅  | operationName 매칭 자유, MAIN world 주입                                |
