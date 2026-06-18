import { BehavioralToggle } from 'argus';

// BehavioralToggle — the "Easy mode" quiz alternative to TypeToggle. Instead of
// raw MBTI letters it asks four workplace-observable questions, each mapped to
// the same boss-store axis. `answered` is lifted to the parent (BossSetup) so
// flipping Easy <-> MBTI doesn't lose progress, so we sweep that prop across the
// cells: none answered, partway, and complete (the "Answered 4/4 ✓" counter).
// Active highlight (gold pill + check) only shows on rows the user actually
// answered. Locale = English to show the English question set.

if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'en' }));
  } catch {}
}

const noop = () => {};

const wrap = (children: JSX.Element) => (
  <div style={{ width: 380, padding: 20, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
    {children}
  </div>
);

// Fresh — nothing answered yet, neutral options, "Answered 0/4" counter.
export const Unanswered = () =>
  wrap(<BehavioralToggle answered={{ ei: false, sn: false, tf: false, jp: false }} onAnswered={noop} />);

// Partway through — two axes picked, two still neutral.
export const PartlyAnswered = () =>
  wrap(<BehavioralToggle answered={{ ei: true, sn: true, tf: false, jp: false }} onAnswered={noop} />);

// All four answered — every row highlighted, counter shows the ✓ completion.
export const AllAnswered = () =>
  wrap(<BehavioralToggle answered={{ ei: true, sn: true, tf: true, jp: true }} onAnswered={noop} />);
