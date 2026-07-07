# Argus dogfood 코퍼스 — 2026-07-03

> 발행된 `argus-decision-mcp` (동일 빌드)를 실제 MCP stdio 프로토콜로 구동해 31개 스텝을 돌린 실측 기록. 격리 임시 저널. 개선 작업용 레퍼런스.
> serverInfo: `{"name":"argus-decision-mcp","version":"1.0.0"}`  · locale=ko · tz=Asia/Seoul

## ⚑ 자동 감지된 거친 지점 (25)

| case | kind | flag | detail |
|---|---|---|---|
| promo-timing | seal | **EN_SURFACE_UNDER_KO** | Sealed. "2주 dogfood를 돌리면 홍보 전에 첫인상을 망칠 문제를 최소 1개 발견해 고친다." — reality answers on  |
| promo-timing | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| hire-contractor | seal | **EN_SURFACE_UNDER_KO** | Sealed. "외주를 쓰면 6주 안에 리뷰 파이프라인이 프로덕션에 나간다." — reality answers on 2026-08-15. Com |
| hire-contractor | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| pricing-free | seal | **EN_SURFACE_UNDER_KO** | Sealed. "무료를 유지하면 3개월 내 주간 활성 사용자가 2배가 된다." — reality answers on 2026-09-30. Com |
| pricing-free | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| hero-copy | seal | **EN_SURFACE_UNDER_KO** | Sealed. "커밋 비유로 바꾸면 개발자 방문자의 첫 봉인 전환이 오른다." — reality answers on 2026-07-24. Com |
| hero-copy | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| retro-onboard | seal | **EN_SURFACE_UNDER_KO** | Sealed. "회고 봉인을 빈 화면에 노출하면 첫 세션 정산 완주율이 오른다." — reality answers on 2026-08-07. C |
| retro-onboard | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| email-domain | seal | **EN_SURFACE_UNDER_KO** | Sealed. "argus.voyage로 보내면 스팸함 없이 도착률 95%+ 나온다." — reality answers on 2026-07-20 |
| email-domain | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| telegram-open | seal | **EN_SURFACE_UNDER_KO** | Sealed. "공개 채널로 열면 한 달 내 외부 사용자 봉인이 5건+ 생긴다." — reality answers on 2026-08-03. C |
| telegram-open | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| registry-list | seal | **EN_SURFACE_UNDER_KO** | Sealed. "레지스트리 등재 후 2주 내 npm 주간 다운로드가 유의미하게 는다." — reality answers on 2026-07-17 |
| registry-list | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| mobile-first | seal | **EN_SURFACE_UNDER_KO** | Sealed. "모바일을 먼저 다듬으면 이탈률이 눈에 띄게 준다." — reality answers on 2026-08-10. Come back |
| mobile-first | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| anchor-sig | seal | **EN_SURFACE_UNDER_KO** | Sealed. "⚓를 매듭마다 넣으면 스크린샷 공유가 실제로 생긴다." — reality answers on 2026-08-20. Come ba |
| anchor-sig | settle | **EN_SURFACE_UNDER_KO** | Settled. The receipt records what you predicted and what reality did — no grade. |
| probe-crux-id | open | **EN_SURFACE_UNDER_KO** | Opened. The one question that decides this: Will the user id migration finish be |
| probe-ai-owned | seal | **EN_SURFACE_UNDER_KO** | Sealed. "이 기능을 내면 리텐션이 오른다고 모델이 추정한다" — reality answers on 2026-08-05. Come back |
| probe-vague-en | seal | **VAGUE_FLAGGED** | {} |
| probe-vague-ko | seal | **VAGUE_FLAGGED** | {} |
| probe-crux-id | open | **CRUX_ID_OK** | Opened. The one question that decides this: Will the user id migration finish before Q3? |

## 케이스별 실측 출력

