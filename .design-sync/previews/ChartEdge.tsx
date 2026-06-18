import { ChartEdge } from 'argus';

// ChartEdge — a thin chart-section edge rule (a hairline capped by a bold bar),
// used inline to mark the end of a voyage segment. It's small, so each cell
// gives it a sized parchment context. Ported from ReframeStep's "complete"
// header where it separates a status label from its caption.

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      width: 360,
      background: 'var(--surface)',
      borderRadius: 12,
      padding: 20,
      border: '1px solid var(--border-subtle)',
    }}
  >
    {children}
  </div>
);

export const InHeader = () => (
  <Panel>
    <div className="flex items-center gap-2" style={{ color: 'var(--success)', fontSize: 13, fontWeight: 700 }}>
      <span>항로 재설정 완료</span>
      <ChartEdge height={16} className="ml-2" />
      <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 4 }}>
        핵심 질문이 정의되었습니다
      </span>
    </div>
  </Panel>
);

export const Heights = () => (
  <Panel>
    <div className="flex items-end gap-6" style={{ height: 48 }}>
      <ChartEdge height={12} />
      <ChartEdge height={20} />
      <ChartEdge height={32} />
      <ChartEdge height={44} />
    </div>
  </Panel>
);

export const SectionRule = () => (
  <Panel>
    <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>
      Leg 1 — 출항 전 점검
    </p>
    <div className="flex items-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <ChartEdge height={14} />
      <span style={{ fontSize: 11, letterSpacing: '0.12em' }} className="bp-mono">END OF LEG</span>
      <ChartEdge height={14} />
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  </Panel>
);
