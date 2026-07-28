'use client';

/**
 * MCP 설치 3걸음 + 옵트인 1줄 — /import의 OS별 현관 안내 (BLUEPRINT §9.5 M4).
 * (설치·기본 경로·Windows 실행형이 3걸음, ARGUS_TOKEN은 선택 4번째 항목.)
 *
 * FC-5의 마지막 조각: 웹 어디에도 ARGUS_DIR·Windows·Desktop 안내가 없어
 * 터미널 사용자의 현관이 문서 없는 문이었다. 규칙: 사실과 명령만, OS별로
 * 정확히 — Desktop은 ${...}를 확장하지 않고(무설정이면 ~/.argus), Windows는
 * bare npx가 자주 실패한다(cmd /c). 카피는 순화 정책(landing-films-copy)과
 * 동일하게 KO 우선.
 */

const CODE = 'text-[12.5px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded';

export function McpInstallGuide({ locale }: { locale: string }) {
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  return (
    <div data-testid="mcp-install-guide" className="mb-6 px-3.5 py-3 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)]">
      <p className="text-[13px] font-medium text-[var(--text-primary)] mb-2">
        {L('MCP로 시작하기 (Claude Code · Claude Desktop)', 'Start with MCP (Claude Code · Claude Desktop)')}
      </p>
      <ol className="space-y-1.5 text-[12.5px] text-[var(--text-secondary)]">
        <li>
          {L('1. 설치: ', '1. Install: ')}
          {/* `@latest` is explicit on purpose. npx reuses a cached install, so a
              bare or range spec can keep serving an old build for weeks — the
              failure that froze a dogfood wire on 1.2.0 while seven releases sat
              on npm (2026-07-26). The bundled plugin pins an EXACT version (it
              ships a tested pair); this hand-copied command is the opposite case
              — it must never inherit a stale cache, so it always asks for latest. */}
          <code className={CODE}>claude mcp add argus -- npx -y argus-decision-mcp@latest</code>
        </li>
        <li>
          {L('2. 기록 위치는 설정 없이도 ', '2. With zero config your decision record lives in ')}
          <code className={CODE}>~/.argus</code>
          {L('에 생깁니다. Claude Desktop은 ', '. Claude Desktop does not expand ')}
          <code className={CODE}>{'${...}'}</code>
          {L(' 변수를 확장하지 않으니, 경로를 지정하려면 절대 경로로 적으세요.', ' variables — use an absolute path if you set one.')}
        </li>
        <li>
          {L('3. Windows에서 서버가 안 뜨면 ', '3. On Windows, if the server fails to launch use ')}
          <code className={CODE}>{'"command": "cmd", "args": ["/c", "npx", "-y", "argus-decision-mcp@latest"]'}</code>
          {L(' 형태로 실행하세요.', '.')}
        </li>
        <li>
          {L('4. 이메일 귀환을 원하면 설정에서 토큰을 발급해 ', '4. For the return email, issue a token in Settings and set ')}
          <code className={CODE}>ARGUS_TOKEN</code>
          {L('으로 넣으세요 — 안 넣으면 완전 로컬로만 동작합니다.', ' — without it everything stays fully local.')}
        </li>
      </ol>
    </div>
  );
}