### [promo-timing] seal — 홍보 지금 vs 2주 dogfood 먼저
- ok: `true`
- surface: Sealed. "2주 dogfood를 돌리면 홍보 전에 첫인상을 망칠 문제를 최소 1개 발견해 고친다." — reality answers on 2026-07-17. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "2주 dogfood를 돌리면 홍보 전에 첫인상을 망칠 문제를 최소 1개 발견해 고친다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-07-17   (14일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [promo-timing] settle — 홍보 지금 vs 2주 dogfood 먼저
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    지금 홍보하나, 먼저 써본 뒤 하나?
  THE UNVERIFIED ASSUMPTION
    dogfood가 안전망으로 작동한다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   거친 첫인상 리스크 vs 2주 지연
  …made by          Me. (not the model)
  …called as        judgment

  YOU PREDICTED   "2주 dogfood를 돌리면 홍보 전에 첫인상을 망칠 문제를 최소 1개 발견해 고친다."   (check-by 2026-07-17)
  WHAT HAPPENED   버그 2개 발견해 고침. 가정 맞았다.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [hire-contractor] seal — 외주 개발자 1명 이번 분기
- ok: `true`
- surface: Sealed. "외주를 쓰면 6주 안에 리뷰 파이프라인이 프로덕션에 나간다." — reality answers on 2026-08-15. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "외주를 쓰면 6주 안에 리뷰 파이프라인이 프로덕션에 나간다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-08-15   (43일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [hire-contractor] settle — 외주 개발자 1명 이번 분기
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    외주로 속도를 살까?
  THE UNVERIFIED ASSUMPTION
    온보딩 비용이 6주 안에 회수된다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   코드 품질 통제권을 얼마나 넘길지
  …made by          Me. (not the model)
  …called as        mixed

  YOU PREDICTED   "외주를 쓰면 6주 안에 리뷰 파이프라인이 프로덕션에 나간다."   (check-by 2026-08-15)
  WHAT HAPPENED   외주 안 쓰고도 4주에 끝남. 온보딩 비용 회피.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [pricing-free] seal — 웹앱 계속 무료 유지
- ok: `true`
- surface: Sealed. "무료를 유지하면 3개월 내 주간 활성 사용자가 2배가 된다." — reality answers on 2026-09-30. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "무료를 유지하면 3개월 내 주간 활성 사용자가 2배가 된다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-09-30   (89일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [pricing-free] settle — 웹앱 계속 무료 유지
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    지금 과금할까 무료 유지할까?
  THE UNVERIFIED ASSUMPTION
    무료가 성장의 병목이 아니다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   초기 신뢰 vs 지속가능성
  …made by          Me. (not the model)
  …called as        unsure

  YOU PREDICTED   "무료를 유지하면 3개월 내 주간 활성 사용자가 2배가 된다."   (check-by 2026-09-30)
  WHAT HAPPENED   사용자는 늘었지만 2배는 아님. 절반만 맞음.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [hero-copy] seal — 히어로 문장 git-commit 비유로
- ok: `true`
- surface: Sealed. "커밋 비유로 바꾸면 개발자 방문자의 첫 봉인 전환이 오른다." — reality answers on 2026-07-24. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "커밋 비유로 바꾸면 개발자 방문자의 첫 봉인 전환이 오른다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-07-24   (21일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [hero-copy] settle — 히어로 문장 git-commit 비유로
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    조어 대신 개발자 언어로?
  THE UNVERIFIED ASSUMPTION
    개발자에게 커밋 비유가 통한다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   세계관 희석 위험을 감수할지
  …made by          Me. (not the model)
  …called as        judgment

  YOU PREDICTED   "커밋 비유로 바꾸면 개발자 방문자의 첫 봉인 전환이 오른다."   (check-by 2026-07-24)
  WHAT HAPPENED   개발자 피드백 좋았음. 전환 소폭 상승.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [retro-onboard] seal — 회고 봉인 온보딩 기본 노출
- ok: `true`
- surface: Sealed. "회고 봉인을 빈 화면에 노출하면 첫 세션 정산 완주율이 오른다." — reality answers on 2026-08-07. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "회고 봉인을 빈 화면에 노출하면 첫 세션 정산 완주율이 오른다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-08-07   (35일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [retro-onboard] settle — 회고 봉인 온보딩 기본 노출
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    첫 정산을 3분으로 당길까?
  THE UNVERIFIED ASSUMPTION
    회고가 리허설로 안 끝나고 실봉인으로 이어진다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   연습을 권하는 게 과한 개입인지
  …made by          Me. (not the model)
  …called as        judgment

  YOU PREDICTED   "회고 봉인을 빈 화면에 노출하면 첫 세션 정산 완주율이 오른다."   (check-by 2026-08-07)
  WHAT HAPPENED   완주율 올라감. 온램프도 작동.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [email-domain] seal — 확인일 이메일 발송 도메인
