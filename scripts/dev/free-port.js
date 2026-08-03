const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function readPortFromEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return null;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key === 'API_PORT') {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

function getPort() {
  const fromEnv = Number.parseInt(process.env.API_PORT || '', 10);
  if (Number.isFinite(fromEnv)) {
    return fromEnv;
  }

  return readPortFromEnvFile() ?? 8000;
}

function getListeningPids(port) {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `@(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) -join " "`,
        ],
        { encoding: 'utf8' },
      );

      return output
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value));
    }

    const output = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value));
  } catch {
    return [];
  }
}

function waitForPortRelease(port) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    if (getListeningPids(port).length === 0) {
      return true;
    }
  }

  return false;
}

function stopPid(pid, signal, port) {
  try {
    process.kill(pid, signal);
    console.log(`Freed port ${port} by stopping PID ${pid} with ${signal}.`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to stop PID ${pid} on port ${port} with ${signal}: ${message}`);
    return false;
  }
}

function main() {
  const port = getPort();
  const pids = getListeningPids(port).filter((pid) => pid !== process.pid);

  if (pids.length === 0) {
    return;
  }

  for (const pid of pids) {
    stopPid(pid, 'SIGTERM', port);
  }

  if (waitForPortRelease(port)) {
    return;
  }

  const remainingPids = getListeningPids(port).filter((pid) => pid !== process.pid);
  for (const pid of remainingPids) {
    stopPid(pid, 'SIGKILL', port);
  }

  if (!waitForPortRelease(port)) {
    console.warn(`Port ${port} is still busy after cleanup attempt.`);
  }
}

main();
