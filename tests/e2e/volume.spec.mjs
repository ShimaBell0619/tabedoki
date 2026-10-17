import { test, expect, cloudData } from './helpers/cloud.mjs';
import { V4_STORAGE_KEY } from '../../src/data/storage.ts';
import { defaultTemplates } from '../../src/domain/templates.ts';

async function seed(page) {
  const items = [
    { id:'egg',name:'たまご',category:'eggs-dairy',kind:'best-before',deadline:'2027-10-28',
      quantity:7,unit:'piece',place:'chilled',status:'active',lowStock:false },
    { id:'milk',name:'牛乳',category:'eggs-dairy',kind:'use-by',deadline:'2027-10-26',
      quantity:2,unit:'bottle',place:'chilled',status:'active',lowStock:false },
  ];
  await page.addInitScript(({key,items,templates})=>
    localStorage.setItem(key,JSON.stringify({version:4,items,templates,shopping:[]})),
    {key:V4_STORAGE_KEY,items,templates:defaultTemplates()});
  await page.goto('/');
}

test('牛乳は10%ずつ直接減らせ、バー・残りわずか・保存値が一致する',async ({page})=>{
  await page.setViewportSize({width:390,height:850});
  await seed(page);
  const egg=page.locator('.food-row').filter({has:page.getByRole('heading',{name:'たまご'})});
  const milk=page.locator('.food-row').filter({has:page.getByRole('heading',{name:'牛乳'})});
  await expect(egg.locator('summary .stock-preview')).toHaveAttribute('aria-label',/7個/);
  await milk.locator('summary').click();
  await expect(milk.locator('.stock-progress')).toHaveAttribute('aria-label',/100%、在庫2本/);
  await expect(milk.locator('.stock-progress [aria-hidden="true"] > span')).toHaveCount(10);
  await expect(milk.locator('.volume-controls')).toHaveCount(0);
  await milk.getByRole('button',{name:'牛乳を10%使った'}).click();
  await expect(milk.locator('.stock-progress')).toHaveAttribute('aria-label',/90%、在庫2本/);
  await milk.getByRole('button',{name:'牛乳を10%使った'}).click();
  await milk.getByRole('button',{name:'牛乳の残量を10%増やす'}).click();
  await expect(milk.locator('summary .stock-preview')).toHaveAttribute('aria-label',/開封中 90%/);
  expect((await cloudData(page)).items.find(x=>x.id==='milk')).toMatchObject({
    quantity:2,trackingMode:'volume',volumePercent:90,lowStock:false,
  });
  await milk.getByRole('checkbox',{name:'牛乳の残りわずか'}).check();
  await expect(milk.locator('summary .quantity')).toHaveText('残りわずか');
  await page.reload();
  await expect(milk.locator('summary .stock-preview')).toHaveAttribute('aria-label',/開封中 90%/);
  expect((await cloudData(page)).items.find(x=>x.id==='milk')).toMatchObject({
    quantity:2,trackingMode:'volume',volumePercent:90,lowStock:true,
  });
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('2本ある牛乳は10%操作で開封中だけを減らし、使い切り時に次の満量容器へ移る',async ({page})=>{
  await seed(page);
  const row=page.locator('.food-row').filter({has:page.getByRole('heading',{name:'牛乳'})});
  await row.locator('summary').click();
  for(let i=0;i<10;i++) await row.getByRole('button',{name:'牛乳を10%使った'}).click();
  expect((await cloudData(page)).items.find(x=>x.id==='milk')).toMatchObject({quantity:1,volumePercent:100,status:'active'});
  await expect(row.locator('summary .stock-preview')).toHaveAttribute('aria-label',/満量/);
  await row.getByRole('button',{name:'牛乳のその他の操作'}).click();
  await page.getByRole('menuitem',{name:'牛乳を1本使い切る'}).click();
  expect((await cloudData(page)).items.find(x=>x.id==='milk').status).toBe('used');
  await page.getByRole('button',{name:'完了',exact:true}).click();
  const finished=page.locator('.food-row').filter({has:page.getByRole('heading',{name:'牛乳'})});
  await finished.locator('summary').click();
  await finished.getByRole('button',{name:'牛乳を管理中に戻す'}).click();
  expect((await cloudData(page)).items.find(x=>x.id==='milk')).toMatchObject({quantity:1,status:'active'});
});

test('登録・編集で個数管理と残量管理を切り替えても本数は変換されない',async ({page})=>{
  await seed(page);
  const row=page.locator('.food-row').filter({has:page.getByRole('heading',{name:'牛乳'})});
  await row.locator('summary').click();
  await row.getByRole('button',{name:'牛乳を編集'}).click();
  const edit=page.getByRole('dialog',{name:'食品を編集'});
  await expect(edit.getByLabel('数量の管理方式')).toHaveValue('volume');
  await edit.getByLabel('数量の管理方式').selectOption('count');
  await edit.getByRole('button',{name:'変更を保存'}).click();
  expect((await cloudData(page)).items.find(x=>x.id==='milk')).toMatchObject({quantity:2,trackingMode:'count'});
  await expect(row.getByRole('button',{name:'牛乳を1本飲み終わった'})).toBeVisible();
  await row.getByRole('button',{name:'牛乳を編集'}).click();
  const again=page.getByRole('dialog',{name:'食品を編集'});
  await again.getByLabel('数量の管理方式').selectOption('volume');
  await again.getByRole('button',{name:'変更を保存'}).click();
  expect((await cloudData(page)).items.find(x=>x.id==='milk')).toMatchObject({quantity:2,trackingMode:'volume',volumePercent:100});
});
