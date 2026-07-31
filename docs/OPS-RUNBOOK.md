# Argus 운영 대처 절차서 (OPS RUNBOOK)

2026-07-30 홍보 개시에 맞춰 작성. **문제가 생기면 이 문서를 열고 증상을 찾아
그대로 따라 한다.** 세션(Claude/Codex)에게 시킬 때도 "OPS-RUNBOOK의 N번 상황"
이라고 말하면 바로 통한다.

> 원칙: 이 문서는 **이미 지어진 밸브**만 안내한다. 새 기능을 짓는 문서가 아니다.

---

## 0. 어디를 보나 (관측소 4곳)

| 관측소 | 무엇을 알려주나 | 주기 |
|---|---|---|
| **아침 이메일** (daily-report) | 어제 사용량·오류·**루프 맥박**(크론 5개가 어제 실제로 돌았는지 — 빨간 카드가 뜨면 크론이 죽은 것) | 매일 |
| **GitHub Actions » health-pulse** | 홈이 열리는지(200) + 크론 인증벽이 살아있는지(401) | 6시간마다 |
| **Vercel 대시보드** (overture 프로젝트) | 빌드 실패, 함수 오류, 트래픽 | 실시간 |
| **Supabase » overture-db » user_events** | 서버가 남긴 모든 신호 (아래 SQL) | 조회 시 |

가장 유용한 SQL 한 벌 (Supabase SQL Editor에 붙여넣기):

```sql
-- 지난 24시간, 무슨 일이 얼마나 있었나 (오류·차단 중심)
select event_name, count(*)
from user_events
where created_at > now() - interval '1 day'
  and event_name in ('server_llm_error','server_rate_limited','server_captcha_rejected','js_error')
group by event_name order by count(*) desc;

-- 한도 차단이 어떤 종류였나 (anon_daily=IP당 / auth_daily=계정당 / global_daily=전체 합산)
select properties->>'kind' as kind, count(*)
from user_events
where created_at > now() - interval '1 day' and event_name = 'server_rate_limited'
group by 1;
```

---

## 1. 사이트가 안 열린다 / 새 배포가 이상하다

1. Vercel » overture » **Deployments** 확인 — 최신 production이 ERROR면 빌드가 깨진 것.
2. **즉시 복구**: 직전의 정상(READY) production 배포 » `⋯` 메뉴 » **Instant Rollback**.
   사이트가 몇 초 안에 이전 버전으로 돌아간다. 원인 수리는 그 다음에 천천히.
3. 빌드는 초록인데 화면이 이상하면 → 세션에게 커밋 해시를 주고 "이 배포에서 뭐가
   바뀌었나" 확인시키기. 급하면 역시 Instant Rollback이 먼저다.

## 2. 분석이 계속 실패한다 (LLM 오류)

1. 위 SQL에서 `server_llm_error` 급증 확인. `properties->>'status'`가 **529/503**이면
   Anthropic 쪽 과부하 — 우리가 고칠 게 없고, 보통 수십 분 내 회복된다.
2. **401/400**이면 우리 쪽 문제(키/요청 형식) — 세션에게 조사시키기.
3. 배포 직후부터 시작됐다면 → 1번의 Instant Rollback.

## 3. 비용이 무섭게 나간다 / 악용이 보인다 (밸브 3개, 위에서부터)

증거 먼저: 위 SQL의 `global_daily` 차단 횟수와, Anthropic 콘솔의 오늘 사용액.

| 밸브 | 어디서 | 효과 |
|---|---|---|
| ① `ANON_DAILY_LIMIT` 내리기 (예: 10) | Vercel » Settings » Environment Variables | 익명 IP당 한도 축소 |
| ② `GLOBAL_DAILY_LIMIT` 내리기 (예: 1000) | 〃 | **하루 전체 합산** 상한 축소 — 코드 기본값 4000. IP를 바꿔가며 쓰는 공격도 이 선에서 멈춘다 |
| ③ `TURNSTILE_SECRET_KEY` 설정 | 〃 (Cloudflare Turnstile에서 발급) | 익명 경로에 캡차 강제. **주의: 웹앱 클라이언트가 토큰을 붙이는 작업과 같이 켜야 한다** — 먼저 세션에게 "Turnstile 클라이언트 배선" 확인시킬 것 (`src/lib/turnstile.ts` 머리말 참고) |

**환경변수는 바꾼 뒤 Redeploy를 눌러야 적용된다** (Deployments » 최신 » Redeploy).
전부 코드 기본값이 안전한 쪽이므로, 위기가 지나면 변수를 지워서 기본값으로 복귀.

