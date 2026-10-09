// W16: 我的空间 → 身份备份与恢复 in the online edition: export a backup in one browser, restore it in a fresh one, see what the visitor gets.
const L = require('./lib.cjs');
const fs = require('fs');
L.watchdog(280);
const vp = process.argv[2] || 'phone';
L.setCorpus(`w16-${vp}`);
const PASS = 'yueTai-livehouse-2026';
(async () => {
  const browser = await L.launch();
  try {
    const a = await L.open(browser, vp); a.page.__vp = vp;
    await L.ready(a);
    await L.enter(a);
    await L.clickHidden(a.page, { open: 'personal' });
    await a.page.waitForSelector('.personal-space', { timeout: 20000 });
    await L.sleep(1200);
    await a.page.evaluate(() => document.querySelector('.personal-space [data-space="identity-backup"]')?.click());
    await L.sleep(1200);
    await L.grab(a.page, 'backup-panel', '.identity-continuity');
    await L.shot(a.page, 'w16-01-backup');
    const pw = a.page.locator('.identity-continuity input[type="password"]');
    console.log('password fields', await pw.count());
    await pw.nth(0).fill(PASS); await pw.nth(1).fill(PASS);
    await a.page.locator('.identity-continuity form').first().locator('input[type="checkbox"]').check({ force: true }).catch(() => {});
    const [download] = await Promise.all([
      a.page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
      a.page.locator('.identity-continuity form').first().locator('button').first().evaluate(b => b.click()),
    ]);
    await L.sleep(1500);
    await L.grab(a.page, 'backup-exported', '.identity-continuity');
    let file = null;
    if (download) { file = '/tmp/space-copy/final-work/audit/backup.json'; await download.saveAs(file); console.log('backup bytes', fs.statSync(file).size); } else console.log('no download');
    await L.log(a.page, 'backup-a');
    if (file) {
      const b = await L.open(browser, vp); b.page.__vp = vp;
      await L.ready(b);
      await L.clickHidden(b.page, { open: 'identity-backup' });
      await L.sleep(1200);
      await L.grab(b.page, 'restore-panel-fresh', '.identity-continuity');
      const form = b.page.locator('.identity-continuity form[data-identity-restore]');
      await form.locator('input[type="file"]').setInputFiles(file);
      await form.locator('input[name="password"]').fill(PASS);
      await form.locator('input[name="consent"]').check({ force: true });
      await form.locator('button').first().evaluate(btn => btn.click());
      await L.sleep(4000);
      await b.page.waitForFunction(() => window.__SPACE_BOOT__ === 'ready', null, { timeout: 60000 }).catch(() => {});
      await L.sleep(2000);
      await L.grab(b.page, 'after-restore', 'body');
      await L.shot(b.page, 'w16-02-after-restore');
      await L.log(b.page, 'backup-b');
      // try entering the show with the restored identity
      await L.press(b, '#join').catch(() => {});
      await L.sleep(1500);
      await L.grab(b.page, 'after-restore-join', '#panel');
      await L.shot(b.page, 'w16-03-after-restore-join');
      await L.log(b.page, 'backup-b2');
    }
  } catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { L.flush(); await browser.close(); }
})();
