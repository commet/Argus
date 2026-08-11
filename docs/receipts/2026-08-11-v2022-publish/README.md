# 2.0.22 발행 검증 리시트 (2026-08-11)

BLUEPRINT §9.5 공정 M4 exit 1항 — "npm 최신 버전 == package.json == 태그
(publish는 창업자 행동 — 실행 후 체크)" — 의 실행·검증 기록.

## 발행

- 창업자가 로컬 main `9a76bf38`에서 `npm publish` 실행 (2026-08-11 03:17Z경).
  `prepublishOnly`가 typecheck + 테스트 1139개(127파일) + audit를 통과시킨 뒤
  발행됐다. 1차 시도는 npm 토큰 만료로 E404가 났고(브라우저 재인증 후 성공),
  **같은 벽이 2.0.21을 막았던 것으로 보인다** — 2.0.21은 리포지토리에만 존재하고
  npm에 발행된 적이 없다 (발행 직전 레지스트리 최신은 2.0.20, dist-tags도
  2.0.20). 즉 이 발행은 실사용자 기준 2.0.20 → 2.0.22 점프이며, CHANGELOG의
  2.0.21 수리(영어 기본 보이스·codex 게이트)도 이번에 처음 도달했다.

## 무결성 사슬

| 지점 | 값 |
|---|---|
| 창업자 터미널의 npm pack shasum | `808f6cfc8715576b74ae49475e0e8a1c06629ca6` |
| 레지스트리 `argus-decision-mcp@latest` shasum | `808f6cfc8715576b74ae49475e0e8a1c06629ca6` |
| 발행 기반 커밋 (창업자 로컬 main) | `9a76bf38` |
| git 태그 `v2.0.22` | `9a76bf38` (관례대로 lightweight) |

## 검증 — `node argus-mcp/evals/verify-published.mjs 2.0.22`

원출력은 `VERIFY-OUTPUT.txt` (exit 0). 레지스트리에서 타르볼을 `npm pack`으로
내려받아 사용자의 npx 해석 그대로 의존성을 설치하고 **그 서버를 구동**한 검사다:

- 버전 일치 + POSIX 실행 비트 (2.0.7 게이트)
- **번들 마커 17/17 실재** — 이번 릴리스의 닫힌-결정 수리 3개
  (`acknowledge it and move on; recording it re-opens it` ·
  `premises serve judgments that are still open` ·
  `Restraint is the default. Never act on trivial`) 포함. 셋 다 발행 직전
  레지스트리 실물(2.0.20)에는 없던 문자열이라 이 검사는 빨간불이 될 수 있었다.
- 라이브 상호작용 4종: 확인창 표시 · 입력칸 없음 · 한 번의 Accept로 기록 ·
  되읽기 보존

## 검증기 자체의 수리 2건 (이 리시트와 같은 커밋)

1. **npm-cli.js 경로가 Windows 배치만 알았다** — `dirname(execPath)/node_modules/…`
   는 Windows에서만 맞고 리눅스는 `../lib/node_modules/…`다. 이 게이트는 리눅스
   컨테이너에서 검사를 시작하기도 전에 죽었다. 두 배치를 순서대로 탐침하고, 둘 다
   없으면 이름 붙여 실패한다.
2. **마커 주석의 "published 2.0.21 커밋" 오기 정정** — 2.0.21은 발행된 적이
   없으므로 그 수식어는 거짓이었다. 마커 부재 대조 자체(커밋 `c20a9016`에 3/3
   부재)는 유효하다.

## 남은 M4 항목

- exit 2항 `[x]` /import Windows 블록 렌더 — 기존 체크 유지.
- exit 3항 `[ ]` 신규 사용자 1명의 외부 개입 없는 완주 — **실제 외부인이 필요해
  남는다.** 발행이 됐으므로 이제 실측 가능한 상태가 됐다.
