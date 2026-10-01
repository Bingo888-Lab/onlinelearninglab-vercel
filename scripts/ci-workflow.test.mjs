import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const playwright = readFileSync("playwright.config.ts", "utf8");
const envCheck = readFileSync("scripts/check-env.mjs", "utf8");

function sectionBetween(text, start, end) {
  const startAt = text.indexOf(start);
  expect(startAt, `missing section: ${start}`).toBeGreaterThanOrEqual(0);
  const endAt = text.indexOf(end, startAt + start.length);
  return text.slice(startAt, endAt < 0 ? text.length : endAt);
}

describe("CI E2E workflow safety (static configuration checks)", () => {
  it("preserves main push/PR checks and requires explicit manual E2E confirmation", () => {
    expect(workflow).toMatch(/^  push:\s*\r?\n    branches: \[main\]/m);
    expect(workflow).toMatch(/^  pull_request:\s*\r?\n    branches: \[main\]/m);
    expect(workflow).toMatch(
      /workflow_dispatch:\s*\r?\n    inputs:\s*\r?\n      run_e2e:\s*\r?\n[\s\S]*?        type: boolean\s*\r?\n        required: true\s*\r?\n        default: false/m,
    );
    expect(workflow).toMatch(
      /if:\s*github\.event_name == 'workflow_dispatch' && inputs\.run_e2e == true/,
    );
  });

  it("keeps PR checks independent of secrets and maps every E2E value to a dedicated secret", () => {
    const checksJob = sectionBetween(workflow, "  checks:", "  e2e:");
    expect(checksJob).not.toMatch(/secrets\./);

    const e2eStart = workflow.indexOf("  e2e:");
    expect(e2eStart).toBeGreaterThanOrEqual(0);
    const e2eJob = workflow.slice(e2eStart);
    const secretBindings = [
      "NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.E2E_SUPABASE_URL }}",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.E2E_SUPABASE_PUBLISHABLE_KEY }}",
      "SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.E2E_SUPABASE_SERVICE_ROLE_KEY }}",
      "R2_ACCOUNT_ID: ${{ secrets.E2E_R2_ACCOUNT_ID }}",
      "R2_BUCKET: ${{ secrets.E2E_R2_BUCKET }}",
      "R2_ACCESS_KEY_ID: ${{ secrets.E2E_R2_ACCESS_KEY_ID }}",
      "R2_SECRET_ACCESS_KEY: ${{ secrets.E2E_R2_SECRET_ACCESS_KEY }}",
    ];

    for (const binding of secretBindings) expect(e2eJob).toContain(binding);
    expect(e2eJob.match(/\$\{\{\s*secrets\.[^}]+\s*\}\}/g)).toHaveLength(secretBindings.length);
    expect(e2eJob).not.toMatch(/secrets\.(?!E2E_)/);
    expect(e2eJob).not.toMatch(/\|\|\s*[^\n]+/);
  });

  it("checks the generated environment before build and E2E with no failure bypass", () => {
    const e2eStart = workflow.indexOf("  e2e:");
    expect(e2eStart).toBeGreaterThanOrEqual(0);
    const e2eJob = workflow.slice(e2eStart);
    const orderedSteps = [
      "- name: Write .env.local from E2E secrets",
      "- name: Check E2E environment",
      "- name: Build with E2E environment",
      "- name: E2E",
    ].map((step) => {
      const index = e2eJob.indexOf(step);
      expect(index, `missing step: ${step}`).toBeGreaterThanOrEqual(0);
      return index;
    });

    expect(orderedSteps).toEqual([...orderedSteps].sort((a, b) => a - b));
    const guardedSequence = e2eJob.slice(orderedSteps[0], orderedSteps.at(-1));
    expect(guardedSequence).not.toMatch(/if:\s*always\(\)|continue-on-error:\s*true/);
    expect(e2eJob).toMatch(/: > \.env\.local/);
    expect(e2eJob).toMatch(/- name: Build with E2E environment\s+run: pnpm build/);
    expect(e2eJob).toMatch(/- name: E2E\s+run: pnpm e2e/);
    expect(envCheck).toMatch(/resolve\(process\.cwd\(\), "\.env\.local"\)/);
    expect(playwright).toMatch(/parseEnvFile\("\.env\.local"\)/);
    expect(playwright).toMatch(/command:\s*"[^"]*pnpm start"/);
  });

  it("keeps Playwright reset opt-in scoped to webServer.env", () => {
    const webServer = sectionBetween(playwright, "  webServer:", "\n  }");
    expect(webServer).toMatch(/command:\s*"node scripts\/reset-e2e\.mjs[^"]*"/);
    expect(webServer).toMatch(/env:\s*\{[\s\S]*\.\.\.env,[\s\S]*E2E_ALLOW_REMOTE_RESET:\s*"1"[\s\S]*\}/);
    expect(workflow).not.toMatch(/E2E_ALLOW_REMOTE_RESET/);
  });
});
