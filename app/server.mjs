// Project HQ 4.54: private, local-first clean slate.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {createCleanSlate} from './clean-slate.mjs';
import {createTradingBridge} from './trading-bridge.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PORT=Number(process.env.PROJECT_HQ_PORT||3765);
const HOST='127.0.0.1';
const DATA_DIR=process.env.PROJECT_HQ_DATA_DIR||path.join(ROOT,'data');
const FRONTEND=path.join(ROOT,'public','workspace');
const SOUND=path.join(ROOT,'public','auto-sound-design','index.html');
const SECRETS=path.join(DATA_DIR,'integrations.private.json');
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const reply=(res,status,obj)=>{res.writeHead(status,JSON_HEADERS);res.end(JSON.stringify(obj))};
const errors=(res,status,message)=>reply(res,status,{error:String(message).slice(0,400)});
let credentials={};try{credentials=JSON.parse(fs.readFileSync(SECRETS,'utf8'))}catch{}
function saveKey(k){credentials.ollamaApiKey=k;fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(SECRETS,JSON.stringify(credentials,null,2),{encoding:'utf8',mode:0o600});}
const hasKey=()=>Boolean(process.env.OLLAMA_API_KEY||credentials.ollamaApiKey);
async function runAgent(prompt,max=440){const key=process.env.OLLAMA_API_KEY||credentials.ollamaApiKey;if(!key)throw Error('Ollama Cloud saknar API-nyckel');
 const model='gemma4:31b-cloud';const r=await fetch('https://ollama.com/api/chat',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,messages:[{role:'user',content:prompt}],stream:false,options:{temperature:.3,num_predict:max}}),signal:AbortSignal.timeout(90000)});
 if(!r.ok)throw Error('Ollama Cloud svarade '+r.status);const j=await r.json();if(!j.message?.content)throw Error('AI-tjänsten returnerade inget svar');return j.message.content.trim();}
const cleanApi=createCleanSlate(DATA_DIR,{runAgent,hasAgentKey:hasKey,storeAgentKey:saveKey});
const trading=createTradingBridge(DATA_DIR,ROOT);
function sendFile(res,file){if(!fs.existsSync(file)||!fs.statSync(file).isFile())return errors(res,404,'Filen finns inte');res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});fs.createReadStream(file).pipe(res)}
const server=http.createServer(async(req,res)=>{try{
 const host=req.headers.host||'';if(host&&!new RegExp('^(localhost|127\\.0\\.0\\.1):'+PORT+'$','i').test(host))return errors(res,403,'Endast lokal åtkomst');
 const u=new URL(req.url,`http://${HOST}:${PORT}`),p=u.pathname;
 if(p==='/'||p==='/index.html'){res.writeHead(302,{Location:'/workspace'});return res.end()}
 if(req.method==='GET'&&(p==='/workspace'||p.startsWith('/workspace/'))){let rel=p==='/workspace'||p==='/workspace/'?'index.html':p.slice('/workspace/'.length);const f=path.resolve(FRONTEND,rel);if(f!==FRONTEND&&!f.startsWith(FRONTEND+path.sep))return errors(res,404,'Inte tillåtet');return sendFile(res,f)}
 if(req.method==='GET'&&(p==='/auto-sound-design/'||p==='/auto-sound-design'))return sendFile(res,SOUND);
 if(!p.startsWith('/api/'))return errors(res,404,'Sidan finns inte');
 if(req.method!=='GET'){const origin=req.headers.origin;if(origin){const x=new URL(origin);if(!['localhost','127.0.0.1'].includes(x.hostname)||Number(x.port||80)!==PORT)return errors(res,403,'Ogiltigt ursprung')}if(req.method!=='DELETE'&&req.headers['content-type']?.split(';')[0]!=='application/json')return errors(res,415,'JSON krävs')}
 if(p.startsWith('/api/clean/'))return cleanApi(req,res,p);
 if(req.method==='GET'&&p==='/api/health')return reply(res,200,{ok:true,name:'Project HQ',version:'4.54',installId:process.env.PROJECT_HQ_INSTALL_ID||null,local:true});
 if(req.method==='GET'&&p==='/api/trading/status')return reply(res,200,trading.status());
 if(req.method==='GET'&&p==='/api/trading/watchlist')return reply(res,200,trading.watchlist(u.searchParams.get('group')||'Sverige'));
 if(req.method==='GET'&&p==='/api/trading/runs')return reply(res,200,{runs:trading.list()});
 if(req.method==='GET'&&/^\/api\/trading\/runs\/[a-f0-9]{12}$/.test(p)){const x=trading.detail(p.split('/').pop());return x?reply(res,200,x):errors(res,404,'Analysen hittades inte')}
 if(req.method==='GET'&&/^\/api\/trading\/reports\/[a-f0-9]{12}$/.test(p)){const x=trading.readReport(p.split('/').pop());if(!x)return errors(res,404,'Rapporten saknas');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','X-Content-Type-Options':'nosniff'});return res.end(x)}
 if(req.method==='POST'&&p==='/api/trading/run'){let body='';for await(const c of req){body+=c;if(body.length>10000)throw Error('För mycket data')}return reply(res,202,trading.start(JSON.parse(body||'{}')))}
 return errors(res,404,'Funktionen finns inte');
 }catch(e){console.error('[HQ]',e.message);return errors(res,400,e.message)}});
server.on('error',e=>{console.error('[HQ startup]',e.message);process.exitCode=1});
server.listen(PORT,HOST,()=>{const url=`http://127.0.0.1:${PORT}/workspace`;console.log('PROJECT HQ 4.54 — CLEAN SLATE\n'+url+'\n');if(process.argv.includes('--open')){if(process.platform==='win32')execFile('cmd',['/c','start','',url],()=>{});else if(process.platform==='darwin')execFile('open',[url],()=>{})}});
