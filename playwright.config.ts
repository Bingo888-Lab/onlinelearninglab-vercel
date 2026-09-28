import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnv, findEnvProblems } from "./scripts/check-env.mjs";

const env = parseEnv(readFileSync(".env.local", "utf8"));
const problems = findEnvProblems(env);
if (problems.length > 0) {
  throw new Error(
    `e2e 缺少环境变量：\n${problems.map((p) => `  - ${p}`).join("\n")}\n先执行 cp .env.example .env.local 并填入测试项目的值。`,
  );
}

export default defineConfig({
  testDir: "./e2e",
  // 远程 Supabase + R2，网络抖动是常态
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // 非 watch 命令；重置脚本必须在前缀里跑，不能放 globalSetup
    // （webServers 先启动，Windows 上会因文件句柄直接 EPERM）。
    // opt-in 环境变量走下方 webServer.env，不用 shell 前缀语法（Windows cmd 不认）。
    command: "node scripts/reset-e2e.mjs && node scripts/make-fixture-pdf.mjs && pnpm start",
    url: "http://localhost:3000/login",
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...env,
      E2E_ALLOW_REMOTE_RESET: "1",
    },
  },
});
