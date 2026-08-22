import {$,number,money,percent,esc,dispositionLabel} from './utils.js';
import {state,getClient,getPart,getOperation,getDefect,getRun,getMachine,getPersonnel,getDowntimeReason,cycleTimesForPart,partsForClient,operationsForPart,defectsForPart,eventsForRun,machinesForPart,partsForMachine} from './state.js';
import {metricsForRuns,filteredRuns,defectPareto,topProducts,scrapQtyForRun,copqForEvent,oeeMetrics} from './metrics.js';
let charts={};
export function populateSelect(el,items,placeholder,label){if(!el)return;const v=el.value;el.innerHTML=`<option value="">${esc(placeholder)}</option>`+items.map(x=>`<option value="${x.id}">${esc(label(x))}</option>`).join('');if([...el.options].some(o=>o.value===v))el.value=v}
export function renderAll(){renderSelects();renderDashboard();renderClients();renderParts();renderMachines();renderPersonnel();renderCatalog();renderDowntimeCatalog();renderRuns();renderSettings();renderHistory();renderRunScrapEvents()}
export function renderSelects(){
 const clientSelects=['filterClient','scrapClient','downtimeClient','partClient','defectClient'];clientSelects.forEach(id=>populateSelect($(id),state.clients,id==='filterClient'?'Todos los clientes':'Selecciona cliente',x=>x.code?`${x.code} · ${x.name}`:x.name));
 updateFilterParts();updateScrapParts();updateDowntimeParts();updateDefectParts();updatePartMachineSelect();populateSelect($('filterMachine'),state.machines,'Todas las máquinas',x=>x.code);
}
export function updateFilterParts(){populateSelect($('filterPartNumber'),partsForClient($('filterClient')?.value),'Todos los NP',x=>x.number)}
export function updateScrapParts(){populateSelect($('scrapPart'),partsForClient($('scrapClient')?.value),'Selecciona NP',x=>x.number);updateScrapOperations()}
export function updateScrapOperations(){populateSelect($('scrapOperation'),operationsForPart($('scrapPart')?.value),'Selecciona operación',x=>`${x.code} · ${x.name}`);updateScrapMachines()}
export function updateScrapMachines(){populateSelect($('scrapMachine'),machinesForPart($('scrapPart')?.value),'Selecciona máquina',x=>`${x.code}${x.name?' · '+x.name:''}`)}
export function updateDowntimeParts(){populateSelect($('downtimePart'),partsForClient($('downtimeClient')?.value),'Selecciona NP',x=>x.number);updateDowntimeOperations()}
export function updateDowntimeOperations(){populateSelect($('downtimeOperation'),operationsForPart($('downtimePart')?.value),'Selecciona operación',x=>`${x.code} · ${x.name}`);updateDowntimeMachines()}
export function updateDowntimeMachines(){populateSelect($('downtimeMachine'),machinesForPart($('downtimePart')?.value),'Selecciona máquina',x=>`${x.code}${x.name?' · '+x.name:''}`)}

