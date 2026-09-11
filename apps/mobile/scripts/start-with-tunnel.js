#!/usr/bin/env node
/**
 * start-with-tunnel.js
 * Starts Expo in LAN mode on port 8081, then opens a localtunnel
 * so the app can be reached from any network (4G, etc.) without ngrok.
 *
 * Usage:  node scripts/start-with-tunnel.js
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const METRO_PORT = 8081;
const ROOT = path.join(__dirname, '..');

// Free port 8081 first
try {
  execSync(`node "${path.join(__dirname, 'free-expo-port.js')}"`, { stdio: 'inherit' });
} catch (_) {}

async function openTunnel() {
  const localtunnel = require('localtunnel');
  console.log('\n🌐  Opening localtunnel to http://localhost:' + METRO_PORT + ' ...');
  const tunnel = await localtunnel({ port: METRO_PORT });
  return tunnel;
}

async function main() {
  // Start Expo first in background (LAN mode), then open tunnel
  console.log('🚀  Starting Expo Metro bundler (LAN mode)...');

  const expo = spawn('npx', ['expo', 'start', '--lan'], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env },
  });

  // Wait a few seconds for Metro to start before opening tunnel
  await new Promise((resolve) => setTimeout(resolve, 8000));

  let tunnel;
  try {
    tunnel = await openTunnel();
    const publicUrl = tunnel.url;

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  ✅  TUNNEL READY — scan QR or enter URL in Expo  ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  Public URL: ' + publicUrl.padEnd(37) + '║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('\n📱  In Expo Go, tap "Enter URL manually" and paste:');
    console.log('   exp+smart-farmer-app://' + publicUrl.replace('https://', '') + '\n');

    tunnel.on('error', (err) => console.error('Tunnel error:', err.message));
    tunnel.on('close', () => console.log('\nTunnel closed.'));
  } catch (err) {
    console.error('\n⚠️  localtunnel failed:', err.message);
    console.log('   Running in LAN mode only — connect phone to same WiFi.\n');
  }

  // Now pipe Expo output to console
  expo.stdout.pipe(process.stdout);
  expo.stderr.pipe(process.stderr);

  expo.on('close', (code) => {
    if (tunnel) tunnel.close();
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    if (tunnel) tunnel.close();
    expo.kill('SIGINT');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
