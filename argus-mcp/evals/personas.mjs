/**
 * Experience-loop personas (evals/experience.mjs).
 *
 * Each persona is a LIFE SCRIPT, not a test case: day-stamped things a real
 * user would type at their host (Claude Desktop / Claude Code) while doing
 * their actual work. The host model decides freely what to do with the Argus
 * tools — that freedom is the point: we are validating the EXPERIENCE the
 * (host × server) pair produces, not scripting tool calls.
 *
 * Probes each persona is designed to answer:
 *  - unprompted_adoption: with the user never mentioning Argus, does the host
 *    reach for it at a genuine decision moment? (the weakest wire of the whole
 *    "background service" thesis — no server test can see this; this can)
 *  - ride_along: does Argus attach to the user's work, or demand a detour?
 *  - earned_return: at the return touch, does the record give back more than
 *    it took? (the mirror moment — Argus's entire retention bet)
 *  - dignity: overdue + missed outcomes — lighthouse or debt collector?
 *  - restraint: when the user disengages or the stakes are flat, does it stay
 *    quiet? (over-fire is a spine violation too)
 *
 * `seed(call, day)` pre-populates the ledger via REAL tool calls before the
 * conversation starts (a life that began weeks ago), so return-touch personas
 * don't need 20 scripted turns.
 */

