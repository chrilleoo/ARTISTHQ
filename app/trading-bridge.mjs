/** Offline-installable HQ Trading Research.
 * No Python, pip, GitHub checkout or broker credentials are required.
 * Quotes are fetched online on demand. Research, NOT official TradingAgents.
 * No execution paths to financial transactions. */
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const readJSON=(p,fallback)=>{try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{return fallback}};
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const fmt=(n,d=2)=>Number.isFinite(n)?Number(n).toLocaleString('sv-SE',{maximumFractionDigits:d,minimumFractionDigits:d}):'—';
const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:NaN;
// Explicitly a curated list of widely followed tickers, not a performance ranking.
export const WATCHLIST=[
 // Well-known Swedish large caps. These are curated examples, NOT ranked winners.
 {ticker:'INVE-B.ST',name:'Investor B',group:'Sverige',currency:'SEK'},
 {ticker:'VOLV-B.ST',name:'Volvo B',group:'Sverige',currency:'SEK'},
 {ticker:'ATCO-A.ST',name:'Atlas Copco A',group:'Sverige',currency:'SEK'},
 {ticker:'SAAB-B.ST',name:'Saab B',group:'Sverige',currency:'SEK'},
 {ticker:'SEB-A.ST',name:'SEB A',group:'Sverige',currency:'SEK'},
 {ticker:'SHB-A.ST',name:'Handelsbanken A',group:'Sverige',currency:'SEK'},
 {ticker:'SWED-A.ST',name:'Swedbank A',group:'Sverige',currency:'SEK'},
 {ticker:'EVO.ST',name:'Evolution',group:'Sverige',currency:'SEK'},
 {ticker:'EQT.ST',name:'EQT',group:'Sverige',currency:'SEK'},
 {ticker:'ERIC-B.ST',name:'Ericsson B',group:'Sverige',currency:'SEK'},
 {ticker:'HM-B.ST',name:'H&M B',group:'Sverige',currency:'SEK'},
 {ticker:'SAND.ST',name:'Sandvik',group:'Sverige',currency:'SEK'},
 {ticker:'NIBE-B.ST',name:'Nibe B',group:'Sverige',currency:'SEK'},
 {ticker:'AZA.ST',name:'Avanza Bank',group:'Sverige',currency:'SEK'},
 {ticker:'ESSITY-B.ST',name:'Essity B',group:'Sverige',currency:'SEK'},
 {ticker:'HEXA-B.ST',name:'Hexagon B',group:'Sverige',currency:'SEK'},
 {ticker:'NVDA',name:'Nvidia',group:'USA',currency:'USD'},
 {ticker:'MSFT',name:'Microsoft',group:'USA',currency:'USD'},
 {ticker:'AAPL',name:'Apple',group:'USA',currency:'USD'},
 {ticker:'GOOGL',name:'Alphabet',group:'USA',currency:'USD'},
 {ticker:'AMZN',name:'Amazon',group:'USA',currency:'USD'},
 {ticker:'SPY',name:'S&P 500 ETF',group:'Fonder USA',currency:'USD',kind:'ETF'},
 // Svenska aktier – utökad, kurser kontrolleras mot datakällan vid användning.
 {ticker:'ASSA-B.ST',name:'Assa Abloy B',group:'Sverige',currency:'SEK'},
 {ticker:'ALFA.ST',name:'Alfa Laval',group:'Sverige',currency:'SEK'},
 {ticker:'SKF-B.ST',name:'SKF B',group:'Sverige',currency:'SEK'},
 {ticker:'SKA-B.ST',name:'Skanska B',group:'Sverige',currency:'SEK'},
 {ticker:'SCA-B.ST',name:'SCA B',group:'Sverige',currency:'SEK'},
 {ticker:'LIFCO-B.ST',name:'Lifco B',group:'Sverige',currency:'SEK'},
 {ticker:'TEL2-B.ST',name:'Tele2 B',group:'Sverige',currency:'SEK'},
 {ticker:'TELIA.ST',name:'Telia',group:'Sverige',currency:'SEK'},
 {ticker:'BOL.ST',name:'Boliden',group:'Sverige',currency:'SEK'},
 {ticker:'SSAB-A.ST',name:'SSAB A',group:'Sverige',currency:'SEK'},
 {ticker:'EPI-A.ST',name:'Epiroc A',group:'Sverige',currency:'SEK'},
 {ticker:'KINV-B.ST',name:'Kinnevik B',group:'Sverige',currency:'SEK'},
 {ticker:'SINCH.ST',name:'Sinch',group:'Sverige',currency:'SEK'},
 {ticker:'GETI-B.ST',name:'Getinge B',group:'Sverige',currency:'SEK'},
 {ticker:'AZN.ST',name:'AstraZeneca',group:'Sverige',currency:'SEK'},
 {ticker:'SAVE.ST',name:'Nordnet',group:'Sverige',currency:'SEK'},
 // USA – bredd från teknik till bank, konsumtion och industribolag.
 {ticker:'META',name:'Meta',group:'USA',currency:'USD'},
 {ticker:'TSLA',name:'Tesla',group:'USA',currency:'USD'},
 {ticker:'AMD',name:'AMD',group:'USA',currency:'USD'},
 {ticker:'AVGO',name:'Broadcom',group:'USA',currency:'USD'},
 {ticker:'NFLX',name:'Netflix',group:'USA',currency:'USD'},
 {ticker:'PLTR',name:'Palantir',group:'USA',currency:'USD'},
 {ticker:'CRM',name:'Salesforce',group:'USA',currency:'USD'},
 {ticker:'ORCL',name:'Oracle',group:'USA',currency:'USD'},
 {ticker:'ADBE',name:'Adobe',group:'USA',currency:'USD'},
 {ticker:'INTC',name:'Intel',group:'USA',currency:'USD'},
 {ticker:'CSCO',name:'Cisco',group:'USA',currency:'USD'},
 {ticker:'JPM',name:'JPMorgan',group:'USA',currency:'USD'},
 {ticker:'V',name:'Visa',group:'USA',currency:'USD'},
 {ticker:'MA',name:'Mastercard',group:'USA',currency:'USD'},
 {ticker:'UNH',name:'UnitedHealth',group:'USA',currency:'USD'},
 {ticker:'WMT',name:'Walmart',group:'USA',currency:'USD'},
 {ticker:'COST',name:'Costco',group:'USA',currency:'USD'},
 {ticker:'KO',name:'Coca-Cola',group:'USA',currency:'USD'},
 {ticker:'PEP',name:'PepsiCo',group:'USA',currency:'USD'},
 {ticker:'DIS',name:'Disney',group:'USA',currency:'USD'},
 {ticker:'BAC',name:'Bank of America',group:'USA',currency:'USD'},
 {ticker:'UBER',name:'Uber',group:'USA',currency:'USD'},
 {ticker:'SHOP',name:'Shopify',group:'USA',currency:'USD'},
 {ticker:'PANW',name:'Palo Alto Networks',group:'USA',currency:'USD'},
 // Svenska börshandlade fonder. Vissa .ST-tickrar kan saknas hos Yahoo;
 // vid det läget visas 'Kursdata saknas', ALDRIG en låtsassignal.
 {ticker:'XACTOMX.ST',name:'XACT OMXS30 ESG',group:'Fonder Sverige',currency:'SEK',kind:'ETF'},
 {ticker:'XACTHDIV.ST',name:'XACT Norden Högutdelande',group:'Fonder Sverige',currency:'SEK',kind:'ETF'},
 {ticker:'XACTSVERIGE.ST',name:'XACT Sverige',group:'Fonder Sverige',currency:'SEK',kind:'ETF'},
 {ticker:'XACTNORDEN.ST',name:'XACT Norden',group:'Fonder Sverige',currency:'SEK',kind:'ETF'},
 // Globala, USA- och europeiska börshandlade fonder (ETF:er).
 {ticker:'VOO',name:'Vanguard S&P 500 ETF',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'QQQ',name:'Invesco Nasdaq 100 ETF',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'VTI',name:'Vanguard Total US Market',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'IVV',name:'iShares S&P 500 ETF',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'IWM',name:'iShares Russell 2000',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'SCHD',name:'Schwab US Dividend',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'VUG',name:'Vanguard Growth ETF',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'VTV',name:'Vanguard Value ETF',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'VEA',name:'Vanguard Developed Markets',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'VWO',name:'Vanguard Emerging Markets',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'VXUS',name:'Vanguard ex-US',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'BND',name:'Vanguard US Bond',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'AGG',name:'iShares US Aggregate Bond',group:'Fonder USA',currency:'USD',kind:'ETF'},
 {ticker:'EUNL.DE',name:'iShares MSCI World UCITS',group:'Fonder Europa',currency:'EUR',kind:'ETF'},
 {ticker:'IWDA.AS',name:'iShares MSCI World UCITS (AMS)',group:'Fonder Europa',currency:'EUR',kind:'ETF'},
 {ticker:'VUSA.L',name:'Vanguard S&P 500 UCITS',group:'Fonder Europa',currency:'GBP',kind:'ETF'},
 {ticker:'VWRL.L',name:'Vanguard FTSE All-World UCITS',group:'Fonder Europa',currency:'GBP',kind:'ETF'},
 {ticker:'EIMI.L',name:'iShares EM IMI UCITS',group:'Fonder Europa',currency:'USD',kind:'ETF'}
];
const sma=(items,n)=>items.length>=n?mean(items.slice(-n)):NaN;
function rsi14(closes){if(closes.length<16)return NaN;let gain=0,loss=0;for(let i=closes.length-14;i<closes.length;i++){const d=closes[i]-closes[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0)}return loss===0?gain===0?50:100:100-100/(1+gain/loss)}
function atr14(bars){if(bars.length<15)return NaN;const tr=[];for(let i=bars.length-14;i<bars.length;i++){const b=bars[i],prev=bars[i-1];tr.push(Math.max(b.high-b.low,Math.abs(b.high-prev.close),Math.abs(b.low-prev.close)))}return mean(tr)}
export function summarizeBars(raw){
 const bars=(raw||[]).filter(b=>b&&Number.isFinite(b.close)&&b.close>0&&Number.isFinite(b.high)&&Number.isFinite(b.low)&&b.high>=b.low).slice(-250);
 if(bars.length<30)throw Error('För lite verifierbar kursdata för analys (minst 30 handelsdagar).');
 const close=bars.map(b=>b.close),last=close.at(-1),prev=close.at(-2);
 const ma14=sma(close,14),ma50=sma(close,50),rsi=rsi14(close),atr=atr14(bars);
 const change=100*(last/prev-1),month=close.length>=22?100*(last/close.at(-22)-1):null;
 const volatility=Number.isFinite(atr)?100*atr/last:NaN;
 const trend=Number.isFinite(ma50)?(last>ma50&&ma14>ma50?'uppåtgående':last<ma50&&ma14<ma50?'nedåtgående':'blandad'):'otillräcklig historik';
 const signals=[
   {name:'Teknisk analys',stance:trend==='uppåtgående'?'positiv':trend==='nedåtgående'?'negativ':'neutral',explanation:`Trend: ${trend}. Kurs ${fmt(last)} mot MA14 ${fmt(ma14)}${Number.isFinite(ma50)?` och MA50 ${fmt(ma50)}`:''}.`},
   {name:'Momentum',stance:rsi>70?'överköpt':rsi<30?'översålt':'neutral',explanation:`RSI(14) ${fmt(rsi,1)}. Detta är en indikator, ingen förutsägelse.`},
   {name:'Risk',stance:volatility>6?'hög':volatility>3?'förhöjd':'okänd/lägre',explanation:`Genomsnittligt 14-dagars prisintervall (ATR) cirka ${fmt(volatility)} % av senaste priset.`},
   {name:'Motargument',stance:'kontroll krävs',explanation:`Historiska priser visar inte framtida utveckling. Likviditet, nyheter, emissionsrisk och projektkvalitet har inte verifierats.`}
 ];
 return {points:bars.length,last,prev,ma14,ma50,rsi,atr,change,month,volatility,trend,signals,rangeStart:bars[0].date,rangeEnd:bars.at(-1).date};
}
/** A cautious, explainable screen – not advice and not a model recommendation.
 * A 'possible entry' requires more than a positive trend: momentum must not be overheated
 * and the recent price volatility must not be exceptionally high. */
