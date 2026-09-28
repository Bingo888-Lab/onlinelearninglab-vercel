import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const credentials = JSON.parse(readFileSync("e2e/.tmp/admin.json", "utf8")) as {
  email: string;
  password: string;
};

const FIXTURE = "e2e/fixtures/test.pdf";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByTestId("email").fill(credentials.email);
  await page.getByTestId("password").fill(credentials.password);
  await page.getByTestId("login-submit").click();
  await expect(page.getByTestId("doc-list").or(page.getByTestId("empty"))).toBeVisible();
}

test.describe.serial("admin upload → read → delete", () => {
  test("管理员可登录、上传 PDF、在线阅读、删除", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto("/admin");
    await page.setInputFiles('[data-testid="file-input"]', FIXTURE);
    await page.getByTestId("upload-submit").click();

    const progress = page.getByTestId("upload-progress");
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute("aria-valuenow", "100", { timeout: 30_000 });

    const item = page.getByTestId("admin-doc-item").filter({ hasText: "test.pdf" });
    await expect(item).toBeVisible();

    await item.getByRole("link").click();
    await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/);
    // 预签名 GET 直连 R2，iframe src 必须指向 r2.cloudflarestorage.com
    await expect(page.getByTestId("pdf-frame")).toHaveAttribute(
      "src",
      /r2\.cloudflarestorage\.com/,
    );

    const documentUrl = page.url();
    await page.goto("/admin");
    await item.getByTestId("delete-doc").click();
    await item.getByTestId("delete-confirm").click();
    await expect(page.getByTestId("admin-doc-item").filter({ hasText: "test.pdf" })).toHaveCount(0);

    await page.goto(documentUrl);
    await expect(page.getByText("404")).toBeVisible();
  });
});
