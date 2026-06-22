/**
 * Telegram Format Simulation — markdownToTelegramHtml 순수함수 검증
 *
 * Telegram sendMessage(parse_mode:'HTML')의 허용 태그(<b><i><code>…)만 내보내고,
 * 사용자/LLM 콘텐츠의 <,>,&는 먼저 이스케이프해 파싱 오류·주입을 막는다.
 * 4096자 하드리밋 아래로 예산을 잡는다.
 */
import { describe, it, expect } from 'vitest';
import { markdownToTelegramHtml } from '@/lib/telegram-format';

describe('Telegram Format Simulation', () => {
  describe('이스케이프 (보안)', () => {
    it('raw HTML 태그를 이스케이프한다', () => {
      const out = markdownToTelegramHtml('T', 'x <script>bad</script> y');
      expect(out).not.toContain('<script>');
      expect(out).toContain('&lt;script&gt;');
    });

    it('앰퍼샌드를 이스케이프한다', () => {
      const out = markdownToTelegramHtml('T', 'tom & jerry');
      expect(out).toContain('&amp;');
    });

    it('제목의 HTML도 이스케이프한다', () => {
      const out = markdownToTelegramHtml('<i>hi</i>', 'body');
      expect(out).toContain('&lt;i&gt;hi&lt;/i&gt;');
    });
  });

  describe('변환', () => {
    it('제목을 굵게 첫 줄에 둔다', () => {
      const out = markdownToTelegramHtml('Report', 'body');
      expect(out.startsWith('<b>Report</b>')).toBe(true);
    });

    it('헤딩을 <b>로 변환한다', () => {
      const out = markdownToTelegramHtml('T', '## Section');
      expect(out).toContain('<b>Section</b>');
    });

    it('불릿을 •로 변환한다', () => {
      const out = markdownToTelegramHtml('T', '- item one');
      expect(out).toContain('• item one');
    });

    it('**볼드**를 <b>로 변환한다', () => {
      const out = markdownToTelegramHtml('T', 'a **strong** b');
      expect(out).toContain('<b>strong</b>');
    });

    it('`code`를 <code>로 변환한다', () => {
      const out = markdownToTelegramHtml('T', 'use `x` here');
      expect(out).toContain('<code>x</code>');
    });

    it('Argus 서명을 붙인다', () => {
      const out = markdownToTelegramHtml('T', 'body');
      expect(out).toContain('— Argus');
    });
  });

  describe('한계', () => {
    it('4096자 하드리밋 아래로 절삭한다', () => {
      const out = markdownToTelegramHtml('T', 'y'.repeat(8000));
      expect(out.length).toBeLessThanOrEqual(3850);
      expect(out.endsWith('…')).toBe(true);
    });

    it('빈 본문도 깨지지 않는다', () => {
      const out = markdownToTelegramHtml('T', '');
      expect(out).toContain('<b>T</b>');
    });
  });
});
