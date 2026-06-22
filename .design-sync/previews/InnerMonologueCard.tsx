import { InnerMonologueCard } from 'argus';

// InnerMonologueCard — the "이면 공개" card that appears right after a boss
// verdict. It takes the verdict object; its revealed text streams from the boss
// store on tap, so the at-rest preview is the LOCKED state: a tappable
// "{name} 팀장의 이면 공개" affordance with the lock icon + sparkle. The boss
// store defaults to ESTJ ('신뢰의 관리자'), which is what the locked title shows.
// Locale = Korean. We pass realistic verdicts (the prop the card actually reads).

if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  } catch {}
}

const APPROVED_VERDICT = {
  verdict: '조건부 승인',
  reason: '방향은 맞아. 근데 첫 25곳을 어디서 데려올지가 비어 있어 — 그것만 채우면 올려도 돼.',
  tip: '확보 경로 한 줄만 더하고 다시 가져와.',
};

const REJECTED_VERDICT = {
  verdict: '보류',
  reason: '레거시 결제 모듈을 통째로 다시 짜자는 건 리스크 대비 명분이 약해. 지금은 안 돼.',
  tip: '장애가 난 구간만 떼어내서 부분 교체안으로 다시 와봐.',
};

// (The bare at-rest "Locked" state renders an empty affordance without a loaded
// boss agent in the store, so we show only the in-context card — the state a
// designer actually wants to see.)

// Placed in its real context — a verdict line above, the reveal card below.
export const InVerdictContext = () => (
  <div style={{ width: 380, padding: 20, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>
        김 팀장의 판정
      </p>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', fontFamily: 'var(--font-display)' }}>
        {REJECTED_VERDICT.verdict}
      </p>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
        {REJECTED_VERDICT.reason}
      </p>
    </div>
    <InnerMonologueCard verdict={REJECTED_VERDICT} />
  </div>
);
