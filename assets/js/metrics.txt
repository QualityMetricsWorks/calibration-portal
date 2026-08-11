import {state,getPart,getRun,getDefect,getShift} from './state.js';
export function scrapQtyForRun(runId){return state.scrapEvents.filter(e=>e.runId===runId&&e.disposition==='scrap').reduce((s,e)=>s+Number(e.quantity||0),0)}
export function copqForEvent(e){const run=getRun(e.runId),part=getPart(run?.partId);return e.disposition==='scrap'?(Number(e.quantity||0)*Number(part?.costPerPiece||0)+Number(e.extraCost||0)):Number(e.extraCost||0)}
export function metricsForRuns(runs){
 const ids=new Set(runs.map(r=>r.id));const events=state.scrapEvents.filter(e=>ids.has(e.runId));
 const produced=runs.reduce((s,r)=>s+Number(r.produced||0),0);
 const scrap=events.filter(e=>e.disposition==='scrap').reduce((s,e)=>s+Number(e.quantity||0),0);
 const copq=events.reduce((s,e)=>s+copqForEvent(e),0);
 return {produced,scrap,scrapRate:produced?scrap/produced*100:0,ppm:produced?scrap/produced*1e6:0,yieldRate:produced?(produced-scrap)/produced*100:100,copq};
}
export function filteredRuns({start='',end='',clientId='',partId=''}={}){
 return state.runs.filter(r=>(!start||r.date>=start)&&(!end||r.date<=end)&&(!clientId||r.clientId===clientId)&&(!partId||r.partId===partId));
}
export function defectPareto(runs){
 const ids=new Set(runs.map(r=>r.id)),m=new Map();
 state.scrapEvents.filter(e=>ids.has(e.runId)&&e.disposition==='scrap').forEach(e=>m.set(e.defectId,(m.get(e.defectId)||0)+Number(e.quantity||0)));
 return [...m].map(([defectId,qty])=>({defectId,name:getDefect(defectId)?.name||'Sin defecto',qty})).sort((a,b)=>b.qty-a.qty);
}
export function topProducts(runs){
 const groups=new Map();runs.forEach(r=>{const a=groups.get(r.partId)||[];a.push(r);groups.set(r.partId,a)});
 return [...groups].map(([partId,rs])=>({partId,runs:rs,...metricsForRuns(rs)})).sort((a,b)=>b.scrap-a.scrap).slice(0,3);
}

function timeToMinutes(v){if(!v)return 0;const [h,m]=String(v).split(':').map(Number);return h*60+m}
function shiftGrossMinutes(s){if(!s)return 0;let a=timeToMinutes(s.startTime),b=timeToMinutes(s.endTime);let d=b-a;if(d<=0)d+=1440;return d}
export function oeeMetrics(runs){
 if(!runs.length)return {available:false,reason:'Sin producción',oee:0,availability:0,performance:0,quality:0,plannedMinutes:0,operatingMinutes:0};
 const groups=new Map();
 for(const r of runs){
  const key=`${r.machineId}|${r.date}|${r.shift}`;
  if(!groups.has(key))groups.set(key,{machineId:r.machineId,date:r.date,shift:r.shift,runs:[]});
  groups.get(key).runs.push(r);
 }
 let planned=0,unplanned=0,idealSeconds=0,produced=0,scrap=0,missingCt=false,missingShift=false;
 for(const g of groups.values()){
  const sh=getShift(g.shift);if(!sh){missingShift=true;continue}
  let base=Math.max(0,shiftGrossMinutes(sh)-Number(sh.breakMinutes||0));
  const ids=new Set(g.runs.map(x=>x.id));
  const ev=state.downtimeEvents.filter(x=>ids.has(x.runId));
  const plannedStops=ev.filter(x=>x.eventType==='planned').reduce((s,x)=>s+Number(x.minutes||0),0);
  const unplannedStops=ev.filter(x=>x.eventType!=='planned').reduce((s,x)=>s+Number(x.minutes||0),0);
  planned+=Math.max(0,base-plannedStops);unplanned+=unplannedStops;
  for(const r of g.runs){
   const ct=state.cycleTimes.find(x=>x.partId===r.partId&&x.operationId===r.operationId&&x.machineId===r.machineId);
   if(!ct){missingCt=true}else idealSeconds+=Number(ct.idealCycleSeconds||0)*Number(r.produced||0);
   produced+=Number(r.produced||0);scrap+=scrapQtyForRun(r.id);
  }
 }
 if(missingShift)return {available:false,reason:'Falta configurar turno',oee:0,availability:0,performance:0,quality:0,plannedMinutes:planned,operatingMinutes:0};
 if(missingCt)return {available:false,reason:'Falta CT ideal en una o más rutas',oee:0,availability:0,performance:0,quality:produced?(produced-scrap)/produced*100:0,plannedMinutes:planned,operatingMinutes:Math.max(0,planned-unplanned)};
 const operating=Math.max(0,planned-unplanned);
 const availability=planned?Math.min(1,operating/planned):0;
 const performance=operating?Math.min(1,(idealSeconds/60)/operating):0;
 const quality=produced?Math.min(1,(produced-scrap)/produced):0;
 return {available:true,reason:'',oee:availability*performance*quality*100,availability:availability*100,performance:performance*100,quality:quality*100,plannedMinutes:planned,operatingMinutes:operating};
}
