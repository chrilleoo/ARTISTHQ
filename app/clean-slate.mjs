// Project HQ / Clean Slate. This workspace is deliberately independent of earlier personal projects.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const PLATFORMS = new Set(['youtube', 'instagram', 'tiktok', 'spotify']);
const TYPES = new Set(['artist', 'business', 'creative', 'general']);
const ID = () => randomUUID().slice(0, 12);
const ISO = () => new Date().toISOString();
const str = (v, n=180) => { if(typeof v !== 'string' || v.length>n) throw Error('Ogiltig text'); return v.trim(); };
const goodUrl = (value, platform) => {
  if(!value) return '';
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password)throw Error('Använd en säker https-länk');
  const hosts={youtube:['youtube.com','www.youtube.com','m.youtube.com'],instagram:['instagram.com','www.instagram.com'],tiktok:['tiktok.com','www.tiktok.com'],spotify:['open.spotify.com']};
  if(!hosts[platform].includes(u.hostname.toLowerCase()))throw Error('Länken måste gå till '+platform);
  return u.toString();
};
const clone = o => JSON.parse(JSON.stringify(o));
const templates = {
  artist: ['Artist', 'Releaser, marknadsföring och social tillväxt', '#9F84EE'],
  business:['Företag', 'Strategi, kunder och lansering', '#83C7BB'],
  creative:['Kreativt projekt', 'Idéer, produktion och publicering', '#CFA6D7'],
  general:['Nytt projekt', 'Samla planering och nästa steg', '#A5AABD']
};
export function createCleanSlate(dataDir, {runAgent,hasAgentKey,storeAgentKey}) {
  const statePath=path.join(dataDir,'clean-slate-workspace.json');
  const secretsPath=path.join(dataDir,'clean-slate-social.private.json');
  const blank={version:1,projects:[],tasks:[],conversations:[],social:{}};
  const read=(p, fallback)=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return clone(fallback)}};
  let state=read(statePath,blank), secrets=read(secretsPath,{});
  if(!Array.isArray(state.projects)||!Array.isArray(state.tasks))state=clone(blank);
  if(!state.social||typeof state.social!=='object')state.social={};
  if(!Array.isArray(state.conversations))state.conversations=[];
  const write=(p,value)=>{fs.mkdirSync(dataDir,{recursive:true});const tmp=p+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2),{encoding:'utf8',mode:0o600});fs.renameSync(tmp,p)};
  const save=()=>write(statePath,state),saveSecrets=()=>write(secretsPath,secrets);
  const getProject=id=>{const p=state.projects.find(p=>p.id===id);if(!p)throw Error('Projektet finns inte');return p};
  const data=async req=>{let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>100_000)throw Error('För mycket data');chunks.push(chunk)};try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{throw Error('Ogiltigt formulär')}};
  const response=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
  const requireSecret=(pid, platform)=>secrets[pid]?.[platform]||{};
  const summary=(pid, platform)=>{
    const config=state.social[pid]?.[platform]||{},secret=requireSecret(pid,platform);
    return {url:config.url||'',accountId:config.accountId||'',hasKey:Boolean(secret.key),hasClientSecret:Boolean(secret.clientSecret),manual:config.manual??null,latest:config.latest||null,error:config.error||null};
  };
  const socialResponse=(pid)=>Object.fromEntries([...PLATFORMS].map(p=>[p,summary(pid,p)]));
  const ensureSocial=(pid,platform)=>{getProject(pid);if(!PLATFORMS.has(platform))throw Error('Okänd kanal');state.social[pid]??={};state.social[pid][platform]??={};secrets[pid]??={};secrets[pid][platform]??={};return state.social[pid][platform]};
  async function fetchOfficial(pid,platform){
    const v=ensureSocial(pid,platform),key=requireSecret(pid,platform).key;
    if(!key)throw Error('Lägg till API-nyckel eller behörig åtkomsttoken först');
    let result={};
    if(platform==='youtube'){
      const url=new URL('https://www.googleapis.com/youtube/v3/channels');url.searchParams.set('part','statistics,snippet');url.searchParams.set('key',key);
      const u=new URL(v.url||'https://youtube.com');const seg=u.pathname.split('/').filter(Boolean);
      if(seg[0]?.startsWith('@'))url.searchParams.set('forHandle',seg[0]);
      else if(seg[0]==='channel'&&seg[1])url.searchParams.set('id',seg[1]);
      else if(seg[0]==='user'&&seg[1])url.searchParams.set('forUsername',seg[1]);
      else if(v.accountId?.startsWith('UC'))url.searchParams.set('id',v.accountId);
      else throw Error('Ange YouTube-länk med @handle eller /channel/UC…');
      const r=await fetch(url,{signal:AbortSignal.timeout(12000)});const j=await r.json();if(!r.ok)throw Error(j.error?.message||'YouTube API nekade anropet');
      const ch=j.items?.[0];if(!ch)throw Error('YouTube-kanalen kunde inte hittas');
      if(ch.statistics?.hiddenSubscriberCount)throw Error('Kanalen visar inte prenumerantantal');
      result={value:Number(ch.statistics?.subscriberCount),label:'Prenumeranter',extra:{views:Number(ch.statistics?.viewCount)||null,videos:Number(ch.statistics?.videoCount)||null},name:ch.snippet?.title};
    }else if(platform==='tiktok'){
      const r=await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,follower_count,likes_count,video_count',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});
      const j=await r.json();if(!r.ok||j.error?.code!=='ok')throw Error(j.error?.message||'TikTok-token saknar user.info.stats');
      const x=j.data?.user||{};result={value:Number(x.follower_count),label:'Följare',extra:{likes:x.likes_count??null,videos:x.video_count??null},name:x.display_name};
    }else if(platform==='instagram'){
      const base=v.accountId?'https://graph.facebook.com/v26.0/'+encodeURIComponent(v.accountId):'https://graph.instagram.com/v26.0/me';
      const url=new URL(base);url.searchParams.set('fields','username,followers_count,media_count');
      const r=await fetch(url,{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});const j=await r.json();if(!r.ok)throw Error(j.error?.message||'Instagram kräver auktoriserat Creator/Business-konto');
      result={value:Number(j.followers_count),label:'Följare',extra:{posts:j.media_count??null},name:j.username};
    }else if(platform==='spotify'){
      const clientSecret=requireSecret(pid,platform).clientSecret;
      if(!clientSecret)throw Error('Spotify kräver både Client ID och Client Secret');
      const id=v.accountId||(v.url||'').match(/\/artist\/([A-Za-z0-9]+)/)?.[1];if(!id)throw Error('Ange Spotify-artistlänk eller artist-ID');
      const tokenResp=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(key+':'+clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(12000)});
      const t=await tokenResp.json();if(!tokenResp.ok)throw Error(t.error_description||'Spotify-inloggning nekades');
      const r=await fetch('https://api.spotify.com/v1/artists/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+t.access_token},signal:AbortSignal.timeout(12000)});
      const j=await r.json();if(!r.ok)throw Error(j.error?.message||'Spotify-artist kunde inte hämtas');
      result={value:Number(j.followers?.total),label:'Artistföljare (inte månatliga lyssnare)',extra:{},name:j.name};
    }
    if(!Number.isFinite(result.value)||result.value<0)throw Error('Plattformen returnerade ingen användbar statistik');
    v.latest={...result,value:Math.round(result.value),source:'api',at:ISO()};v.error=null;save();return v.latest;
  }
  return async function route(req,res,pathname){
    if(!pathname.startsWith('/api/clean/'))return false;
    try{
      const segments=pathname.split('/').filter(Boolean);const method=req.method||'GET';
      if(method==='GET'&&pathname==='/api/clean/state')return response(res,200,{projects:state.projects,tasks:state.tasks,conversations:state.conversations.slice(-200),version:state.version,aiConnected:!!hasAgentKey()});
      if(method==='GET'&&pathname==='/api/clean/templates')return response(res,200,templates);
      if(method==='POST'&&pathname==='/api/clean/projects'){
        if(state.projects.length>=100)throw Error('Max 100 projekt');const b=await data(req);const type=str(b.type||'general',30);if(!TYPES.has(type))throw Error('Okänd mall');
        const name=str(b.name||templates[type][0],90);if(!name)throw Error('Projektet behöver namn');
        const p={id:ID(),name,type,description:str(b.description||templates[type][1],350),color:templates[type][2],createdAt:ISO()};state.projects.push(p);save();return response(res,201,p);
      }
      if(segments[2]==='projects'&&segments.length===4){
        const id=segments[3],p=getProject(id);
        if(method==='PATCH'){const b=await data(req);if(b.name!==undefined)p.name=str(b.name,90);if(!p.name)throw Error('Namn saknas');if(b.description!==undefined)p.description=str(b.description,350);save();return response(res,200,p)}
        if(method==='DELETE'){state.projects=state.projects.filter(x=>x.id!==id);state.tasks=state.tasks.filter(x=>x.projectId!==id);state.conversations=state.conversations.filter(x=>x.projectId!==id);delete state.social[id];delete secrets[id];save();saveSecrets();return response(res,200,{ok:true})}
      }
      if(method==='POST'&&pathname==='/api/clean/tasks'){
        const b=await data(req);getProject(b.projectId);const title=str(b.title,180);if(!title)throw Error('Uppgiften behöver titel');const t={id:ID(),projectId:b.projectId,title,done:false,createdAt:ISO()};state.tasks.push(t);save();return response(res,201,t);
      }
      if(segments[2]==='tasks'&&segments.length===4){
        const t=state.tasks.find(x=>x.id===segments[3]);if(!t)throw Error('Uppgiften saknas');
        if(method==='PATCH'){const b=await data(req);if('done'in b)t.done=Boolean(b.done);if('title'in b)t.title=str(b.title,180);save();return response(res,200,t)}
        if(method==='DELETE'){state.tasks=state.tasks.filter(x=>x.id!==t.id);save();return response(res,200,{ok:true})}
      }
      if(segments[2]==='social'&&segments.length>=4){
        const pid=segments[3];getProject(pid);
        if(method==='GET'&&segments.length===4)return response(res,200,socialResponse(pid));
        const platform=segments[4];if(!PLATFORMS.has(platform))throw Error('Okänd kanal');const config=ensureSocial(pid,platform);
        if(method==='PATCH'&&segments.length===5){
          const b=await data(req);
          if('url'in b)config.url=goodUrl(str(b.url||'',1200),platform);
          if('accountId'in b)config.accountId=str(b.accountId||'',130);
          if('key'in b&&b.key)secrets[pid][platform].key=str(b.key,2400);
          if('clientSecret'in b&&b.clientSecret)secrets[pid][platform].clientSecret=str(b.clientSecret,2400);
          if(b.clearSecret){secrets[pid][platform]={};delete config.latest;}
          if('manual'in b){if(b.manual===''||b.manual===null){config.manual=null}else{const x=Number(b.manual);if(!Number.isSafeInteger(x)||x<0||x>1e12)throw Error('Ange ett giltigt heltal');config.manual=x;config.latest={value:x,label:platform==='youtube'?'Prenumeranter':'Följare',source:'manual',at:ISO()}}}
          config.error=null;save();saveSecrets();return response(res,200,summary(pid,platform));
        }
        if(method==='POST'&&segments[5]==='refresh'){
          try{const v=await fetchOfficial(pid,platform);return response(res,200,{ok:true,latest:v})}catch(e){config.error=String(e.message).slice(0,250);save();return response(res,422,{error:config.error})}
        }
      }
      if(method==='POST'&&pathname==='/api/clean/agent-settings'){
        const b=await data(req);const key=str(b.key||'',2400);if(!key)throw Error('Ange en nyckel');storeAgentKey(key);return response(res,200,{ok:true});
      }
      if(method==='POST'&&pathname==='/api/clean/chat'){
        const b=await data(req);const p=getProject(b.projectId);const content=str(b.text,2200);if(!content)throw Error('Skriv ett meddelande');
        const role=str(b.role||'Strateg',50);const allowed=['Manager','Marknadsföring','Booking','Strateg','Research','Ekonomi'];if(!allowed.includes(role))throw Error('Okänd agent');
        const msg={id:ID(),projectId:p.id,role,text:content,kind:'user',at:ISO()};state.conversations.push(msg);save();
        if(!hasAgentKey())return response(res,200,{reply:null,notice:'Anslut Ollama Cloud för att få svar. Meddelandet är sparat.'});
        const history=state.conversations.filter(x=>x.projectId===p.id).slice(-12).map(x=>({role:x.role,kind:x.kind,text:x.text}));
        const prompt='Du är '+role+' för projektet '+p.name+' (typ '+p.type+'). Svara kortfattat på svenska. Projektbeskrivning: '+p.description+'. Säg inte att du har skickat meddelanden eller gjort research utan verktyg. Inga påhittade siffror. Historik: '+JSON.stringify(history).slice(0,8000);
        try{const answer=(await runAgent(prompt,440)).slice(0,4000);const reply={id:ID(),projectId:p.id,role,text:answer,kind:'agent',at:ISO()};state.conversations.push(reply);state.conversations=state.conversations.slice(-500);save();return response(res,200,{reply});}
        catch(e){return response(res,200,{reply:null,notice:'Agenten kunde inte svara: '+String(e.message).slice(0,150)})}
      }
      return response(res,404,{error:'Funktionen finns inte'});
    }catch(e){return response(res,400,{error:String(e.message).slice(0,320)})}
  };
}
