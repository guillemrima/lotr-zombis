/**
 * Unified launcher for LOTR Zombies LAN Multiplayer:
 * 1) Starts the local LAN WebSocket & UDP Discovery Server (0.0.0.0:4300)
 * 2) Starts Angular Dev Server exposed on LAN (ng serve --host 0.0.0.0)
 */

const { spawn } = require('child_process');
const path = require('path');
const { startLanServer } = require('./lan-server');

// 1. Start LAN WebSocket & UDP Discovery Server
startLanServer();

// 2. Launch Angular Dev Server on 0.0.0.0 so both local & LAN browsers can connect
const ngBin = path.resolve(__dirname, '../node_modules/@angular/cli/bin/ng.js');
const extraArgs = process.argv.slice(2);
const hasHostArg = extraArgs.some((a) => a === '--host' || a.startsWith('--host='));
const ngArgs = [ngBin, 'serve', ...(hasHostArg ? [] : ['--host', '0.0.0.0']), ...extraArgs];

const child = spawn(process.execPath, ngArgs, {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..')
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
