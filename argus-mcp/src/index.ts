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
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch(console.error);
