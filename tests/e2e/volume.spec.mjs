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

test('閉じたカードの残数バーと手動フラグは残量変更後も整合する',async ({page})=>{
  await page.setViewportSize({width:390,height:850});
  await seed(page);
  const egg=page.locator('.food-row').filter({has:page.getByRole('heading',{name:'たまご'})});
  const milk=page.locator('.food-row').filter({has:page.getByRole('heading',{name:'牛乳'})});
  await expect(egg.locator('summary .stock-preview')).toHaveAttribute('aria-label',/7個/);
  await expect(milk.locator('summary .stock-preview')).toBeVisible();
  await milk.locator('summary').click();
  await expect(milk.getByRole('group',{name:'牛乳の残量'}).getByRole('button')).toHaveText(['少し','半分','多め','満量']);
  await milk.getByRole('button',{name:'牛乳の残量を半分にする'}).click();
  await expect(milk.locator('summary .stock-preview')).toHaveAttribute('aria-label',/開封中 半分/);
  expect((await cloudData(page)).items.find(x=>x.id==='milk')).toMatchObject({
    quantity:2,trackingMode:'volume',volumePercent:50,lowStock:false,
  });
  await milk.getByRole('button',{name:'牛乳の残量を少しにする'}).click();
  await expect(milk.locator('.low-stock')).toHaveCount(0);
  await milk.getByRole('checkbox',{name:'牛乳の残りわずか'}).click();
  await expect(milk.locator('summary .low-stock')).toHaveText('残りわずか');
  await page.reload();
  await expect(milk.locator('summary .stock-preview')).toHaveAttribute('aria-label',/開封中 少し/);
  const saved=(await cloudData(page)).items.find(x=>x.id==='milk');
  expect(saved).toMatchObject({quantity:2,trackingMode:'volume',volumePercent:25,lowStock:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('開封中の容器を飲み終わると1本減り、次の容器は満量になる',async ({page})=>{
  await seed(page);
  const row=page.locator('.food-row').filter({has:page.getByRole('heading',{name:'牛乳'})});
  await row.locator('summary').click();
  await row.getByRole('button',{name:'牛乳の残量を半分にする'}).click();
  await row.getByRole('button',{name:'牛乳を1本飲み終わった'}).click();
  expect((await cloudData(page)).items.find(x=>x.id==='milk')).toMatchObject({quantity:1,volumePercent:100,status:'active'});
  await expect(row.locator('summary .stock-preview')).toHaveAttribute('aria-label',/満量/);
  await row.getByRole('button',{name:'牛乳の残量を少しにする'}).click();
  await row.getByRole('button',{name:'牛乳を飲み終わった'}).click();
  expect((await cloudData(page)).items.find(x=>x.id==='milk').status).toBe('used');
  await page.getByRole('button',{name:'完了',exact:true}).click();
  await expect(page.locator('.food-row').filter({has:page.getByRole('heading',{name:'牛乳'})})).toBeVisible();
});
