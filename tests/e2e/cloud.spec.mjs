import { test, expect, userId } from './helpers/cloud.mjs';
import { defaultTemplates } from '../../src/domain/templates.ts';
import { STORAGE_KEY, V3_STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY } from '../../src/data/storage.ts';
import { migrationKey } from '../../src/data/migration.ts';
const food={id:'local',name:'移行する牛乳',category:'eggs-dairy',kind:'use-by',deadline:'2026-12-31',quantity:2,unit:'bottle',place:'chilled',status:'active',lowStock:true};
const empty={items:[],templates:[],shopping:[]};
test('ログイン前に在庫を表示せず、ログアウトで画面の個人データを破棄する',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:/食品一覧/})).toBeVisible();
 await page.getByRole('button',{name:'アカウント',exact:true}).click();await page.getByRole('menuitem',{name:'ログアウト',exact:true}).click();await expect(page.getByRole('button',{name:'Googleでログイン'})).toBeVisible();
 await expect(page.getByRole('heading',{name:/食品一覧/})).toHaveCount(0);await page.reload();await expect(page.getByRole('button',{name:'Googleでログイン'})).toBeVisible();
});
for(const [key,version] of [[LEGACY_STORAGE_KEY,1],[V2_STORAGE_KEY,2],[V3_STORAGE_KEY,3],[STORAGE_KEY,4]]) {
 test(`v${version}を明示操作で移行・照合し、再読込や二度目で原文とクラウドを保持する`,async({page})=>{
  page.cloud.row=null;let item={...food};if(version<4)delete item.lowStock;if(version===1){delete item.category;delete item.unit;}
  const raw=JSON.stringify({version,items:[item],...(version>=3?{templates:[]}:{}),...(version===4?{shopping:[]}:{} )});
  await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await page.goto('/');
  await expect(page.getByRole('button',{name:'test@example.com に移行'})).toBeVisible();expect(page.cloud.writes).toBe(0);
  await expect(page.getByRole('button',{name:/退避|バックアップ/})).toHaveCount(0);
  await page.getByRole('button',{name:'test@example.com に移行'}).click();await expect(page.getByRole('heading',{name:food.name,exact:true})).toBeVisible();
  expect(page.cloud.writes).toBe(1);expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(raw);
  await page.reload();await expect(page.getByRole('heading',{name:food.name,exact:true})).toBeVisible();expect(page.cloud.writes).toBe(1);
 });
}
test('移行退避失敗と別アカウントへの再移行を拒否し、クラウド行を作らない',async({page})=>{
 page.cloud.row=null;
 await page.addInitScript(({key,claim,food})=>{
  localStorage.setItem(key,JSON.stringify({version:4,items:[food],templates:[],shopping:[]}));
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key===claim)throw new DOMException('quota');return original.call(this,key,value);};
 },{key:STORAGE_KEY,claim:migrationKey('https://cloud.tabedoki.test'),food});
 await page.goto('/');await page.getByRole('button',{name:'test@example.com に移行'}).click();await expect(page.getByRole('alert')).toBeVisible();expect(page.cloud.writes).toBe(0);
});
test('別アカウントに紐付いた旧データと既存クラウドは自動で混合しない',async({page})=>{
 page.cloud.row=null;
 await page.addInitScript(({key,claim,food})=>{
  localStorage.setItem(key,JSON.stringify({version:4,items:[food],templates:[],shopping:[]}));
  localStorage.setItem(claim,JSON.stringify({userId:'another-user',raw:'old'}));
 },{key:STORAGE_KEY,claim:migrationKey('https://cloud.tabedoki.test'),food});
 await page.goto('/');await expect(page.getByText(/別のアカウント|紐付け済み/)).toBeVisible();await expect(page.getByRole('button',{name:'test@example.com に移行'})).toHaveCount(0);expect(page.cloud.writes).toBe(0);
 await page.getByRole('button',{name:'旧データを使わず開始'}).click();await expect(page.getByRole('heading',{name:/食品一覧/})).toBeVisible();expect(page.cloud.row.data.items).toEqual([]);
 await page.reload();await expect(page.getByRole('heading',{name:/食品一覧/})).toBeVisible();await expect(page.getByRole('heading',{name:food.name})).toHaveCount(0);expect(page.cloud.writes).toBe(1);
});
async function draft(page){await page.getByRole('button',{name:'食品を登録',exact:true}).last().click();const dialog=page.getByRole('dialog');await dialog.getByLabel(/食品名/).fill('未保存の納豆');await dialog.getByLabel(/期限の日付/).fill('2026-12-20');return dialog;}
test('保存失敗は成功通知を出さず入力を保持し、再取得後に一度だけ保存できる',async({page})=>{
 await page.goto('/');const dialog=await draft(page);page.cloud.fail=true;await dialog.getByRole('button',{name:'登録する',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('保存結果を確認できません');await expect(dialog.getByLabel(/食品名/)).toHaveValue('未保存の納豆');expect(page.cloud.row.data.items).toEqual([]);
 page.cloud.fail=false;await dialog.getByRole('button',{name:'クラウドを再取得',exact:true}).click();
 await expect(dialog.getByLabel(/食品名/)).toHaveValue('未保存の納豆');
 await expect(dialog.getByRole('button',{name:'登録する',exact:true})).toBeEnabled();await page.getByRole('button',{name:'登録する',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect(page.cloud.writes).toBe(1);
});
test('別端末の更新を上書きせず入力を残し、再取得で最新を表示する',async({page})=>{
 await page.goto('/');const dialog=await draft(page);page.cloud.row={...page.cloud.row,revision:2,data:{version:4,...empty,items:[food]}};
 await dialog.getByRole('button',{name:'登録する',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('別の端末');expect(page.cloud.row.data.items).toEqual([food]);expect(page.cloud.writes).toBe(0);
 await dialog.getByRole('button',{name:'キャンセル'}).click();await page.getByRole('button',{name:'クラウドを再取得',exact:true}).click();await expect(page.getByRole('heading',{name:food.name,exact:true})).toBeVisible();
});
test('保存中の二重送信を止め、応答消失後も照合した1回だけを成功扱いにする',async({page})=>{
 await page.goto('/');const dialog=await draft(page);let release;page.cloud.wait=new Promise(resolve=>{release=resolve;});page.cloud.lost=true;
 await dialog.getByRole('button',{name:'登録する',exact:true}).click();await expect(dialog.getByRole('button',{name:'登録する',exact:true})).toBeDisabled();release();
 await expect(dialog).toHaveCount(0);expect(page.cloud.writes).toBe(1);await expect(page.getByRole('heading',{name:'未保存の納豆',exact:true})).toBeVisible();
});
test('異なるユーザーの応答と読み込み障害では在庫を表示しない',async({page})=>{
 page.cloud.row={user_id:'foreign',data:{version:4,...empty,items:[food]},revision:1,write_id:'existing',previous:null};await page.goto('/');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('heading',{name:food.name})).toHaveCount(0);
 page.cloud.offline=true;await page.getByRole('button',{name:'クラウドを再取得'}).click();await expect(page.getByRole('alert')).toContainText('読み込めません');
});
