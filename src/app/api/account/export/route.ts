import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';
import { collectServerJudgmentArchive, createJudgmentArchive } from '@/lib/epistemic/server-judgment-archive';

/**
 * Complete server-side export — every user-scoped row across all USER_DATA_TABLES
 * as one portable JSON. The old Settings "export" only dumped localStorage, so server-only
 * data (synced history, plugin imports, analytics) was invisible to the user who
 * owns it. Data ownership/portability is a trust dimension: you can take it with you.
 *
 * 단 하나의 예외가 있다 — 아래 redactUnsettledSeals 를 보라.
 */

/**
 * 소유권과 봉인의 충돌, 그리고 그 타협.
 *
 * TWIN 의 그림자 예측은 **정산 전에 사용자에게 보이면 안 된다** (§7.3 의 기계
 * 쌍둥이 — 자기 예측을 미리 보면 봉인 자체가 무의미해진다). 그런데 사용자는
 * 자기 데이터를 전부 반출할 권리가 있다. 이 라우트가 `select('*')` 를 그대로
 * 내보내면 **사용자가 export 버튼 하나로 자기 봉인을 깰 수 있다** — RLS 로
 * 막아 둔 문을 service role 이 열어 주는 꼴이다.
 *
 * 타협: 미정산(revealed_at is null) 예측은 **존재와 해시와 메타데이터만** 내보낸다.
 * 사용자는 "그때 봉인된 예측이 있었고 내용이 이 해시다"를 가져가므로 소유권과
 * 검증 가능성을 잃지 않고, 내용은 정산 때 열린다. 정산된 행은 전문 그대로다.
 */
function redactUnsettledSeals(table: string, rows: unknown): unknown {
  if (table !== 'argus_shadow_predictions' || !Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    if (r.revealed_at) return r; // 정산된 예측은 전문 반출
    const { expectation, reasoning, verdict_quote, ...meta } = r;
    void expectation;
    void reasoning;
    void verdict_quote;
    return {
      ...meta,
      _redacted: 'sealed_until_settlement',
      _note:
        '아직 정산되지 않은 분신 예측입니다. 내용을 미리 보면 봉인이 무의미해지므로 ' +
        'content_hash 와 메타데이터만 반출됩니다. 해당 결정을 정산하면 전문이 열립니다.',
    };
  });
}
export async function GET(req: NextRequest) {
  // Reject anonymous callers before exposing deployment configuration state.
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  const token = authHeader.slice(7);
  const authClient = createClient(url, anonKey);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createClient(url, serviceKey);
  if (new URL(req.url).searchParams.get('format') === 'judgment-archive') {
    try {
      const input = await collectServerJudgmentArchive(admin, user.id);
      const archive = await createJudgmentArchive(input, {
        key: process.env.ARGUS_EXPORT_SIGNING_KEY,
        key_id: process.env.ARGUS_EXPORT_SIGNING_KEY_ID,
      });
      return new NextResponse(Buffer.from(archive), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="argus-judgment-archive-${user.id.slice(0, 8)}.zip"`,
        },
      });
    } catch {
      return NextResponse.json({ error: 'Judgment archive export failed.' }, { status: 500 });
    }
  }
  const data: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email, created_at: user.created_at },
    tables: {},
  };
  const tables = data.tables as Record<string, unknown>;

  for (const table of USER_DATA_TABLES) {
    const { data: rows, error } = await admin.from(table).select('*').eq('user_id', user.id);
    tables[table] = error ? { error: error.message } : redactUnsettledSeals(table, rows);
  }

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="argus-export-${user.id.slice(0, 8)}.json"`,
    },
  });
}
