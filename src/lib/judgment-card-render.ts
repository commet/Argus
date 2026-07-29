import { CARD_STRINGS, type JudgmentCardData } from './judgment-card';

/**
 * 판단 카드를 캔버스에 그린다. 그리기만 한다.
 *
 * 이 파일은 `judgment-card.ts` 가 만든 값만 받는다 — 여기서 문장을 만들거나
 * 네트워크를 타지 않는다. 왜 그렇게까지 하는지는 그쪽 파일 머리말에 있다.
 *
 * 외부 폰트를 쓰지 않는 이유: 공유 이미지가 CSP 나 오프라인에서 조용히 다른
 * 폰트로 렌더되면, 사용자가 본 카드와 남이 받은 카드가 달라진다. 시스템 스택만 쓴다.
 */

const W = 1080;
const H = 1350;
const PAD = 88;

const FONT = `'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', 'Malgun Gothic', sans-serif`;

const INK = '#f2f0ea';
const DIM = '#8b8b96';
const GOLD = '#c9a227';
const BG_TOP = '#12121a';
const BG_BOTTOM = '#0a0a10';

/** 캔버스에는 자동 줄바꿈이 없다. 한글은 단어 경계가 드물어 글자 단위로 자른다. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    const next = line + ch;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function authorshipLabel(data: JudgmentCardData, locale: 'ko' | 'en'): string {
  const S = CARD_STRINGS[locale];
  if (data.authorship === 'user') return S.byUser;
  if (data.authorship === 'ai_surfaced') return S.byAi;
  return S.byUnknown;
}

/**
 * 카드를 그려 PNG blob 을 돌려준다.
 *
 * 본문 크기는 문장 길이에 따라 줄인다. 잘라내지 않는 이유: 봉인 문장은 사용자가
 * 확정한 바로 그 한 줄이라, 말줄임표로 끝나면 **다른 문장이 된다.** 길면 작게
 * 쓸지언정 자르지 않는다.
 */
export async function renderJudgmentCard(data: JudgmentCardData, locale: 'ko' | 'en' = 'ko'): Promise<Blob> {
  const S = CARD_STRINGS[locale];
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  // 배경
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 위쪽 금색 실선 — 브랜드 표식 하나로 족하다.
  ctx.fillStyle = GOLD;
  ctx.fillRect(PAD, PAD, 96, 3);

  ctx.textBaseline = 'top';

  // 워드마크
  ctx.font = `600 26px ${FONT}`;
  ctx.fillStyle = GOLD;
  ctx.letterSpacing = '4px';
  ctx.fillText('ARGUS', PAD, PAD + 28);
  ctx.letterSpacing = '0px';

  // 봉인한 날
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = DIM;
  ctx.fillText(S.sealedOn(data.sealedOn), PAD, PAD + 84);

  let y = PAD + 190;
  const maxW = W - PAD * 2;

  // 상황 한 줄 (있을 때만)
  if (data.context) {
    ctx.font = `400 28px ${FONT}`;
    ctx.fillStyle = DIM;
    const ctxLines = wrap(ctx, data.context, maxW).slice(0, 2);
    for (const l of ctxLines) { ctx.fillText(l, PAD, y); y += 42; }
    y += 34;
  }

  // 본문 — 봉인 문장. 카드의 전부.
  const bodySize = data.statement.length > 160 ? 44 : data.statement.length > 90 ? 52 : 60;
  ctx.font = `600 ${bodySize}px ${FONT}`;
  ctx.fillStyle = INK;
  const bodyLines = wrap(ctx, data.statement, maxW);
  const lineH = Math.round(bodySize * 1.5);
  for (const l of bodyLines) { ctx.fillText(l, PAD, y); y += lineH; }

  // 출처 표기 — 흐리게 쓰되 **빼지는 않는다**. 기계 문장을 사람 문장처럼
  // 유통시키지 않는 것이 이 카드의 유일한 무거운 약속이다.
  y += 26;
  ctx.font = `500 25px ${FONT}`;
  ctx.fillStyle = data.authorship === 'user' ? DIM : GOLD;
  ctx.fillText(authorshipLabel(data, locale), PAD, y);

  // 아래쪽 — 확인일. 이 제품이 다른 어떤 결과물 이미지와도 다르게 생긴 지점.
  const footerTop = H - PAD - 190;
  ctx.fillStyle = '#26262f';
  ctx.fillRect(PAD, footerTop, maxW, 1);

  ctx.font = `700 46px ${FONT}`;
  ctx.fillStyle = data.checkOn ? GOLD : DIM;
  const closing = data.checkOn ? S.checkOn(data.checkOn) : S.noCheck;
  const closingLines = wrap(ctx, closing, maxW);
  let cy = footerTop + 46;
  for (const l of closingLines) { ctx.fillText(l, PAD, cy); cy += 60; }

  ctx.font = `500 25px ${FONT}`;
  ctx.fillStyle = DIM;
  ctx.fillText('argus.voyage', PAD, H - PAD - 30);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
  });
}

/** 파일명은 확인일을 담는다 — 저장 폴더에서도 "언제 답이 오는지"가 보이게. */
export function judgmentCardFilename(data: JudgmentCardData): string {
  return `argus-${data.checkOn ?? data.sealedOn}.png`;
}
