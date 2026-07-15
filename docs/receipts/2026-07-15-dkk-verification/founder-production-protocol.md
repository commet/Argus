# 창업자 프로덕션 검증 프로토콜 — 30분

Date: 2026-07-15
Scope: DKK v6 Definition-of-Done 중 **프로덕션 환경에서만 가능한** 잔여 4상자.
이 세션(원격 샌드박스)에는 프로덕션 자격증명이 없고, 있어서도 안 된다 —
아래는 창업자 머신(.env.local 보유)에서 그대로 실행하는 절차다.
로컬/구조 증거는 같은 폴더의 `evidence.md`가 정본이다.

## 준비 (5분, 1회)

1. Telegram 토큰이 아직 회전되지 않았다면 **먼저 회전** (핸드오프 §0 — BotFather
   revoke → `.env.local` → Vercel Prod/Preview → redeploy → setWebhook 재등록).
2. argus.voyage에서 **일회용 테스트 계정** 가입 (예: `dkk-dogfood+0715@…`).
3. 로그인된 상태 확인.

## 1. 웹 P6 — 자동 (10분)

```bash
ARGUS_BASE_URL=https://argus.voyage \
NEXT_PUBLIC_SUPABASE_URL=<.env.local 값> \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<.env.local 값> \
DOGFOOD_EMAIL=<테스트 계정> DOGFOOD_PASSWORD=<암호> \
npm run dogfood:prod
```

- 러너가 일회용 프로젝트를 스스로 만들고 핸드오프의 10단계(봉인→관찰→답→
  defer→분리된 close→중복 재시도→변조 재시도→동시 defer/close)를 실HTTPS로
  구동, 증거(JSONL: 이벤트 id·영수증·HTTP 코드·해시)를 남긴다.
- 끝나면 `npm run dogfood:analyze <출력 디렉터리>` → report.md의 finding 0 확인.
- **이 report가 P6 상자의 증거다** — 커밋 시 판단 본문은 넣지 않는다(해시만).

## 2. Telegram P7 — 수동 (7분)

1. 웹 Settings → Telegram 연결(`/start` 일회 코드).
2. 위 러너가 만든 프로젝트(끝에 id 출력)에 대해 봇에서 실답장 1회.
3. `GET /api/semantic/projects/<id>/events`로 `observation_recorded` +
   `resolution_asserted`가 **한 atomic batch**로 붙었고 judgment가 아직 열려
   있음을 확인.
4. 별도의 close 버튼 탭 → `judgment_closed`가 **별개 이벤트**로 추가 확인.
5. pending(아직)과 mute를 각각 1회 — pending은 defer일 뿐 종결이 아니고,
   mute는 원장 무기록(전달만 끔)인지 이벤트 스트림으로 확인.

## 3. 플러그인 P7 — 수동 (5분)

이 세션이 **실제 push-webapp.js를 로컬 와이어로 완주**시켜 뒀다
(`scripts/dogfood/p7-real-pull.ts`, evidence.md §P7). 프로덕션에서 남은 것은
실제 HTTPS + 실제 토큰 조합 1회:

1. 일회용 리포에서 `/argus:connect <새 pat>` → `/argus:pull`.
2. `.argus/ledger/semantic-v3.jsonl`의 event_id들이 웹
   `/api/plugin/events` 응답과 일치(바이트 비교)하는지 확인.

## 4. 소유·파기 (3분)

1. Settings → 계정 데이터 내보내기 → JSON에 `project_semantic_events` 키와
   방금 만든 이벤트들이 있는지 확인.
2. 계정 삭제 실행 → 반환된 테이블별 영수증에서 `project_semantic_events: N>0`.
3. 같은 토큰/세션으로 `GET /api/semantic/...` 재호출 → 401/빈 결과 확인
   (낡은 replica 재등장 벡터는 corpus C15 + 삭제 후 auth 소멸로 구조 차단 —
   evidence.md §erasure).

## 완료 후

- 각 단계의 report/이벤트 id를 `docs/receipts/2026-07-15-dkk-verification/`에
  추가 커밋 (본문·시크릿 금지).
- `DKK-v6-CONTINUATION-HANDOFF-2026-07-14.md` Definition of done의 해당 4상자를
  그 커밋에서 체크.
