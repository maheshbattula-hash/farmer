import Constants from "expo-constants";

type ExpoConfigWithHost = {
  hostUri?: string;
};

type ExpoGoConfigWithDebuggerHost = {
  debuggerHost?: string;
};

function extractHost(candidate?: string | null): string | null {
  if (!candidate) {
    return null;
  }

  const normalized = candidate.replace(/^https?:\/\//, "").replace(/^exp:\/\//, "").trim();
  if (!normalized) {
    return null;
  }

  const host = normalized.split(/[/:?]/)[0]?.trim();
  return host || null;
}

function sanitizeManualUrl(candidate: string): string {
  const trimmed = candidate.trim().replace(/\/$/, "");
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function normalizeApiUrl(candidate: string): string {
  const sanitized = sanitizeManualUrl(candidate);
  if (!sanitized) {
    return "";
  }

  try {
    const url = new URL(sanitized);
    // Only force port 8000 for localhost / raw IP addresses.
    // Tunnel URLs (ngrok, Cloudflare, etc.) use standard HTTPS port 443
    // and must NOT have a port appended.
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      /^10\./.test(url.hostname) ||
      /^192\.168\./.test(url.hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname);

    if (isLocal && (!url.port || url.port === "3000")) {
      url.port = "8000";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return sanitized;
  }
}

export function resolveApiUrl(): string {
  // If running in a browser on localhost / 127.0.0.1, connect directly to local API
  if (typeof window !== "undefined" && window.location) {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return `http://${window.location.hostname}:8000`;
    }
  }

  const manualUrl = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL || "");

  const host =
    extractHost((Constants.expoConfig as ExpoConfigWithHost | null)?.hostUri) ||
    extractHost((Constants.expoGoConfig as ExpoGoConfigWithDebuggerHost | null)?.debuggerHost) ||
    extractHost((Constants.platform as ExpoConfigWithHost | null)?.hostUri);

  const activeTunnelUrl = "https://said-dedicated-vehicles-patients.trycloudflare.com";

  if (manualUrl && !manualUrl.includes("popularity-cabin")) {
    // If running on a physical phone or Expo Go and the user has localhost/127.0.0.1 configured,
    // swap localhost with the host machine IP so requests don't fail against the phone's loopback
    if (host && (manualUrl.includes("localhost") || manualUrl.includes("127.0.0.1"))) {
      return manualUrl.replace("localhost", host).replace("127.0.0.1", host);
    }
    return manualUrl;
  }

  // When Metro is running via Expo Tunnel (exp.direct), Metro does NOT proxy port 8000.
  // We automatically route API requests to the active Cloudflare tunnel for port 8000.
  if (host && (host.includes("exp.direct") || host.includes("trycloudflare") || host.includes("loca.lt") || host.includes("ngrok"))) {
    return activeTunnelUrl;
  }

  if (host) {
    return `http://${host}:8000`;
  }

  return activeTunnelUrl;
}

export function resolveWebUrl(): string {
  const manualUrl = sanitizeManualUrl(process.env.EXPO_PUBLIC_WEB_URL || "");
  if (manualUrl) {
    return manualUrl;
  }

  const host =
    extractHost((Constants.expoConfig as ExpoConfigWithHost | null)?.hostUri) ||
    extractHost((Constants.expoGoConfig as ExpoGoConfigWithDebuggerHost | null)?.debuggerHost) ||
    extractHost((Constants.platform as ExpoConfigWithHost | null)?.hostUri);

  if (host) {
    return `http://${host}:3000`;
  }

  return "http://localhost:3000";
}

export function buildHealthUrl(webUrl: string): string {
  return `${webUrl.replace(/\/$/, "")}/healthz`;
}

export function buildConnectionHelp(webUrl: string): string {
  if (webUrl.includes("localhost") || webUrl.includes("127.0.0.1")) {
    return "Start the Next.js web app first. For a real phone, replace localhost with your computer LAN IP in apps/mobile/.env.";
  }
  return "Start the Next.js web app first, keep your phone and computer on the same Wi-Fi, then tap retry.";
}
