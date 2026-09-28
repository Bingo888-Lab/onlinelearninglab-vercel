import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];

// 不打印任何值：只报「哪个变量缺失 / 是否填了占位符」。
const PLACEHOLDERS = /^(changeme|xxx|todo|your-|example|<)/i;

function readLocalEnv() {
  return readFile(resolve(process.cwd(), ".env.local"), "utf8").catch(() => "");
}

export function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const name = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[name] = value;
  }
  return env;
}

export function findEnvProblems(env) {
  const problems = [];
  for (const name of REQUIRED) {
    const value = env[name];
    if (value === undefined) problems.push(`${name}: 未设置`);
    else if (value === "") problems.push(`${name}: 为空`);
    else if (PLACEHOLDERS.test(value)) problems.push(`${name}: 仍是占位符`);
  }
  return problems;
}

async function main() {
  const explicit = process.argv[2];
  const env = explicit ? parseEnv(await readFile(resolve(explicit), "utf8")) : parseEnv(await readLocalEnv());

  if (Object.keys(env).length === 0) {
    console.error("未找到 .env.local。先执行：cp .env.example .env.local 并填入真实值。");
    process.exit(1);
  }

  const problems = findEnvProblems(env);
  if (problems.length > 0) {
    console.error("环境变量检查未通过：");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log(`环境变量检查通过（${REQUIRED.length} 项，值未打印）。`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
