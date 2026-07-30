/**
 * ClauseText — the ONE way landing copy is rendered.
 *
 * Every "이거 왜 이상한 데서 잘려?" report on this page traces to the same
 * cause: the copy was handed to the browser as a plain string and broken
 * wherever the line filled up. See src/lib/clause-split.ts for the full
 * diagnosis; this component is the rendering half of the fix.
 *
 * Three layers, and every landing text block gets all three:
 *   1. authored "\n"  → a hard break the writer chose (rendered as <br />)
 *   2. clause units   → inline-block atoms, so an automatic break can ONLY land
 *                       on a clause boundary, never inside one
 *   3. text-wrap      → `pretty` by default; `balance` where it earns its keep
 *
 * On layer 3: `balance` is right for a HEADING or a centred lead — it evens the
 * lines instead of filling line 1 and dangling the remainder ("애매하게 끊겨서
 * 두번째 줄에" is exactly a fill-then-dangle). It is wrong for body copy in a
 * narrow column: balance minimises the widest line, so in a ~200px card column
 * it pulled a two-line tap-back into three short ones. Body text gets `pretty`
 * (which only fixes the orphaned last line) and lets the clause atoms do the
 * real work; headings opt into `balance` explicitly.
 *
 * Do not hand-roll a `text.split('\n').map(<br/>)` again — that is layer 1 only,
 * which is what kept regressing.
 */

import { Fragment } from 'react';
import type { CSSProperties, ElementType } from 'react';
import { splitLines } from '@/lib/clause-split';

export function ClauseText({
  text,
  as: Tag = 'span',
  wrap = 'pretty',
  className = '',
  style,
  ...rest
}: {
  text: string;
  as?: ElementType;
  wrap?: 'balance' | 'pretty';
  className?: string;
  style?: CSSProperties;
} & Record<string, unknown>) {
  const lines = splitLines(text);
  return (
    <Tag className={className} style={{ textWrap: wrap, ...style } as CSSProperties} {...rest}>
      {lines.map((units, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {units.map((unit, ui) => (
            <Fragment key={ui}>
              {ui > 0 && ' '}
              {/* inline-block = the line-breaker places this clause whole.
                  textIndent must be reset: it is an INHERITED property, and each
                  inline-block starts its own first line, so a parent's hanging
                  indent (the seed cards use `text-indent: -0.58em` to hang the
                  opening quote) would re-apply to every unit and pull each one
                  left over the character before it — it ate the comma in
                  "이 사업, 지금 확장할까". */}
              <span style={{ display: 'inline-block', textIndent: 0 }}>{unit}</span>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </Tag>
  );
}
