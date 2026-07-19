import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));
vi.mock('@/components/ui/RecordStrip', () => ({ RecordStrip: () => null }));

import { ReceiptList } from '../ReceiptList';

describe('ReceiptList navigation', () => {
  it('opens Create a draft as a fresh workspace project', () => {
    const html = renderToStaticMarkup(
      <ReceiptList receipts={[]} onOpen={() => {}} onNew={() => {}} />,
    );
    expect(html).toContain('href="/ko/workspace?new=1"');
  });
});
