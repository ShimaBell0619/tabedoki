import { test as base, expect } from '@playwright/test';
import { decodeStored } from '../../../src/storage.ts';
import { defaultTemplates } from '../../../src/food.ts';
export { expect };
export const userId = '00000000-0000-4000-a000-000000000001';
export const test = base.extend({
  page: async ({ page }, use) => {
    page.cloud = { row: undefined, writes: 0, fail: false, lost: false, offline: false, wait: null };
    await page.addInitScript(({ id }) => {
      if (sessionStorage.getItem('cloud-auth-seeded')) return;
      const payload = btoa(JSON.stringify({sub:id,exp:4102444800,role:'authenticated'}));
      localStorage.setItem('sb-cloud-auth-token', JSON.stringify({access_token:`test.${payload}.test`,refresh_token:'test-refresh',expires_at:4102444800,expires_in:3600,token_type:'bearer',user:{id,email:'test@example.com',app_metadata:{provider:'google'},user_metadata:{},aud:'authenticated',created_at:'2026-01-01'}}));
      sessionStorage.setItem('cloud-auth-seeded','yes');
    }, { id: userId });
    await page.route('https://cloud.tabedoki.test/**', async route => {
      const request = route.request();
      if (!request.url().includes('/rest/v1/user_data')) { await route.fulfill({status:200,contentType:'application/json',body:'{}'}); return; }
      const db = page.cloud;
      if (db.row === undefined) {
        const source = await page.evaluate(() => ['tabedoki:data:v4','tabedoki:data:v3','tabedoki:foods:v2','tabedoki:foods:v1'].map(key=>localStorage.getItem(key)).find(value=>value!==null)??null);
        const data = source ? decodeStored(source) : {items:[],templates:defaultTemplates(),shopping:[]};
        db.row = {user_id:userId,data:{version:4,...data},revision:1,write_id:'existing',previous:null};
      }
      if (db.offline) { await route.abort(); return; }
      const write = request.method() !== 'GET';
      if (write && db.wait) await db.wait;
      if (write && db.fail) { await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'test_unavailable',message:'offline'})});return; }
      if (write) {
        const revision = new URL(request.url()).searchParams.get('revision');
        if (request.method()==='POST' && db.row) { await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'23505',message:'duplicate'})}); return; }
        if (request.method()==='PATCH' && revision!==`eq.${db.row?.revision}`) { await route.fulfill({status:200,contentType:'application/json',body:'[]'});return; }
        db.row={...db.row,...request.postDataJSON(),user_id:userId,revision:(db.row?.revision??0)+1,previous:request.postDataJSON().previous??db.row?.previous??null}; db.writes++;
        if (db.lost) { await route.abort(); return; }
      }
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(db.row?[db.row]:[])});
    });
    await use(page);
  }
});
export async function cloudData(page) { await expect(page.getByRole('heading', {level: 1})).toHaveText(/食品一覧|買い物リスト/); await expect(page.getByLabel('保存状態')).toHaveCount(0); await expect.poll(()=>page.cloud.row?.data).toBeTruthy(); return structuredClone(page.cloud.row.data); }

export async function setCloudData(page, data) {
  page.cloud.row = {...page.cloud.row, data: structuredClone(data), revision: page.cloud.row.revision + 1};
  await page.reload();
  await cloudData(page);
}