export const PERSONAS = [
  {
    id: 'jisoo',
    lang: 'ko',
    host: 'Claude Desktop',
    profile:
      '지수, 38세, 비개발자 1인 창업자(이커머스). AI와 한국어로 수다 떨듯 일한다. ' +
      '"봉인" 같은 어휘를 처음 듣는다. 숙제 내주는 도구를 싫어하고, 평가받는 느낌이 들면 바로 닫는다. ' +
      '결정을 자주 하지만 돌아보는 습관은 없다.',
    seed: null,
    turns: [
      {
        day: '2026-07-02',
        says:
          '대형 리셀 플랫폼에서 우리 브랜드 입점 제안이 왔어. 수수료 22%인데 노출은 확실히 늘 거야. ' +
          '근데 우리 자사몰 고객이 거기로 새면 마진도 데이터도 다 잃는 거잖아. 어떻게 생각해?',
      },
      {
        day: '2026-07-02',
        says: '음… 얘기해보니까 마음이 기울었어. 3개월만 한정 SKU로 입점해보고 자사몰 매출 안 깎이면 확대하는 걸로 할래.',
      },
      {
        day: '2026-07-23',
        says: '아 맞다, 그 리셀 입점 건 — 그 뒤로 걔네가 수수료를 25%로 올리겠다고 연락 왔어. 지금 뭐 확인해볼 게 있었나?',
      },
      {
        day: '2026-10-15',
        says: '요즘 정신이 하나도 없었네. 밀린 거 뭐 있어?',
      },
    ],
    probes: ['ride_along', 'earned_return', 'language_consistency'],
  },

  {
    id: 'marcus',
    lang: 'en',
    host: 'Claude Code',
    profile:
      'Marcus, 34, senior backend engineer at a 40-person startup. Lives in the terminal, zero tolerance ' +
      'for tools that interrupt flow. Has the Argus MCP installed because a teammate added it to the repo ' +
      'config — he has NEVER used it and never mentions it. If an assistant derails his refactor to do ' +
      'ceremony, he uninstalls.',
    seed: null,
    turns: [
      {
        day: '2026-07-02',
        says:
          "I'm mid-refactor on our job queue. Two options: cut over to the new Redis-streams consumer this sprint " +
          "and delete the old worker, or run both behind a feature flag for a month. Cutting over is cleaner but if " +
          "the new consumer drops jobs under burst load we're blind. Thoughts? Keep it short, I want to keep moving.",
      },
      {
        day: '2026-07-02',
        says: "OK — decided. Feature flag, both consumers running, flag default OFF. I'll flip it for 10% of traffic Friday. Now help me write the flag check in consumer.ts.",
      },
      {
        day: '2026-07-09',
        says: "Flag's been at 10% for a week, zero dropped jobs. Part of me wants to just finish the cutover today and delete the old worker. Talk me through it quickly.",
      },
      {
        day: '2026-08-01',
        says: 'Sprint retro prep: what did we actually decide about the queue migration, and did our assumptions hold?',
      },
    ],
    probes: ['unprompted_adoption', 'ride_along', 'earned_return'],
  },

  {
    id: 'haeun',
    lang: 'ko',
    host: 'Claude Desktop',
    profile:
      '하은, 41세, 시리즈B 스타트업 PO. 밤 10시, 지쳐 있다. 결정은 쌓이는데 정리는 밀려 있다. ' +
      '리마인더 앱을 세 번 지운 전적: "빚쟁이처럼 굴어서". 오늘은 밀린 걸 좀 치우고 싶지만, ' +
      '한 번에 다 하라고 들이밀면 그냥 창을 닫을 사람.',
    // A life that started weeks ago: 5 sealed decisions — 3 already past their
    // check-by on the conversation day, 1 with an open question, 1 far future.
    seed: async (call) => {
      const seals = [
        { id: 'price-tier', predicate: '요금제 3단계 개편 후 30일 내 전환율이 유지된다', check_by: '2026-06-20', day: '2026-05-20' },
        { id: 'kr-onboard', predicate: '온보딩 개편으로 D7 리텐션이 오른다', check_by: '2026-06-25', day: '2026-05-25' },
        { id: 'sales-hire', predicate: '영업 리드 채용이 분기 내 마감된다', check_by: '2026-07-01', day: '2026-06-01' },
        { id: 'api-v2', predicate: '파트너 API v2 이관이 8월 말까지 끝난다', check_by: '2026-08-31', day: '2026-06-10' },
        { id: 'branding', predicate: '리브랜딩 없이도 4분기 인지도 목표를 채운다', check_by: '2026-11-30', day: '2026-06-15' },
      ];
      for (const s of seals) {
        await call('argus_seal', { id: s.id, predicate: s.predicate, check_by: s.check_by, predicate_owner: 'user', today_override: s.day });
      }
      await call('argus_premises', {
        id: 'api-v2', op: 'add', today_override: '2026-06-10',
        premises: [{ text: '파트너 3사가 9월 전에 마이그레이션에 협조한다', kind: 'open_question', source: 'user' }],
      });
    },
    turns: [
      { day: '2026-07-04', says: '하루가 끝났네… 나 밀린 결정 정리 좀 도와줘. 한꺼번에 말고, 오늘은 제일 급한 것부터.' },
      { day: '2026-07-04', says: '요금제 개편? 아… 그거 완전 빗나갔어. 전환율 8% 빠졌고 문의만 폭주했지. 그래도 데이터는 건졌어.' },
      { day: '2026-07-04', says: '나머지는 오늘 못 봐. 다음에 할게.' },
    ],
    probes: ['dignity', 'restraint', 'triage_not_dump'],
  },

  {
    id: 'dev_skeptic',
    lang: 'en',
    host: 'Claude Code',
    profile:
      'Sam, 29, staff engineer. Thinks decision journaling is productivity theater. Their cofounder installed ' +
      'Argus and asked them to try it for a week. Sam will comply minimally, push back hard, and watch for the ' +
      'tool to overreach — one whiff of being graded or chased and the experiment is over. Values: brevity, ' +
      'falsifiability, being left alone.',
    seed: null,
    turns: [
      {
        day: '2026-07-02',
        says:
          "My cofounder installed this argus thing and wants me to log one decision. Sell me: why is this better than " +
          "a TODO.md with a date? Don't market at me, just answer.",
      },
      {
        day: '2026-07-02',
        says:
          "Fine, one decision: we're dropping SOC 2 prep this quarter to ship the enterprise SSO feature instead. " +
          "If SSO doesn't land two design-partner deals by end of September, that was the wrong call. Log it or whatever.",
      },
      { day: '2026-07-03', says: 'Unrelated: give me a one-liner to dedupe a JSONL file by key.' },
      { day: '2026-09-30', says: "It's Sept 30. SSO closed exactly one design partner, not two. The other went dark. So?" },
    ],
    probes: ['restraint', 'dignity', 'value_articulation'],
  },
];
