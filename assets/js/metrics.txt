import {state,getPart,getRun,getDefect} from './state.js';
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
