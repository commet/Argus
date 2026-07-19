import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const UI_FILES = [
  'src/components/review/ReviewFlow.tsx',
  'src/components/review/ReceiptView.tsx',
  'src/components/review/ReceiptList.tsx',
  'src/components/landing/voyage/Act2DecisionVoyage.tsx',
  'src/components/workspace/InteractiveDemo.tsx',
  'src/components/workspace/progressive/SealMoment.tsx',
  'src/components/projects/VoyageSea.tsx',
  'src/components/workspace/VoyageEta.tsx',
  'src/app/[locale]/project/page.tsx',
  'src/app/[locale]/import/page.tsx',
].map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');

const PLAIN_UI_FILES = [
  'src/app/error.tsx',
  'src/app/global-error.tsx',
  'src/app/[locale]/tools/error.tsx',
  'src/app/[locale]/auth/callback/mcp-connect/page.tsx',
  'src/app/[locale]/auth/callback/mcp-device/page.tsx',
  'src/app/[locale]/auth/callback/page.tsx',
  'src/app/[locale]/guide/page.tsx',
  'src/app/[locale]/settings/page.tsx',
  'src/app/[locale]/workspace/page.tsx',
  'src/app/[locale]/login/page.tsx',
  'src/app/[locale]/privacy/page.tsx',
  'src/app/[locale]/terms/page.tsx',
  'src/app/[locale]/teams/page.tsx',
  'src/components/agents/AgentHub.tsx',
  'src/components/layout/AuthGuard.tsx',
  'src/components/layout/ErrorBoundary.tsx',
  'src/components/layout/Footer.tsx',
  'src/components/layout/Header.tsx',
  'src/components/patterns/PatternsSurface.tsx',
  'src/components/projects/DecisionItemsCard.tsx',
  'src/components/projects/ProjectAttentionList.tsx',
  'src/components/projects/VoyageSea.tsx',
  'src/components/review/PremiseTracker.tsx',
  'src/components/workspace/InteractiveDemo.tsx',
  'src/components/workspace/progressive/AgentSidebar.tsx',
  'src/components/workspace/progressive/VoyageChart.tsx',
].map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');

const MOBILE_UI_FILES = [
  'src/app/[locale]/settings/page.tsx',
  'src/app/error.tsx',
  'src/app/not-found.tsx',
  'src/components/brand/Logo.tsx',
  'src/components/layout/AuthGuard.tsx',
  'src/components/layout/ErrorBoundary.tsx',
  'src/components/ui/Button.tsx',
].map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');

const SHELL_MAIN_FILES = [
  'src/app/[locale]/auth/callback/mcp-connect/page.tsx',
  'src/app/[locale]/auth/callback/mcp-device/page.tsx',
  'src/app/[locale]/teams/page.tsx',
].map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');

describe('plain product-language contract', () => {
  it('does not expose internal lifecycle metaphors through localized UI copy', () => {
    expect(UI_FILES).not.toMatch(/L\(\s*['"`]([^'"`]*(?:판단 영수증|봉인|정산|정본|해도에서|도착 예정))/);
    expect(UI_FILES).not.toContain('\n            Judgment Receipt\n');
  });

  it('keeps the main record and follow-up terms explicit', () => {
    expect(UI_FILES).toContain("L('문서 검수 기록', 'Document Review Record')");
    expect(UI_FILES).toContain("L('판단과 확인일 기록', 'Save decision and review date')");
    expect(UI_FILES).toContain("L('실제 결과 기록', 'Record actual outcome')");
    expect(UI_FILES).toContain("L('파일 지원 범위', 'File support')");
  });

  it('keeps internal metaphors and team qualifiers out of controls and errors', () => {
    for (const leakedCopy of [
      "L('사람 팀'",
      'People teams',
      '결정 해도',
      '해도에서 찾기',
      "L('이 지점에서 항해'",
      "L('암초에 부딪혔어요'",
      "'We hit a reef'",
      'AI가 뽑았어요',
      "L('결정 항목'",
      "L('핵심', 'load-bearing')",
      '>Draft<',
      '>live<',
    ]) {
      expect(PLAIN_UI_FILES).not.toContain(leakedCopy);
    }
    expect(PLAIN_UI_FILES).toContain("L('팀', 'Teams')");
    expect(PLAIN_UI_FILES).toContain("L('결정 지도 — 각 결정의 현재 상태', 'Decision map — current status of each decision')");
    expect(PLAIN_UI_FILES).toContain("L('이 지점에서 다시 시작', 'Restart from here')");
    expect(PLAIN_UI_FILES).toContain("L('문제가 생겼어요', 'Something went wrong')");
  });

  it('keeps narrow-screen navigation and primary tap targets reachable', () => {
    expect(MOBILE_UI_FILES).toContain('grid grid-cols-3 gap-1 py-2');
    expect(MOBILE_UI_FILES).toContain('min-h-[44px] sm:min-h-[36px]');
    expect(MOBILE_UI_FILES).toContain('group inline-flex min-h-11 items-center');
    expect(MOBILE_UI_FILES).toContain('inline-flex min-h-11 items-center');
  });

  it('does not nest another main landmark inside the shared app shell', () => {
    expect(SHELL_MAIN_FILES).not.toContain('<main');
  });
});
