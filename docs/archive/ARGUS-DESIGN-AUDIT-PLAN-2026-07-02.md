# Argus 웹앱 총체 디자인 감수 및 개선 계획

작성일: 2026-07-02  
작성 목적: 다른 Codex/검토 세션이 이 문서를 읽고 동일한 디자인 감수 맥락을 이어갈 수 있도록, 현재 Argus 웹앱의 시각 언어, 실제 렌더링 문제, 화면별 개선 계획, 실행 우선순위를 정리한다.

## 1. 감수 범위와 확인 방식

이번 감수는 코드 구조와 실제 렌더링을 함께 확인했다.

- 대상 앱: `C:\Users\admin\Documents\GitHub\Argus`
- 실행 확인: Next dev server `http://127.0.0.1:3002`
- 주요 확인 화면:
  - `/ko`
  - `/ko/workspace`
  - `/ko/project`
  - `/ko/settings`
  - `/ko/boss`
- 주요 참고 파일:
  - `src/app/globals.css`
  - `src/components/landing/SirenHero.tsx`
  - `src/components/landing/LandingHeader.tsx`
  - `src/app/[locale]/workspace/page.tsx`
  - `src/components/boss/BossSetup.tsx`
  - `src/app/[locale]/project/page.tsx`
  - `src/app/[locale]/settings/page.tsx`
  - `src/components/ui/Card.tsx`
  - `src/components/ui/Button.tsx`

적용한 감수 기준:

- `frontend-design` 플러그인의 "distinctive, intentional visual design" 기준
- 기존 프로젝트 리디자인 기준
- 웹 인터페이스 가이드라인
- 인터페이스 폴리시 기준: 반경, 그림자, hit area, transition specificity, text wrapping, tabular numbers

## 2. 최상위 결론

Argus는 디자인 퀄리티가 없는 앱이 아니다. 오히려 이미 강한 시각 자산이 있다.

핵심 자산은 다음이다.

- 항해, 해도, 로그북, 현재 방위, 봉인, 귀환이라는 제품 은유
- `blueprint/logbook` 계열의 랜딩 시각 언어
- 사용자가 AI 답변을 듣기 전에 자기 판단을 먼저 고정한다는 제품 철학
- 프로젝트 빈 상태 카드처럼 실제로 이 언어가 잘 작동하는 화면

문제는 다음이다.

1. 일부 핵심 화면이 실제로 보이지 않는다. 이는 디자인 polish 이전의 P0 렌더링 문제다.
2. 랜딩, 앱 내부, 보스/에이전트 UI가 서로 다른 시각 언어를 쓴다.
3. 금색, 카드, 둥근 반경, 그림자, 작은 텍스트가 너무 넓게 쓰여 정보 위계가 흐려진다.
4. 랜딩은 브랜드 필름은 강하지만, 첫 viewport에서 "바로 써보는 제품"이라는 액션이 늦게 나온다.
5. 설정 화면은 기능적으로 명확하지만, 카드와 폼이 반복되어 작업 도구라기보다 설정 목록처럼 보인다.

가장 먼저 할 일은 디자인 개선이 아니라 `workspace`와 `boss`의 콘텐츠가 실제로 보이게 만드는 것이다.

## 3. P0 렌더링 문제

### 3.1 `/ko/workspace` 첫 화면이 비어 보임

현상:

- DOM에는 본문, 입력창, 시나리오 카드, CTA가 존재한다.
- 실제 스크린샷에서는 헤더 아래 본문이 거의 전부 빈 화면처럼 보인다.
- 모바일에서도 동일하게 빈 화면으로 보인다.

확인된 단서:

- `document.elementFromPoint()` 기준으로 본문 요소는 실제 좌표에 존재한다.
- `h2`, `textarea`, `button` 등 자식 요소의 computed style은 `opacity: 1`이다.
- 그러나 상위 motion wrapper 하나가 `opacity: 0`으로 남아 있고, 자식들이 실제 픽셀에 렌더링되지 않는다.

관련 위치:

- `src/app/[locale]/workspace/page.tsx`
- 특히 `HeroFlow`의 idle phase 근처:
  - `motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} ...`

