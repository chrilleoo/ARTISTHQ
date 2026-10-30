import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createCleanSlate} from '../clean-slate.mjs';
function requestTo(route,method,url,body){let status,response;const json=body===undefined?'':JSON.stringify(body);const req={method,async *[Symbol.asyncIterator](){yield Buffer.from(json)}};const res={writeHead(code){status=code},end(data){response=JSON.parse(data)}};return route(req,res,url).then(()=>({status,response}))}
test('new HQ starts blank and persists only user-created projects',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hq-clean-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const args={runAgent:async()=>'',hasAgentKey:()=>false,storeAgentKey:()=>{}};
 const api=createCleanSlate(dir,args);
 let result=await requestTo(api,'GET','/api/clean/state');assert.deepEqual(result.response.projects,[]);assert.deepEqual(result.response.tasks,[]);
 const created=await requestTo(api,'POST','/api/clean/projects',{type:'artist',name:'Ny artist'});
 assert.equal(created.status,201);assert.equal(created.response.name,'Ny artist');assert.equal(created.response.type,'artist');
 const pid=created.response.id;
 const social=await requestTo(api,'GET','/api/clean/social/'+pid);assert.equal(social.response.youtube.latest,null);assert.equal(social.response.youtube.hasKey,false);
 const saved=await requestTo(api,'PATCH','/api/clean/social/'+pid+'/youtube',{url:'https://youtube.com/@example',key:'secret_fake_key'});
 assert.equal(saved.response.hasKey,true);assert.ok(!JSON.stringify(saved.response).includes('secret_fake_key'));
 const savedSocial=await requestTo(api,'GET','/api/clean/social/'+pid);assert.equal(savedSocial.response.youtube.latest,null,'a URL or key is not a stat value');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'clean-slate-social.private.json'),'utf8'))[pid].youtube.key,'secret_fake_key');
 const invalid=await requestTo(api,'PATCH','/api/clean/social/'+pid+'/youtube',{url:'https://evil.example/account'});assert.equal(invalid.status,400);
 const manual=await requestTo(api,'PATCH','/api/clean/social/'+pid+'/youtube',{manual:421});assert.equal(manual.response.latest.source,'manual');
 const task=await requestTo(api,'POST','/api/clean/tasks',{projectId:pid,title:'Min första uppgift'});assert.equal(task.status,201);
 const apiReload=createCleanSlate(dir,args);result=await requestTo(apiReload,'GET','/api/clean/state');assert.equal(result.response.projects.length,1);assert.equal(result.response.tasks.length,1);
 const removed=await requestTo(apiReload,'DELETE','/api/clean/projects/'+pid);assert.equal(removed.status,200);
 result=await requestTo(apiReload,'GET','/api/clean/state');assert.deepEqual(result.response.projects,[]);assert.deepEqual(result.response.tasks,[]);
});