export function updatePartMachineSelect(){const linked=new Set(state.partMachines.filter(x=>x.partId===state.selectedPartId).map(x=>x.machineId));populateSelect($('partMachineSelect'),state.machines.filter(x=>!linked.has(x.id)),'Selecciona máquina',x=>`${x.code}${x.name?' · '+x.name:''}`)}
export function updateDefectParts(){populateSelect($('defectPartNumber'),partsForClient($('defectClient')?.value),'Selecciona NP',x=>x.number);updateDefectOperations()}
export function updateDefectOperations(){populateSelect($('defectOperation'),operationsForPart($('defectPartNumber')?.value),'Todas / general',x=>`${x.code} · ${x.name}`)}
export function findMatchingRuns(){
 const lot=($('scrapLot')?.value||'').trim().toLowerCase(),clientId=$('scrapClient')?.value,partId=$('scrapPart')?.value,operationId=$('scrapOperation')?.value,machineId=$('scrapMachine')?.value;
 const matches=state.runs.filter(r=>(!lot||String(r.lotNumber||'').toLowerCase().includes(lot))&&(!clientId||r.clientId===clientId)&&(!partId||r.partId===partId)&&(!operationId||r.operationId===operationId)&&(!machineId||r.machineId===machineId));
 const list=$('matchedRunsList');if(!list)return matches;
 list.innerHTML=matches.slice(0,12).map(r=>`<button class="entity-item ${$('scrapRun')?.value===r.id?'active':''}" data-match-run="${r.id}"><span><strong>${esc(r.lotNumber||'Sin lote')} · ${esc(getPart(r.partId)?.number||'—')} · ${esc(getOperation(r.operationId)?.code||'—')}</strong><small>${new Date(r.createdAt).toLocaleString('es-MX')} · ${esc(getMachine(r.machineId)?.code||r.machine||'—')} · Turno ${esc(r.shift)} · ${number(r.produced)} pzas</small></span><span>Seleccionar</span></button>`).join('')||'<div class="empty-state">No se encontró una corrida con esos datos.</div>';
 if(matches.length===1){$('scrapRun').value=matches[0].id;updateScrapDefects()}
 else if(matches.length!==1){$('scrapRun').value='';$('selectedRunSummary').textContent=matches.length?'Hay varias coincidencias. Selecciona la corrida correcta.':'No se encontró una corrida con esos datos.';populateSelect($('scrapDefect'),[],'Selecciona defecto',x=>x.name)}
 return matches;
}
export function findDowntimeMatchingRuns(){
 const lot=($('downtimeLot')?.value||'').trim().toLowerCase(),clientId=$('downtimeClient')?.value,partId=$('downtimePart')?.value,operationId=$('downtimeOperation')?.value,machineId=$('downtimeMachine')?.value;
 const matches=state.runs.filter(r=>(!lot||String(r.lotNumber||'').toLowerCase().includes(lot))&&(!clientId||r.clientId===clientId)&&(!partId||r.partId===partId)&&(!operationId||r.operationId===operationId)&&(!machineId||r.machineId===machineId));
 const list=$('matchedDowntimeRunsList');if(!list)return matches;
 list.innerHTML=matches.slice(0,12).map(r=>`<button class="entity-item ${$('downtimeRun')?.value===r.id?'active':''}" data-match-downtime-run="${r.id}"><span><strong>${esc(r.lotNumber||'Sin lote')} · ${esc(getPart(r.partId)?.number||'—')} · ${esc(getOperation(r.operationId)?.code||'—')}</strong><small>${new Date(r.createdAt).toLocaleString('es-MX')} · ${esc(getMachine(r.machineId)?.code||r.machine||'—')} · ${number(r.produced)} pzas</small></span><span>Seleccionar</span></button>`).join('')||'<div class="empty-state">No se encontró una corrida con esos datos.</div>';
 if(matches.length===1){$('downtimeRun').value=matches[0].id;renderSelectedDowntimeRun()}
 else if(matches.length!==1){$('downtimeRun').value='';$('selectedDowntimeRunSummary').textContent=matches.length?'Hay varias coincidencias. Selecciona la corrida correcta.':'No se encontró una corrida con esos datos.'}
 return matches;
}
export function renderSelectedDowntimeRun(){
 const run=getRun($('downtimeRun')?.value),sum=$('selectedDowntimeRunSummary');if(!sum)return;
 if(!run){sum.textContent='Completa los datos para localizar la corrida.';return}
 sum.textContent=`${run.lotNumber||'Sin lote'} · ${getClient(run.clientId)?.name||'—'} · ${getPart(run.partId)?.number||'—'} · ${getOperation(run.operationId)?.code||'—'} · ${getMachine(run.machineId)?.code||'—'} · ${number(run.produced)} pzas`;
 populateSelect($('manualDowntimeReason'),state.downtimeReasons,'Selecciona motivo',x=>`${x.code} · ${x.name}`);
}
export function updateScrapDefects(){
 const run=getRun($('scrapRun')?.value);populateSelect($('scrapDefect'),run?defectsForPart(run.partId,run.operationId):[],'Selecciona defecto',x=>`${x.code} · ${x.name}`);
 const sum=$('selectedRunSummary');if(!sum)return;if(!run){sum.textContent='Selecciona una corrida de producción.';return}
 const m=metricsForRuns([run]);sum.textContent=`${run.lotNumber||'Sin lote'} · ${getClient(run.clientId)?.name||'—'} · ${getPart(run.partId)?.number||'—'} · ${getOperation(run.operationId)?.code||'—'} · Producción ${number(run.produced)} · Scrap ${number(m.scrap)} · Yield ${percent(m.yieldRate)}`;
 renderRunScrapEvents();
}
function activeRuns(){return filteredRuns({start:$('filterStart')?.value,end:$('filterEnd')?.value,clientId:$('filterClient')?.value,partId:$('filterPartNumber')?.value}).filter(r=>!$('filterMachine')?.value||r.machineId===$('filterMachine').value)}
function localDateString(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function dateFromInput(s){const p=String(s||'').split('-').map(Number);return p.length===3&&p.every(Boolean)?new Date(p[0],p[1]-1,p[2]):null}
function previousPeriodRange(period,start,end){
 const s=dateFromInput(start),e=dateFromInput(end);if(!s||!e)return null;
 let ps,pe;
 if(period==='today'||period==='previous_day'){ps=new Date(s);ps.setDate(ps.getDate()-1);pe=new Date(ps)}
 else if(period==='current_week'||period==='previous_week'){pe=new Date(s);pe.setDate(pe.getDate()-1);ps=new Date(pe);ps.setDate(ps.getDate()-6)}
 else if(period==='current_month'||period==='previous_month'){ps=new Date(s.getFullYear(),s.getMonth()-1,1);pe=new Date(s.getFullYear(),s.getMonth(),0)}
 else if(period==='previous_quarter'){const q=Math.floor(s.getMonth()/3)-1;ps=new Date(s.getFullYear(),q*3,1);pe=new Date(s.getFullYear(),q*3+3,0)}
 else if(period==='previous_half'){const h=s.getMonth()<6?0:1;ps=new Date(h?s.getFullYear()-1: s.getFullYear(),h?0:6,1);pe=new Date(ps.getFullYear(),ps.getMonth()+6,0)}
 else if(period==='previous_year'){ps=new Date(s.getFullYear()-1,0,1);pe=new Date(s.getFullYear()-1,11,31)}
 else return null;
 return {start:localDateString(ps),end:localDateString(pe)}
}
function setKpiComparison(id,current,previous,lowerIsBetter=false){
 const el=$(id),host=el?.closest('.kpi-card');if(!el||!host)return;
 let node=host.querySelector('.kpi-comparison');if(!node){node=document.createElement('small');node.className='kpi-comparison';host.appendChild(node)}
 if(previous===null||previous===undefined||current===null||current===undefined){node.textContent='';return}
 const delta=previous===0?(current===0?0:null):(current-previous)/Math.abs(previous)*100;
 if(delta===null){node.textContent='—';node.className='kpi-comparison neutral';return}
 const improved=lowerIsBetter?delta<0:delta>0;
 node.textContent=delta===0?'→ 0.0%':`${delta>0?'↑':'↓'} ${Math.abs(delta).toFixed(1)}%`;
 node.className=`kpi-comparison ${delta===0?'neutral':improved?'positive':'negative'}`;
}
function renderKpiComparisons(){
 const period=$('filterPeriod')?.value,start=$('filterStart')?.value,end=$('filterEnd')?.value;
 const ids=['kpiOee','kpiProduction','kpiScrap','kpiPpm','kpiYield','kpiCopq'];
 if(!period||period==='current'||period==='custom'||!start||!end){ids.forEach(id=>setKpiComparison(id,null,null));return}
 const prev=previousPeriodRange(period,start,end);if(!prev){ids.forEach(id=>setKpiComparison(id,null,null));return}
 const currentRuns=activeRuns();
 const prevRuns=filteredRuns({start:prev.start,end:prev.end,clientId:$('filterClient')?.value,partId:$('filterPartNumber')?.value});
 const cm=metricsForRuns(currentRuns),pm=metricsForRuns(prevRuns),co=oeeMetrics(currentRuns),po=oeeMetrics(prevRuns);
 setKpiComparison('kpiOee',co.available?co.oee:null,po.available?po.oee:null);
 setKpiComparison('kpiProduction',cm.produced,pm.produced);
 setKpiComparison('kpiScrap',cm.scrapRate,pm.scrapRate,true);
 setKpiComparison('kpiPpm',cm.ppm,pm.ppm,true);
 setKpiComparison('kpiYield',cm.yieldRate,pm.yieldRate);
 setKpiComparison('kpiCopq',cm.copq,pm.copq,true);
}
function renderGeneralCharts(runs){
 const d=daily(runs),labels=d.map(x=>x.date);
 chart('generalProductionTrendChart',rangedLineConfig(labels,d.map(x=>x.produced),'cyan',chartRange('production','production')));
 const oeeData=labels.map(date=>{const o=oeeMetrics(runs.filter(r=>r.date===date));return o.available?o.oee:null});
 chart('oeeTrendChart',rangedLineConfig(labels,oeeData,'blue',chartRange('production','oee')));
}
export function renderDashboard(){
 const runs=activeRuns(),m=metricsForRuns(runs);$('kpiProduction').textContent=number(m.produced);$('kpiScrap').textContent=percent(m.scrapRate);$('kpiScrapQty').textContent=`${number(m.scrap)} piezas`;$('kpiPpm').textContent=number(Math.round(m.ppm));$('kpiYield').textContent=percent(m.yieldRate);$('kpiCopq').textContent=money(m.copq,'USD');
 const de=state.downtimeEvents.filter(e=>runs.some(r=>r.id===e.runId));const mins=de.reduce((s,e)=>s+e.minutes,0);$('kpiDowntime').textContent=`${number(mins)} min`;$('kpiDowntimeEvents').textContent=number(de.length);
 const oee=oeeMetrics(runs);$('kpiOee').textContent=oee.available?percent(oee.oee):'—';$('kpiOeeNote').textContent=oee.available?'Availability × Performance × Quality':oee.reason;
 $('kpiProdOee').textContent=oee.available?percent(oee.oee):'—';$('kpiProdOeeNote').textContent=oee.available?`${number(Math.round(oee.plannedMinutes))} min planificados`:oee.reason;
 $('kpiAvailability').textContent=oee.available?percent(oee.availability):'—';$('kpiPerformance').textContent=oee.available?percent(oee.performance):'—';$('kpiQuality').textContent=oee.available?percent(oee.quality):percent(oee.quality||0);
 renderGeneralCharts(runs);renderCharts(runs,de);renderTopProducts(runs);renderKpiComparisons();renderCustomDashboard('production',runs,de);renderCustomDashboard('scrap',runs,de);renderCustomDashboard('maintenance',runs,de);
}

const dashboardSettingsKey='guvel.dashboard.settings.v146';
const customDashboardsKey='guvel.custom.dashboards.v146';
function readDashboardSettings(){try{return JSON.parse(localStorage.getItem(dashboardSettingsKey)||'{}')}catch{return {}}}
function writeDashboardSettings(x){localStorage.setItem(dashboardSettingsKey,JSON.stringify(x))}
function dashboardDefault(kind,metric){
 const d={min:0,max:100,target:50};
 if(metric==='scrap'||metric==='ppm'||metric==='copq'||metric==='production'||metric==='downtime')return {min:0,max:metric==='ppm'?1000:metric==='production'?1000:metric==='copq'?1000:metric==='downtime'?600:100,target:metric==='scrap'?5:metric==='ppm'?100:metric==='downtime'?60:50};
 return d;
}
function chartRange(kind,metric){
 const all=readDashboardSettings();return all?.[kind]?.[metric]||dashboardDefault(kind,metric);
}
function applyTargetLine(cfg,target){
 const labels=cfg.data?.labels||[];
 cfg.data.datasets.push({data:labels.map(()=>Number(target)),borderColor:'#FF3131',backgroundColor:'#FF3131',borderWidth:2,borderDash:[5,4],pointRadius:0,fill:false,tension:0});
 return cfg;
}
function rangedLineConfig(labels,data,tone,range){
 const cfg=lineConfig(labels,data,tone);cfg.options.scales.y.min=Number(range.min);cfg.options.scales.y.max=Number(range.max);return applyTargetLine(cfg,Number(range.target));
}
export function getDashboardSetting(kind,metric){return chartRange(kind,metric)}
export function saveDashboardSetting(kind,metric,value){const all=readDashboardSettings();all[kind]=all[kind]||{};all[kind][metric]=value;writeDashboardSettings(all)}
export function dashboardMetricOptions(kind){
 const map={
  general:[['scrap','Scrap %'],['ppm','PPM'],['yield','Yield %'],['copq','COPQ'],['production','Production']],
  production:[['production','Production'],['oee','OEE %'],['availability','Availability %'],['performance','Performance %'],['quality','Quality %']],
  scrap:[['scrap','Scrap %'],['ppm','PPM'],['yield','Yield %'],['defect_pie','Pie · Defectos'],['part_pie','Pie · Números de Parte'],['defect_pareto','Pareto · Defectos'],['part_pareto','Pareto · Números de Parte']],
  maintenance:[['downtime','Tiempo muerto'],['reason_pie','Pie · Motivos de paro'],['machine_pie','Pie · Máquinas'],['reason_pareto','Pareto · Motivos de paro'],['machine_pareto','Pareto · Máquinas']]
 };return map[kind]||map.general;
}
function getCustomDashboards(){try{return JSON.parse(localStorage.getItem(customDashboardsKey)||'{}')}catch{return {}}}
function setCustomDashboards(x){localStorage.setItem(customDashboardsKey,JSON.stringify(x))}
export function getCustomDashboard(kind,id){return (getCustomDashboards()[kind]||[]).find(x=>x.id===id)||null}
export function updateCustomDashboard(kind,id,patch){
 const all=getCustomDashboards();all[kind]=(all[kind]||[]).map(x=>x.id===id?{...x,...patch}:x);setCustomDashboards(all);
}
export function removeCustomDashboard(kind,id){
 const all=getCustomDashboards();all[kind]=(all[kind]||[]).filter(x=>x.id!==id);setCustomDashboards(all);
}
export function saveCustomDashboardSetting(kind,id,value){updateCustomDashboard(kind,id,{range:value})}
export function addCustomDashboard(kind,name,metric,span=1){
 const all=getCustomDashboards();all[kind]=all[kind]||[];
 const options=dashboardMetricOptions(kind),chosen=options.find(x=>x[0]===metric)||options[0];
 all[kind].push({id:`${kind}-${Date.now()}`,name,metric:chosen[0],metricLabel:chosen[1],span:Number(span)||1,range:dashboardDefault(kind,chosen[0])});
 setCustomDashboards(all);
}
export function reorderCustomDashboard(kind,id,beforeId){
 const all=getCustomDashboards(),items=all[kind]||[],from=items.findIndex(x=>x.id===id);if(from<0)return;
 const [item]=items.splice(from,1);const to=beforeId?items.findIndex(x=>x.id===beforeId):items.length;
 items.splice(to<0?items.length:to,0,item);all[kind]=items;setCustomDashboards(all);
}
function customData(kind,metric,runs,downtime){
 const d=daily(runs),labels=d.map(x=>x.date);
 if(metric==='production')return {type:'line',labels,data:d.map(x=>x.produced),label:'Production'};
 if(metric==='scrap')return {type:'line',labels,data:d.map(x=>x.scrapRate),label:'Scrap %'};
 if(metric==='ppm')return {type:'line',labels,data:d.map(x=>x.ppm),label:'PPM'};
 if(metric==='yield')return {type:'line',labels,data:d.map(x=>x.yieldRate),label:'Yield %'};
 if(metric==='oee'){const o=oeeMetrics(runs);return {type:'line',labels,data:labels.map(()=>o.available?o.oee*100:0),label:'OEE %'}}
 if(metric==='availability'){const o=oeeMetrics(runs);return {type:'line',labels,data:d.map(()=>o.availability*100),label:'Availability %'}}
 if(metric==='performance'){const o=oeeMetrics(runs);return {type:'line',labels,data:d.map(()=>o.performance*100),label:'Performance %'}}
 if(metric==='quality'){const o=oeeMetrics(runs);return {type:'line',labels,data:d.map(()=>o.quality*100),label:'Quality %'}}
 if(metric==='downtime'){const map={};downtime.forEach(e=>map[getDowntimeReason(e.reasonId)?.name||'Other']=(map[getDowntimeReason(e.reasonId)?.name||'Other']||0)+Number(e.minutes||0));return {type:'pie',labels:Object.keys(map),data:Object.values(map),label:'Downtime'}}
 if(metric==='defect_pie'){const map={};state.scrapEvents.filter(e=>runs.some(r=>r.id===e.runId)).forEach(e=>map[getDefect(e.defectId)?.name||'Other']=(map[getDefect(e.defectId)?.name||'Other']||0)+Number(e.quantity||0));return {type:'pie',labels:Object.keys(map),data:Object.values(map),label:'Defects'}}
 if(metric==='part_pie'){const map={};state.scrapEvents.filter(e=>runs.some(r=>r.id===e.runId)).forEach(e=>{const pn=getPart(getRun(e.runId)?.partId)?.number||'Other';map[pn]=(map[pn]||0)+Number(e.quantity||0)});return {type:'pie',labels:Object.keys(map),data:Object.values(map),label:'Part Numbers'}}
 if(metric==='defect_pareto'){const map={};state.scrapEvents.filter(e=>runs.some(r=>r.id===e.runId)).forEach(e=>{const n=getDefect(e.defectId)?.name||'Other';map[n]=(map[n]||0)+Number(e.quantity||0)});const z=Object.entries(map).sort((a,b)=>b[1]-a[1]);return {type:'pareto',labels:z.map(x=>x[0]),data:z.map(x=>x[1]),label:'Defect Pareto'}}
 if(metric==='part_pareto'){const map={};state.scrapEvents.filter(e=>runs.some(r=>r.id===e.runId)).forEach(e=>{const n=getPart(getRun(e.runId)?.partId||'')?.number||'Other';map[n]=(map[n]||0)+Number(e.quantity||0)});const z=Object.entries(map).sort((a,b)=>b[1]-a[1]);return {type:'pareto',labels:z.map(x=>x[0]),data:z.map(x=>x[1]),label:'Part Pareto'}}
 if(metric==='reason_pie'){const map={};downtime.forEach(e=>{const n=getDowntimeReason(e.reasonId)?.name||'Other';map[n]=(map[n]||0)+Number(e.minutes||0)});return {type:'pie',labels:Object.keys(map),data:Object.values(map),label:'Downtime reasons'}}
 if(metric==='machine_pie'){const map={};downtime.forEach(e=>{const r=getRun(e.runId),n=getMachine(r?.machineId)?.code||'Other';map[n]=(map[n]||0)+Number(e.minutes||0)});return {type:'pie',labels:Object.keys(map),data:Object.values(map),label:'Machines'}}
 if(metric==='reason_pareto'){const map={};downtime.forEach(e=>{const n=getDowntimeReason(e.reasonId)?.name||'Other';map[n]=(map[n]||0)+Number(e.minutes||0)});const z=Object.entries(map).sort((a,b)=>b[1]-a[1]);return {type:'pareto',labels:z.map(x=>x[0]),data:z.map(x=>x[1]),label:'Downtime Pareto'}}
 if(metric==='machine_pareto'){const map={};downtime.forEach(e=>{const r=getRun(e.runId),n=getMachine(r?.machineId)?.code||'Other';map[n]=(map[n]||0)+Number(e.minutes||0)});const z=Object.entries(map).sort((a,b)=>b[1]-a[1]);return {type:'pareto',labels:z.map(x=>x[0]),data:z.map(x=>x[1]),label:'Machine Pareto'}}
 return {type:'line',labels,data:[],label:metric};
}
function renderCustomDashboard(kind,runs,downtime){
 const host=document.querySelector(`[data-custom-dashboard-host="${kind}"]`);if(!host)return;
 const all=getCustomDashboards(),items=all[kind]||[];
 host.innerHTML=`<div class="custom-dashboard-toolbar"><div><p class="eyebrow">Dashboards personalizados</p><span>Arrastra para mover · 1, 2 o 3 columnas</span></div><button class="btn btn-secondary btn-sm" data-add-custom-dashboard="${kind}">+ Añadir dashboard</button></div><div class="custom-dashboard-grid" data-custom-grid="${kind}">${items.map(x=>`<article class="custom-dashboard-card span-${Math.min(3,Math.max(1,Number(x.span)||1))}" draggable="true" data-custom-dashboard-card="${x.id}" data-custom-kind="${kind}">
   <div class="custom-dashboard-card-header"><div class="custom-dashboard-drag" title="Mover dashboard">⠿</div><div class="custom-dashboard-card-title"><strong>${esc(x.name)}</strong><small>${esc(x.metricLabel)}</small></div><div class="custom-dashboard-card-actions"><button class="dashboard-chart-settings" data-custom-dashboard-settings="${kind}" data-custom-dashboard-id="${x.id}" data-dashboard-settings="${kind}" data-dashboard-metric="${x.metric}" title="Configurar meta">⚙</button><button class="custom-dashboard-more" type="button" title="Editar dashboard" data-edit-custom-dashboard="${kind}" data-custom-dashboard-id="${x.id}">✎</button><button class="custom-dashboard-more danger" type="button" title="Eliminar dashboard" data-delete-custom-dashboard="${kind}" data-custom-dashboard-id="${x.id}">×</button></div></div>
   <div class="custom-dashboard-canvas"><canvas id="customDashCanvas-${kind}-${x.id}"></canvas></div>
   <div class="custom-dashboard-footer"><span>Distribución</span><div class="span-control">${[1,2,3].map(n=>`<button type="button" class="${Number(x.span)===n?'active':''}" data-set-custom-span="${kind}" data-custom-dashboard-id="${x.id}" data-span="${n}">${n}</button>`).join('')}</div></div>
 </article>`).join('')||'<div class="empty-state custom-dashboard-empty">No hay dashboards adicionales. Usa “+ Añadir dashboard”.</div>'}</div>`;
 const grid=host.querySelector(`[data-custom-grid="${kind}"]`);
 grid?.querySelectorAll('[data-custom-dashboard-card]').forEach(card=>{
   card.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',card.dataset.customDashboardCard);card.classList.add('dragging')});
   card.addEventListener('dragend',()=>card.classList.remove('dragging'));
   card.addEventListener('dragover',e=>{e.preventDefault();card.classList.add('drag-over')});
   card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
   card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');if(id&&id!==card.dataset.customDashboardCard){reorderCustomDashboard(kind,id,card.dataset.customDashboardCard);renderDashboard()}}); 
 });
 items.forEach(x=>{
   const d=customData(kind,x.metric,runs,downtime),cid=`customDashCanvas-${kind}-${x.id}`;
   let cfg;if(d.type==='pie')cfg=pieConfig(d.labels,d.data);else if(d.type==='pareto')cfg=paretoConfig(d.labels,d.data);else cfg=rangedLineConfig(d.labels,d.data,'cyan',x.range||chartRange(kind,x.metric));
   chart(cid,cfg);
 });
}
function daily(runs){const map=new Map();runs.forEach(r=>{const a=map.get(r.date)||[];a.push(r);map.set(r.date,a)});return [...map].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,rs])=>({date,...metricsForRuns(rs)}))}
function chart(id,cfg){if(!window.Chart)return;if(charts[id])charts[id].destroy();const ctx=$(id);if(ctx)charts[id]=new Chart(ctx,cfg)}
function lineConfig(labels,data,tone='cyan'){const p=tone==='red'?{line:'#FF3131',fill:'rgba(255,49,49,.08)'}:{line:'#0CC1E0',fill:'rgba(12,193,224,.10)'};return{type:'line',data:{labels,datasets:[{data,borderColor:p.line,backgroundColor:p.fill,fill:true,tension:.25,pointRadius:2,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{beginAtZero:true}}}}}
function pieConfig(labels,data){return{type:'pie',data:{labels,datasets:[{data,backgroundColor:['#0CC1E0','#FF3131','#59D5E8','#FF7070','#8CE4F0','#FF9B9B','#B9EFF6','#FFC4C4']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:10}}}}}}}
function paretoConfig(labels,data){
 const total=data.reduce((s,v)=>s+Number(v||0),0);let acc=0;
 return{data:{labels,datasets:[{type:'bar',data,backgroundColor:'#FF3131',borderWidth:0,yAxisID:'y'},{type:'line',data:data.map(v=>{acc+=Number(v||0);return total?acc/total*100:0}),borderColor:'#0CC1E0',backgroundColor:'#0CC1E0',pointBackgroundColor:'#0CC1E0',borderWidth:2,tension:.15,yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{font:{size:9}}},y:{beginAtZero:true,grid:{color:'#EEF1F4'}},y1:{beginAtZero:true,max:100,position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>v+'%'}}}}}
}
function renderCharts(runs,downtime){const d=daily(runs),labels=d.map(x=>x.date);chart('scrapTrendChart',rangedLineConfig(labels,d.map(x=>x.scrapRate),'red',chartRange('general','scrap')));
 chart('ppmTrendChart',rangedLineConfig(labels,d.map(x=>x.ppm),'red',chartRange('general','ppm')));
 chart('yieldTrendChart',rangedLineConfig(labels,d.map(x=>x.yieldRate),'cyan',chartRange('general','yield')));
 chart('copqTrendChart',rangedLineConfig(labels,d.map(x=>x.copq),'red',chartRange('general','copq')));
 chart('productionTrendChart',rangedLineConfig(labels,d.map(x=>x.produced),'cyan',chartRange('production','production')));
 const ev=state.scrapEvents.filter(e=>runs.some(r=>r.id===e.runId)),byDef={},byPart={};ev.forEach(e=>{const n=getDefect(e.defectId)?.name||'Otro';byDef[n]=(byDef[n]||0)+e.quantity;const pn=getPart(getRun(e.runId)?.partId)?.number||'Otro';byPart[pn]=(byPart[pn]||0)+e.quantity});chart('scrapDefectPieChart',pieConfig(Object.keys(byDef),Object.values(byDef)));chart('scrapPartPieChart',pieConfig(Object.keys(byPart),Object.values(byPart)));const defSorted=Object.entries(byDef).sort((a,b)=>b[1]-a[1]),partSorted=Object.entries(byPart).sort((a,b)=>b[1]-a[1]);chart('scrapDefectParetoChart',paretoConfig(defSorted.map(x=>x[0]),defSorted.map(x=>x[1])));chart('scrapPartParetoChart',paretoConfig(partSorted.map(x=>x[0]),partSorted.map(x=>x[1])));
 const byReason={},byMachine={};downtime.forEach(e=>{const n=getDowntimeReason(e.reasonId)?.name||'Otro';byReason[n]=(byReason[n]||0)+e.minutes;const r=getRun(e.runId),mc=getMachine(r?.machineId)?.code||'Sin máquina';byMachine[mc]=(byMachine[mc]||0)+e.minutes});chart('downtimeReasonPieChart',pieConfig(Object.keys(byReason),Object.values(byReason)));chart('downtimeMachinePieChart',pieConfig(Object.keys(byMachine),Object.values(byMachine)));const reasonSorted=Object.entries(byReason).sort((a,b)=>b[1]-a[1]),machineSorted=Object.entries(byMachine).sort((a,b)=>b[1]-a[1]);chart('downtimeReasonParetoChart',paretoConfig(reasonSorted.map(x=>x[0]),reasonSorted.map(x=>x[1])));chart('downtimeMachineParetoChart',paretoConfig(machineSorted.map(x=>x[0]),machineSorted.map(x=>x[1])));}
