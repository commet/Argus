# Handoff — Hero Voyage Film (2026-06-24)

The landing hero plays a cinematic film of Odysseus's Sirens voyage — framing
"AI = the omniscient-sounding Sirens; here is how to pass it and reach a better
decision." The user generated 5 clips with Veo; we stitched them, placed the film
full-bleed in the hero, and overlaid meaning captions.

## Branch / status
- Work branch: **`feat/3phase-integration`** (shared worktree — the checked-out
  branch can change between sessions; always check `git rev-parse --abbrev-ref HEAD`).
- Pushed; tsc/eslint/related tests green. Headless Playwright cannot screenshot a
  *playing* `<video>` (the media clock doesn't advance) — verify live on dev `/ko`.
  Caption design was validated by burning frames with ffmpeg.

## What was built
**The film**
- `public/voyage/voyage-film.mp4` — deployed (muted, ~8.8 MB), 5 clips stitched
  (sail → 묶기 → 듣기 → 닿기 → dog) with ink-dissolve crossfades.
- `public/voyage/voyage-poster.jpg` — poster (the ship).
- Masters/sources are NOT in git — in
  `C:\Users\admin\.claude\uploads\8dabf5a9-9bfb-4bd2-a60d-34072cfbf8c1\`:
  - 5 Veo clips: `7ab3f596…galley(sail)`, `efa2fc92…mast(bind)`,
    `8195887a…Sirens(listen)`, `a322ae15…arrival(land)`, `55e05550…dog`.
  - `voyage-film-v2.mp4` = **master with audio** (re-edit from this).
  - `voyage-captioned.mp4` = KO burned-caption preview. `scrim.png` + `*_*.txt` for
    previews. **ffmpeg is installed** (scoop; uses `malgun.ttf` / `malgunbd.ttf`).

**Code**
- `src/components/landing/films/VoyageFilm.tsx` — the `<video>` (autoplay/muted/
  loop) + caption system. `INTRO` over the opening sail + `CHAPTERS[4]`
  (묶기 I / 듣기 II / 닿기 III / 종장-dog). Synced to `currentTime`
  (timeupdate/seeked); `?cap=N` or `?cap=intro` force a caption for preview.
  Heading ("Ⅰ · 묶기" / "종장") + **quote (serif italic, quoted)** + **service
  copy (Pretendard sans)** + **dot progress** (not a word rail). Siren line only is
  red (`--bp-lure`). Dark mode inverts the film via `.bp-voyage-video`.
- `src/components/landing/SirenHero.tsx` — film placed full-bleed (desktop 56vh,
  mobile native 16:9); headline above, input below.
- `src/app/globals.css` — `.bp-voyage-video` (dark invert), `--bp-lure`
  (light `#a4452f` / dark `#cf6e54`), plus the voyage animations.
- `src/proxy.ts` — **bugfix**: static-asset matcher now excludes mp4/webm/audio/
  fonts (otherwise `/voyage/*.mp4` was 307-redirected under a locale and never served).
- `src/app/[locale]/page.tsx` — composes the hero + the 3-leg band below.

**(Already on the branch, earlier)** the 3-leg band `VoyagePhases.tsx`
(+ `public/voyage/{bind,listen,land}.png` = Flaxman/Siren-vase engraving masks),
workspace `VoyagePhaseRail.tsx`, Act2 Arrival verdict → neutral crux question.

## Final caption copy (current code)
- **Intro**: 세이렌은 "내가 다 알려줄게" 노래로 뱃사람을 홀렸습니다 — 지금의 AI처럼.
  오디세우스는, 휩쓸리지 않고 지나는 법을 알았죠.
- **I 묶기** — *"나를 돛대에 묶어라. 풀어달라 빌어도, 더 단단히."* / 묻기 전에, 지금
  당신이 어느 쪽으로 기울었는지부터 적어 둬요. AI의 유창한 답에 흔들리지 않게.
- **II 듣기 (red)** — *"이리 와 들으라. 우리 노래를 들은 자는, 세상 모든 일을 알고
  떠나리라."* / AI는 "좋아 보여요" 대신, 당신이 놓친 단 하나를 짚어줘요. 결정은 끝까지
  당신 몫이고요.
- **III 닿기** — *"노래가 잦아들고, 마침내 단단한 땅에 발을 디딘다."* / AI는 거들 뿐,
  결정은 현실의 당신 몫이에요. 그 한 걸음을 또렷하게 내딛도록.
- **종장 (dog)** — *"스러져 가던 늙은 개만이, 옛 주인을 알아보았다."* / 정한 날 Argus가
  돌아와 물어요 — "그래서, 어떻게 됐어요?" 현실로 확인한 판단이 쌓여, 당신만의 판단력이 됩니다.

EN strings live alongside each (myth = archaic/Pope tone; service = clean modern).

## Open items / next steps
1. **Font (key)**: user kept the heavy (myth+meaning) captions but wanted a font
   change. Current guess: quotes = Noto Serif KR italic, intro + service =
   Pretendard sans. The previews the user saw were Malgun (ffmpeg), not the live
   serif — **confirm the intended font on dev `/ko`.**
2. **Input placement / conversion**: full-bleed film pushes the LOG ENTRY input
   below the fold. Recommended a slim input overlaid on the film's lower edge —
   not yet built.
3. **Korean italic** on quotes is synthetic (Noto Serif KR) — may look off; option
   to drop italic for KO only.
4. **Redundancy**: the film captions and the 3-leg band below explain the same
   묶기/듣기/닿기. User kept both (heavy); revisit later if it feels repetitive.
5. **Caption timing**: `CHAPTERS` `from/to` are tuned to the 40 s film — **re-tune
   if the film is re-edited.**
6. **Live verification** on dev `/ko` (headless can't screenshot the playing video).

## Quick resume
- Re-edit film: ffmpeg-xfade from `voyage-film-v2.mp4` (or the 5 clips) → refresh
  muted web `public/voyage/voyage-film.mp4` → re-tune caption windows.
- Preview captions: `?cap=0..3` / `?cap=intro`, or burn frames with ffmpeg +
  `scrim.png` + malgun.
- Always: check branch → tsc/eslint → small commits/push.
