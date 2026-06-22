/**
 * /design/foundry — Component Foundry (from the claude.ai/design ArgusV2 ref).
 *
 * A dimensional rebuild catalogue of the Argus primitives — buttons, cards,
 * badges, fields — with layered depth, bevels and the logbook motif. This is a
 * DESIGN-DIRECTION reference page (the spec for 입체화), not a swap of the live
 * shared primitives. Resting-state fidelity is the goal; the `:hover`/`:active`
 * lifts from the reference are omitted (static showcase). The drifting compass
 * (argdrift) and spinner (argspin) animate via globals.css keyframes.
 */

const MONO = "var(--font-mono,'JetBrains Mono',monospace)";
const SERIF = "var(--font-display,'Noto Serif KR',Georgia,serif)";
const SANS = "var(--font-sans,'Pretendard',system-ui)";

function SectionHead({ kicker, title, body }: { kicker: string; title: string; body?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ font: `600 11px/1 ${MONO}`, letterSpacing: '.24em', textTransform: 'uppercase', color: '#a87d31' }}>{kicker}</span>
      <h2 style={{ margin: 0, font: `600 28px/1.1 ${SERIF}`, letterSpacing: '-.01em', color: '#221e19' }}>{title}</h2>
      {body && <p style={{ margin: 0, fontSize: 13.5, color: '#6b6459', maxWidth: 560 }}>{body}</p>}
    </div>
  );
}

const panelLabel: React.CSSProperties = { font: `600 10px/1 ${MONO}`, letterSpacing: '.18em', textTransform: 'uppercase', color: '#9a917f' };

