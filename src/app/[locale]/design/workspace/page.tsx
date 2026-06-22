/**
 * /design/workspace — Decision Chart & Crew (from the claude.ai/design
 * ArgusWorkspace ref). The static "원형" of DecisionVoyageFilm: a 3D parchment
 * decision chart (ForkPath reborn) with ship markers, and a brass crew-summon
 * panel. Design-direction reference; resting state faithful. The spinner /
 * pulse / bob animate via globals.css keyframes (argspin / argpulse / argbob).
 */

const MONO = "var(--font-mono,'JetBrains Mono',monospace)";
const SERIF = "var(--font-display,'Noto Serif KR',Georgia,serif)";
const SANS = "var(--font-sans,'Pretendard',system-ui)";

export default function WorkspacePage() {
  return (
    <div
      className="ds-showcase"
      style={{
        minHeight: '100vh',
        background: '#e8dec9',
        backgroundImage:
          'radial-gradient(120% 80% at 18% 0%,rgba(255,251,242,.85),rgba(232,222,201,0) 55%),radial-gradient(100% 90% at 100% 100%,rgba(120,90,40,.14),rgba(232,222,201,0) 50%),repeating-linear-gradient(0deg,rgba(43,39,34,.014) 0 1px,transparent 1px 3px)',
        fontFamily: SANS,
        color: '#2b2722',
        padding: '60px 32px 110px',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 84 }}>
        {/* header */}
        <header style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 26, height: 1, background: '#a87d31' }} />
            <span style={{ font: `600 11px/1 ${MONO}`, letterSpacing: '.26em', textTransform: 'uppercase', color: '#a87d31' }}>Argus · Workspace</span>
          </div>
          <h1 style={{ margin: 0, font: `600 clamp(30px,4vw,46px)/1.08 ${SERIF}`, letterSpacing: '-.018em', color: '#221e19' }}>갈림길을 해도(海圖) 위에 펼치다</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: '#5c554c' }}>
            가는 선 두 줄짜리 ForkPath를 버리고, 양피지를 <strong style={{ color: '#3a2c12', fontWeight: 600 }}>기울여 깊이를 준 결정 차트</strong>로 다시 세공했습니다. 항로는 종이에 각인되고, 분기점마다 <strong style={{ color: '#3a2c12', fontWeight: 600 }}>함선이 갑판 위에 서며</strong>, 선택지는 지도 위로 떠오릅니다.
          </p>
        </header>

        {/* 01 · DECISION CHART (3D) */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: `600 11px/1 ${MONO}`, letterSpacing: '.24em', textTransform: 'uppercase', color: '#a87d31' }}>01 · Decision chart</span>
            <h2 style={{ margin: 0, font: `600 27px/1.1 ${SERIF}`, letterSpacing: '-.01em', color: '#221e19' }}>결정 차트 — 세 갈래의 항로</h2>
          </div>

          {/* 3D scene */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 48px', perspective: '1500px', perspectiveOrigin: '50% 30%' }}>
            <div style={{ position: 'relative', width: 900, maxWidth: '100%' }}>
              <div style={{ position: 'absolute', left: '6%', right: '6%', top: '58%', height: 120, background: 'radial-gradient(ellipse at center,rgba(60,44,18,.34),rgba(60,44,18,0) 70%)', filter: 'blur(14px)' }} />

              {/* tilted chart */}
              <div style={{ position: 'relative', width: 900, height: 500, transform: 'rotateX(21deg) rotateZ(-1deg)', transformStyle: 'preserve-3d', borderRadius: 10, background: 'linear-gradient(150deg,#f3e8cd 0%,#e9d9b4 48%,#e0cca0 100%)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,.4),0 30px 60px rgba(60,44,18,.32),0 8px 18px rgba(60,44,18,.22)', border: '1px solid #cdb37e', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,rgba(120,90,40,.07) 0 1px,transparent 1px 46px),repeating-linear-gradient(90deg,rgba(120,90,40,.07) 0 1px,transparent 1px 46px)' }} />
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(110% 90% at 50% 38%,rgba(255,250,238,.5),rgba(120,90,40,0) 55%),radial-gradient(140% 120% at 50% 110%,rgba(90,64,24,.28),rgba(90,64,24,0) 55%)' }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: 10, boxShadow: 'inset 0 0 60px rgba(90,64,24,.22),inset 0 0 0 8px rgba(120,90,40,.05)' }} />

                {/* compass rose, embossed */}
                <svg width="124" height="124" viewBox="0 0 100 100" fill="none" style={{ position: 'absolute', left: 34, bottom: 26, opacity: 0.85, filter: 'drop-shadow(0 1px 0 rgba(255,255,255,.6))' }}>
                  <circle cx="50" cy="50" r="46" stroke="#a07d40" strokeWidth="1.2" />
                  <circle cx="50" cy="50" r="34" stroke="#bfa066" strokeWidth="1" />
                  <circle cx="50" cy="50" r="20" stroke="#bfa066" strokeWidth="1" />
                  <path d="M50 6 L56 50 L50 94 L44 50 Z" fill="#9a6b1e" opacity=".5" />
                  <path d="M6 50 L50 44 L94 50 L50 56 Z" fill="#6e5020" opacity=".32" />
                  <path d="M22 22 L50 47 L78 78 M78 22 L50 53 L22 78" stroke="#bfa066" strokeWidth="1" />
                  <circle cx="50" cy="50" r="3.4" fill="#6e5020" />
                </svg>

                {/* routes (engraved) */}
                <svg viewBox="0 0 900 500" width="900" height="500" fill="none" style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 1px 0 rgba(255,251,240,.7))' }}>
                  <path d="M70 250 H210" stroke="#5e4a22" strokeWidth="3.5" strokeLinecap="round" />
                  <path d="M210 250 C 360 210 470 150 612 122" stroke="#c2933f" strokeWidth="4" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px rgba(216,178,94,.7))' }} />
                  <path d="M210 250 C 360 252 480 250 636 250" stroke="#6e5a30" strokeWidth="2.6" strokeLinecap="round" />
                  <path d="M210 250 C 350 300 470 348 600 380" stroke="#8a6f3c" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="3 7" opacity=".7" />
                </svg>

                {/* depth soundings */}
                <span style={{ position: 'absolute', left: 330, top: 300, font: `500 11px ${MONO}`, color: 'rgba(110,80,32,.55)' }}>· 12 ·</span>
                <span style={{ position: 'absolute', left: 470, top: 330, font: `500 11px ${MONO}`, color: 'rgba(110,80,32,.5)' }}>· 27 ·</span>

                {/* FORK node: flagship */}
                <div style={{ position: 'absolute', left: 210, top: 250, transformStyle: 'preserve-3d' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-50%)', width: 40, height: 14, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(60,44,18,.42),transparent 70%)', filter: 'blur(2px)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: 0, width: 42, height: 42, borderRadius: '50%', border: '2px solid rgba(194,147,63,.75)', transform: 'translate(-50%,-50%)', animation: 'argpulse 2.6s ease-out infinite' }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: 'bottom center', transform: 'translate(-50%,-100%) rotateX(-21deg)', filter: 'drop-shadow(0 6px 5px rgba(60,44,18,.3))' }}>
                    <svg width="56" height="54" viewBox="0 0 56 54" fill="none">
                      <line x1="28" y1="40" x2="28" y2="6" stroke="#5e4a22" strokeWidth="2.2" />
                      <path d="M28 9 Q44 19 28 33 Z" fill="#fbf3df" stroke="#8c6526" strokeWidth="1.4" />
                      <path d="M28 7 L39 9.5 L28 12 Z" fill="#c2933f" stroke="#8c6526" strokeWidth="1" />
                      <path d="M8 38 Q28 50 48 38 L43 46 Q28 51 13 46 Z" fill="#c2933f" stroke="#6e5020" strokeWidth="1.4" />
                      <path d="M11 41 Q28 49 45 41" stroke="#fbeec8" strokeWidth="1" opacity=".5" />
                    </svg>
                  </div>
                </div>

                {/* Route A endpoint: chosen ship (gold) */}
                <div style={{ position: 'absolute', left: 612, top: 122, transformStyle: 'preserve-3d' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-50%)', width: 30, height: 11, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(60,44,18,.4),transparent 70%)', filter: 'blur(2px)' }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: 'bottom center', transform: 'translate(-50%,-100%) rotateX(-21deg)', animation: 'argbob 4s ease-in-out infinite', filter: 'drop-shadow(0 5px 4px rgba(60,44,18,.28))' }}>
                    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                      <line x1="22" y1="32" x2="22" y2="5" stroke="#5e4a22" strokeWidth="1.9" />
                      <path d="M22 8 Q35 16 22 27 Z" fill="#fbf3df" stroke="#8c6526" strokeWidth="1.3" />
                      <path d="M22 5 L31 7.5 L22 10 Z" fill="#c2933f" stroke="#8c6526" strokeWidth="1" />
                      <path d="M6 30 Q22 40 38 30 L34 37 Q22 41 10 37 Z" fill="#c2933f" stroke="#6e5020" strokeWidth="1.3" />
                    </svg>
                  </div>
                </div>

                {/* Route B endpoint: ink ship */}
                <div style={{ position: 'absolute', left: 636, top: 250, transformStyle: 'preserve-3d' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-50%)', width: 26, height: 10, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(60,44,18,.34),transparent 70%)', filter: 'blur(2px)' }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: 'bottom center', transform: 'translate(-50%,-100%) rotateX(-21deg)', filter: 'drop-shadow(0 4px 4px rgba(60,44,18,.24))' }}>
                    <svg width="38" height="40" viewBox="0 0 38 40" fill="none">
                      <line x1="19" y1="29" x2="19" y2="6" stroke="#6e5a30" strokeWidth="1.7" />
                      <path d="M19 8 Q30 15 19 25 Z" fill="#efe4cd" stroke="#8a7340" strokeWidth="1.2" />
                      <path d="M5 27 Q19 36 33 27 L29 33 Q19 37 9 33 Z" fill="#8a7340" stroke="#6a5630" strokeWidth="1.2" />
                    </svg>
                  </div>
                </div>

                {/* Route C endpoint: faint risky ship */}
                <div style={{ position: 'absolute', left: 600, top: 380, transformStyle: 'preserve-3d', opacity: 0.78 }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-50%)', width: 24, height: 9, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(60,44,18,.3),transparent 70%)', filter: 'blur(2px)' }} />
                  <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: 'bottom center', transform: 'translate(-50%,-100%) rotateX(-21deg)', filter: 'drop-shadow(0 4px 4px rgba(60,44,18,.2))' }}>
                    <svg width="36" height="38" viewBox="0 0 36 38" fill="none">
                      <line x1="18" y1="27" x2="18" y2="7" stroke="#7d6238" strokeWidth="1.6" />
                      <path d="M18 9 Q28 15 18 24 Z" fill="#e6dabf" stroke="#8a6f3c" strokeWidth="1.1" />
                      <path d="M5 26 Q18 34 31 26 L27 31 Q18 35 9 31 Z" fill="#a98f5c" stroke="#7d6838" strokeWidth="1.1" />
                    </svg>
                  </div>
                </div>

                {/* floating option cards */}
                <div style={{ position: 'absolute', left: 648, top: 40, width: 218, transform: 'translateZ(34px)', display: 'flex', flexDirection: 'column', gap: 7, padding: '15px 16px', borderRadius: 13, background: 'linear-gradient(180deg,#fffdf8,#f6edd8)', border: '1px solid #e0cfa6', boxShadow: '0 2px 4px rgba(60,44,18,.18),0 22px 38px rgba(60,44,18,.28),inset 0 1px 0 rgba(255,255,255,.9)' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#a87d31,#e2bf6e,#a87d31)', borderRadius: '13px 13px 0 0' }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: '#a87d31' }}>Route A · 채택</span>
                    <span style={{ font: `600 9.5px/1 ${MONO}`, color: '#3a2a10', padding: '4px 8px', borderRadius: 6, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#b8893a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)' }}>현재 방위</span>
                  </div>
                  <h4 style={{ margin: 0, font: `600 15px ${SERIF}`, color: '#221e19' }}>북서 항로로 전환</h4>
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: '#6b5c38' }}>바람은 거슬러도 가장 빠른 도착. 위험 관리 가능.</p>
                </div>

                <div style={{ position: 'absolute', left: 678, top: 226, width: 194, transform: 'translateZ(20px)', display: 'flex', flexDirection: 'column', gap: 6, padding: '13px 15px', borderRadius: 12, background: 'linear-gradient(180deg,#fdfbf6,#f3ead7)', border: '1px solid #e2d6b8', boxShadow: '0 2px 3px rgba(60,44,18,.14),0 14px 26px rgba(60,44,18,.2),inset 0 1px 0 rgba(255,255,255,.85)' }}>
                  <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: '#9a917f' }}>Route B · 대안</span>
                  <h4 style={{ margin: 0, font: `600 14px ${SERIF}`, color: '#3a342a' }}>현 항로 유지</h4>
                  <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: '#7a6e54' }}>안정적이나 도착이 늦음.</p>
                </div>

                <div style={{ position: 'absolute', left: 636, top: 352, width: 194, transform: 'translateZ(10px)', display: 'flex', flexDirection: 'column', gap: 6, padding: '13px 15px', borderRadius: 12, background: 'linear-gradient(180deg,#fbf6ef,#efe4cf)', border: '1px solid #ddccaa', boxShadow: '0 2px 3px rgba(60,44,18,.12),0 10px 20px rgba(60,44,18,.18),inset 0 1px 0 rgba(255,255,255,.8)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8f3d33', boxShadow: '0 0 0 3px rgba(143,61,51,.18)' }} />
                    <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8f3d33' }}>Route C · 치명적</span>
                  </div>
                  <h4 style={{ margin: 0, font: `600 14px ${SERIF}`, color: '#5a3a30' }}>남쪽 해협 돌파</h4>
                  <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: '#7a5b4e' }}>암초 미확인. 되돌릴 수 없음.</p>
                </div>
              </div>
            </div>
          </div>

          {/* chart actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: `600 14px/1 ${SANS}`, color: '#3a2a10', padding: '11px 22px', borderRadius: 10, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#c2933f 55%,#a87d31)', boxShadow: '0 6px 15px rgba(168,125,49,.34),inset 0 1px 0 rgba(255,255,255,.5)', textShadow: '0 1px 0 rgba(255,255,255,.3)', cursor: 'pointer' }}>
              Route A 채택
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 8.5l2.5 2.5L12 5" stroke="#3a2a10" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button style={{ font: `600 14px/1 ${SANS}`, color: '#34302a', padding: '11px 20px', borderRadius: 10, border: '1px solid #d6cbb4', background: 'linear-gradient(180deg,#fffdf8,#f1e9d7)', boxShadow: '0 1px 2px rgba(43,39,34,.08),inset 0 1px 0 rgba(255,255,255,.9)', cursor: 'pointer' }}>다른 갈래 그리기</button>
          </div>
        </section>

        {/* 02 · CREW SUMMON */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: `600 11px/1 ${MONO}`, letterSpacing: '.24em', textTransform: 'uppercase', color: '#a87d31' }}>02 · Crew summon</span>
            <h2 style={{ margin: 0, font: `600 27px/1.1 ${SERIF}`, letterSpacing: '-.01em', color: '#221e19' }}>크루 소환 — 황동 메달리온</h2>
            <p style={{ margin: 0, fontSize: 13.5, color: '#6b6459', maxWidth: 580 }}>에이전트를 “부서별 크루”로 소환합니다. 황동 메달리온이 양피지에서 솟아오르고, 상태 링으로 대기·소환됨·항해 중을 한눈에.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 18, padding: '30px 26px', borderRadius: 18, background: 'linear-gradient(180deg,#f6efdd,#efe5cd)', border: '1px solid #e0d3b3', boxShadow: '0 1px 2px rgba(60,44,18,.06),0 14px 34px rgba(60,44,18,.1),inset 0 1px 0 rgba(255,255,255,.7)' }}>
            {/* Scouts — working */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '22px 16px', borderRadius: 14, background: 'linear-gradient(180deg,#fdfbf6,#f5ecd8)', border: '1px solid #e2d6b6', boxShadow: '0 1px 2px rgba(60,44,18,.06),0 8px 20px rgba(60,44,18,.1),inset 0 1px 0 rgba(255,255,255,.85)' }}>
              <div style={{ position: 'relative', width: 96, height: 96, display: 'grid', placeItems: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px dashed #c2933f', animation: 'argspin 7s linear infinite' }} />
                <div style={{ position: 'relative', width: 74, height: 74, borderRadius: '50%', background: 'radial-gradient(circle at 38% 30%,#f3dd9a,#c2933f 56%,#8c6526 100%)', border: '1px solid #6e5020', boxShadow: 'inset 0 3px 5px rgba(255,255,255,.5),inset 0 -5px 9px rgba(0,0,0,.34),0 7px 16px rgba(80,55,15,.42)', display: 'grid', placeItems: 'center' }}>
                  <svg width="34" height="34" viewBox="0 0 32 32" fill="none"><circle cx="13" cy="13" r="7" stroke="#3a2a10" strokeWidth="2" /><path d="M18.5 18.5 L25 25" stroke="#3a2a10" strokeWidth="2.4" strokeLinecap="round" /></svg>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <h3 style={{ margin: 0, font: `600 16px ${SERIF}`, color: '#221e19' }}>탐색조</h3>
                <span style={{ font: `500 11px ${MONO}`, color: '#9a917f' }}>Scouts</span>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: `600 10.5px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8c6526', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(168,125,49,.4)', background: 'rgba(216,178,94,.16)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c2933f', boxShadow: '0 0 6px #d8b25e' }} />항해 중
              </span>
            </div>

            {/* Cartographers — summoned */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '22px 16px', borderRadius: 14, background: 'linear-gradient(180deg,#fdfbf6,#f5ecd8)', border: '1px solid #e2d6b6', boxShadow: '0 1px 2px rgba(60,44,18,.06),0 8px 20px rgba(60,44,18,.1),inset 0 1px 0 rgba(255,255,255,.85)' }}>
              <div style={{ position: 'relative', width: 96, height: 96, display: 'grid', placeItems: 'center' }}>
                <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: '2px solid #c2933f', boxShadow: '0 0 14px rgba(216,178,94,.6)' }} />
                <div style={{ position: 'relative', width: 74, height: 74, borderRadius: '50%', background: 'radial-gradient(circle at 38% 30%,#f3dd9a,#c2933f 56%,#8c6526 100%)', border: '1px solid #6e5020', boxShadow: 'inset 0 3px 5px rgba(255,255,255,.5),inset 0 -5px 9px rgba(0,0,0,.34),0 7px 16px rgba(80,55,15,.42)', display: 'grid', placeItems: 'center' }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M5 8h22M5 16h22M5 24h22M10 4v24M22 4v24" stroke="#3a2a10" strokeWidth="1.6" /></svg>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <h3 style={{ margin: 0, font: `600 16px ${SERIF}`, color: '#221e19' }}>제도사</h3>
                <span style={{ font: `500 11px ${MONO}`, color: '#9a917f' }}>Cartographers</span>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: `600 10.5px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: '#3a2a10', padding: '6px 12px', borderRadius: 20, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#b8893a)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.4)' }}>소환됨</span>
            </div>

            {/* Navigator — idle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '22px 16px', borderRadius: 14, background: 'linear-gradient(180deg,#fbf8f1,#f2eadb)', border: '1px solid #e4dac3', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)' }}>
              <div style={{ position: 'relative', width: 96, height: 96, display: 'grid', placeItems: 'center' }}>
                <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', border: '1.5px solid #cabfa2' }} />
                <div style={{ position: 'relative', width: 74, height: 74, borderRadius: '50%', background: 'radial-gradient(circle at 38% 30%,#e9dfc8,#b6a684 58%,#8f7e58 100%)', border: '1px solid #897a52', boxShadow: 'inset 0 3px 5px rgba(255,255,255,.4),inset 0 -4px 8px rgba(0,0,0,.26),0 5px 12px rgba(80,55,15,.3)', display: 'grid', placeItems: 'center', filter: 'saturate(.85)' }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M16 3 L19 16 L16 29 L13 16 Z" fill="#4a3c1e" /><path d="M3 16 L16 13 L29 16 L16 19 Z" fill="#5a4a26" opacity=".7" /><circle cx="16" cy="16" r="2.2" fill="#3a2c12" /></svg>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <h3 style={{ margin: 0, font: `600 16px ${SERIF}`, color: '#3a342a' }}>항법사</h3>
                <span style={{ font: `500 11px ${MONO}`, color: '#9a917f' }}>Navigator</span>
              </div>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11px/1 ${SANS}`, color: '#3a2a10', padding: '7px 15px', borderRadius: 20, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#b8893a)', boxShadow: '0 3px 8px rgba(168,125,49,.3),inset 0 1px 0 rgba(255,255,255,.45)', cursor: 'pointer' }}>소환하기</button>
            </div>

            {/* Quartermaster — idle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '22px 16px', borderRadius: 14, background: 'linear-gradient(180deg,#fbf8f1,#f2eadb)', border: '1px solid #e4dac3', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)' }}>
              <div style={{ position: 'relative', width: 96, height: 96, display: 'grid', placeItems: 'center' }}>
                <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', border: '1.5px solid #cabfa2' }} />
                <div style={{ position: 'relative', width: 74, height: 74, borderRadius: '50%', background: 'radial-gradient(circle at 38% 30%,#e9dfc8,#b6a684 58%,#8f7e58 100%)', border: '1px solid #897a52', boxShadow: 'inset 0 3px 5px rgba(255,255,255,.4),inset 0 -4px 8px rgba(0,0,0,.26),0 5px 12px rgba(80,55,15,.3)', display: 'grid', placeItems: 'center', filter: 'saturate(.85)' }}>
                  <svg width="30" height="30" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="7" r="3" stroke="#4a3c1e" strokeWidth="2" /><path d="M16 10 V27" stroke="#4a3c1e" strokeWidth="2" strokeLinecap="round" /><path d="M9 19 Q16 29 23 19" stroke="#4a3c1e" strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M10 14 H22" stroke="#4a3c1e" strokeWidth="2" strokeLinecap="round" /></svg>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <h3 style={{ margin: 0, font: `600 16px ${SERIF}`, color: '#3a342a' }}>병참관</h3>
                <span style={{ font: `500 11px ${MONO}`, color: '#9a917f' }}>Quartermaster</span>
              </div>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `600 11px/1 ${SANS}`, color: '#3a2a10', padding: '7px 15px', borderRadius: 20, border: '1px solid #7d5a22', background: 'linear-gradient(180deg,#e2bf6e,#b8893a)', boxShadow: '0 3px 8px rgba(168,125,49,.3),inset 0 1px 0 rgba(255,255,255,.45)', cursor: 'pointer' }}>소환하기</button>
            </div>
          </div>
        </section>

        <footer style={{ paddingTop: 24, borderTop: '1px solid rgba(43,39,34,.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ font: `500 12px ${MONO}`, color: '#9a917f' }}>Argus v2 · Workspace — 제안용 쇼케이스</span>
          <span style={{ font: `500 12px ${MONO}`, color: '#a87d31' }}>3D chart · ship markers · crew</span>
        </footer>
      </div>
    </div>
  );
}