개선 방향:

- `AnimatePresence`에 `initial={false}` 적용 여부 검토
- phase root wrapper가 애니메이션 실패 시에도 `opacity: 1` fallback을 갖도록 수정
- idle entry는 필수 입력 화면이므로, entrance animation이 실패해도 절대 숨겨지지 않아야 한다.
- Playwright/브라우저 검증 기준에 "첫 viewport 픽셀에 입력창 텍스트가 보이는가"를 추가한다.

### 3.2 `/ko/boss`도 주요 본문이 `opacity: 0`에 갇힘

현상:

- DOM에는 보스 설정 폼, 성격 설정, 입력 블록이 존재한다.
- 실제 스크린샷에서는 헤더 아래가 비어 보인다.

확인된 opacity 0 요소:

- `.bs-hero`
- `.bs-type-section`
- `.bs-persona-card`
- `.bs-input-block`

관련 위치:

- `src/components/boss/BossSetup.tsx`
- `stagger`, `fadeUp` variants
- root `motion.div className="bs"` with `initial="hidden"` and `animate="show"`

개선 방향:

- parent/child variant propagation이 현재 환경에서 제대로 동작하지 않는 원인을 확인한다.
- 필수 화면은 CSS class 또는 non-motion fallback으로 기본 visible 상태를 보장한다.
- `initial="hidden"`을 제거하거나 `initial={false}`/explicit `animate` 구조로 바꾼다.
- 애니메이션은 "보이면 더 좋아지는 것"이어야지, 실패하면 제품을 숨기는 구조면 안 된다.

## 4. 현재 디자인 언어 분석

### 4.1 랜딩: `blueprint/logbook` 언어

좋은 점:

- 제품 철학과 직접 연결된다.
- `AI에 묻기 전에, 당신 판단부터.`라는 headline과 항해 필름이 강하게 맞물린다.
- 모바일에서 특히 첫 화면의 정체성이 선명하다.
- 종이, 잉크, 항해도, 선박 일러스트가 "판단을 기록한다"는 제품 세계를 만든다.

문제:

- 데스크톱 첫 viewport에서 입력 CTA가 film 아래로 밀린다.
- 사용자가 첫 화면에서 "바로 써볼 수 있다"보다 "브랜드 영상을 본다"로 느낄 수 있다.
- 랜딩의 강한 언어가 앱 내부로 충분히 이어지지 않는다.

개선 방향:

- 데스크톱에서도 첫 viewport 안에 `LOG ENTRY` 입력과 `읽어보기` CTA가 반드시 보이게 한다.
- film은 유지하되, 높이와 위치를 조정한다.
- 입력 영역을 제품의 진짜 첫 상호작용으로 취급한다.
- 랜딩에서 쓰는 잉크/종이/해도 언어를 앱 내부 기본 시각 언어로 승격한다.

### 4.2 앱 내부: `concert hall/gold card` 언어

현재 앱 내부는 warm cream, white card, gold accent, rounded card, shadow 기반이다.

좋은 점:

- 접근성/콘트라스트를 이미 여러 차례 고친 흔적이 있다.
- 금색 accent가 Argus의 "확정, 봉인, 결과" 느낌과 맞을 수 있다.
- 프로젝트 빈 상태는 비교적 완성도가 높다.

문제:

- 금색이 너무 많은 역할을 한다.
  - CTA
  - hover
  - error-ish 상태
  - active nav
  - focus
  - badge
  - card emphasis
- 랜딩의 해도/로그북 정체성과 앱 내부 카드 UI가 별도 제품처럼 보인다.
- `rounded-2xl`, `rounded-xl`, `shadow`, `border`가 반복되어 인터페이스가 살짝 둔해진다.

개선 방향:

- 금색은 "확정, 봉인, 현재 방위, 중요한 결론"에 집중한다.
- 기본 조작 UI는 잉크/종이/선 기반으로 낮춘다.
- 카드 기본 반경을 줄이고, 큰 상태판만 큰 반경을 허용한다.
- `Card`와 `Button` 공통 컴포넌트를 중심으로 tone을 재정의한다.

