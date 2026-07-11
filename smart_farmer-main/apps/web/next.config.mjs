import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");

try {
  loadEnvFile(envPath);
} catch (error) {
  if (!(error instanceof Error) || !String(error.message || "").includes("ENOENT")) {
    throw error;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
