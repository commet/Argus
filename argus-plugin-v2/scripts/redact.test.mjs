// Unit test for secret redaction — no API key. Run: node argus-plugin-v2/scripts/redact.test.mjs
//
// NOTE: the fake secrets below are assembled by concatenation at runtime so that no
// contiguous real-looking token literal exists in this source file — otherwise
// GitHub push-protection / secret-scanning flags the fixtures as if they were live.
import { redactSecrets, isSecretPath } from './redact.mjs';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.error(`  FAIL ${name}`); } };
const redacts = (name, input, leak) => ok(name, !redactSecrets(input).includes(leak));
const keeps = (name, input, keep) => ok(name, redactSecrets(input).includes(keep));

// assembled fixtures (split so the literal token never appears contiguously here)
const skAnt = 'sk-' + 'ant-' + 'api03-AbCdEf0123456789xyzLMNOPqrst';
const skKey = 'sk-' + 'AbCdEf0123456789GhIjKlMnOp';
const ghPat = 'gh' + 'p_' + 'AbCdEf0123456789GhIjKlMnOpQrStUv';
const awsId = 'AKIA' + 'IOSFODNN7EXAMPLE';
const slack = 'xox' + 'b-' + '1234567890-abcdefghijklmnop';
const gocspx = 'GOCSPX' + '-abcdef123456ZZ';

redacts('anthropic key', `ANTHROPIC_API_KEY=${skAnt}`, skAnt);
redacts('openai key', `use ${skKey} as the key`, skKey);
redacts('github PAT', `token ${ghPat}`, ghPat);
redacts('aws key id', `${awsId} in config`, awsId);
redacts('KEY=value env', 'DATABASE_PASSWORD=hunter2supersecret', 'hunter2supersecret');
redacts('client secret', `GOOGLE_CLIENT_SECRET: ${gocspx}`, gocspx);
redacts('url creds', 'postgres://admin:s3cretP@ss@db.host:5432/x', 's3cretP@ss');
redacts('pem block', '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----', 'MIIEpAIBAAKCAQEA0');
redacts('slack token', slack, slack);

// Must NOT over-redact ordinary content
keeps('keeps prose', 'We are deciding whether to keep the Express API.', 'Express API');
keeps('keeps git sha', 'commit a1b2c3d4e5f60718293a4b5c6d7e8f9012345678', 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678');
keeps('keeps file path', 'edit src/components/workspace/SynthesizeStep.tsx now', 'SynthesizeStep.tsx');

ok('isSecretPath .env.local', isSecretPath('.env.local'));
ok('isSecretPath id_rsa', isSecretPath('/home/u/.ssh/id_rsa'));
ok('isSecretPath normal false', !isSecretPath('src/lib/db.ts'));

console.log(`\nredact.test: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
