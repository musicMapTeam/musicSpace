// Shared helpers for the capture experiments (Playwright-core + system Google Chrome, real Apple GPU via ANGLE/Metal).
import { chromium } from '/tmp/space-video-prep/tools/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

export const W = 1920, H = 1080;
export const BASE = process.env.SPACE_BASE || 'http://127.0.0.1:8931';

export async function launch({ headless = true, extra = [] } = {}) {
  return chromium.launch({
    channel: 'chrome',
    headless,
    args: [
      '--ignore-gpu-blocklist',
      '--use-angle=metal',
      '--enable-gpu-rasterization',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--force-color-profile=srgb',
      ...extra,
    ],
  });
}

export async function newPage(browser, { width = W, height = H, dpr = 1, storageState, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    reducedMotion,
    storageState,
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  return { ctx, page };
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }
export function rimraf(d) { fs.rmSync(d, { recursive: true, force: true }); }
export { fs, path };
