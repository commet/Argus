import { DailyMoodIndicator } from 'argus';

// DailyMoodIndicator — the "오늘의 팀장 기운" indicator shown next to a saved boss.
// It takes a YearMonthProfile and runs computeDailyMood(profile) against today's
// date; with no profile it renders null. We pass a literal, valid YearMonthProfile
// (a 1990 boss — 庚 metal stem, 戌 branch, horse zodiac) so it always renders.
// The exact mood (radiant/light/neutral/heavy/stormy) is computed from the
// capture's fixed clock, so the emoji/label reflect that day. Locale = Korean so
// the full mood copy renders.
//
// NOTE: only the `inline` variant is shown here. The default `pill` variant is a
// framer-motion root with initial opacity 0; the capture harness pins a fixed
// clock, so motion entry animations never advance off frame 0 and the pill
// captures blank (the same harness limitation that blanks ChatMessage /
// InnerMonologueCard). The `inline` variant has a plain <span> root, so it
// renders — and it's a real usage path (the BossChat header).

if (typeof window !== 'undefined') {
  try {
    window.localStorage.setItem('sot_settings', JSON.stringify({ language: 'ko' }));
  } catch {}
}

const PROFILE = {
  yearStem: '庚',
  yearBranch: '戌',
  yearElement: {
    element: '金' as const,
    color: '#78909c',
    glow: 'rgba(120,144,156,0.3)',
    stem: '庚',
    stemName: '경금',
    nature: '강철',
    trait: '단호하고 결단력 있는 의리파',
    emoji: '⚔️',
  },
  animal: { animal: '말', emoji: '🐴', trait: '에너지 넘치고 행동파. 열정적이지만 지구력 부족할 때' },
  summary: '강철 같은 결단력에 행동파 기질이 더해진 추진형 팀장',
  traits: ['단호함', '추진력', '의리'],
};

// Real usage — the inline mood tag beside a boss name in the chat header.
export const ChatHeader = () => (
  <div style={{ padding: 20, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, width: 320 }}>
    <span style={{ fontSize: 18 }}>👔</span>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>김 팀장</span>
      <DailyMoodIndicator profile={PROFILE} variant="inline" />
    </div>
  </div>
);

// The inline indicator on its own, on a parchment surface.
export const InlineStandalone = () => (
  <div style={{ padding: 24, background: 'var(--bg)' }}>
    <DailyMoodIndicator profile={PROFILE} variant="inline" />
  </div>
);