- ok: `true`
- surface: Sealed. "argus.voyage로 보내면 스팸함 없이 도착률 95%+ 나온다." — reality answers on 2026-07-20. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "argus.voyage로 보내면 스팸함 없이 도착률 95%+ 나온다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-07-20   (17일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [email-domain] settle — 확인일 이메일 발송 도메인
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    어느 도메인으로 보낼까?
  THE UNVERIFIED ASSUMPTION
    도메인 인증이 도착률을 좌우한다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   초기 신뢰가 걸린 첫 메일을 감수할지
  …made by          Me. (not the model)
  …called as        luck

  YOU PREDICTED   "argus.voyage로 보내면 스팸함 없이 도착률 95%+ 나온다."   (check-by 2026-07-20)
  WHAT HAPPENED   테스트 발송 전부 도착. 스팸 0.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [telegram-open] seal — 텔레그램 봇 공개 채널
- ok: `true`
- surface: Sealed. "공개 채널로 열면 한 달 내 외부 사용자 봉인이 5건+ 생긴다." — reality answers on 2026-08-03. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "공개 채널로 열면 한 달 내 외부 사용자 봉인이 5건+ 생긴다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-08-03   (31일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [telegram-open] settle — 텔레그램 봇 공개 채널
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    봇을 공개로 열까?
  THE UNVERIFIED ASSUMPTION
    텔레그램에 수요가 있다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   스팸/악용 리스크를 감당할지
  …made by          Me. (not the model)
  …called as        unsure

  YOU PREDICTED   "공개 채널로 열면 한 달 내 외부 사용자 봉인이 5건+ 생긴다."   (check-by 2026-08-03)
  WHAT HAPPENED   봉인은 왔지만 5건 미만. 절반.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [registry-list] seal — 공식 MCP 레지스트리 등재
- ok: `true`
- surface: Sealed. "레지스트리 등재 후 2주 내 npm 주간 다운로드가 유의미하게 는다." — reality answers on 2026-07-17. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "레지스트리 등재 후 2주 내 npm 주간 다운로드가 유의미하게 는다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-07-17   (14일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [registry-list] settle — 공식 MCP 레지스트리 등재
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    지금 등재할까?
  THE UNVERIFIED ASSUMPTION
    레지스트리가 실제 유입 원천이다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   첫인상 준비가 됐는지
  …made by          Me. (not the model)
  …called as        mixed

  YOU PREDICTED   "레지스트리 등재 후 2주 내 npm 주간 다운로드가 유의미하게 는다."   (check-by 2026-07-17)
  WHAT HAPPENED   등재 후 다운로드 상승 관측.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [mobile-first] seal — 모바일 UX 먼저
- ok: `true`
- surface: Sealed. "모바일을 먼저 다듬으면 이탈률이 눈에 띄게 준다." — reality answers on 2026-08-10. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "모바일을 먼저 다듬으면 이탈률이 눈에 띄게 준다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-08-10   (38일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [mobile-first] settle — 모바일 UX 먼저
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    모바일 먼저 vs 데스크톱 먼저?
  THE UNVERIFIED ASSUMPTION
    트래픽 다수가 모바일이다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   데스크톱 정교화를 미룰지
  …made by          Me. (not the model)
  …called as        judgment

  YOU PREDICTED   "모바일을 먼저 다듬으면 이탈률이 눈에 띄게 준다."   (check-by 2026-08-10)
  WHAT HAPPENED   이탈률 감소 확인.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [anchor-sig] seal — ⚓ 서명을 시그니처로
