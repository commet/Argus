import fs from 'node:fs';
import path from 'node:path';
import { evaluateP5 } from '../src/v3/p5-gate.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run eval:p5 -- <p5-results.json>');
  process.exitCode = 2;
} else {
  try {
    const input = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as unknown;
    const report = evaluateP5(input);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exitCode = report.status === 'no_go' ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
