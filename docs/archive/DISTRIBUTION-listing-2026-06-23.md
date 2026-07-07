# Argus 유통·발견 체크리스트 (2026-06-23)

> 워크스트림 4. 조사에서 "Argus가 *발견될* 레이어"로 지목된 큐레이션 목록 등재 + 설치
> 신뢰성. 포장(marketplace.json v2.6)은 됐으나 등재 0이던 상태를 푼다. 정직 원칙(Git의
> "reference 수준" 규율) — 과장 금지.

## 1. 설치 신뢰성 — 검증 결과 ✅

- `node argus-plugin-v2/scripts/validate-plugin.js` → **passed** (구조/스킬/스키마 정합).
- `.claude-plugin/marketplace.json`(루트) + `argus-plugin-v2/.claude-plugin/plugin.json` 둘 다
  v2.6.0, 스키마 URL 명시, license MIT, homepage/repo 정상.
- 설치 경로(README 상단, 검증된 형태):
  ```text
  /plugin marketplace add commet/Argus
  /plugin install argus@argus
  /argus:sail "막힌 결정"        # 재시작 후
  ```
- **전제**: `marketplace add commet/Argus`는 GitHub `commet/Argus`의 **main**에서 당겨온다 →
  플러그인이 main에 있어야 함(현재 있음). 이 커밋 push 후 즉시 유효.
- **남은 한 가지(코드로 못 막음):** 진짜 빈 머신에서 위 3줄을 한 번 실제로 돌려
  스크린샷. (CI/검증기는 구조만 보증; 실제 한 번의 클린 설치는 사람 확인 영역 — plugin
  hardening 메모리의 "실사용자가 최종 검증" 원칙.)

## 2. 버전드 릴리스

- mutable-main만 가리키지 말고 **annotated git tag `v2.6.0`** + GitHub Release.
  (wshobson 비판: "버전 없는 main = 신뢰/재현성 구멍".)
- 태그는 이 작업 커밋과 함께 push. Release 노트 초안은 §4.

## 3. awesome-claude-code 등재 (외부 PR — 본인 확인 후 발사)

> ⚠️ 제3자 repo에 PR을 여는 건 outward-facing이라 **자동 제출하지 않음.** 아래 항목을
> 그대로 복사해 PR 하면 된다. (목록마다 CONTRIBUTING 형식이 다르니 그 repo 규칙 우선.)

**제안 한 줄 (정직, 과장 없음):**

> **Argus** — A decision-voyage harness. Sharpens the real question, puts an agent
> crew to work on your actual code/PR/docs, verifies their claims, and returns a
> one-screen *Current Heading* (course · why · what's unverified · road not taken ·
> next step) plus a falsifiable decision-contract you later settle against reality.

- **Category:** Plugins / Workflow & Decision
- **Repo:** https://github.com/commet/Argus
- **Install:** `/plugin marketplace add commet/Argus` → `/plugin install argus@argus`
- **License:** MIT

**후보 등재처(우선순위):**
1. `hesreallyhim/awesome-claude-code` (큐레이션형, 47k★ — 조사가 지목한 그 레이어).
2. Claude Code plugin/marketplace 디렉토리(공식/커뮤니티) — plugin.json 그대로 사용.

**금지(스파인):** "AI의 판단을 받으세요" / "리스크를 줄여줍니다" 류 카피 금지 — 제품 명제는
*orientation*. anti-sycophancy / verification을 전면에.

## 4. GitHub Release 노트 초안 (v2.6.0)

```md
## Argus v2.6.0 — decision-voyage harness

Ask Argus a hard decision; it checks the weak claims behind the scenes and returns
one screen showing where the decision actually stands — plus a falsifiable
decision-contract you settle against reality later.

- Under-fire restraint default (no manufactured forks on flat decisions)
- Agent crew works on your real code / PR / docs; claims are verified before the answer
- Current Heading output + /argus:settle /argus:log calibration loop
- Crisis screening on all input paths

Install:
  /plugin marketplace add commet/Argus
  /plugin install argus@argus
```