function renderTopProducts(runs){const el=$('topProductsGrid');if(!el)return;const tops=topProducts(runs);el.innerHTML=tops.length?tops.map((t,i)=>{const p=getPart(t.partId),pr=defectPareto(t.runs).slice(0,3);return `<div class="top-product"><span class="rank">RANK ${i+1}</span><h4>${esc(p?.number||'—')}</h4><small>${esc(getClient(p?.clientId)?.name||'—')}</small><div class="metrics"><div><span>SCRAP</span><strong>${number(t.scrap)}</strong></div><div><span>YIELD</span><strong>${percent(t.yieldRate)}</strong></div><div><span>COPQ</span><strong>${money(t.copq,p?.currency||'USD')}</strong></div></div>${pr.map((x,j)=>`<div class="entity-item"><small>${j+1}. ${esc(x.name)}</small><strong>${number(x.qty)}</strong></div>`).join('')}</div>`}).join(''):'<div class="empty-state">Sin datos para el periodo seleccionado.</div>'}
export function renderClients(){
 $('clientCount').textContent=state.clients.length;const q=($('clientSearch')?.value||'').toLowerCase();const list=state.clients.filter(x=>`${x.name} ${x.code}`.toLowerCase().includes(q));$('clientList').innerHTML=list.map(c=>`<button class="entity-item ${c.id===state.selectedClientId?'active':''}" data-client-id="${c.id}"><span><strong>${esc(c.name)}</strong><small>${esc(c.code||'Sin código')}</small></span><span>›</span></button>`).join('');
 renderClientDetail();
}
export function renderClientDetail(){
 const c=getClient(state.selectedClientId),empty=$('clientEmptyState'),detail=$('clientDetail');if(!c){empty.hidden=false;detail.hidden=true;return}empty.hidden=true;detail.hidden=false;$('clientDetailName').textContent=c.name;$('clientDetailCode').textContent=c.code||'Sin código';
 const ps=partsForClient(c.id),rs=state.runs.filter(r=>r.clientId===c.id),m=metricsForRuns(rs);$('clientDetailParts').textContent=ps.length;$('clientDetailProduction').textContent=number(m.produced);$('clientDetailScrap').textContent=number(m.scrap);$('clientDetailPpm').textContent=number(Math.round(m.ppm));
 $('clientPartsList').innerHTML=ps.map(p=>`<button class="entity-item" data-open-part="${p.id}"><span><strong>${esc(p.number)}</strong><small>${esc(p.description||'Sin descripción')}</small></span><span>›</span></button>`).join('')||'<div class="empty-state">Sin números de parte.</div>';
}
export function renderParts(){
 $('partCount').textContent=state.parts.length;const q=($('partSearch')?.value||'').toLowerCase();$('partList').innerHTML=state.parts.filter(p=>`${p.number} ${p.description} ${getClient(p.clientId)?.name}`.toLowerCase().includes(q)).map(p=>`<button class="entity-item ${p.id===state.selectedPartId?'active':''}" data-part-id="${p.id}"><span><strong>${esc(p.number)}</strong><small>${esc(getClient(p.clientId)?.name||'—')} · ${esc(p.description||'')}</small></span><span>›</span></button>`).join('');renderPartDetail();
}
export function renderPartDetail(){
 const p=getPart(state.selectedPartId),empty=$('partEmptyState'),detail=$('partDetail');if(!p){empty.hidden=false;detail.hidden=true;return}empty.hidden=true;detail.hidden=false;$('partDetailNumber').textContent=p.number;$('partDetailDescription').textContent=p.description||'Sin descripción';$('editPartDescription').value=p.description||'';$('editPartCost').value=p.costPerPiece||0;$('editPartCurrency').value=p.currency||'USD';$('partDetailClient').textContent=getClient(p.clientId)?.name||'—';$('partDetailCost').textContent=money(p.costPerPiece,p.currency);
 const rs=state.runs.filter(r=>r.partId===p.id),m=metricsForRuns(rs);$('partDetailProduction').textContent=number(m.produced);$('partDetailScrapQty').textContent=number(m.scrap);$('partDetailYield').textContent=percent(m.yieldRate);$('partDetailCopq').textContent=money(m.copq,p.currency);
 updatePartMachineSelect();$('partMachineList').innerHTML=machinesForPart(p.id).map(m=>`<div class="entity-item"><span><strong>${esc(m.code)}</strong><small>${esc(m.name||'')}</small></span><button class="icon-btn" data-unlink-machine="${m.id}">×</button></div>`).join('')||'<div class="empty-state">Sin máquinas vinculadas.</div>';

 renderCycleTimes();
 $('partOperationList').innerHTML=operationsForPart(p.id).map(o=>`<div class="entity-item"><span><strong>${esc(o.code)}</strong><small>${esc(o.name)}</small></span><button class="icon-btn" data-delete-operation="${o.id}">×</button></div>`).join('')||'<div class="empty-state">Sin operaciones.</div>';
 $('partDefectList').innerHTML=defectsForPart(p.id).map(d=>`<div class="entity-item"><span><strong>${esc(d.code)} · ${esc(d.name)}</strong><small>${esc(getOperation(d.operationId)?.code||'General')} · ${esc(d.category||'')}</small></span></div>`).join('')||'<div class="empty-state">Sin defectos.</div>';
 $('partProductionList').innerHTML=rs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(r=>`<div class="entity-item"><span><strong>${r.date} · ${esc(getOperation(r.operationId)?.code||'—')}</strong><small>${number(r.produced)} piezas · ${esc(r.machine||'Sin máquina')}</small></span><strong>${percent(metricsForRuns([r]).yieldRate)}</strong></div>`).join('')||'<div class="empty-state">Sin producción.</div>';
 const ev=state.scrapEvents.filter(e=>getRun(e.runId)?.partId===p.id);if(window.GUVEL_RENDER_BARCODE)window.GUVEL_RENDER_BARCODE();
 $('partScrapList').innerHTML=ev.slice(0,30).map(e=>`<div class="entity-item"><span><strong>${esc(getDefect(e.defectId)?.name||'—')}</strong><small>${esc(dispositionLabel(e.disposition))}</small></span><strong>${number(e.quantity)}</strong></div>`).join('')||'<div class="empty-state">Sin eventos.</div>';
}
export function renderCycleTimes(){
 const p=getPart(state.selectedPartId),body=$('cycleTimeTableBody');if(!p||!body)return;
 populateSelect($('cycleTimeOperation'),operationsForPart(p.id),'Selecciona operación',x=>`${x.code} · ${x.name}`);
 populateSelect($('cycleTimeMachine'),machinesForPart(p.id),'Selecciona máquina',x=>`${x.code}${x.name?' · '+x.name:''}`);
 const rows=cycleTimesForPart(p.id);
 body.innerHTML=rows.map(x=>`<tr><td>${esc(getOperation(x.operationId)?.code||'—')}</td><td>${esc(getMachine(x.machineId)?.code||'—')}</td><td><strong>${Number(x.idealCycleSeconds).toFixed(2)} s</strong></td><td><button class="icon-btn" data-delete-cycle-time="${x.id}">×</button></td></tr>`).join('')||'<tr><td colspan="4" class="empty-state">Sin tiempos ciclo configurados.</td></tr>';
}
export function renderMachines(){
 $('machineCount').textContent=state.machines.length;const q=($('machineSearch')?.value||'').toLowerCase();$('machineList').innerHTML=state.machines.filter(m=>`${m.code} ${m.name}`.toLowerCase().includes(q)).map(m=>`<button class="entity-item ${m.id===state.selectedMachineId?'active':''}" data-machine-id="${m.id}"><span><strong>${esc(m.code)}</strong><small>${esc(m.name||'Sin descripción')}</small></span><span>›</span></button>`).join('');
 const m=getMachine(state.selectedMachineId),empty=$('machineEmptyState'),detail=$('machineDetail');if(!m){empty.hidden=false;detail.hidden=true;return}empty.hidden=true;detail.hidden=false;$('machineDetailCode').textContent=m.code;$('machineDetailName').textContent=m.name||'Sin descripción';
 const ps=partsForMachine(m.id),rs=state.runs.filter(r=>r.machineId===m.id),met=metricsForRuns(rs);$('machineDetailParts').textContent=ps.length;$('machineDetailProduction').textContent=number(met.produced);$('machineDetailScrap').textContent=number(met.scrap);$('machineDetailYield').textContent=percent(met.yieldRate);
 $('machinePartsList').innerHTML=ps.map(p=>`<button class="entity-item" data-open-part="${p.id}"><span><strong>${esc(p.number)}</strong><small>${esc(getClient(p.clientId)?.name||'—')}</small></span><span class="machine-link-badge">Vinculado</span></button>`).join('')||'<div class="empty-state">Sin NP vinculados.</div>';
}
export function renderPersonnel(){
 const count=$('personnelCount');if(!count)return;count.textContent=state.personnel.length;
 const q=($('personnelSearch')?.value||'').toLowerCase();
 const list=state.personnel.filter(p=>`${p.employeeNo} ${p.fullName} ${p.role}`.toLowerCase().includes(q));
 $('personnelList').innerHTML=list.map(p=>`<button class="entity-item ${p.id===state.selectedPersonnelId?'active':''}" data-personnel-id="${p.id}"><span><strong>${esc(p.fullName)}</strong><small>${esc(p.employeeNo)} · ${esc(p.role)}</small></span><span class="personnel-role-badge">${esc(p.role)}</span></button>`).join('');
 const p=getPersonnel(state.selectedPersonnelId),empty=$('personnelEmptyState'),detail=$('personnelDetail');
 if(!p){empty.hidden=false;detail.hidden=true;return}empty.hidden=true;detail.hidden=false;
 $('personnelDetailName').textContent=p.fullName;$('personnelDetailNo').textContent=p.employeeNo;$('personnelDetailRole').textContent=({operator:'Operador',supervisor:'Supervisor',both:'Operador / Supervisor'})[p.role]||p.role;$('personnelDetailStatus').textContent=p.active===false?'Inactivo':'Activo';
 const rs=state.runs.filter(r=>r.operatorId===p.id||r.supervisorId===p.id);$('personnelDetailRuns').textContent=rs.length;$('personnelDetailProduction').textContent=number(rs.reduce((s,r)=>s+r.produced,0));
}
export function renderCatalog(){
 const newest=(a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''));
 const q=($('defectSearch')?.value||'').toLowerCase();const rows=[...state.defects].sort(newest).filter(d=>`${d.code} ${d.name} ${d.category} ${getPart(d.partId)?.number}`.toLowerCase().includes(q));$('defectTableBody').innerHTML=rows.map(d=>{const p=getPart(d.partId);return `<tr><td>${esc(getClient(p?.clientId)?.name||'—')}</td><td>${esc(p?.number||'—')}</td><td>${esc(getOperation(d.operationId)?.code||'General')}</td><td>${esc(d.code)}</td><td>${esc(d.name)}</td><td>${esc(d.category||'—')}</td><td><button class="icon-btn" data-delete-defect="${d.id}">×</button></td></tr>`}).join('')||'<tr><td colspan="7" class="empty-state">Sin defectos.</td></tr>';
}
export function renderDowntimeCatalog(){const newest=(a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''));const q=($('downtimeSearch')?.value||'').toLowerCase();const rows=[...state.downtimeReasons].sort(newest).filter(x=>`${x.code} ${x.name} ${x.category} ${x.downtimeType}`.toLowerCase().includes(q));$('downtimeTableBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>${esc(x.category||'—')}</td><td><span class="type-badge ${x.downtimeType==='planned'?'planned':'unplanned'}">${x.downtimeType==='planned'?'Planeado':'No planeado'}</span></td><td><button class="icon-btn" data-delete-downtime-reason="${x.id}">×</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty-state">Sin paros configurados.</td></tr>'}
const runCode=r=>`PR-${String(r.id||'').replaceAll('-','').slice(0,8).toUpperCase()}`;
export function renderRuns(){
 const count=$('runCount'),list=$('runList');if(!count||!list)return;
 const sorted=[...state.runs].sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));
 if(!state.selectedRunId&&sorted.length)state.selectedRunId=sorted[0].id;
 if(state.selectedRunId&&!state.runs.some(x=>x.id===state.selectedRunId))state.selectedRunId=sorted[0]?.id||null;
 count.textContent=state.runs.length;
 const q=($('runSearch')?.value||'').trim().toLowerCase();
 const rows=sorted.filter(r=>{
  const p=getPart(r.partId),m=getMachine(r.machineId),op=getOperation(r.operationId),oper=getPersonnel(r.operatorId),sup=getPersonnel(r.supervisorId);
  return `${runCode(r)} ${r.lotNumber||''} ${p?.number||''} ${getClient(r.clientId)?.name||''} ${m?.code||''} ${op?.code||''} ${oper?.fullName||''} ${sup?.fullName||''}`.toLowerCase().includes(q);
 });
 if(!state.runs.length){
  list.innerHTML='<div class="run-zero-state"><strong>Sin corridas.</strong><small>No existen registros en production_runs para esta empresa.</small></div>';
 }else if(!rows.length){
  list.innerHTML='<div class="run-zero-state"><strong>Sin resultados.</strong><small>Cambia el criterio de búsqueda.</small></div>';
 }else{
  list.innerHTML=rows.map(r=>`<button class="entity-item ${r.id===state.selectedRunId?'active':''}" data-run-id="${r.id}"><span><strong>${esc(runCode(r))} · ${esc(r.lotNumber||'Sin lote')}</strong><small>${esc(getPart(r.partId)?.number||'—')} · ${esc(getMachine(r.machineId)?.code||r.machine||'—')} · ${r.createdAt?new Date(r.createdAt).toLocaleString(document.documentElement.lang==='en'?'en-US':'es-MX'):r.date}</small></span><span>›</span></button>`).join('');
 }
 renderRunDetail();
}
export function renderRunDetail(){
 const r=getRun(state.selectedRunId),empty=$('runEmptyState'),detail=$('runDetail');if(!r){empty.hidden=false;detail.hidden=true;return}
 empty.hidden=true;detail.hidden=false;
 const p=getPart(r.partId),m=getMachine(r.machineId),op=getOperation(r.operationId),met=metricsForRuns([r]);
 const quality=state.scrapEvents.filter(x=>x.runId===r.id),downtime=state.downtimeEvents.filter(x=>x.runId===r.id);
 const mins=downtime.reduce((s,x)=>s+Number(x.minutes||0),0);
 const ct=state.cycleTimes.find(x=>x.partId===r.partId&&x.operationId===r.operationId&&x.machineId===r.machineId);
 const locale=document.documentElement.lang==='en'?'en-US':'es-MX';
 $('runDetailCode').textContent=runCode(r);$('runDetailStatus').textContent=r.status||'completed';$('runDetailStatus').className=`run-status ${r.status||'completed'}`;$('runDetailMethod').textContent=r.captureMethod||'—';$('runDetailLot').textContent=r.lotNumber||'—';
 $('runDetailProduction').textContent=number(met.produced);$('runDetailScrap').textContent=number(met.scrap);$('runDetailYield').textContent=percent(met.yieldRate);$('runDetailPpm').textContent=number(Math.round(met.ppm));$('runDetailCopq').textContent=money(met.copq,p?.currency||'USD');$('runDetailDowntime').textContent=`${number(mins)} min`;
 $('runDetailClient').textContent=getClient(r.clientId)?.name||'—';$('runDetailPart').textContent=p?.number||'—';$('runDetailOperation').textContent=op?`${op.code} · ${op.name}`:'—';$('runDetailMachine').textContent=m?.code||r.machine||'—';$('runDetailCycle').textContent=ct?`${Number(ct.idealCycleSeconds).toFixed(2)} s`:'No configurado';$('runDetailShift').textContent=r.shift||'—';$('runDetailOperator').textContent=getPersonnel(r.operatorId)?.fullName||'—';$('runDetailSupervisor').textContent=getPersonnel(r.supervisorId)?.fullName||'—';$('runDetailCreated').textContent=r.createdAt?new Date(r.createdAt).toLocaleString(locale):'—';$('runDetailCompleted').textContent=r.completedAt?new Date(r.completedAt).toLocaleString(locale):'—';
 $('runQualityList').innerHTML=quality.map(e=>`<div class="entity-item"><span><strong>${esc(getDefect(e.defectId)?.name||'—')}</strong><small>${esc(dispositionLabel(e.disposition))}</small></span><strong>${number(e.quantity)}</strong></div>`).join('')||'<div class="empty-state">Sin eventos de calidad.</div>';
 $('runDowntimeList').innerHTML=downtime.map(e=>`<div class="entity-item"><span><strong>${esc(getDowntimeReason(e.reasonId)?.name||'—')}</strong><small>${e.eventType==='planned'?'Planned':'Unplanned'}</small></span><strong>${number(e.minutes)} min</strong></div>`).join('')||'<div class="empty-state">Sin tiempos muertos.</div>';
}
export function renderSettings(){
 const el=$('shiftList');if(!el)return;
 el.innerHTML=state.shiftSchedules.map(s=>`<div class="entity-item"><span><strong>${esc(s.code)} · ${esc(s.name)}</strong><small>${esc(String(s.startTime).slice(0,5))} → ${esc(String(s.endTime).slice(0,5))} · ${number(s.breakMinutes)} min excluidos</small></span><button class="icon-btn" data-delete-shift="${s.id}">×</button></div>`).join('')||'<div class="empty-state">Sin turnos configurados.</div>';
}
export function renderHistory(){
 const newest=(a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||''));
 const qp=($('productionHistorySearch')?.value||'').toLowerCase();const rs=[...state.runs].sort(newest).filter(r=>`${r.date} ${getClient(r.clientId)?.name} ${getPart(r.partId)?.number} ${getOperation(r.operationId)?.code} ${r.machine}`.toLowerCase().includes(qp));$('productionHistoryBody').innerHTML=rs.map(r=>{const m=metricsForRuns([r]);return `<tr><td>${r.createdAt?new Date(r.createdAt).toLocaleString('es-MX'):r.date}</td><td>${esc(r.shift)}</td><td>${esc(r.lotNumber||'—')}</td><td>${esc(getClient(r.clientId)?.name||'—')}</td><td>${esc(getPart(r.partId)?.number||'—')}</td><td>${esc(getOperation(r.operationId)?.code||'—')}</td><td>${esc(getMachine(r.machineId)?.code||r.machine||'—')}</td><td>${esc(getPersonnel(r.operatorId)?.fullName||'—')}</td><td>${esc(r.status||'completed')}</td><td>${number(r.produced)}</td><td class="${m.scrap?'metric-bad':''}">${number(m.scrap)}</td><td>${percent(m.yieldRate)}</td><td><button class="icon-btn" data-delete-run="${r.id}">×</button></td></tr>`}).join('')||'<tr><td colspan="13" class="empty-state">Sin producción.</td></tr>';
 const qs=($('scrapHistorySearch')?.value||'').toLowerCase();const es=[...state.scrapEvents].sort(newest).filter(e=>{const r=getRun(e.runId);return `${r?.date} ${getClient(r?.clientId)?.name} ${getPart(r?.partId)?.number} ${getDefect(e.defectId)?.name} ${e.disposition}`.toLowerCase().includes(qs)});$('scrapHistoryBody').innerHTML=es.map(e=>{const r=getRun(e.runId),p=getPart(r?.partId);return `<tr><td>${r?.date||'—'}</td><td>${esc(getClient(r?.clientId)?.name||'—')}</td><td>${esc(p?.number||'—')}</td><td>${esc(getOperation(r?.operationId)?.code||'—')}</td><td>${esc(getDefect(e.defectId)?.name||'—')}</td><td>${number(e.quantity)}</td><td>${esc(dispositionLabel(e.disposition))}</td><td>${money(copqForEvent(e),p?.currency||'USD')}</td><td><button class="icon-btn" data-delete-scrap="${e.id}">×</button></td></tr>`}).join('')||'<tr><td colspan="9" class="empty-state">Sin eventos.</td></tr>';
 const dh=$('downtimeHistoryBody');if(dh)dh.innerHTML=[...state.downtimeEvents].sort(newest).map(e=>{const r=getRun(e.runId),p=getPart(r?.partId);return `<tr><td>${r?.date||'—'}</td><td>${esc(getClient(r?.clientId)?.name||'—')}</td><td>${esc(p?.number||'—')}</td><td>${esc(getMachine(r?.machineId)?.code||'—')}</td><td>${esc(getDowntimeReason(e.reasonId)?.name||'—')}</td><td>${esc(e.eventType==='planned'?'Planned':'Unplanned')}</td><td>${number(e.minutes)}</td></tr>`}).join('')||'<tr><td colspan="6" class="empty-state">Sin tiempos muertos.</td></tr>';
}
export function renderRunScrapEvents(){
 const runId=$('scrapRun')?.value,body=$('runScrapEventsBody');if(!body)return;body.innerHTML=eventsForRun(runId).map(e=>`<tr><td>${esc(getDefect(e.defectId)?.name||'—')}</td><td>${number(e.quantity)}</td><td>${esc(dispositionLabel(e.disposition))}</td><td>${money(copqForEvent(e),getPart(getRun(e.runId)?.partId)?.currency||'USD')}</td><td><button class="icon-btn" data-delete-scrap="${e.id}">×</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty-state">Sin eventos para esta corrida.</td></tr>';
}
