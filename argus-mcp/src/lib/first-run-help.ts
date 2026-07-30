import { osLocaleHint } from './locale.js';

/**
 * 사람이 터미널에서 직접 실행한 첫 순간 (2026-07-30).
 *
 * MCP 서버는 어시스턴트(호스트)가 파이프로 띄우는 프로그램이라, 사람이 직접
 * `npx argus-decision-mcp`를 치면 조용히 매달리는 것이 "정상 동작"이었다 —
 * 하지만 아무것도 모르는 사용자의 첫인상으로는 고장과 구분되지 않는다.
 * stdin 이 TTY(사람 키보드)면 서버 대신 이 카드를 보여주고 끝낸다.
 * 호스트는 파이프로 띄우므로 이 게이트에 절대 걸리지 않는다.
 *
 * 길이 규율: 화면 하나, 한 언어 10줄 안팎. 설치 명령 2개 + 첫 사용법 1줄이
 * 전부다 — 여기서 제품 철학을 강의하지 않는다 (그건 README 몫).
 */

export function isHumanTerminal(stdin: { isTTY?: boolean } = process.stdin): boolean {
  return stdin.isTTY === true;
}

export function buildFirstRunHelp(locale?: 'ko' | 'en'): string {
  const loc = locale ?? osLocaleHint();
  if (loc === 'ko') {
    return [
      'Argus — 결정을 기록하고, 시간이 지나면 실제로 어땠는지 다시 봐주는 MCP 서버',
      '',
      '이 프로그램은 AI 어시스턴트가 백그라운드로 띄우는 서버라, 직접 실행하면',
      '아무 일도 일어나지 않는 것처럼 보입니다. 어시스턴트에 연결해 쓰세요:',
      '',
      '  Claude Code:  claude mcp add argus "--" npx -y argus-decision-mcp',
      '  Codex:        codex mcp add argus-decision -- npx -y argus-decision-mcp',
      '',
      '연결 후 새 대화에서, 배울 명령 없이 평소처럼 결정을 말하면 됩니다.',
      '예: "이번 주까지 A안으로 배포하기로 했어" → 기록해둘지 물어봅니다.',
      '',
      '계정 연결(선택): npx argus-decision-mcp connect',
      '자세히: https://github.com/commet/Argus',
    ].join('\n');
  }
  return [
    'Argus — an MCP server that records decisions and returns when reality has answered',
    '',
    'This program is meant to be launched by an AI assistant in the background,',
    'so running it directly looks like nothing happens. Wire it into your assistant:',
    '',
    '  Claude Code:  claude mcp add argus "--" npx -y argus-decision-mcp',
    '  Codex:        codex mcp add argus-decision -- npx -y argus-decision-mcp',
    '',
    'Then, in a new conversation, just talk about a decision as usual — nothing to learn.',
    'e.g. "We ship option A by Friday" → it will offer to save the check.',
    '',
    'Account link (optional): npx argus-decision-mcp connect',
    'More: https://github.com/commet/Argus',
  ].join('\n');
}