export function explainWatchSetup(r){
 const finite=v=>Number.isFinite(v);
 const state=r.trend==='nedåtgående'?'weak':r.trend==='uppåtgående'&&finite(r.rsi)&&r.rsi>=35&&r.rsi<=70&&finite(r.month)&&r.month>=0&&finite(r.volatility)&&r.volatility<=4.5?'potential':'wait';
 const label=state==='potential'?'Möjligt köpläge':state==='weak'?'Svag trend':'Avvakta';
 const reasons=[];
 if(finite(r.ma50)){
  reasons.push(r.trend==='uppåtgående'?'Priset ligger över sitt 50-dagars snitt. Även det kortare snittet pekar uppåt.':r.trend==='nedåtgående'?'Priset och det korta snittet ligger under det längre snittet – trenden har varit svag.':'Det korta och långa prissnittet ger ingen tydlig riktning.');
 }else reasons.push('Det finns ännu inte tillräckligt många dagar för en längre trendjämförelse.');
 if(finite(r.month))reasons.push(`Senaste cirka månaden: ${r.month>=0?'+':''}${fmt(r.month)} %. Historisk förändring, inte en prognos.`);
 if(finite(r.rsi))reasons.push(r.rsi>70?`RSI ${fmt(r.rsi,0)}: uppgången är kraftig och en rekyl kan komma.`:r.rsi<30?`RSI ${fmt(r.rsi,0)}: kursen har pressats ned. Det betyder inte att botten är nådd.`:`RSI ${fmt(r.rsi,0)}: tempot är inte extremt högt eller lågt.`);
 if(finite(r.volatility))reasons.push(`Genomsnittlig dagsrörelse (ATR): cirka ${fmt(r.volatility)} % av kursen.${r.volatility>4.5?' Relativt stora svängningar ökar risken.':''}`);
 const headline=state==='potential'?'Trenden är positiv utan tydligt överhettat momentum.':state==='weak'?'Kursen har haft en tydligt svag trend.':'Signalerna är blandade eller kursrörelserna innebär extra risk.';
 return {setup:state,setupLabel:label,headline,reasons,disclaimer:'Enbart historiska kurser och enkla indikatorer. Inga nyheter, rapporter, värderingar eller personliga förutsättningar har granskats. Inte ett köp- eller säljråd.'};
}
export function parseYahooChart(json){
 const r=json?.chart?.result?.[0];if(!r)throw Error(json?.chart?.error?.description||'Datakällan returnerade inga kurser.');
 const q=r.indicators?.quote?.[0]||{},ts=r.timestamp||[];return ts.map((seconds,i)=>({date:new Date(seconds*1000).toISOString().slice(0,10),open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i],volume:q.volume?.[i]}));
}
async function fetchMarket(ticker){
 const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
 const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 ProjectHQ Research (public market history)','Accept':'application/json'},signal:AbortSignal.timeout(18000)});
 if(!r.ok)throw Error(`Kursleverantören svarade ${r.status}. Försök igen senare eller välj en annan ticker.`);
 return parseYahooChart(await r.json());
}
function reportHTML(row,s){
 const newsNote='Detta är en datadriven, regelbaserad genomgång av historiska kurser. Ingen AI-modell, oberoende nyhetsanalys, företagsvärdering eller TradingAgents Python-motor har använts.';
 return `<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HQ Research · ${escapeHTML(row.ticker)}</title><style>body{margin:0;background:#0b1220;color:#e8edf7;font:15px system-ui,Segoe UI,sans-serif}main{max-width:900px;margin:44px auto;padding:0 22px}h1{font-size:34px;letter-spacing:-.04em}h2{font-size:19px}p,li{color:#aab9d1;line-height:1.55}.pill{display:inline-block;border:1px solid #33435c;border-radius:99px;padding:6px 12px;color:#b1d3f9}.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.card{background:#141f31;border:1px solid #29384f;border-radius:15px;padding:18px}.card b{font-size:24px;display:block;margin:12px 0}.card small{color:#8ea5c4}.sign{margin:12px 0}.sign strong{color:#fff}footer{margin-top:36px;border-top:1px solid #29384f;padding:18px 0;color:#8ea5c4}</style><main><span class="pill">HQ · inbyggd marknadsresearch · inga köp</span><h1>${escapeHTML(row.ticker)}</h1><p>Källa: Yahoo Finance diagram-API · observationer ${escapeHTML(s.rangeStart||'')}–${escapeHTML(s.rangeEnd||'')} · sammanställd ${escapeHTML(row.finishedAt||'')}</p><div class="cols"><div class="card"><small>Senaste stängningskurs</small><b>${fmt(s.last)}</b><small>Enhet enligt ticker</small></div><div class="card"><small>Förändring föregående handelsdag</small><b>${fmt(s.change)}%</b></div><div class="card"><small>RSI (14)</small><b>${fmt(s.rsi,1)}</b></div><div class="card"><small>ATR i %</small><b>${fmt(s.volatility)}%</b></div></div><h2>Analys – olika perspektiv</h2>${s.signals.map(q=>`<section class="card sign"><strong>${escapeHTML(q.name)} · ${escapeHTML(q.stance)}</strong><p>${escapeHTML(q.explanation)}</p></section>`).join('')}<h2>Risker och begränsningar</h2><p>${escapeHTML(newsNote)}</p><p>Ingen handel, ingen plånbok, inga riktiga köp. Kontrollera data hos börsen innan ett beslut.</p><footer>Projekt HQ · Regelbaserad sammanställning, inte finansiell rådgivning.</footer></main></html>`;
}
export function createTradingBridge(dataDir,appDir,{marketSource=fetchMarket}={}){
 const localDir=path.join(dataDir,'trading');fs.mkdirSync(localDir,{recursive:true});
 const file=path.join(localDir,'runs.json');let runs=readJSON(file,[]);let active=null;
 const stocks=new Map(WATCHLIST.map(item=>[item.ticker,{...item,status:'waiting',signal:'unknown',trend:null,last:null,change:null,asOf:null,error:null}]));
 const watchedAt=new Map(),runningGroups=new Set();
 const isInGroup=(item,g)=>g==='Alla'||item.group===g||(g==='Fonder världen'&&item.group.startsWith('Fonder ')&&item.group!=='Fonder Sverige');
 const refreshWatch=(group='Sverige')=>{
  if(!['Sverige','USA','Fonder Sverige','Fonder världen','Alla'].includes(group))group='Sverige';
  const updated=watchedAt.get(group)||0;
  if(runningGroups.has(group)||(updated&&Date.now()-updated<20*60*1000))return;
  watchedAt.set(group,Date.now());runningGroups.add(group);
  const pending=WATCHLIST.filter(item=>isInGroup(item,group));
  for(const item of pending)stocks.set(item.ticker,{...item,status:'loading',signal:'unknown',trend:null,last:null,change:null,asOf:null,error:null});
  const worker=async()=>{while(pending.length){const item=pending.shift();if(!item)break;
   try{const bars=await marketSource(item.ticker);const r=summarizeBars(bars);
    stocks.set(item.ticker,{...item,status:'ready',signal:r.trend==='uppåtgående'?'positive':r.trend==='nedåtgående'?'negative':'neutral',trend:r.trend,last:r.last,change:r.change,month:r.month,rsi:r.rsi,ma14:r.ma14,ma50:r.ma50,volatility:r.volatility,asOf:r.rangeEnd,...explainWatchSetup(r),error:null});
   }catch(e){stocks.set(item.ticker,{...item,status:'error',signal:'unknown',trend:null,last:null,change:null,asOf:null,error:String(e.message||e).slice(0,110)});}
  }};
  void Promise.all([worker(),worker(),worker(),worker()]).finally(()=>{runningGroups.delete(group)});
 };
 for(const row of runs)if(row.status==='running'){row.status='interrupted';row.error='HQ stängdes medan analysen kördes.';row.finishedAt=new Date().toISOString()}
 const persist=()=>fs.writeFileSync(file,JSON.stringify(runs.slice(0,80),null,2));persist();
 const reportPath=row=>row?path.join(localDir,'jobs',row.id,'complete_report.html'):null;
 const serialized=row=>({id:row.id,ticker:row.ticker,date:row.date,status:row.status,startedAt:row.startedAt,finishedAt:row.finishedAt||null,provider:'inbyggd',exitCode:row.status==='completed'?0:null,error:row.error||null,tail:String(row.tail||'').slice(-16000),hasReport:!!(reportPath(row)&&fs.existsSync(reportPath(row)))});
 return {
  watchlist(group='Sverige'){refreshWatch(group);return {items:[...stocks.values()],loading:runningGroups.has(group),updatedAt:watchedAt.get(group)?new Date(watchedAt.get(group)).toISOString():null,kind:'curated',fundsNote:'ETF:er är börshandlade fonder. Vanliga svenska fonders NAV finns inte alltid via Yahoo; XACT-symboler visas utan grön/röd signal om kursdata saknas.',source:'Yahoo Finance chart-API; Stockholmsbörsen .ST för svenska aktier; teknisk indikator',autoRefreshMinutes:20}},
  status(){return {installed:true,engine:'built-in',needsInstall:false,hasActiveJob:!!active,activeId:active?.id||null,apiConfigured:false,chatgptAuthNeeded:false,version:'HQ Trading Research 1.0',liveTrading:false,source:'Yahoo Finance (online för kursdata)',upstreamTradingAgentsIncluded:false}},
  list(){return runs.slice(0,35).map(serialized)},
  detail(id){const r=runs.find(x=>x.id===id);return r?serialized(r):null},
  readReport(id){const row=runs.find(x=>x.id===id),p=reportPath(row);return p&&fs.existsSync(p)?fs.readFileSync(p,'utf8'):null},
  start(input={}){
   if(active)throw Error('En analys körs redan.');
   const ticker=String(input.ticker||'').trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(ticker))throw Error('Ogiltig ticker. Exempel: AAPL eller BTC-USD.');
   const date=new Date().toISOString().slice(0,10); // source always uses the latest available close
   const row={id:randomUUID().replaceAll('-','').slice(0,12),ticker,date,status:'running',startedAt:new Date().toISOString(),tail:'Hämtar verifierbara historiska marknadspriser…\n',error:''};
   runs.unshift(row);runs=runs.slice(0,80);active=row;persist();
   Promise.resolve().then(async()=>{
    const bars=await marketSource(ticker);if(row.status==='cancelled')return;
    const result=summarizeBars(bars);if(row.status==='cancelled')return;
    row.finishedAt=new Date().toISOString();row.status='completed';row.tail+=`Datapunkter: ${result.points}; dataintervall ${result.rangeStart}–${result.rangeEnd}.\nTeknisk trend: ${result.trend}; RSI(14): ${fmt(result.rsi,1)}; ATR: ${fmt(result.volatility)}%.\n`; 
    const dir=path.join(localDir,'jobs',row.id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'complete_report.html'),reportHTML(row,result),'utf8');
   }).catch(e=>{if(row.status==='cancelled')return;row.status='failed';row.finishedAt=new Date().toISOString();row.error=String(e?.message||e).slice(0,350);row.tail+='Fel: '+row.error+'\n';}).finally(()=>{if(active===row)active=null;persist()});
   return serialized(row);
  },
  cancel(id){if(!active||active.id!==id)throw Error('Inget aktivt jobb med det ID:t.');active.status='cancelled';active.finishedAt=new Date().toISOString();active=null;persist();return {ok:true}}
 };
}
