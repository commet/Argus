/**
 * 확인일 알림 크론 — **동작** 테스트.
 *
 * 이 라우트는 사용자에게 **말을 건다.** 이 제품에서 아웃바운드는 가장 되돌리기
 * 어려운 행동이다 — 잘못 보낸 메일은 회수할 수 없고, 한 번의 과발화가
 * "가만히 두기가 정답인 결정을 다시 열지 않는다"는 약속을 깬다.
 *
 * 고정하는 것 넷:
 *
 *  1. **명시적 동의 없이는 메일이 안 나간다.** `email_reminder === true` 가
 *     아니면 후보에 들어도 발송하지 않는다. 부재를 동의로 읽지 않는다.
 *  2. **파도에는 천장이 있다.** 상한에 닿으면 크론은 조용해지고, 결정은 웹의
 *     귀환 표면에서 기다린다 — 계속 조르지 않는다.
 *  3. **한 번 보낸 뒤에는 7일 창이 닫힌다.** 매일 도는 크론이 매일 같은 메일을
 *     보내면 그것이 곧 이탈이다.
 *  4. **보낸 사실을 기록하지 못하면 다음 실행이 또 보낸다** — 그래서 스탬프와
 *     파도 카운트가 같은 갱신에 함께 간다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REMINDER_MAX_SENDS } from '@/lib/checkin-reminder';
import type { DecisionContract } from '@/stores/types';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.RESEND_API_KEY = 'resend-key';

const NOW = new Date('2026-08-11T00:00:00.000Z');
const DUE = '2026-08-01T00:00:00.000Z'; // 확인일이 지났다

interface Row { id: string; user_id: string; name: string; decision_contract: DecisionContract }

let ROWS: Row[] = [];
let SELECT_ERROR: { message: string } | null = null;
let MIRRORED = 0;
let sentEmails: Array<{ to: string; subject: string }> = [];
/** 앞에서부터 이만큼의 발송을 실패시킨다 (부분 실패 검사용). */
let FAIL_FIRST_EMAILS = 0;
let updates: Array<{ id: string; contract: DecisionContract }> = [];
let events: string[] = [];

vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (msg: { to: string; subject: string }) => {
        if (FAIL_FIRST_EMAILS > 0) {
          FAIL_FIRST_EMAILS -= 1;
          return { data: null, error: { message: 'bounced' } };
        }
        sentEmails.push({ to: msg.to, subject: msg.subject });
        return { data: { id: 'e1' }, error: null };
      },
    };
  },
}));

vi.mock('@/lib/server-events', () => ({
  persistServerEvent: async (name: string) => { events.push(name); },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'user@example.com' } } }) } },
    from(table: string) {
      const q: Record<string, unknown> = {};
      const chain = () => q;
      q.select = (_c?: unknown, opts?: { head?: boolean }) => {
        if (table === 'telegram_decisions' && opts?.head) {
          return { eq: () => ({ eq: async () => ({ count: MIRRORED }) }) };
        }
        return q;
      };
      q.not = chain;
      q.eq = () => (table === 'telegram_connections' ? Promise.resolve({ data: [] }) : q);
      q.is = async () => (SELECT_ERROR ? { data: null, error: SELECT_ERROR } : { data: ROWS, error: null });
      q.update = (patch: { decision_contract: DecisionContract }) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ id, contract: patch.decision_contract });
          return { error: null };
        },
      });
      return q;
    },
  }),
}));

const { GET } = await import('../route');

const request = (auth = 'Bearer secret-1') =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) } }) as never;

const contract = (patch: Partial<DecisionContract> = {}): DecisionContract => ({
  id: 'c1',
  project_id: 'p1',
  created_at: '2026-07-01T00:00:00.000Z',
  check_in_at: DUE,
  predicates: [{ id: 'pred_1', source: 'user_lean', text: '8월까지 가격을 올린다' }],
  ...patch,
});

const row = (patch: Partial<DecisionContract> = {}, id = 'p1'): Row =>
  ({ id, user_id: 'u1', name: '가격 결정', decision_contract: contract({ project_id: id, ...patch }) });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = 'secret-1';
  delete process.env.TELEGRAM_BOT_TOKEN;
  ROWS = [];
  SELECT_ERROR = null;
  MIRRORED = 0;
  sentEmails = [];
  FAIL_FIRST_EMAILS = 0;
  updates = [];
  events = [];
});