### 4.3 보스 시뮬레이터

좋은 점:

- 기능 의도는 명확하다. "말하기 전에 상사 반응을 시뮬레이션"한다.
- 사용자에게 친근한 진입 장치가 있다.

문제:

- 현재는 Argus의 핵심 판단/항해 제품에서 분리된 별도 재미 기능처럼 보일 위험이 있다.
- `boss` 전용 CSS가 globals 안에 길게 있고, 앱 전체 언어와 느슨하게 연결된다.
- 렌더링 P0 때문에 실제 화면 검증이 우선이다.

개선 방향:

- "팀장 시뮬레이터"를 독립적인 장난감처럼 보이게 하지 말고, `보고 상대 설정` 혹은 `stakeholder rehearsal` 기능으로 재배치한다.
- 보스 전용 카드도 로그북/해도 언어 안으로 흡수한다.
- 감정적 표현은 유지하되, 전체 제품의 "판단 기록" 정체성을 해치지 않게 한다.

## 5. 화면별 개선 계획

### 5.1 랜딩 `/ko`

현재 의도:

- AI가 답을 먼저 주는 세상에서, 사용자의 판단을 먼저 묶고 보호한다.
- 오디세우스/사이렌 항해 은유로 제품의 철학을 강하게 보여준다.

현재 수행:

- 브랜드 기억은 강하다.
- 모바일은 좋은 편이다.
- 데스크톱은 film이 화면을 크게 차지해서 입력 CTA가 늦게 보인다.

개선 계획:

1. 첫 viewport 안에 입력 CTA를 보장한다.
2. film 높이를 viewport와 입력의 공존 기준으로 재조정한다.
3. headline, subcopy, film, input의 순서를 유지하되 각 높이를 줄인다.
4. `Have it read / 읽어보기` CTA를 더 명확한 primary action으로 만든다.
5. 랜딩의 `bp-root` 토큰을 앱 내부로 연결할 이름을 만든다.
   - 예: `chart`, `logbook`, `ink`, `sealed`, `bearing`

검증 기준:

- 1280x720에서 입력 박스와 CTA가 보인다.
- 390x844에서 현재처럼 CTA까지 자연스럽게 이어진다.
- 첫 화면만 보고도 "여기에 결정을 적는 도구"라는 점이 보인다.

### 5.2 워크스페이스 `/ko/workspace`

현재 의도:

- 사용자가 지금 들고 있는 결정을 입력한다.
- AI 팀이 갈리는 지점을 보여주고, 최종적으로 문서와 현재 방위를 남긴다.

현재 수행:

- DOM 구조는 의도에 맞다.
- 하지만 실제 렌더링에서 본문이 보이지 않는 P0 문제가 있다.

개선 계획:

1. opacity P0를 최우선 수정한다.
2. 로그인 배너는 입력보다 덜 중요한 정보로 낮춘다.
3. 입력창이 화면의 시각 중심이 되게 한다.
4. "AI 팀 소개 / 보고 상대 설정 / 팀 / 가이드" 링크는 tertiary row로 유지하되 더 작고 조용하게 둔다.
5. 시나리오 카드는 첫 사용자 보조 장치로 좋지만, 입력 아래에 명확히 "sample"로 둔다.
6. 본문 첫 heading은 랜딩과 어휘를 맞춘다.
   - 예: "지금 들고 있는 결정, 어디서 갈리는지 봐 드릴게요"
   - 이 방향은 좋으므로 유지하되, 글자 크기와 위치를 더 강하게 한다.

검증 기준:

- 첫 viewport에서 textarea와 시작 CTA가 실제 픽셀에 보인다.
- 키보드 focus가 입력창으로 자연스럽게 간다.
- 빈 상태, 샘플 선택, q query 진입이 모두 같은 레이아웃에서 깨지지 않는다.

### 5.3 프로젝트 `/ko/project`

현재 의도:

- 사용자가 봉인한 결정, 확인일, 귀환 기록을 모아보는 곳.
- "그래서 어떻게 됐는지"를 다시 보는 해도.

