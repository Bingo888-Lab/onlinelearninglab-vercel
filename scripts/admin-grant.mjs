/**
 * 把某个已有账号提权为 admin。
 *
 * 用法：pnpm admin:grant --email you@example.com
 *
 * 设计约束：密码不经过这个脚本。用户先在 Supabase Dashboard 用 Add user 建号
 * （勾 Auto Confirm），再跑本脚本改 profiles.role。
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { parseEnv, findEnvProblems } from "./check-env.mjs";

function readArg(name) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? undefined : argv[index + 1];
}

const email = readArg("email")?.trim().toLowerCase();
if (!email) {
  console.error("用法：pnpm admin:grant --email you@example.com");
  process.exit(1);
}

const env = parseEnv(await readFile(".env.local", "utf8"));
const problems = findEnvProblems(env);
if (problems.length > 0) {
  console.error("环境变量检查未通过：");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: userList, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) {
  console.error(`读取用户列表失败：${listError.message}`);
  process.exit(1);
}

const user = userList.users.find((candidate) => candidate.email?.toLowerCase() === email);
if (!user) {
  console.error(`未找到用户 ${email}。请先在 Supabase Dashboard → Authentication → Users 里 Add user 并勾选 Auto Confirm。`);
  process.exit(1);
}

const { error: updateError } = await supabase
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", user.id);

if (updateError) {
  console.error(`提权失败：${updateError.message}`);
  process.exit(1);
}

console.log(`已把 ${email} 的角色设为 admin。现在可以用该账号登录 /admin。`);
