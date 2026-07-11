const { execFileSync } = require("node:child_process");

const port = Number.parseInt(process.env.EXPO_PORT || "8081", 10);

function getPids(targetPort) {
  try {
    if (process.platform === "win32") {
      const output = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `@(Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique) -join " "`,
        ],
        { encoding: "utf8" },
      );

      return output
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value));
    }

    const output = execFileSync("lsof", ["-ti", `tcp:${targetPort}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
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

function stopPid(pid, signal) {
  try {
    process.kill(pid, signal);
    console.log(`Freed Expo port ${port} by stopping PID ${pid} with ${signal}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to stop PID ${pid}: ${message}`);
  }
}

function waitForPortRelease(targetPort) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    if (getPids(targetPort).length === 0) {
      return true;
    }
  }

  return false;
}

const pids = getPids(port).filter((pid) => pid !== process.pid);
for (const pid of pids) {
  stopPid(pid, "SIGTERM");
}

if (!waitForPortRelease(port)) {
  for (const pid of getPids(port).filter((value) => value !== process.pid)) {
    stopPid(pid, "SIGKILL");
  }
  waitForPortRelease(port);
}