현재 수행:

- 빈 상태 카드가 제품 철학과 잘 맞는다.
- 해도, 미개척, 좌표, 배 아이콘이 좋다.
- 현재 확인한 화면 중 가장 안정적으로 보인다.

개선 계획:

1. 이 화면을 앱 내부 디자인 기준의 reference로 삼는다.
2. 단일 큰 카드의 완성도는 유지한다.
3. 빈 상태에서는 `항해 시작하기`와 `데모 먼저 보기`의 hierarchy를 더 분명히 한다.
4. `Claude Code 플러그인 결정 가져오기`는 너무 작게 밀려 있으므로 대상 사용자가 명확하다면 별도 import affordance로 정리한다.
5. 프로젝트가 생긴 뒤의 list/detail 화면도 같은 해도 언어로 맞춘다.

검증 기준:

- 빈 상태에서 다음 행동이 1개 primary, 1개 secondary로 명확하다.
- 모바일에서 카드 내부 텍스트가 과밀하지 않다.
- 프로젝트 list가 생겨도 카드 반복이 generic dashboard처럼 보이지 않는다.

### 5.4 설정 `/ko/settings`

현재 의도:

- 프로필, AI 엔진, 언어, 연동, 데이터, Labs를 설정한다.

현재 수행:

- 기능 항목은 찾을 수 있다.
- 하지만 큰 카드와 긴 폼이 반복되어 화면이 무겁다.
- 설정은 반복적으로 쓰는 운영 도구인데, 현재는 한 페이지에 모든 덩어리를 쌓는다.

개선 계획:

1. 설정 화면을 좌측 section nav + 우측 panel 구조로 바꾼다.
2. 카드 하나에 너무 많은 기능을 넣지 않는다.
3. `프로필`, `AI 엔진`, `연동`, `데이터`, `Labs`를 시각적으로 분리한다.
4. segmented control은 현재 pill/tall 형태보다 더 compact하게 한다.
5. 위험 액션(`데이터 초기화`, `계정 삭제`)은 별도 danger zone으로 하단에 명확히 격리한다.
6. 입력 필드의 세로 높이와 내부 padding을 줄여 정보 밀도를 높인다.

검증 기준:

- 첫 viewport에서 설정의 주요 섹션 3개 이상이 보이거나, 좌측 nav로 위치가 명확하다.
- primary 설정 변경과 destructive action이 시각적으로 섞이지 않는다.
- 모바일에서는 accordion/section list로 자연스럽게 전환된다.

### 5.5 보스 `/ko/boss`

현재 의도:

- 상사/의사결정권자 반응을 말하기 전에 미리 시뮬레이션한다.

현재 수행:

- 현재는 P0 렌더링 문제로 화면이 보이지 않는다.
- DOM text 기준으로 기능 흐름은 좋다.

개선 계획:

1. opacity P0를 수정한다.
2. 보스 화면을 Argus 전체 흐름에 연결한다.
   - "보고 상대 설정"
   - "의사결정권자 반응 rehearsal"
   - "workspace로 가져가기"
3. `팀장한테 할 말 있어?` 같은 친근한 톤은 유지 가능하지만, 전체 UI는 해도/로그북 계열로 낮춘다.
4. 성격 설정 카드와 입력 카드가 한 화면에서 경쟁하지 않게 순서를 정리한다.
5. setup이 끝난 뒤 workspace로 계획을 가져가는 CTA를 더 분명히 만든다.

검증 기준:

- 첫 viewport에서 질문, 설정, 입력 중 무엇부터 해야 하는지 명확하다.
- 보스가 별도 제품이 아니라 Argus의 보조 판단 도구로 느껴진다.

## 6. 공통 컴포넌트 개선 계획

### 6.1 `Card`

현재:

- `rounded-2xl`, border, shadow가 기본값이다.
- 카드 반복이 많아지면 앱이 둔해 보인다.

개선:

- 기본 card 반경: 10-12px
- 큰 상태판/hero plate만 16px 이상
- border는 depth 목적이면 shadow-ring으로 대체 검토
- nested card 금지 원칙 적용
- page section은 card가 아니라 unframed band/layout으로 처리