숫자의 정본은 `src/lib/quota-config.ts` 하나다 (익명 50 / 로그인 80 / 전체 4000).

## 4. 아침 이메일에 빨간 "루프 맥박" 카드가 떴다 (크론 침묵)

1. 카드가 지목한 크론 이름 확인 (premise_watch / companion_brief / checkin_due /
   telegram_reminders / anon_cleanup).
2. Vercel » Settings » **Cron Jobs**에서 해당 잡의 최근 실행 기록 확인 — 실패면
   로그가 거기 있다.
3. `CRON_SECRET` 환경변수가 지워지지 않았는지 확인 (지워지면 크론 전부 401).
4. premise-watch만 침묵이면 `PREMISE_WATCH_ENABLED`가 꺼진 것일 수 있다 —
   의도된 킬스위치이므로 끄여 있다면 끈 이유를 먼저 기억해낼 것.

## 5. 외부 사람이 PR을 보냈다 (공개 레포)

구조적으로 안전한 것 (이미 확인됨):
- 포크 PR에는 GitHub이 **비밀키를 아예 주지 않는다**. 로그인 E2E는 "건너뛴다"고
  말하고 넘어가게 되어 있다 — 포크 PR에서 그 경고는 **정상**이다.
- 비밀키를 쓰는 워크플로(evals, npm 발행)는 수동 실행/태그 전용이라 PR로 못 돌린다.
- 외부인은 main에 직접 push할 수 없다. 머지 버튼은 사장님 손에만 있다.

머지 전 확인 3가지 (세션에게 시켜도 됨):
1. `.github/workflows/` 파일을 건드렸나? → 건드렸다면 한 줄씩 정독.
2. `package.json` 의존성을 추가했나? → 추가된 패키지의 정체 확인.
3. CI가 초록인가? (포크 PR의 signed-in E2E skip 경고는 예외)

## 6. 보안 제보가 왔다

`SECURITY.md`의 절차대로. 공개 이슈로 다루지 말고, 수리 전까지 재현 방법을
레포에 적지 않는다.

## 7. 데이터가 이상하다 (동기화/삭제/부활)

이 부류는 과거 사례가 전부 문서화되어 있다 — 세션에게 증상과 함께 이 힌트를 주면 빠르다:
- 저장이 서버에 안 닿음 → 스키마 드리프트 (CLAUDE.md "Schema Sync" 절, PGRST204)
- 삭제한 것이 되살아남 → soft-delete 컬럼 부재 or cascade 누락
- 특정 계정만 동기화 실패 → 계정 두 개 충돌 사례 (2026-07-30 기록)

---

## 킬 스위치 / 환경변수 한눈표 (전부 Vercel » Environment Variables)

| 변수 | 없을 때(기본) | 설정하면 |
|---|---|---|
| `ANON_DAILY_LIMIT` | 50 (코드 기본) | 익명 IP당 한도를 그 값으로 |
| `GLOBAL_DAILY_LIMIT` | 4000 (코드 기본) | 하루 전체 합산 상한을 그 값으로 |
| `TURNSTILE_SECRET_KEY` | 캡차 꺼짐 | 익명 경로 캡차 강제 (클라이언트 배선 선행 필수) |
| `PREMISE_WATCH_ENABLED` | 전제 감시 크론 꺼짐 | `true`면 켜짐 |
| `CRON_SECRET` | 크론 전부 401 (죽음) | 반드시 존재해야 함 — **지우지 말 것** |
| `ARGUS_DEV_SKIP_RATE_LIMIT` | — | 로컬 개발 전용, 프로덕션에선 무효 |
| `NEXT_PUBLIC_JUDGMENT_HARNESS_V2` | 새 판단 하네스 켜짐 | `off`면 2026-07-31 이전 프롬프트로 되돌림 (커밋 revert 불필요, 재배포만) |

### 무거운 길 대화가 이상해졌다 (2026-07-31 하네스 교체)

증상: 무거운 길에서 질문이 엉뚱하거나, 전제가 하나도 안 잡히거나, 최종 정리가 텅 빈다.

1. `NEXT_PUBLIC_JUDGMENT_HARNESS_V2=off` → 재배포. 옛 프롬프트로 즉시 복귀한다
   (Instant Rollback보다 좁은 밸브 — 오늘 배포한 다른 수정은 그대로 살아 있음).
2. 그러고도 이상하면 §1 Instant Rollback.
3. 전제가 **일부러** 비는 경우가 있다: 사용자가 직접 말하지 않은 것은 전제로 적지
   않고 질문으로 되묻는 게 설계다. 질문조차 안 나오면 그때가 고장이다.
