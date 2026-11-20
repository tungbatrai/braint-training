import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const screenshots = 'artifacts/screenshots';

test('đăng ký, tiếp tục phiên và lưu kết quả hai bài tập', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(screenshots, { recursive: true });
  const email = `learner-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('/register');
  await page.getByLabel('Họ và tên').fill('Người kiểm thử');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill('password123');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByText('Sẵn sàng luyện tập?')).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu chu kỳ' }).click();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).last().click();
  await page.locator('.exercise-row').filter({ hasText: 'Tính toán' }).getByRole('button', { name: 'Bắt đầu' }).click();
  await expect(page.locator('.question')).toBeVisible();
  await page.screenshot({ path: `${screenshots}/training.png`, fullPage: true });
  const sessionUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(sessionUrl);
  for (let i = 0; i < 10; i++) {
    await expect(page.locator('.session-number')).toContainText(`CÂU ${i + 1} / 10`);
    const match = (await page.locator('.question').innerText()).match(/(\d+)\s*([+−×])\s*(\d+)/);
    expect(match).not.toBeNull();
    const a = Number(match![1]), b = Number(match![3]);
    const answer = match![2] === '+' ? a + b : match![2] === '−' ? a - b : a * b;
    await page.locator('.choices button').filter({ has: page.locator('strong', { hasText: new RegExp(`^${answer}$`) }) }).click();
  }
  await expect(page.locator('.result-score strong')).toHaveText('10');
  await page.screenshot({ path: `${screenshots}/result.png`, fullPage: true });
  await page.getByRole('button', { name: 'Lưu kết quả' }).click();
  await page.getByRole('button', { name: 'Về tổng quan' }).click();
  await page.locator('.exercise-row').filter({ hasText: 'Ghi nhớ' }).getByRole('button', { name: 'Bắt đầu' }).click();
  await expect(page.locator('.word-grid.memorize span')).toHaveCount(6);
  const words = await page.locator('.word-grid.memorize span').allTextContents();
  await page.getByRole('button', { name: 'Tôi đã ghi nhớ' }).click();
  for (let i = 0; i < 6; i++) {
    await expect(page.locator('.session-number')).toContainText(`CÂU ${i + 1} / 6`);
    const options = page.locator('.choices button');
    let found = false;
    for (let j = 0; j < await options.count(); j++) {
      if (words.includes((await options.nth(j).locator('strong').innerText()).trim())) {
        await options.nth(j).click(); found = true; break;
      }
    }
    expect(found).toBe(true);
  }
  await expect(page.locator('.result-score strong')).toHaveText('6');
  await page.getByRole('button', { name: 'Lưu kết quả' }).click();
  await page.getByRole('button', { name: 'Về tổng quan' }).click();
  await expect(page.getByText('Đã hoàn thành')).toHaveCount(2);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${screenshots}/dashboard-desktop.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => { const box = await page.locator('.sidebar').boundingBox(); return box ? box.x + box.width : 0; }).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${screenshots}/dashboard-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.reload();
  await expect(page.getByText('Đã hoàn thành')).toHaveCount(2);
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill('password123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByText('Đã hoàn thành')).toHaveCount(2);
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'backend/promote-admin.ts', email], { env: { ...process.env, DB_PATH: '.data/e2e.sqlite' } });
  await page.reload();
  await page.goto('/admin');
  await expect(page.locator('.page')).toBeVisible();
  await page.screenshot({ path: `${screenshots}/admin.png`, fullPage: true });
});

test('màn hình nhỏ không tràn ngang và tải lại đường dẫn', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tạo tài khoản' })).toBeVisible();
});
