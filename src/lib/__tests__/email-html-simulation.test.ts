/**
 * Email HTML Simulation — markdownToEmailHtml 순수함수 검증
 *
 * 핵심 검증 (보안 최우선): 결과물은 사용자 입력 + LLM 출력이므로 HTML 이스케이프가
 * 먼저 일어나 실행 가능한 태그가 절대 새지 않아야 한다. 그 위에 가벼운 마크다운
 * (헤딩/볼드/불릿) 렌더가 얹힌다.
 */
import { describe, it, expect } from 'vitest';
import { markdownToEmailHtml } from '@/lib/email-html';

describe('Email HTML Simulation', () => {
  describe('XSS / escaping (보안)', () => {
    it('script 태그를 실행 불가능하게 이스케이프한다', () => {
      const html = markdownToEmailHtml('T', 'hello <script>alert(1)</script> world');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('이미지 onerror 등 속성 주입을 무력화한다', () => {
      const html = markdownToEmailHtml('T', '<img src=x onerror=alert(1)>');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img');
    });

    it('제목의 HTML도 이스케이프한다', () => {
      const html = markdownToEmailHtml('<b>boom</b>', 'body');
      // 제목 영역에 raw <b>boom</b> 가 들어가면 안 된다
      expect(html).not.toContain('<b>boom</b>');
      expect(html).toContain('&lt;b&gt;boom');
    });

    it('인용부호/앰퍼샌드를 이스케이프한다', () => {
      const html = markdownToEmailHtml('T', `a & b "c" 'd'`);
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;');
      expect(html).toContain('&#39;');
    });
  });

  describe('마크다운 렌더', () => {
    it('헤딩을 굵은 단락으로 변환한다', () => {
      const html = markdownToEmailHtml('T', '# Big\n## Mid\n### Small');
      expect(html).toContain('font-weight:700');
      expect(html).toMatch(/Big/);
    });

    it('불릿을 <ul><li>로 묶는다', () => {
      const html = markdownToEmailHtml('T', '- one\n- two');
      expect(html).toContain('<ul');
      expect(html).toContain('<li');
      expect(html).toContain('one');
      expect(html).toContain('two');
    });

    it('**볼드**를 <strong>으로 변환한다', () => {
      const html = markdownToEmailHtml('T', 'this is **bold** here');
      expect(html).toContain('<strong>bold</strong>');
    });

    it('`code`를 <code>로 변환한다', () => {
      const html = markdownToEmailHtml('T', 'run `npm test` now');
      expect(html).toContain('<code');
      expect(html).toContain('npm test');
    });

    it('볼드 마크가 닫는 태그를 깨지 않는다 (이스케이프 후 변환 순서)', () => {
      const html = markdownToEmailHtml('T', '**<b>x</b>**');
      // <b> 는 이스케이프되고, ** 만 strong 으로
      expect(html).toContain('<strong>&lt;b&gt;x&lt;/b&gt;</strong>');
    });
  });

  describe('구조 / 한계', () => {
    it('Argus 헤더와 푸터를 포함한다', () => {
      const html = markdownToEmailHtml('My Title', 'body');
      expect(html).toContain('Argus');
      expect(html).toContain('My Title');
      expect(html).toContain('argus.voyage');
    });

    it('원장 DNA: 세리프 제목, 고정폭 표식, 얇은 괘선, 다크 대응을 포함한다', () => {
      const html = markdownToEmailHtml('My Title', 'body');
      expect(html).toContain("Georgia,'Times New Roman',serif");
      expect(html).toContain("'SFMono-Regular',Consolas");
      expect(html).toContain('border-top:1px solid');
      expect(html).toContain('prefers-color-scheme: dark');
      expect(html).toContain('No score. No AI verdict.');
    });

    it('빈 본문도 깨지지 않는다', () => {
      const html = markdownToEmailHtml('T', '');
      expect(typeof html).toBe('string');
      expect(html).toContain('Argus');
    });

    it('초장문 본문을 4만자에서 절삭한다', () => {
      const huge = 'x'.repeat(60_000);
      const html = markdownToEmailHtml('T', huge);
      // 원문 6만자가 그대로 들어가지 않는다
      expect(html.length).toBeLessThan(55_000);
    });
  });
});
