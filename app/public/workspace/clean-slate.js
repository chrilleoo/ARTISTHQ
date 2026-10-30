'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(Number(n))?new Intl.NumberFormat('sv-SE').format(Number(n)):'—';
const names={artist:'Artist',business:'Business',creative:'Creative',general:'Projekt'};
const icons={artist:'♫',business:'◇',creative:'✳',general:'✦'};
const platformNames={spotify:'Spotify',instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube'};
const platformHelp={
 spotify:'Klistra in din artistlänk. Automatisk avläsning använder Spotify Developer Client ID och Client Secret. Spotify API ger artistföljare, inte månatliga lyssnare.',
 instagram:'Klistra in en profillänk. För automatiska siffror krävs en officiell Instagram Creator-/Business-token med rätt behörigheter. För Instagram Login kan fältet Konto-ID lämnas tomt.',
 tiktok:'Klistra in profillänken. För automatisk statistik krävs en godkänd TikTok OAuth-token med behörigheten user.info.stats.',
 youtube:'Klistra in youtube.com/@dittkonto eller youtube.com/channel/UC… samt en YouTube Data API v3-nyckel. Kanalen behöver vara offentlig.'
};
let state={projects:[],tasks:[],conversations:[],aiConnected:false},active=null,view='home',tab='overview',role='Strateg',social=null,templates=null,loading=false;
let toastTimer;
const toast=s=>{const t=$('#toast');t.textContent=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.textContent='',4200)};
async function api(method,url,payload){const options={method,headers:{}};if(payload!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(payload)}const r=await fetch(url,options);const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||`Kunde inte hämta data (${r.status})`);return j}
const project=()=>state.projects.find(p=>p.id===active);
const projectTasks=()=>state.tasks.filter(t=>t.projectId===active);
const initial=(s)=>{if(!s)return 'N';return s.trim().slice(0,1).toUpperCase()};
async function refresh(){state=await api('GET','/api/clean/state');render();}
function navigate(dest='home',id){view=dest;active=dest==='project'?id:null;tab='overview';if(dest==='project'&&!project()){navigate();return}render();window.scrollTo({top:0,behavior:'smooth'});if(dest==='project'&&project()?.type==='artist')loadSocial()}
function render(){
 $('#home-view').hidden=view!=='home';$('#project-view').hidden=view!=='project';$('#trading-view').hidden=view!=='trading';
 $('#breadcrumb').textContent=view==='home'?'HQ / ÖVERSIKT':view==='trading'?'HQ / TRADING':'HQ / '+(project()?.name||'PROJEKT').toUpperCase();
 $('#project-counter').textContent=String(state.projects.length).padStart(2,'0');
 $('#project-nav').innerHTML=state.projects.map(p=>`<button type="button" class="${active===p.id?'selected':''}" data-open="${esc(p.id)}"><span class="project-mark" style="background:${p.color}"></span><span class="name">${esc(p.name)}</span></button>`).join('');
 $('#side-overview').classList.toggle('selected',view==='home');
 if(view==='home')renderHome();else if(view==='project')renderProject();else if(view==='trading')loadTrading();
}
function renderHome(){
 $('#metric-projects').textContent=String(state.projects.length).padStart(2,'0');$('#metric-tasks').textContent=String(state.tasks.filter(t=>!t.done).length).padStart(2,'0');$('#metric-done').textContent=String(state.tasks.filter(t=>t.done).length).padStart(2,'0');$('#home-project-count').textContent=String(state.projects.length).padStart(2,'0');
 $('#home-projects').innerHTML=state.projects.length?state.projects.map(p=>{
   const total=state.tasks.filter(x=>x.projectId===p.id).length;
   return `<button type="button" class="project-card" data-open="${esc(p.id)}"><span class="pict">${icons[p.type]||'✦'}</span><b>${esc(p.name)}</b><small>${esc(p.description||names[p.type]||'Projekt')} · ${total} uppgifter</small><em>ÖPPNA PROJEKT ↗</em></button>`;
 }).join(''):`<div class="empty-card"><div><h3>Här börjar ditt nästa projekt.</h3><p>Inga färdiga projekt. Skapa ett eget eller välj en mall nedanför.</p></div><button type="button" data-create="general">＋ Skapa projekt</button></div>`;
}
function renderProject(){
 const p=project();if(!p)return;
 $('#project-name').textContent=p.name;$('#project-description').textContent=p.description||'Din arbetsyta';$('#project-type').textContent='PROJECT / '+(names[p.type]||'GENERAL').toUpperCase();
 $('#social-tab').hidden=p.type!=='artist';if(p.type!=='artist'&&tab==='social')tab='overview';
 $$('.tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
 ['overview','agents','social'].forEach(name=>$('#project-'+name+'-panel').hidden=name!==tab);
 if(tab==='overview')renderTasks();if(tab==='agents')renderChat();if(tab==='social')renderSocial();
}
function renderTasks(){const tasks=projectTasks();$('#task-count').textContent=tasks.filter(x=>!x.done).length+' kvar';
 $('#task-list').innerHTML=tasks.length?tasks.map(t=>`<div class="task-row"><button type="button" class="check ${t.done?'done':''}" data-task-toggle="${esc(t.id)}" aria-label="${t.done?'Ångra':'Markera klar'}">${t.done?'✓':''}</button><span class="task-text ${t.done?'done':''}">${esc(t.title)}</span><button type="button" class="delete-task" data-task-delete="${esc(t.id)}" aria-label="Ta bort">×</button></div>`).join(''):'<div class="empty-tasks">Inga uppgifter ännu. Lägg till ditt första steg ovan.</div>';
}
function roles(){return project()?.type==='artist'?['Manager','Marknadsföring','Booking','Research']:['Strateg','Research','Ekonomi','Marknadsföring']}
function renderChat(){if(!roles().includes(role))role=roles()[0];$('#agent-roles').innerHTML=roles().map(r=>`<button type="button" data-role="${esc(r)}" class="${role===r?'active':''}">${esc(r)}</button>`).join('');const messages=state.conversations.filter(x=>x.projectId===active&&x.role===role);$('#chat-body').innerHTML=messages.length?messages.map(m=>`<div class="chat-bubble ${m.kind==='user'?'mine':''}"><small>${m.kind==='user'?'Du':esc(m.role)}</small>${esc(m.text)}</div>`).join(''):'<div class="empty-tasks">Ingen konversation ännu. Skriv till '+esc(role)+' för att komma igång.</div>';$('#chat-body').scrollTop=$('#chat-body').scrollHeight;$('#agent-note').textContent=state.aiConnected?'AI ansluten · Du godkänner alla externa åtgärder.':'Anslut en Ollama Cloud-nyckel i inställningarna för AI-svar.'}
async function loadSocial(){try{social=await api('GET','/api/clean/social/'+active);if(view==='project'&&tab==='social')renderSocial()}catch(e){toast(e.message)}}
function renderSocial(){if(!project()||project().type!=='artist')return;
 $('#social-cards').innerHTML=Object.entries(platformNames).map(([key,title])=>{
 const d=social?.[key]||{},last=d.latest,connected=d.hasKey===true,exists=Boolean(d.url),display=last?.value!==undefined?fmt(last.value):'—';
 const status=connected?'API-nyckel sparad':exists?'Profil tillagd':'Inte ansluten';
 return `<article class="social-card"><div class="social-top"><h3>${title}</h3><span class="social-status">${status}</span></div><div class="social-value">${display}<small>${esc(last?.label|| (key==='youtube'?'Prenumeranter':key==='spotify'?'Artistföljare':'Följare'))}</small></div><div class="social-since">${last?`${last.source==='manual'?'Manuellt angivet':'Officiellt API'} · ${new Date(last.at).toLocaleString('sv-SE')}`:'Lägg till en profil för att börja. Inga data ännu.'}</div>${d.error?`<div class="social-error">${esc(d.error)}</div>`:''}<div class="social-actions"><button type="button" data-social-config="${key}">⚙ Anslut / ändra</button>${exists?`<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Visa profil ↗</a>`:''}</div></article>`;
 }).join('');
}
function showModal(title,content){$('#modal-root').hidden=false;$('#modal-root').innerHTML=`<div class="modal" role="dialog" aria-modal="true"><div class="modal-head"><div><span class="eyebrow flat">PROJECT HQ</span><h2>${esc(title)}</h2></div><button type="button" class="modal-close" data-modal-close aria-label="Stäng">×</button></div>${content}</div>`;$('#modal-root').querySelector('input:not([type=hidden])')?.focus()}
function closeModal(){$('#modal-root').hidden=true;$('#modal-root').innerHTML=''}
function createModal(type='general',edit=false){
 const p=edit?project():null, t=p?.type||type;
 const options=Object.entries(names).map(([id,n])=>`<option value="${id}" ${t===id?'selected':''}>${n}</option>`).join('');
 showModal(edit?'Redigera projekt':'Nytt projekt',`<form id="project-form"><input type="hidden" name="edit" value="${edit?'1':'0'}"><label>Typ av projekt<select name="type" ${edit?'disabled':''}>${options}</select></label><label>Projektnamn<input required name="name" maxlength="90" value="${esc(p?.name||'')}" placeholder="Vad ska projektet heta?"></label><label>Beskrivning<input name="description" maxlength="350" value="${esc(p?.description||'')}" placeholder="Vad vill du skapa?"></label><button class="primary" type="submit">${edit?'SPARA ÄNDRINGAR':'SKAPA PROJEKT'}</button></form>`)
}
function socialModal(platform){const d=social?.[platform]||{};const extra=platform==='spotify'?`<label>Spotify Client Secret<input type="password" name="clientSecret" autocomplete="off" placeholder="${d.hasClientSecret?'Sparad – lämna tomt för att behålla':'Client Secret'}"></label>`:'';
 showModal('Anslut '+platformNames[platform],`<form id="social-form" data-platform="${platform}"><div class="platform-help">${esc(platformHelp[platform])}</div><label>Profillänk<input name="url" type="url" placeholder="https://…" value="${esc(d.url||'')}"></label><label>${platform==='spotify'?'Spotify Artist ID (valfritt)':platform==='instagram'?'Instagram Graph User ID (valfritt)':'Konto-ID (valfritt)'}<input name="accountId" maxlength="130" value="${esc(d.accountId||'')}" placeholder="Valfritt"></label><label>${platform==='spotify'?'Spotify Client ID':platform==='youtube'?'YouTube Data API-nyckel':'Officiell OAuth access token'}<input type="password" name="key" autocomplete="off" placeholder="${d.hasKey?'Nyckel sparad – lämna tomt för att behålla':'Lägg till nyckel eller token'}"></label>${extra}<label>Följare / prenumeranter (manuell reserv)<input name="manual" type="number" min="0" max="1000000000000" placeholder="Valfritt, endast om du vill ange en egen siffra" value="${d.manual??''}"></label><small>Nycklar sparas lokalt och visas aldrig i gränssnittet eller i statistiksvaret. Enbart länk hämtar inte följarsiffror.</small><button class="primary" type="submit">SPARA ANSLUTNING</button><div class="inline"><button type="button" data-social-refresh="${platform}">↻ Hämta riktiga siffror</button><button type="button" data-social-clear="${platform}">Rensa nyckel</button></div></form>`);
}
function aiModal(){showModal('AI-anslutning',`<form id="ai-form"><p class="soft-copy">Anslut en Ollama Cloud API-nyckel för att kunna chatta med agentroller inne i dina egna projekt. Ingen automatisk aktivitet aktiveras.</p><label>Ollama Cloud API-nyckel<input name="key" type="password" autocomplete="off" required placeholder="Ange din API-nyckel"></label><small>Nyckeln lagras bara lokalt i HQ:s privata integrationsfil och skickas till Ollama vid AI-anrop.</small><button type="submit" class="primary">SPARA ANSLUTNING</button></form>`)}
async function loadTrading(){const slot=$('#trading-list');slot.innerHTML='<div>Läser bevakningslista…</div>';try{const group=$('#trading-group').value;const j=await api('GET','/api/trading/watchlist?group='+encodeURIComponent(group));const list=Array.isArray(j)?j:(j.items||j.watchlist||[]);slot.innerHTML=list.length?list.slice(0,30).map(x=>`<div><strong>${esc(x.symbol||x.ticker||x.name||'Instrument')}</strong> <span style="color:#938aa0">${esc(x.name||x.label||'')}</span></div>`).join(''):'<div>Ingen bevakningslista tillgänglig i den här gruppen.</div>'}catch(e){slot.textContent='Trading går inte att läsa: '+e.message}}

document.addEventListener('click',async e=>{
 try{
 const get=(sel)=>e.target.closest(sel);
 if(get('[data-modal-close]')||e.target===$('#modal-root'))return closeModal();
 if(get('#go-home,#side-overview,#project-back,#trading-back'))return navigate();
 if(get('#hero-create,#side-new,[data-create]'))return createModal(get('[data-create]')?.dataset.create||'general');
 if(get('[data-template]'))return createModal(get('[data-template]').dataset.template);
 if(get('[data-open]'))return navigate('project',get('[data-open]').dataset.open);
 if(get('#side-trading'))return navigate('trading');
 if(get('#settings-open,#agent-connect'))return aiModal();
 if(get('#project-edit'))return createModal(project()?.type,true);
 if(get('#project-delete')){const p=project();if(confirm('Radera projektet '+p.name+' och alla dess uppgifter och anslutningar?')){await api('DELETE','/api/clean/projects/'+p.id);await refresh();navigate();toast('Projektet raderades.')}return}
 if(get('[data-tab]')){tab=get('[data-tab]').dataset.tab;renderProject();if(tab==='social')loadSocial();return}
 if(get('[data-task-toggle]')){const id=get('[data-task-toggle]').dataset.taskToggle,t=state.tasks.find(x=>x.id===id);await api('PATCH','/api/clean/tasks/'+id,{done:!t.done});return refresh()}
 if(get('[data-task-delete]')){await api('DELETE','/api/clean/tasks/'+get('[data-task-delete]').dataset.taskDelete);return refresh()}
 if(get('[data-role]')){role=get('[data-role]').dataset.role;return renderChat()}
 if(get('[data-social-config]'))return socialModal(get('[data-social-config]').dataset.socialConfig);
 if(get('[data-social-refresh]')){const p=get('[data-social-refresh]').dataset.socialRefresh;if(loading)return;loading=true;toast('Hämtar statistik från '+platformNames[p]+'…');try{await api('POST','/api/clean/social/'+active+'/'+p+'/refresh',{});await loadSocial();closeModal();toast('Statistiken uppdaterades från officiellt API.')}finally{loading=false}return}
 if(get('[data-social-clear]')){const p=get('[data-social-clear]').dataset.socialClear;if(!confirm('Ta bort sparad API-nyckel för '+platformNames[p]+'?'))return;await api('PATCH','/api/clean/social/'+active+'/'+p,{clearSecret:true});await loadSocial();closeModal();toast('Nyckeln togs bort.');return}
 }catch(err){toast(err.message)}
});
document.addEventListener('submit',async e=>{
 const f=e.target;e.preventDefault();if(loading)return;loading=true;
 try{
 if(f.id==='project-form'){const form=new FormData(f),edit=form.get('edit')==='1',type=form.get('type')||project()?.type||'general',body={type,name:form.get('name'),description:form.get('description')};const p=await api(edit?'PATCH':'POST',edit?'/api/clean/projects/'+active:'/api/clean/projects',body);closeModal();await refresh();navigate('project',p.id);toast(edit?'Projektet är uppdaterat.':'Projektet är skapat.');}
 else if(f.id==='new-task-form'){const title=new FormData(f).get('title');await api('POST','/api/clean/tasks',{projectId:active,title});f.reset();await refresh();}
 else if(f.id==='social-form'){const data=new FormData(f),p=f.dataset.platform;const body={url:data.get('url'),accountId:data.get('accountId'),key:data.get('key'),manual:data.get('manual')};if(p==='spotify')body.clientSecret=data.get('clientSecret');await api('PATCH','/api/clean/social/'+active+'/'+p,body);closeModal();await loadSocial();toast('Anslutningen sparad. Hämta data när du är redo.');}
 else if(f.id==='ai-form'){await api('POST','/api/clean/agent-settings',{key:new FormData(f).get('key')});state.aiConnected=true;closeModal();renderChat();toast('Ollama Cloud-nyckeln sparad.');}
 else if(f.id==='agent-chat-form'){const text=new FormData(f).get('message');f.reset();$('#agent-send').disabled=true;toast('Agenten arbetar…');const result=await api('POST','/api/clean/chat',{projectId:active,role,text});await refresh();if(result.notice)toast(result.notice)}
 }catch(err){toast(err.message)}finally{loading=false;const btn=$('#agent-send');if(btn)btn.disabled=false;}
});
$('#current-date').textContent=new Date().toLocaleDateString('sv-SE',{day:'numeric',month:'short',year:'numeric'});
$('#trading-group').addEventListener('change',loadTrading);
refresh().catch(e=>toast('Kunde inte ansluta till HQ-servern: '+e.message));
