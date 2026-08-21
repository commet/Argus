#!/usr/bin/env node
import { createServer } from './server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  if (process.argv[2] === 'connect') {
    const { connectAccount } = await import('./a0/account-connect.js');
    await connectAccount({ headless: process.argv.includes('--headless') });
    return;
  }
  if (process.argv[2] === 'disconnect') {
    const { disconnectStoredAccount } = await import('./a0/account-credentials.js');
    disconnectStoredAccount();
    process.stdout.write('Local Argus account credential removed. Revoke the device in Settings to invalidate its server token.\n');
    return;
  }
  if (process.argv[2] === 'capture-scan') {
    const { runCaptureCli } = await import('./v2/capture-cli.js');
    await runCaptureCli(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === 'dec-scan-rules') {
    const { runDecScanRulesCli } = await import('./dec/dec-cli.js');
    runDecScanRulesCli(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === 'dec-sync') {
    const { runDecSyncCli } = await import('./dec/dec-cli.js');
    runDecSyncCli(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === 'dec-verify') {
    const { runDecVerifyCli } = await import('./dec/dec-cli.js');
    runDecVerifyCli(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === 'capture-drain') {
    const { runCaptureDrainCli } = await import('./v2/capture-cli.js');
    await runCaptureDrainCli(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === 'capture-status') {
    const { runCaptureStatusCli } = await import('./v2/capture-cli.js');
    runCaptureStatusCli(process.argv.slice(3));
    return;
  }
  if (process.argv[2] === 'capture-purge') {
    const { runCapturePurgeCli } = await import('./v2/capture-cli.js');
    runCapturePurgeCli(process.argv.slice(3));
    return;
  }
  if (['archive-export', 'archive-restore', 'local-purge'].includes(process.argv[2] ?? '')) {
    const { runLifecycleCli } = await import('./v2/lifecycle-cli.js');
    runLifecycleCli(process.argv[2]!, process.argv.slice(3));
    return;
  }
  // 사람이 직접 쳤을 때의 첫 화면 (2026-07-30): help 요청이거나 stdin 이
  // 키보드(TTY)면 조용히 매달리는 대신 연결 안내를 보여주고 끝낸다.
  // 호스트는 파이프로 띄우므로 여기 걸리지 않는다. --stdio 로 강제 서버 가능.
  const wantsHelp = ['help', '--help', '-h'].includes(process.argv[2] ?? '');
  const { isHumanTerminal, buildFirstRunHelp } = await import('./lib/first-run-help.js');
  if (wantsHelp || (isHumanTerminal() && !process.argv.includes('--stdio'))) {
    process.stdout.write(buildFirstRunHelp() + '\n');
    return;
  }
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
