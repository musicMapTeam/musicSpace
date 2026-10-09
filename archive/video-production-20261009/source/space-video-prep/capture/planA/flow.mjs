// Plan A real-time flow helpers (live 0.16 page).  All steps are real clicks through the real UI.
import { sleep } from './lib.mjs';
export async function toDemo(p) { await p.getByRole('button', { name: /体验示例/ }).first().click(); await sleep(2800); }
export async function openMake(p) { await p.getByRole('button', { name: /做一张卡/ }).first().click(); await sleep(2400); }
export async function pickFile(p, file, { wait = true } = {}) {
  await p.locator('input[name=photo]').setInputFiles(file);
  if (wait) await p.waitForFunction(() => /AI 判断|不确定/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => console.log('WARN no AI verdict'));
  await sleep(500);
}
export async function saveCard(p) { await p.getByRole('button', { name: /保存现场卡/ }).click(); await sleep(2200); }
export async function toRequest(p) { await p.getByRole('button', { name: /看看阿遥的卡/ }).click(); await sleep(2200); await p.getByRole('button', { name: /申请换卡/ }).click(); await sleep(1800); }
export async function send(p) { await p.getByRole('button', { name: /发送申请/ }).click(); await sleep(2200); }
export async function asYao(p) { await p.getByRole('button', { name: /切到阿遥/ }).first().click(); await sleep(2200); }
export async function viewRequest(p) { await p.getByRole('button', { name: /查看申请/ }).first().click(); await sleep(1800); }
export async function agree(p) { await p.getByRole('button', { name: /同意交换/ }).click(); await sleep(1500); }