- ok: `true`
- surface: Sealed. "⚓를 매듭마다 넣으면 스크린샷 공유가 실제로 생긴다." — reality answers on 2026-08-20. Come back then with argus_settle.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "⚓를 매듭마다 넣으면 스크린샷 공유가 실제로 생긴다."

  이 문장은 당신의 것입니다.                       (predicate_owner: user)

  봉인       2026-07-03
  현실의 답    2026-08-20   (48일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [anchor-sig] settle — ⚓ 서명을 시그니처로
- ok: `true`
- surface: Settled. The receipt records what you predicted and what reality did — no grade.
```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Sealed 2026-07-03      Settled 2026-07-03

  THE REAL QUESTION
    ⚓를 서명으로 박을까?
  THE UNVERIFIED ASSUMPTION
    작은 물성이 공유를 만든다
    (+1 premise(s) tracked · 0 changed at re-check — argus_recall view=premises)
  HUMAN-ONLY CALL   과한 장식 위험을 감수할지
  …made by          Me. (not the model)
  …called as        unsure

  YOU PREDICTED   "⚓를 매듭마다 넣으면 스크린샷 공유가 실제로 생긴다."   (check-by 2026-08-20)
  WHAT HAPPENED   몇 건 공유 관측. 확정은 이르다.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└────────────────────────────────  argus · seal → settle ⚓ ─┘
```

### [probe-flat] open — 평평한 사소 결정 — 절제 기대
- ok: `true`
- surface: Cheap to undo and little at stake — trying it IS the test. Leaving it as is stays a real option.

### [probe-already] open — 이미 결정함 — 재오픈 안 함 기대
- ok: `true`
- surface: You already made this call. Argus does not reopen it. Leaving it as is stays a real option.

### [probe-vague-en] seal — 막연한 영어 술어 — 반증불가 걸러야
- ok: `false`

### [probe-vague-ko] seal — 막연한 한국어 술어 — VIBE_KO 검증
- ok: `false`

### [probe-badcheck] seal — 과거 확인일 — BAD_CHECK_BY 기대
- ok: `false`

### [probe-nosettle] settle — 봉인 없는 정산 — NO_PRIOR_SEAL 기대
- ok: `false`

### [probe-double] settle — 이중 정산 — ALREADY_SETTLED 기대
- ok: `false`

### [probe-crux-id] open — crux에 id 포함 — 오탐 없어야
- ok: `true`
- surface: Opened. The one question that decides this: Will the user id migration finish before Q3?

### [probe-ai-owned] seal — ai_surfaced 술어 — 정직 소유 분기
- ok: `true`
- surface: Sealed. "이 기능을 내면 리텐션이 오른다고 모델이 추정한다" — reality answers on 2026-08-05. Come back then with argus_settle. You sealed without naming the assumption it rests on — that's recorded as skipped, not hidden. You can still name it.
```
┌─ ARGUS · 봉인 ──────────────────────────────────────────────┐

  "이 기능을 내면 리텐션이 오른다고 모델이 추정한다"

  Argus가 초안한 문장입니다 — 아직 당신이 확언하지 않았습니다. (predicate_owner: ai_surfaced)

  봉인       2026-07-03
  현실의 답    2026-08-05   (33일 뒤)

  그날까지 이 봉인은 닫혀 있습니다. 날짜가 오면 여기 기록될
  것은 평가가 아니라 — 실제로 일어난 일입니다.

└────────────────────────────────────────  argus · 닻 내림 ⚓ ─┘
```

### [final-wake] recall — 항적(wake) — 축적된 전체
- ok: `true`
- surface: 12 decision(s) on record.
```
┌─ ARGUS · 항적 ──────────────────── 결정 12 · 봉인 중 1 · 정산 10 ─┐

  확인일 지남 (1)                                ← argus_settle
    ai-owned   "이 기능을 내면 리텐션이 오른다고 모델이 …"   08-05 · 15일 경과

  정산됨 (10) — held 5 · avoided 2 · partial 3
    promo-tim… held      07-03   "2주 dogfood를 돌리면 홍보 전에 첫…"
    registry-… held      07-03   "레지스트리 등재 후 2주 내 npm 주간 …"
    email-dom… avoided   07-03   "argus.voyage로 보내면 스팸함 없…"
    hero-copy  held      07-03   "커밋 비유로 바꾸면 개발자 방문자의 첫 봉…"
    telegram-… partial   07-03   "공개 채널로 열면 한 달 내 외부 사용자 …"
    … (+5)

└───────────────────────────────────── 기록 시작 2026-07-03 부터 ─┘
```

### [final-track] recall — track_record — 빈도 서술
- ok: `true`
- surface: Of 10 settled: 5 held, 2 avoided, 3 partial.
