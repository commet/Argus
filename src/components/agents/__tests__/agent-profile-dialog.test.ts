import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../AgentProfile.tsx', import.meta.url), 'utf8');

describe('AgentProfile dialog lifecycle', () => {
  it('keeps focus stable across parent renders and locks background scrolling', () => {
    expect(source).toContain('const onCloseRef = useRef(onClose)');
    expect(source).toContain("document.body.style.overflow = 'hidden'");
    expect(source).toContain('document.body.style.overflow = previousOverflow');
    expect(source).toContain('}, []);');
    expect(source).not.toContain('}, [onClose]);');
  });
});
