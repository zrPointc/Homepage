// 公開用HTMLを実際のChromiumで検証。アプリの実行にはNodeは不要です。
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

(async () => {
  const preview = path.resolve('.preview-test');
  await fs.mkdir(preview, { recursive: true });
  await fs.cp('dist', path.join(preview, 'Ten-Homepage'), { recursive: true });
  await fs.mkdir('test-results', { recursive: true });
  const server = spawn('python', ['-m', 'http.server', '8765', '--bind', '127.0.0.1', '--directory', preview], { stdio: 'ignore' });
  const base = 'http://127.0.0.1:8765/Ten-Homepage/';
  let browser;
  try {
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(base)).ok) break; } catch (_) { /* サーバー起動待ち */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    browser = await chromium.launch({ headless: true });
    const failures = [];
    for (const width of [375, 768, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      page.on('pageerror', error => failures.push(error.message));
      page.on('response', response => {
        if (response.url().startsWith(base) && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
      });
      const checkLayout = async label => {
        const geometry = await page.evaluate(() => {
          const nav = document.querySelector('.site-nav');
          const box = nav.getBoundingClientRect();
          return {
            width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            position: getComputedStyle(nav).position, top: box.top,
            links: [...nav.querySelectorAll('.nav-items a')].map(a => {
              const r = a.getBoundingClientRect();
              return { text: a.textContent, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
            }),
          };
        });
        assert(geometry.scrollWidth <= geometry.width, `${width} ${label}: 横にはみ出しています`);
        assert.equal(geometry.position, 'fixed');
        assert.equal(geometry.top, 0);
        for (const link of geometry.links) {
          assert(link.top >= 0 && link.bottom <= 800 && link.left >= 0 && link.right <= width, `${label}: ${link.text} が画面外`);
        }
      };
      await page.goto(base);
      await page.locator('.greeting.is-typing').waitFor({ state: 'detached' });
      await page.locator('.typing-cursor.is-blinking').waitFor({ state: 'detached' });
      assert(await page.locator('.portrait img').evaluate(img => img.complete && img.naturalWidth > 0));
      await checkLayout('home top');
      await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
      for (const id of ['diary', 'now', 'works', 'links']) {
        await page.locator(`.nav-items a[data-section="${id}"]`).click();
        await checkLayout(`anchor ${id}`);
        const visibleHeading = await page.evaluate(id => {
          const y = document.getElementById(id).getBoundingClientRect().top;
          const nav = document.querySelector('.site-nav').getBoundingClientRect();
          return y >= (innerWidth <= 900 ? nav.bottom : 0) - 1;
        }, id);
        assert(visibleHeading, `${width}: #${id} がメニューに隠れています`);
      }
      await page.locator('.nav-items a[data-section="top"]').click();
      assert((await page.evaluate(() => scrollY)) <= 1);
      await page.locator('a[href="/Ten-Homepage/diary/"]').click();
      await checkLayout('diary');
      await page.screenshot({ path: `test-results/diary-${width}.png`, fullPage: true });
      await page.locator('.diary-card h3 a').first().click();
      await checkLayout('post');
      await page.screenshot({ path: `test-results/post-${width}.png`, fullPage: true });
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await checkLayout('post bottom');
      await page.locator('.nav-items a[data-section="now"]').click();
      assert(page.url().endsWith('/Ten-Homepage/#now'));
      assert.equal(await page.locator('.greeting.is-typing').count(), 0, '戻るたびに再生しない');
      await context.close();
      console.log(`PASS ${width}px: トップ・日記・記事、固定メニュー、全リンク、アンカー`);
    }
    const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 375, height: 800 } });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(base);
    assert.equal(await reducedPage.locator('.greeting.is-typing').count(), 0);
    assert.equal(await reducedPage.locator('.greeting').textContent(), 'こんにちは！点です');
    await reduced.close();
    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
    const noJsPage = await noJs.newPage();
    await noJsPage.goto(base);
    assert.equal(await noJsPage.locator('.greeting').textContent(), 'こんにちは！点です');
    await noJsPage.locator('.nav-items a[data-section="works"]').click();
    assert(noJsPage.url().endsWith('#works'));
    await noJs.close();
    assert.deepEqual(failures, []);
    console.log('PASS reduced-motion / JavaScript無効 / 実行エラーなし');
  } finally {
    await browser?.close();
    server.kill();
    await fs.rm(preview, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
