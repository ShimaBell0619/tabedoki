import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudStore, decodeRow } from '../src/data/cloud.ts';
import { claimMigration, localSource, migrationOwner } from '../src/data/migration.ts';
import { STORAGE_KEY, V3_STORAGE_KEY } from '../src/data/storage.ts';
const data = { items: [], templates: [], shopping: [] };
const row = (revision=1, id='A', value=data, write='existing') => ({ user_id:id,data:{version:4,...value},revision,write_id:write,previous:null });
function client(initial=row()) {
  let current = initial; let mode = ''; let pause; let calls = 0;
  const db = { get row() {return current;}, set row(v) {current=v;}, set mode(v) {mode=v;}, get calls(){return calls;}, release(){pause?.();},
    from() {
      let operation='read', payload, rev, owner;
      const query = {retry(){return query;},select(){return query;}, eq(key,value){if(key==='revision')rev=value;else owner=value;return query;},
        insert(v){operation='insert';payload=v;return query;}, update(v){operation='update';payload=v;return query;},
        async maybeSingle(){
          if(operation==='read') return mode==='offline' ? {data:null,error:{code:'offline'}} : {data:current,error:null};
          calls++;
          if(mode==='pause') await new Promise(resolve=>{pause=resolve;});
          if(mode==='fail'||mode==='offline') return {data:null,error:{code:'network'}};
          if(operation==='insert' && current) return {data:null,error:{code:'23505'}};
          if(operation==='update' && (current?.revision!==rev || current.user_id!==owner)) return {data:null,error:null};
          current={...current,...payload,user_id:owner??payload.user_id,revision:(current?.revision??0)+1,previous:payload.previous??current?.previous??null};
          return mode==='lost' ? {data:null,error:{code:'network'}} : {data:current,error:null};
        }
      };return query;
    }
  };return db;
}
test('CAS rejects stale update and initial insert without overwriting the other device',async()=>{
  const c=client(), a=new CloudStore(c,'A'),b=new CloudStore(c,'A');await a.load();await b.load();
  await a.save(data,true); assert.equal(c.row.revision,2);assert.deepEqual(c.row.previous,{version:4,...data});
  await assert.rejects(b.save(data),e=>e.kind==='conflict');assert.equal(c.row.revision,2);
  const fresh=new CloudStore(c,'A'); await assert.rejects(fresh.save(data),e=>e.kind==='conflict');
});
test('lost commit response is verified; failed or unavailable writes do not become success',async()=>{
  const c=client(), store=new CloudStore(c,'A');await store.load();c.mode='lost';assert.equal((await store.save(data)).revision,2);
  c.mode='fail';await assert.rejects(store.save(data),e=>e.kind==='unavailable');assert.equal(c.row.revision,2);
  c.mode='offline';await assert.rejects(store.save(data),e=>e.kind==='unavailable');assert.equal(c.row.revision,2);
});
test('serializes immediately and clears busy even on invalid input',async()=>{
  const c=client(),store=new CloudStore(c,'A');await store.load();c.mode='pause';const pending=store.save(data);
  await assert.rejects(store.save(data),e=>e.kind==='busy');c.release();await pending;assert.equal(c.calls,1);
  await assert.rejects(store.save({...data,items:[{}]}));assert.equal(store.busy,false);
});
test('foreign, malformed, unsupported and unsafe revision responses fail closed',()=>{
  for(const value of [row(1,'B'),row(0),row(9007199254740992),{...row(),data:{version:3,...data}},{...row(),data:{version:4,...data,items:[{}]}}]) assert.throws(()=>decodeRow(value,'A'));
});
test('migration reads v1-v4 without writes and binds before upload across accounts',()=>{
  const entries=new Map(),storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value)};
  const raw=JSON.stringify({version:3,items:[],templates:[]});entries.set(V3_STORAGE_KEY,raw);
  const source=localSource(storage);assert.deepEqual(source.data,data);assert.equal(entries.size,1);
  claimMigration(storage,'project','A',source);assert.equal(migrationOwner(storage,'project'),'A');
  claimMigration(storage,'project','A',source);assert.throws(()=>claimMigration(storage,'project','B',source));
  assert.equal(entries.get(V3_STORAGE_KEY),raw);assert.equal(entries.get(STORAGE_KEY),undefined);
  entries.set(STORAGE_KEY,'broken');assert.equal(localSource(storage).data,null);
});
test('failed migration backup never permits upload and preserves the original',()=>{
  const raw=JSON.stringify({version:4,...data});const storage={getItem:key=>key===STORAGE_KEY?raw:null,setItem(){throw Error('quota');}};
  assert.throws(()=>claimMigration(storage,'project','A',localSource(storage)));assert.equal(storage.getItem(STORAGE_KEY),raw);
});