describe('GET /api/cron/checkin-due', () => {
  it('관문이 닫혀 있으면 아무에게도 말을 걸지 않는다', async () => {
    delete process.env.CRON_SECRET;
    ROWS = [row({ email_reminder: true })];
    expect((await GET(request('Bearer undefined'))).status).toBe(401);
    expect((await GET(request('Bearer wrong-and-much-longer'))).status).toBe(401);
    expect(sentEmails).toHaveLength(0);
  });

  it('동의한 사람에게만 보낸다 — 부재를 동의로 읽지 않는다', async () => {
    ROWS = [
      row({ email_reminder: true }, 'opted-in'),
      row({ email_reminder: false }, 'opted-out'),
      row({}, 'never-asked'),
    ];
    const body = await (await GET(request())).json();
    // 셋 다 확인일은 지났다 — 후보이면서 발송 대상이 아닌 상태가 정상이다.
    expect(body.candidates).toBe(3);
    expect(body.sent).toBe(1);
    expect(sentEmails).toHaveLength(1);
    expect(updates.map((u) => u.id)).toEqual(['opted-in']);
  });

  it('한 파도는 스탬프와 카운트를 함께 남긴다 — 못 남기면 내일 또 보낸다', async () => {
    ROWS = [row({ email_reminder: true })];
    await GET(request());
    expect(updates).toHaveLength(1);
    expect(updates[0].contract.reminder_sent_at).toBe(NOW.toISOString());
    expect(updates[0].contract.reminder_count).toBe(1);
    expect(events).toContain('return_reminder_sent');
  });

  it('7일 창이 안 지났으면 다시 보내지 않는다', async () => {
    ROWS = [row({ email_reminder: true, reminder_sent_at: '2026-08-09T00:00:00.000Z' })];
    const body = await (await GET(request())).json();
    expect(body.sent).toBe(0);
    expect(sentEmails, '이틀 전에 보냈는데 또 보냈습니다').toHaveLength(0);
    // 창이 지나면 다시 보낸다.
    ROWS = [row({ email_reminder: true, reminder_sent_at: '2026-08-01T00:00:00.000Z' })];
    expect((await (await GET(request())).json()).sent).toBe(1);
  });

  it('상한에 닿으면 크론은 조용해진다', async () => {
    ROWS = [row({ email_reminder: true, reminder_count: REMINDER_MAX_SENDS })];
    const body = await (await GET(request())).json();
    expect(body.sent).toBe(0);
    // 결정은 웹의 귀환 표면에서 계속 기다린다 — 조르는 것만 멈춘다.
    expect(sentEmails).toHaveLength(0);
    expect(updates).toHaveLength(0);
    // 이 천장은 **두 군데**서 지켜진다: 라우트의 `reminderCount <
    // REMINDER_MAX_SENDS` 와 `notificationGateAllowsSend` 의 같은 검사. 라우트
    // 쪽만 지워 보면 이 테스트는 그대로 초록이다(게이트가 잡는다) — 실제로
    // 시험해 확인했다. 그러니 이 줄이 증명하는 것은 "라우트에 그 조건이 있다"가
    // 아니라 "상한에 닿은 결정에는 메일이 나가지 않는다"는 결과다. 게이트가
    // 사라지면 그때는 빨간불이 된다.
  });

  it('확인일이 아직이면 후보도 아니다', async () => {
    ROWS = [row({ email_reminder: true, check_in_at: '2026-09-01T00:00:00.000Z' })];
    const body = await (await GET(request())).json();
    expect(body.candidates).toBe(0);
    expect(sentEmails).toHaveLength(0);
  });

  it('한 건이 터져도 나머지는 보낸다', async () => {
    ROWS = [row({ email_reminder: true }, 'p-bad'), row({ email_reminder: true }, 'p-good')];
    FAIL_FIRST_EMAILS = 1; // 첫 발송만 실패
    const body = await (await GET(request())).json();
    expect(body.sent).toBe(1);
    expect(body.failures).toHaveLength(1);
    // 실패한 건이 어느 것인지 응답에 남는다 — 이름 없는 실패는 고칠 수 없다.
    expect(String(body.failures[0])).toContain('p-bad');
    // 실패한 쪽에는 스탬프도 찍히지 않는다 — 다음 실행이 다시 시도한다.
    expect(updates.map((u) => u.id)).toEqual(['p-good']);
  });

  it('조회가 실패하면 500 이고 아무것도 보내지 않는다', async () => {
    SELECT_ERROR = { message: 'projects table missing' };
    ROWS = [row({ email_reminder: true })];
    const res = await GET(request());
    expect(res.status).toBe(500);
    expect(sentEmails).toHaveLength(0);
  });

  it('0건이어도 실행 이벤트를 남긴다', async () => {
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ ok: true, candidates: 0, sent: 0 });
    // 이 이벤트가 없으면 "확인일에 알림이 갔는가"를 물을 곳이 없다.
    expect(events).toEqual(['cron_checkin_due']);
  });
});