### 6.2 `Button`

현재:

- variant별 inline style이 많다.
- hover는 translate/brightness 중심이다.
- active는 `translateY(1px)` 계열이다.

개선:

- `active:scale-[0.96]`로 tactile press 통일
- icon side padding을 1-2px 줄여 optical balance 적용
- primary action:
  - 일반 시작: ink button
  - 확정/봉인/현재 방위: gold button
- secondary는 outline/paper로 낮춘다.
- danger는 별도 hue로 격리한다.

### 6.3 Typography

개선:

- heading: `text-wrap: balance`
- body copy: `text-wrap: pretty`
- 동적 숫자: `tabular-nums`
- 11px 텍스트 과다 사용 줄이기
- 한글 serif는 판단/결론/문장 중심에만 사용
- 조작 UI는 Pretendard 중심

### 6.4 Motion

현재 문제:

- motion 실패가 콘텐츠를 숨기는 구조다.

개선:

- 필수 화면은 default visible이어야 한다.
- `AnimatePresence initial={false}`를 적절히 사용한다.
- interactive state는 keyframe보다 CSS transition을 우선한다.
- `transition-all` 제거, transition property 명시.

## 7. 실행 우선순위

### P0: 렌더링 복구

1. `/workspace` idle HeroFlow opacity 문제 수정
2. `/boss` setup opacity 문제 수정
3. 브라우저/Playwright로 실제 pixel visibility 검증

### P1: 첫 진입 경험

1. 랜딩 데스크톱 첫 viewport에 입력 CTA 노출
2. 워크스페이스 입력 중심 레이아웃 정리
3. 프로젝트 빈 상태 CTA hierarchy 정리

### P2: 시각 언어 통합

1. `blueprint/logbook`을 앱 전체 주 언어로 승격
2. 금색 사용 역할 제한
3. `Card`, `Button`, input, segmented control 토큰 정리

### P3: 밀도와 정보 구조

1. 설정 화면 section nav 구조 도입
2. 보스 화면을 workspace/reviewer flow와 연결
3. 작은 텍스트와 과한 카드 반복 줄이기

### P4: polish

1. text wrapping
2. tabular numbers
3. focus/hover/active state 정리
4. mobile hit area와 bottom drawer 충돌 검증

## 8. 검증 체크리스트

다음은 다른 세션이 수정 후 반드시 확인해야 할 항목이다.

### 화면별

- `/ko`
  - 1280x720 첫 viewport에서 입력 CTA가 보이는가
  - 390x844에서 headline, film, input이 자연스럽게 이어지는가
- `/ko/workspace`
  - 첫 viewport에서 textarea와 start button이 실제 픽셀에 보이는가
  - opacity 0 wrapper가 남아 있지 않은가
  - 샘플 시나리오 선택이 깨지지 않는가
- `/ko/project`
  - 빈 상태 카드 CTA hierarchy가 명확한가
  - 모바일에서 카드가 과하게 높거나 잘리지 않는가
- `/ko/settings`
  - 섹션 이동이 명확한가
  - 위험 액션이 일반 설정과 분리되어 있는가
- `/ko/boss`
  - setup 화면이 실제로 보이는가
  - Argus 전체 제품의 일부로 보이는가

### 기술 검증

- `opacity: 0`이고 높이가 큰 요소가 첫 viewport 핵심 콘텐츠를 감싸지 않는가
- `transition-all` 사용이 줄었는가
- 버튼 active state가 통일되었는가
- 카드 안 카드가 줄었는가
- focus ring이 보이는가
- 모바일 hit area가 44px 이상인가

## 9. 한 줄 방향성

Argus는 더 화려해질 필요가 없다.  
이미 가진 "해도 위에 판단을 묶고, 시간이 지난 뒤 다시 돌아오는 도구"라는 언어를 제품 전체에 일관되게 적용해야 한다.

가장 좋은 기준 화면은 현재 `/project` 빈 상태이고, 가장 먼저 고칠 화면은 `/workspace`와 `/boss`의 opacity P0다.
