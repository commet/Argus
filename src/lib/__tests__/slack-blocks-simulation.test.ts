/**
 * Slack Blocks Simulation — markdownToSlackBlocks 순수함수 검증
 *
 * 핵심 검증:
 * - 헤더 블록 (title 150자 절삭)
 * - 마크다운 → Slack mrkdwn 변환 (bold, bullets, nested bullets)
 * - 긴 텍스트 청킹 (3000자 초과)
 * - 블록 상한 50개
 * - 빈 입력 / 헤딩만 / 본문만 처리
 */

import { describe, it, expect } from 'vitest';
import { markdownToSlackBlocks } from '@/lib/slack-blocks';

describe('Slack Blocks Simulation', () => {
  // ═══════════════════════════════════════
  // Header + Divider
  // ═══════════════════════════════════════
  describe('Header block', () => {
    it('returns header block with title', () => {
      const blocks = markdownToSlackBlocks('My Report', '## Section\nBody text');
      const header = blocks[0];
      expect(header.type).toBe('header');
      expect(header.text?.type).toBe('plain_text');
      expect(header.text?.text).toBe('My Report');
      expect(header.text?.emoji).toBe(true);
    });

    it('truncates title at 150 chars', () => {
      const longTitle = 'A'.repeat(200);
      const blocks = markdownToSlackBlocks(longTitle, 'body');
      expect(blocks[0].text?.text).toHaveLength(150);
      expect(blocks[0].text?.text).toBe('A'.repeat(150));
    });

    it('returns divider after header', () => {
      const blocks = markdownToSlackBlocks('Title', 'body');
      expect(blocks[1].type).toBe('divider');
    });
  });

  // ═══════════════════════════════════════
  // Heading conversion
  // ═══════════════════════════════════════
  describe('Heading conversion', () => {
    it('converts ## headings to bold section blocks', () => {
      const blocks = markdownToSlackBlocks('Title', '## My Heading');
      const headingBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text === '*My Heading*'
      );
      expect(headingBlock).toBeDefined();
      expect(headingBlock!.text?.type).toBe('mrkdwn');
    });

    it('converts ### headings to bold section blocks', () => {
      const blocks = markdownToSlackBlocks('Title', '### Sub Heading');
      const headingBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text === '*Sub Heading*'
      );
      expect(headingBlock).toBeDefined();
    });
  });

  // ═══════════════════════════════════════
  // Body text conversion
  // ═══════════════════════════════════════
  describe('Body text conversion', () => {
    it('converts body text to section blocks with mrkdwn', () => {
      const blocks = markdownToSlackBlocks('Title', 'Some plain body text');
      const bodyBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text === 'Some plain body text'
      );
      expect(bodyBlock).toBeDefined();
      expect(bodyBlock!.text?.type).toBe('mrkdwn');
    });

    it('converts **bold** to *bold* (Slack format)', () => {
      const blocks = markdownToSlackBlocks('Title', 'This is **important** text');
      const bodyBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('*important*')
      );
      expect(bodyBlock).toBeDefined();
      expect(bodyBlock!.text?.text).not.toContain('**important**');
      expect(bodyBlock!.text?.text).toContain('*important*');
    });

    it('converts - bullet to bullet character', () => {
      const blocks = markdownToSlackBlocks('Title', '- First item\n- Second item');
      const bodyBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('• First item')
      );
      expect(bodyBlock).toBeDefined();
      expect(bodyBlock!.text?.text).toContain('• Second item');
    });

    it('converts   - nested to nested bullet character', () => {
      const blocks = markdownToSlackBlocks('Title', '- Top\n  - Nested');
      const bodyBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('◦ Nested')
      );
      expect(bodyBlock).toBeDefined();
    });
  });

  // ═══════════════════════════════════════
  // Long text chunking
  // ═══════════════════════════════════════
  describe('Long text chunking', () => {
    it('chunks long text (>3000 chars) into multiple blocks', () => {
      // Create text with many lines that total > 3000 chars
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${'x'.repeat(50)}`);
      const longBody = lines.join('\n');
      expect(longBody.length).toBeGreaterThan(3000);

      const blocks = markdownToSlackBlocks('Title', longBody);
      const sectionBlocks = blocks.filter(
        (b) => b.type === 'section' && b.text?.type === 'mrkdwn'
      );
      // Should have split into more than 1 section block
      expect(sectionBlocks.length).toBeGreaterThan(1);
      // Each section text should be <= 3000 chars
      for (const block of sectionBlocks) {
        expect(block.text!.text.length).toBeLessThanOrEqual(3000);
      }
    });
  });

  // ═══════════════════════════════════════
  // Footer
  // ═══════════════════════════════════════
  describe('Footer', () => {
    it('adds footer divider + context block', () => {
      const blocks = markdownToSlackBlocks('Title', 'Body');
      const lastBlock = blocks[blocks.length - 1];
      const secondLast = blocks[blocks.length - 2];

      expect(secondLast.type).toBe('divider');
      expect(lastBlock.type).toBe('context');
      expect(lastBlock.elements).toBeDefined();
      expect(lastBlock.elements![0].text).toContain('Argus');
    });
  });

  // ═══════════════════════════════════════
  // Block cap
  // ═══════════════════════════════════════
  describe('Block cap', () => {
    it('total blocks capped at 50', () => {
      // Generate enough headings + body sections to exceed 50 blocks
      const sections = Array.from(
        { length: 60 },
        (_, i) => `## Section ${i}\nBody text for section ${i} with some content.`
      );
      const markdown = sections.join('\n');
      const blocks = markdownToSlackBlocks('Title', markdown);
      expect(blocks.length).toBeLessThanOrEqual(50);
    });
  });

  // ═══════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════
  describe('Edge cases', () => {
    it('handles empty markdown', () => {
      const blocks = markdownToSlackBlocks('Title', '');
      // Should still have header, divider, footer divider, footer context
      expect(blocks[0].type).toBe('header');
      expect(blocks[1].type).toBe('divider');
      // Last two: divider + context
      const lastBlock = blocks[blocks.length - 1];
      expect(lastBlock.type).toBe('context');
    });

    it('handles markdown with only headings', () => {
      const blocks = markdownToSlackBlocks('Title', '## Heading One\n## Heading Two');
      const sectionBlocks = blocks.filter(
        (b) => b.type === 'section' && b.text?.text?.startsWith('*')
      );
      expect(sectionBlocks.length).toBe(2);
      expect(sectionBlocks[0].text?.text).toBe('*Heading One*');
      expect(sectionBlocks[1].text?.text).toBe('*Heading Two*');
    });

    it('handles markdown with no headings (body only)', () => {
      const blocks = markdownToSlackBlocks('Title', 'Just a paragraph\nwith two lines');
      const sectionBlocks = blocks.filter((b) => b.type === 'section');
      expect(sectionBlocks.length).toBeGreaterThanOrEqual(1);
      // No bold-wrapped headings
      const boldSections = sectionBlocks.filter(
        (b) => b.text?.text?.startsWith('*') && b.text?.text?.endsWith('*')
      );
      expect(boldSections.length).toBe(0);
    });
  });
});
