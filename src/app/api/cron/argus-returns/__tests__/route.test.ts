import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 귀환 크론 — 3막의 기계 검증.
 *
 * 이 라우트는 이 제품의 유일한 outbound 채널인데 2026-08-06까지 테스트가
 * 없었다. 여기가 조용히 틀리면: 같은 결정에 이메일이 무한히 가거나(과발화),
 * 하루 예산이 안 지켜지거나, **선택이 제목으로 새서**(§7.3 위반) 기억이
 * 오염된다 — 전부 사용자가 알아챌 수 없는 형태의 실패다.
 *
 * mock 경계는 seal 라우트 테스트와 같은 규칙: Supabase·Resend 만 막고
 * 라우트 본문은 진짜로 돈다.
 */

interface SentMail { to: string; subject: string; text: string; html: string }

const sentMails: SentMail[] = [];
const statusUpdates: Array<{ id: string; values: Record<string, unknown> }> = [];
const caseSelects: string[] = []; // argus_cases 에서 무엇을 조회했는지 (§7.3 가드)

let dueRows: Array<Record<string, unknown>> = [];
let userEmails: Record<string, string | undefined> = {};

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'argus_returns') {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              expect(col).toBe('status');
              expect(val).toBe('armed'); // 멱등성: 보낸 것은 다시 조회조차 안 한다
              return {
                lte: () => ({
                  order: () => ({ limit: () => Promise.resolve({ data: dueRows, error: null }) }),
                }),
              };
            },
          }),
          update: (values: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              statusUpdates.push({ id, values });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      // argus_cases
      return {
        select: (cols: string) => {
          caseSelects.push(cols);
          return {
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { title: '직원을 뽑을 것인가' }, error: null }),
              }),
            }),
          };
        },
      };
    },
    auth: {
      admin: {
        getUserById: (id: string) =>
          Promise.resolve({ data: { user: userEmails[id] ? { email: userEmails[id] } : null } }),
      },
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => makeAdmin() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: (m: SentMail) => {
        sentMails.push(m);
        return Promise.resolve({ error: null });
      },
    };
  },
}));
vi.mock('@/lib/server-events', () => ({ persistServerEvent: vi.fn(() => Promise.resolve()) }));

import { NextRequest } from 'next/server';
import { persistServerEvent } from '@/lib/server-events';
import { GET } from '../route';

const SECRET = 'test-cron-secret';

function req(auth?: string) {
  return new NextRequest('https://argus.voyage/api/cron/argus-returns', {
    headers: auth ? { authorization: auth } : {},
  });
}

function dueRow(id: string, userId: string, over: Record<string, unknown> = {}) {
  return {
    id,
    case_id: `case-${id}`,
    user_id: userId,
    kind: 'commitment',
    due_at: '2026-08-01T00:00:00Z',
    from_step: '채용 공고 초안',
    ...over,
  };
}

beforeEach(() => {
  sentMails.length = 0;
  statusUpdates.length = 0;
  caseSelects.length = 0;
  dueRows = [];
  userEmails = { 'user-1': 'founder@example.com' };
  vi.mocked(persistServerEvent).mockClear();
  process.env.CRON_SECRET = SECRET;
  process.env.RESEND_API_KEY = 'rk';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sk';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://db.example.com';
});

describe('GET /api/cron/argus-returns', () => {
  it('비밀 없이 401 — 아무나 발송을 트리거할 수 없다', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer wrong-secret-value'))).status).toBe(401);
    expect(sentMails).toHaveLength(0);
  });

  it('설정이 없으면 성공한 척하지 않는다 (503)', async () => {
    delete process.env.RESEND_API_KEY;
    expect((await GET(req(`Bearer ${SECRET}`))).status).toBe(503);
  });

  it('만기 1건 → 이메일 1통 + status sent — 기본 경로', async () => {
    dueRows = [dueRow('r1', 'user-1')];
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ sent: 1, deferred: 0, failed: 0 });

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe('founder@example.com');
    // 보냈으면 반드시 sent 로 옮긴다 — 안 옮기면 다음 크론이 또 보낸다.
    expect(statusUpdates).toEqual([{ id: 'r1', values: expect.objectContaining({ status: 'sent' }) }]);
  });

  it('§7.3 — 케이스에서 질문(title)만 읽는다. 선택·이유는 조회조차 하지 않는다', async () => {
    dueRows = [dueRow('r1', 'user-1')];
    await GET(req(`Bearer ${SECRET}`));
    expect(caseSelects).toEqual(['title']);
    // 제목은 질문이므로 제목이 실리는 것은 정상. 그 외 결정 내용 컬럼이
    // select 에 등장하는 순간 위 단언이 깨진다 — 읽지 않으면 샐 수 없다.
  });

  it('사용자당 하루 예산 3건 — 4건째부터는 보내지 않고 남긴다', async () => {
    dueRows = [
      dueRow('r1', 'user-1'),
      dueRow('r2', 'user-1'),
      dueRow('r3', 'user-1'),
      dueRow('r4', 'user-1'),
    ];
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ sent: 3, deferred: 1 });
    expect(sentMails).toHaveLength(3);
    // 미룬 것은 상태를 건드리지 않는다 — 내일 다시 만기다.
    expect(statusUpdates.map((u) => u.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('예산은 사용자별이다 — 다른 사용자는 서로를 막지 않는다', async () => {
    userEmails = { 'user-1': 'a@example.com', 'user-2': 'b@example.com' };
    dueRows = [
      dueRow('r1', 'user-1'), dueRow('r2', 'user-1'), dueRow('r3', 'user-1'), dueRow('r4', 'user-1'),
      dueRow('r5', 'user-2'),
    ];
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ sent: 4, deferred: 1 });
    expect(sentMails.map((m) => m.to)).toContain('b@example.com');
  });

  it('이메일 없는 사용자는 failed 로 세고, 상태를 sent 로 옮기지 않는다', async () => {
    userEmails = {};
    dueRows = [dueRow('r1', 'user-1')];
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ sent: 0, failed: 1 });
    expect(statusUpdates).toHaveLength(0); // 못 보냈으면 armed 로 남아 다음에 재시도
  });

  it('만기가 없으면 안 보내되, 실행 사실은 이벤트로 남긴다', async () => {
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(await res.json()).toMatchObject({ sent: 0 });
    expect(sentMails).toHaveLength(0);
    // due 0건의 실행도 argus_return_cron_run 을 남겨야 한다 — 안 남기면
    // "스케줄러 고장"과 "할 일 없음"이 텔레메트리에서 구분되지 않는다.
    // (실제로 8/7–8/9 사흘간 이벤트 0건이 크론 고장으로 오진될 뻔했다.)
    expect(vi.mocked(persistServerEvent)).toHaveBeenCalledWith(
      'argus_return_cron_run',
      expect.objectContaining({ due_total: 0 }),
      expect.objectContaining({ path: '/api/cron/argus-returns' }),
    );
  });
});