export default function FoundryPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ece3d0',
        backgroundImage:
          'radial-gradient(120% 80% at 20% 0%,rgba(255,251,242,.85),rgba(236,227,208,0) 55%),radial-gradient(100% 90% at 100% 100%,rgba(199,170,118,.16),rgba(236,227,208,0) 50%),repeating-linear-gradient(0deg,rgba(43,39,34,.014) 0 1px,transparent 1px 3px)',
        fontFamily: SANS,
        color: '#2b2722',
        padding: '64px 32px 96px',
      }}
    >
      <div style={{ maxWidth: 1140, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 72 }}>
        {/* COVER */}
        <header style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32, paddingBottom: 34, borderBottom: '1px solid rgba(43,39,34,.14)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 680 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 26, height: 1, background: '#a87d31' }} />
              <span style={{ font: `600 11px/1 ${MONO}`, letterSpacing: '.26em', textTransform: 'uppercase', color: '#a87d31' }}>Argus · Design Foundry</span>
            </div>
            <h1 style={{ margin: 0, font: `600 clamp(34px,4.4vw,52px)/1.06 ${SERIF}`, letterSpacing: '-.018em', color: '#221e19' }}>
              정교하게 벼려낸
              <br />
              항해 도구상자
            </h1>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: '#5c554c', maxWidth: 560 }}>
              평면적이던 컴포넌트를 입체 음영·베벨·종이 질감으로 다시 세공했습니다. 황동 계기와 해도(海圖)의 깊이를 담아, 위계와 표현의 폭을 넓힌 Argus v2.
            </p>
          </div>
          <svg width="92" height="92" viewBox="0 0 100 100" fill="none" style={{ flex: 'none', animation: 'argdrift 7s ease-in-out infinite', filter: 'drop-shadow(0 6px 12px rgba(140,101,38,.22))' }}>
            <circle cx="50" cy="50" r="47" stroke="#c2933f" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="37" stroke="#d8cbb0" strokeWidth="1" />
            <circle cx="50" cy="50" r="27" stroke="#d8cbb0" strokeWidth="1" />
            <path d="M50 9 L57 50 L50 91 L43 50 Z" fill="#c2933f" />
            <path d="M9 50 L50 43 L91 50 L50 57 Z" fill="#2b2722" opacity=".22" />
            <circle cx="50" cy="50" r="4.5" fill="#221e19" />
            <circle cx="50" cy="50" r="4.5" fill="none" stroke="#d8b25e" strokeWidth="1" />
          </svg>
        </header>

        {/* BUTTONS */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <SectionHead kicker="01 · Actions" title="버튼 — 눌리는 무게" body="상단 하이라이트와 다층 그림자로 물리적 깊이를 줬습니다. 황동(accent)은 한 화면에 하나만 — 가장 중요한 행동에." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24, background: 'linear-gradient(180deg,#fbf8f1,#f4ecdb)', border: '1px solid #e2d8c3', borderRadius: 16, boxShadow: '0 1px 2px rgba(43,39,34,.06),0 10px 30px rgba(43,39,34,.06),inset 0 1px 0 rgba(255,255,255,.8)' }}>
            <span style={panelLabel}>Variants</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: `600 14px/1 ${SANS}`, color: '#3a2a10', padding: '11px 20px', borderRadius: 10, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e 0%,#c2933f 55%,#a87d31 100%)', boxShadow: '0 1px 2px rgba(0,0,0,.18),0 6px 15px rgba(168,125,49,.34),inset 0 1px 0 rgba(255,255,255,.5)', textShadow: '0 1px 0 rgba(255,255,255,.35)', cursor: 'pointer' }}>
                항해 시작
                <svg width="14" height="14" viewBox="0 0 16 16" style={{ opacity: 0.85 }}>
                  <path d="M3 8h9M9 4l4 4-4 4" stroke="#3a2a10" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button style={{ font: `600 14px/1 ${SANS}`, color: '#f7f1e6', padding: '11px 20px', borderRadius: 10, border: '1px solid #15110d', background: 'linear-gradient(180deg,#3f372e 0%,#241f1a 100%)', boxShadow: '0 1px 2px rgba(0,0,0,.35),0 6px 15px rgba(43,39,34,.28),inset 0 1px 0 rgba(255,255,255,.14)', textShadow: '0 1px 0 rgba(0,0,0,.3)', cursor: 'pointer' }}>결정 봉인</button>
              <button style={{ font: `600 14px/1 ${SANS}`, color: '#34302a', padding: '11px 20px', borderRadius: 10, border: '1px solid #d6cbb4', background: 'linear-gradient(180deg,#fffdf8,#f1e9d7)', boxShadow: '0 1px 2px rgba(43,39,34,.08),inset 0 1px 0 rgba(255,255,255,.9)', cursor: 'pointer' }}>초안 보기</button>
              <button style={{ font: `600 14px/1 ${SANS}`, color: '#4a443c', padding: '11px 18px', borderRadius: 10, border: '1px solid transparent', background: 'transparent', cursor: 'pointer' }}>건너뛰기</button>
              <button style={{ font: `600 14px/1 ${SANS}`, color: '#fbeeea', padding: '11px 20px', borderRadius: 10, border: '1px solid #6e2c24', background: 'linear-gradient(180deg,#b65648,#8f3d33)', boxShadow: '0 1px 2px rgba(0,0,0,.2),0 6px 15px rgba(143,61,51,.3),inset 0 1px 0 rgba(255,255,255,.18)', textShadow: '0 1px 0 rgba(0,0,0,.25)', cursor: 'pointer' }}>삭제</button>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 14px/1 ${SANS}`, color: '#a87d31', padding: '11px 6px', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4, textDecorationThickness: '1.5px', textDecorationColor: 'rgba(168,125,49,.5)' }}>기록 전체 보기</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 22, background: '#fbf8f1', border: '1px solid #e7ddc9', borderRadius: 14, boxShadow: '0 1px 2px rgba(43,39,34,.05),0 6px 18px rgba(43,39,34,.05)' }}>
              <span style={panelLabel}>Sizes</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <button style={{ font: `600 12.5px/1 ${SANS}`, color: '#f7f1e6', padding: '7px 13px', borderRadius: 8, border: '1px solid #15110d', background: 'linear-gradient(180deg,#3f372e,#241f1a)', boxShadow: '0 3px 8px rgba(43,39,34,.22),inset 0 1px 0 rgba(255,255,255,.12)', cursor: 'pointer' }}>Small</button>
                <button style={{ font: `600 14px/1 ${SANS}`, color: '#f7f1e6', padding: '11px 20px', borderRadius: 10, border: '1px solid #15110d', background: 'linear-gradient(180deg,#3f372e,#241f1a)', boxShadow: '0 5px 13px rgba(43,39,34,.26),inset 0 1px 0 rgba(255,255,255,.14)', cursor: 'pointer' }}>Medium</button>
                <button style={{ font: `600 16px/1 ${SANS}`, color: '#f7f1e6', padding: '15px 28px', borderRadius: 12, border: '1px solid #15110d', background: 'linear-gradient(180deg,#3f372e,#241f1a)', boxShadow: '0 8px 20px rgba(43,39,34,.3),inset 0 1px 0 rgba(255,255,255,.16)', cursor: 'pointer' }}>Large</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 22, background: '#fbf8f1', border: '1px solid #e7ddc9', borderRadius: 14, boxShadow: '0 1px 2px rgba(43,39,34,.05),0 6px 18px rgba(43,39,34,.05)' }}>
              <span style={panelLabel}>States</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <button style={{ font: `600 14px/1 ${SANS}`, color: '#f7f1e6', padding: '11px 20px', borderRadius: 10, border: '1px solid #15110d', background: 'linear-gradient(180deg,#3f372e,#241f1a)', boxShadow: '0 5px 13px rgba(43,39,34,.26),inset 0 1px 0 rgba(255,255,255,.14)', cursor: 'pointer' }}>활성</button>
                <button disabled style={{ font: `600 14px/1 ${SANS}`, color: '#8d857a', padding: '11px 20px', borderRadius: 10, border: '1px solid #ddd2bd', background: '#ece3d0', boxShadow: 'inset 0 1px 2px rgba(43,39,34,.06)', cursor: 'not-allowed' }}>비활성</button>
                <button style={{ display: 'inline-flex', alignItems: 'center', gap: 9, font: `600 14px/1 ${SANS}`, color: '#d8cbb0', padding: '11px 20px', borderRadius: 10, border: '1px solid #2a241d', background: 'linear-gradient(180deg,#332d26,#221d18)', boxShadow: '0 5px 13px rgba(43,39,34,.22)', cursor: 'progress' }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(216,178,94,.3)', borderTopColor: '#d8b25e', display: 'inline-block', animation: 'argspin .7s linear infinite' }} />봉인 중
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 22, background: '#fbf8f1', border: '1px solid #e7ddc9', borderRadius: 14, boxShadow: '0 1px 2px rgba(43,39,34,.05),0 6px 18px rgba(43,39,34,.05)' }}>
              <span style={panelLabel}>Icon</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <button title="다음" style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 11, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#b8893a)', boxShadow: '0 5px 13px rgba(168,125,49,.32),inset 0 1px 0 rgba(255,255,255,.5)', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8h9M9 4l4 4-4 4" stroke="#3a2a10" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button title="저장" style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 11, border: '1px solid #15110d', background: 'linear-gradient(180deg,#3f372e,#241f1a)', boxShadow: '0 5px 13px rgba(43,39,34,.26),inset 0 1px 0 rgba(255,255,255,.14)', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" stroke="#e6d6ad" strokeWidth="1.6" fill="none" /><circle cx="8" cy="8" r="1.6" fill="#e6d6ad" /></svg>
                </button>
                <button title="더보기" style={{ display: 'grid', placeItems: 'center', width: 42, height: 42, borderRadius: 11, border: '1px solid #d6cbb4', background: 'linear-gradient(180deg,#fffdf8,#f1e9d7)', boxShadow: '0 1px 2px rgba(43,39,34,.08),inset 0 1px 0 rgba(255,255,255,.9)', cursor: 'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="3" cy="8" r="1.4" fill="#5c554c" /><circle cx="8" cy="8" r="1.4" fill="#5c554c" /><circle cx="13" cy="8" r="1.4" fill="#5c554c" /></svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* CARDS */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <SectionHead kicker="02 · Surfaces" title="카드 — 세 단계의 높이" body="평평함 → 떠오름 → 봉인. 그림자 깊이와 상단 황동 엣지로 한눈에 위계가 읽힙니다. 시맨틱 표면은 색 띠와 카르투슈로 의미를 부여합니다." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 22, background: '#fbf8f1', border: '1px solid #e7ddc9', borderRadius: 14 }}>
              <span style={{ ...panelLabel, letterSpacing: '.16em' }}>Flat · 기본</span>
              <h3 style={{ margin: '2px 0 0', font: `600 16px ${SERIF}`, color: '#221e19' }}>평면 표면</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#6b6459' }}>테두리만 있는 중립 표면. 밀도 높은 목록에.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 22, background: 'linear-gradient(180deg,#fdfbf6,#f8f1e3)', border: '1px solid #e2d8c3', borderRadius: 14, boxShadow: '0 1px 2px rgba(43,39,34,.07),0 8px 22px rgba(43,39,34,.08),inset 0 1px 0 rgba(255,255,255,.8)' }}>
              <span style={{ ...panelLabel, letterSpacing: '.16em' }}>Raised · 호버</span>
              <h3 style={{ margin: '2px 0 0', font: `600 16px ${SERIF}`, color: '#221e19' }}>떠오르는 표면</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#6b6459' }}>마우스를 올리면 더 떠오릅니다. 클릭 가능한 항목에.</p>
            </div>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: '23px 22px 22px', background: 'linear-gradient(180deg,#fdfbf6,#f7efdf)', border: '1px solid #e0d3b6', borderRadius: 14, boxShadow: '0 2px 6px rgba(43,39,34,.12),0 18px 40px rgba(43,39,34,.14),inset 0 1px 0 rgba(255,255,255,.85)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#a87d31,#e2bf6e,#a87d31)' }} />
              <span style={{ ...panelLabel, letterSpacing: '.16em', color: '#a87d31' }}>Elevated · 강조</span>
              <h3 style={{ margin: '2px 0 0', font: `600 16px ${SERIF}`, color: '#221e19' }}>황동 엣지 표면</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#6b6459' }}>상단 황동 띠 + 깊은 그림자. 화면의 주인공.</p>
            </div>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: 22, background: 'linear-gradient(180deg,#fbf3dd,#f4e8c8)', border: '1px solid #e3cf9c', borderRadius: 14, boxShadow: '0 2px 6px rgba(140,101,38,.16),0 14px 32px rgba(140,101,38,.16),inset 0 1px 0 rgba(255,255,255,.7)' }}>
              <div style={{ position: 'absolute', inset: 8, border: '1px dashed rgba(168,125,49,.4)', borderRadius: 9, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%,#e2bf6e,#a87d31 68%,#8c6526)', border: '1px solid #7d5a22', boxShadow: 'inset 0 2px 4px rgba(255,255,255,.4),inset 0 -3px 6px rgba(0,0,0,.28),0 3px 8px rgba(140,101,38,.4)', display: 'grid', placeItems: 'center' }}>
                <span style={{ font: `700 18px ${SERIF}`, color: '#3a2a10', textShadow: '0 1px 0 rgba(255,255,255,.3)' }}>A</span>
              </div>
              <span style={{ ...panelLabel, letterSpacing: '.16em', color: '#8c6526' }}>Sealed · 봉인</span>
              <h3 style={{ margin: '2px 0 0', font: `600 16px ${SERIF}`, color: '#3a2a10' }}>봉인된 결정</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#6e5c38', maxWidth: 160 }}>밀랍 인장으로 고정. 더 이상 바꿀 수 없는 기록.</p>
            </div>
          </div>
          {/* semantic cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {[
              { bar: 'linear-gradient(90deg,#5b6b7a,#8597a6)', bg: 'linear-gradient(180deg,#f3f6f9,#eaeff4)', border: '#d3dde6', dot: '#5b6b7a', dotRadius: 2, label: 'AI 작업', labelColor: '#5b6b7a', title: '자동 항법', titleColor: '#27313a', body: 'AI가 생성한 경로. 검토 전까지 임시.', bodyColor: '#5a6671', sh: '0 1px 2px rgba(43,39,34,.05),0 7px 18px rgba(60,80,100,.08),inset 0 1px 0 rgba(255,255,255,.8)' },
              { bar: 'linear-gradient(90deg,#a8843f,#d8b25e)', bg: 'linear-gradient(180deg,#fbf4e6,#f6ecd6)', border: '#e6d6b4', dot: '#a8843f', dotRadius: 2, label: '사람 판단', labelColor: '#a8843f', title: '선장의 결정', titleColor: '#3a2c12', body: '사람이 직접 방위를 정한 구간.', bodyColor: '#6e5c38', sh: '0 1px 2px rgba(43,39,34,.05),0 7px 18px rgba(140,101,38,.09),inset 0 1px 0 rgba(255,255,255,.8)' },
              { bar: 'linear-gradient(90deg,#5e7a52,#84a070)', bg: 'linear-gradient(180deg,#eef5ea,#e4eddd)', border: '#cadcbf', dot: '#5e7a52', dotRadius: 2, label: '협업 완료', labelColor: '#5e7a52', title: '합의된 항로', titleColor: '#2f3f29', body: 'AI와 사람이 합의에 도달한 결과.', bodyColor: '#566a4c', sh: '0 1px 2px rgba(43,39,34,.05),0 7px 18px rgba(94,122,82,.09),inset 0 1px 0 rgba(255,255,255,.8)' },
              { bar: 'linear-gradient(90deg,#c2933f,#e2bf6e,#c2933f)', bg: 'linear-gradient(180deg,#fbf6e4,#f5edd2)', border: '#e6d9af', dot: '#c2933f', dotRadius: 50, dotRing: true, label: '체크포인트', labelColor: '#a87d31', title: '봉인 직전', titleColor: '#3a2c12', body: '결정을 확정하기 전 마지막 확인 지점.', bodyColor: '#6e5c38', sh: '0 1px 2px rgba(43,39,34,.05),0 7px 18px rgba(140,101,38,.1),inset 0 1px 0 rgba(255,255,255,.8)' },
            ].map((c) => (
              <div key={c.title} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, padding: 20, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 13, boxShadow: c.sh, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.bar }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: c.dotRadius, background: c.dotRing ? 'transparent' : c.dot, border: c.dotRing ? `2px solid ${c.dot}` : undefined }} />
                  <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: c.labelColor }}>{c.label}</span>
                </div>
                <h3 style={{ margin: 0, font: `600 15px ${SERIF}`, color: c.titleColor }}>{c.title}</h3>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: c.bodyColor }}>{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* BADGES */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <SectionHead kicker="03 · Signals" title="배지 & 위험도" body="솔리드·소프트·아웃라인 세 등급, 그리고 위험 삼분법(치명·관리가능·암묵). 미세한 그라데이션과 내부 하이라이트로 새겨 넣은 느낌." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 24, background: '#fbf8f1', border: '1px solid #e7ddc9', borderRadius: 16, boxShadow: '0 1px 2px rgba(43,39,34,.05),0 8px 22px rgba(43,39,34,.06)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11.5px/1 ${MONO}`, letterSpacing: '.04em', color: '#3a2a10', padding: '6px 12px', borderRadius: 8, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#b8893a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45),0 1px 2px rgba(140,101,38,.25)', textShadow: '0 1px 0 rgba(255,255,255,.3)' }}>현재 방위</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11.5px/1 ${MONO}`, color: '#f7f1e6', padding: '6px 12px', borderRadius: 8, border: '1px solid #15110d', background: 'linear-gradient(180deg,#3f372e,#241f1a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)' }}>봉인됨</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11.5px/1 ${MONO}`, color: '#8c6526', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(168,125,49,.45)', background: 'rgba(216,178,94,.16)' }}>소프트 골드</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11.5px/1 ${MONO}`, color: '#5c554c', padding: '6px 12px', borderRadius: 8, border: '1px solid #cabfa8', background: 'transparent' }}>아웃라인</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11.5px/1 ${MONO}`, color: '#5b6b7a', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(91,107,122,.35)', background: 'rgba(91,107,122,.12)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5b6b7a' }} />AI
              </span>
            </div>
            <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(43,39,34,.14),transparent)' }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {[
                { color: '#8f3d33', dot: '#8f3d33', bg: 'linear-gradient(180deg,rgba(178,86,72,.18),rgba(143,61,51,.12))', border: 'rgba(143,61,51,.4)', ring: 'rgba(143,61,51,.18)', label: '치명적' },
                { color: '#9a6b1e', dot: '#c08a3e', bg: 'linear-gradient(180deg,rgba(216,178,94,.22),rgba(168,125,49,.12))', border: 'rgba(168,125,49,.42)', ring: 'rgba(192,138,62,.18)', label: '관리 가능' },
                { color: '#5a606b', dot: '#6b6f78', bg: 'linear-gradient(180deg,rgba(107,111,120,.16),rgba(107,111,120,.08))', border: 'rgba(107,111,120,.38)', ring: 'rgba(107,111,120,.16)', label: '암묵적' },
              ].map((r) => (
                <span key={r.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: `600 11.5px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: r.color, padding: '7px 13px', borderRadius: 8, border: `1px solid ${r.border}`, background: r.bg, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.dot, boxShadow: `0 0 0 3px ${r.ring}` }} />{r.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FIELDS */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <SectionHead kicker="04 · Inputs" title="입력 — 종이에 각인" body="눌러 새긴 듯한 내부 음영(inset), 포커스 시 황동 링, 명확한 에러 상태." />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18, padding: 26, background: 'linear-gradient(180deg,#fbf8f1,#f4ecdb)', border: '1px solid #e2d8c3', borderRadius: 16, boxShadow: '0 1px 2px rgba(43,39,34,.05),0 8px 22px rgba(43,39,34,.06)' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ ...panelLabel, letterSpacing: '.16em' }}>결정 제목</span>
              <input defaultValue="북서 항로로 전환" style={{ font: `400 14px ${SANS}`, color: '#2b2722', padding: '11px 13px', borderRadius: 10, border: '1px solid #d6cbb4', background: '#fffdf8', boxShadow: 'inset 0 1px 3px rgba(43,39,34,.1),inset 0 0 0 1px rgba(43,39,34,.02)', outline: 'none' }} />
              <span style={{ fontSize: 11.5, color: '#9a917f' }}>기록에 남을 한 줄.</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ ...panelLabel, letterSpacing: '.16em' }}>봉인 날짜</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderRadius: 10, border: '1px solid #d6cbb4', background: '#fffdf8', boxShadow: 'inset 0 1px 3px rgba(43,39,34,.1)' }}>
                <svg width="15" height="15" viewBox="0 0 16 16" style={{ flex: 'none' }}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="#a87d31" strokeWidth="1.3" fill="none" /><path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" stroke="#a87d31" strokeWidth="1.3" strokeLinecap="round" /></svg>
                <input defaultValue="2026-07-01" style={{ flex: 1, font: `400 14px ${MONO}`, color: '#2b2722', border: 'none', background: 'none', outline: 'none' }} />
              </div>
              <span style={{ fontSize: 11.5, color: '#9a917f' }}>이 날 Argus가 결과를 묻습니다.</span>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ ...panelLabel, letterSpacing: '.16em', color: '#8f3d33' }}>근거 (필수)</span>
              <input placeholder="비워둘 수 없습니다" style={{ font: `400 14px ${SANS}`, color: '#2b2722', padding: '11px 13px', borderRadius: 10, border: '1px solid #c98a7e', background: '#fdf3f1', boxShadow: 'inset 0 1px 3px rgba(143,61,51,.12),0 0 0 3px rgba(143,61,51,.1)', outline: 'none' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#8f3d33' }}>
                <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#8f3d33', color: '#fff', display: 'grid', placeItems: 'center', font: `700 9px ${MONO}` }}>!</span>근거 없이 봉인할 수 없습니다.
              </span>
            </label>
          </div>
        </section>

        {/* APPLIED */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <SectionHead kicker="05 · In context" title="살아있는 화면 — 결정 봉인" />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 480, padding: 30, background: 'linear-gradient(180deg,#fdfbf6,#f6eede)', border: '1px solid #e0d3b6', borderRadius: 18, boxShadow: '0 3px 8px rgba(43,39,34,.12),0 24px 54px rgba(43,39,34,.16),inset 0 1px 0 rgba(255,255,255,.85)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#a87d31,#e2bf6e,#a87d31)' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.18em', textTransform: 'uppercase', color: '#a87d31' }}>체크포인트 · 07/01</span>
                <h3 style={{ margin: 0, font: `600 21px/1.2 ${SERIF}`, color: '#221e19' }}>이 결정을 봉인할까요?</h3>
              </div>
              <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 10.5px/1 ${MONO}`, color: '#3a2a10', padding: '6px 11px', borderRadius: 8, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#b8893a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45)' }}>현재 방위</span>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: '#5c554c' }}>정한 날짜에 Argus가 먼저 돌아와 결과를 묻습니다. 봉인 후에는 근거와 함께 항해일지에 영구 기록됩니다.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 15px', borderRadius: 11, background: 'rgba(216,178,94,.12)', border: '1px solid rgba(168,125,49,.28)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ flex: 'none' }}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="#a87d31" strokeWidth="1.3" fill="none" /><path d="M2.5 6.5h11M5.5 2v2.5M10.5 2v2.5" stroke="#a87d31" strokeWidth="1.3" strokeLinecap="round" /></svg>
              <span style={{ font: `500 13px ${MONO}`, color: '#6e5c38' }}>복귀 예정 · 2026-07-01</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
              <button style={{ font: `600 14px/1 ${SANS}`, color: '#4a443c', padding: '11px 18px', borderRadius: 10, border: '1px solid transparent', background: 'transparent', cursor: 'pointer' }}>취소</button>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: `600 14px/1 ${SANS}`, color: '#3a2a10', padding: '11px 22px', borderRadius: 10, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#c2933f 55%,#a87d31)', boxShadow: '0 6px 15px rgba(168,125,49,.34),inset 0 1px 0 rgba(255,255,255,.5)', textShadow: '0 1px 0 rgba(255,255,255,.3)', cursor: 'pointer' }}>
                봉인하기
                <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 8.5l2.5 2.5L12 5" stroke="#3a2a10" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </div>
        </section>

        {/* DARK STRIP */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <SectionHead kicker="06 · Night harbour" title="다크 — 심야 항구" body="같은 언어, 깊은 남청색 잉크 위에서. 황동은 등대처럼 더 빛납니다." />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch', padding: 30, borderRadius: 18, background: 'radial-gradient(120% 90% at 80% 0%,rgba(40,52,66,.9),rgba(22,28,36,1) 60%),linear-gradient(180deg,#1a2027,#12161c)', border: '1px solid #2a323c', boxShadow: '0 18px 44px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, justifyContent: 'center' }}>
              <button style={{ font: `600 14px/1 ${SANS}`, color: '#221a0c', padding: '12px 22px', borderRadius: 10, border: '1px solid #c2933f', background: 'linear-gradient(180deg,#ecc878,#c2933f)', boxShadow: '0 6px 18px rgba(216,178,94,.32),inset 0 1px 0 rgba(255,255,255,.55)', textShadow: '0 1px 0 rgba(255,255,255,.3)', cursor: 'pointer' }}>항해 시작</button>
              <button style={{ font: `600 14px/1 ${SANS}`, color: '#e8ddc5', padding: '12px 22px', borderRadius: 10, border: '1px solid #3a4654', background: 'linear-gradient(180deg,#2c3540,#1d242c)', boxShadow: '0 6px 16px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.08)', cursor: 'pointer' }}>초안 보기</button>
            </div>
            <div style={{ flex: 1, minWidth: 240, position: 'relative', display: 'flex', flexDirection: 'column', gap: 9, padding: 22, borderRadius: 14, background: 'linear-gradient(180deg,#212a33,#191f26)', border: '1px solid #303a45', boxShadow: '0 14px 34px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#a87d31,#ecc878,#a87d31)' }} />
              <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: '#d8b25e' }}>Elevated</span>
              <h3 style={{ margin: '2px 0 0', font: `600 16px ${SERIF}`, color: '#f1ead9' }}>야간 항법 카드</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#9aa4af' }}>어둠 속에서도 위계는 그대로. 황동 엣지가 길을 비춥니다.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 10.5px/1 ${MONO}`, color: '#d8b25e', padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(216,178,94,.35)', background: 'rgba(216,178,94,.1)' }}>봉인됨</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 10.5px/1 ${MONO}`, color: '#8ea2b4', padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(142,162,180,.3)', background: 'rgba(142,162,180,.1)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8ea2b4' }} />AI
                </span>
              </div>
            </div>
          </div>
        </section>

        <footer style={{ paddingTop: 24, borderTop: '1px solid rgba(43,39,34,.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ font: `500 12px ${MONO}`, color: '#9a917f' }}>Argus v2 · Component Foundry — 제안용 쇼케이스</span>
          <span style={{ font: `500 12px ${MONO}`, color: '#a87d31' }}>depth · hierarchy · variety</span>
        </footer>
      </div>
    </div>
  );
}
