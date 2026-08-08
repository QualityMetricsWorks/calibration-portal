import {$,today,toast,number} from './utils.js';
import {state,getClient,getPart,getRun} from './state.js';
import * as api from './db.js';
import * as ui from './ui.js';
import {metricsForRuns,copqForEvent} from './metrics.js';
import {initTraceability,renderBarcode,printBarcode} from './traceability.js';

let db;
function setView(view){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));$(`${view}View`)?.classList.add('active');document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('pageTitle').textContent=({dashboard:'Dashboard',capture:'Captura',clients:'Clientes',parts:'Números de Parte',machines:'Máquinas',personnel:'Personal',catalog:'Catálogo',history:'Historial'})[view]||view}
async function reload(msg='Datos actualizados'){await api.loadAll();ui.renderAll();$('storageStatus').textContent='Supabase sincronizado';if(msg)toast(msg)}
async function run(fn){try{$('storageStatus').textContent='Sincronizando…';await fn();await reload('Guardado correctamente')}catch(e){console.error(e);$('storageStatus').textContent='Error';toast(e.message||'Error')}}
function roleCanWrite(){return ['admin','editor','operator'].includes(state.role)}

function initEvents(){
 document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
 $('refreshDataBtn').addEventListener('click',()=>reload());
 $('signOutBtn').addEventListener('click',()=>db.auth.signOut());
 $('clearFiltersBtn').addEventListener('click',()=>{['filterStart','filterEnd','filterClient','filterPartNumber'].forEach(id=>$(id).value='');ui.updateFilterParts();ui.renderDashboard()});
 ['filterStart','filterEnd','filterPartNumber'].forEach(id=>$(id).addEventListener('change',ui.renderDashboard));$('filterClient').addEventListener('change',()=>{ui.updateFilterParts();ui.renderDashboard()});
 document.querySelectorAll('.history-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.history-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.history-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector(`[data-history-panel="${b.dataset.historyTab}"]`).classList.add('active')}));
 document.querySelectorAll('.detail-tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.detail-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.part-tab-panel').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelector(`[data-part-panel="${b.dataset.partTab}"]`).classList.add('active')}));
$('scrapClient').addEventListener('change',ui.updateScrapParts);$('scrapPart').addEventListener('change',ui.updateScrapOperations);$('scrapOperation').addEventListener('change',ui.findMatchingRuns);$('scrapMachine').addEventListener('change',ui.findMatchingRuns);$('scrapLot').addEventListener('input',ui.findMatchingRuns);$('defectClient').addEventListener('change',ui.updateDefectParts);$('defectPartNumber').addEventListener('change',ui.updateDefectOperations);$('findProductionBtn').addEventListener('click',ui.findMatchingRuns);
 $('scrapEventForm').addEventListener('submit',e=>{e.preventDefault();if(!roleCanWrite())return toast('Tu rol es de solo lectura.');const runObj=getRun($('scrapRun').value),qty=Number($('scrapQuantity').value),existing=state.scrapEvents.filter(x=>x.runId===runObj?.id).reduce((s,x)=>s+Number(x.quantity||0),0);if(!runObj)return toast('Selecciona una corrida.');if(existing+qty>runObj.produced)return toast('La suma de eventos no puede exceder la producción de la corrida.');run(()=>api.insertScrapEvent({runId:runObj.id,defectId:$('scrapDefect').value,quantity:qty,disposition:$('scrapDisposition').value,extraCost:Number($('scrapExtraCost').value||0),reason:$('scrapReason').value.trim(),notes:$('scrapNotes').value.trim()})).then(()=>{$('scrapQuantity').value='';$('scrapExtraCost').value='0';$('scrapReason').value='';$('scrapNotes').value=''});});
 $('clientForm').addEventListener('submit',e=>{e.preventDefault();run(()=>api.insertClient({name:$('clientName').value.trim(),code:$('clientCode').value.trim()})).then(()=>e.target.reset())});
 $('partForm').addEventListener('submit',e=>{e.preventDefault();run(()=>api.insertPart({clientId:$('partClient').value,number:$('partNumberName').value.trim(),description:$('partDescription').value.trim(),costPerPiece:Number($('partCost').value||0),currency:$('partCurrency').value})).then(()=>e.target.reset())});
 $('manualClient').addEventListener('change',()=>{ui.populateSelect($('manualPart'),state.parts.filter(x=>x.clientId===$('manualClient').value),'Selecciona NP',x=>x.number);updateManualResources()});
 $('manualPart').addEventListener('change',updateManualResources);
 function updateManualResources(){const pid=$('manualPart').value;ui.populateSelect($('manualOperation'),state.operations.filter(x=>x.partId===pid),'Selecciona operación',x=>`${x.code} · ${x.name}`);ui.populateSelect($('manualMachine'),state.partMachines.filter(x=>x.partId===pid).map(pm=>state.machines.find(m=>m.id===pm.machineId)).filter(Boolean),'Selecciona máquina',x=>x.code)}
 $('manualProductionForm').addEventListener('submit',e=>{e.preventDefault();run(()=>api.registerProduction({partId:$('manualPart').value,operationId:$('manualOperation').value,machineId:$('manualMachine').value,quantity:Number($('manualQuantity').value),lotNumber:$('manualLot').value.trim(),operatorId:$('manualOperator').value,supervisorId:$('manualSupervisor').value,status:$('manualStatus').value,captureMethod:'manual',manualReason:$('manualReason').value.trim()})).then(()=>{e.target.reset();toast('Captura manual registrada');})});
 $('personnelForm').addEventListener('submit',e=>{e.preventDefault();run(()=>api.insertPersonnel({employeeNo:$('personnelEmployeeNo').value.trim(),fullName:$('personnelName').value.trim(),role:$('personnelRole').value})).then(()=>e.target.reset())});
 $('personnelSearch').addEventListener('input',ui.renderPersonnel);
$('partEditForm').addEventListener('submit',e=>{e.preventDefault();if(!state.selectedPartId)return;run(()=>api.updatePart(state.selectedPartId,{description:$('editPartDescription').value.trim(),costPerPiece:Number($('editPartCost').value||0),currency:$('editPartCurrency').value}))});
$('editPartBtn').addEventListener('click',()=>{$('partEditForm').hidden=!$('partEditForm').hidden});
$('partMachineForm').addEventListener('submit',e=>{e.preventDefault();if(!state.selectedPartId||!$('partMachineSelect').value)return;run(()=>api.linkPartMachine(state.selectedPartId,$('partMachineSelect').value))});
$('machineForm').addEventListener('submit',e=>{e.preventDefault();run(()=>api.insertMachine({code:$('machineCode').value.trim(),name:$('machineName').value.trim()})).then(()=>e.target.reset())});
$('machineSearch').addEventListener('input',ui.renderMachines);

 $('operationForm').addEventListener('submit',e=>{e.preventDefault();if(!state.selectedPartId)return toast('Selecciona un NP.');run(()=>api.insertOperation({partId:state.selectedPartId,code:$('operationCode').value.trim(),name:$('operationName').value.trim()})).then(()=>e.target.reset())});
 $('defectForm').addEventListener('submit',e=>{e.preventDefault();run(()=>api.insertDefect({partId:$('defectPartNumber').value,operationId:$('defectOperation').value,code:$('defectCode').value.trim(),name:$('defectName').value.trim(),category:$('defectCategory').value})).then(()=>{e.target.reset();ui.renderSelects()})});
 $('clientSearch').addEventListener('input',ui.renderClients);$('partSearch').addEventListener('input',ui.renderParts);$('defectSearch').addEventListener('input',ui.renderCatalog);$('productionHistorySearch').addEventListener('input',ui.renderHistory);$('scrapHistorySearch').addEventListener('input',ui.renderHistory);
 document.body.addEventListener('click',e=>{const t=e.target.closest('[data-client-id],[data-part-id],[data-open-part],[data-machine-id],[data-personnel-id],[data-match-run],[data-unlink-machine],[data-delete-operation],[data-delete-defect],[data-delete-run],[data-delete-scrap]');if(!t)return;
  if(t.dataset.clientId){state.selectedClientId=t.dataset.clientId;ui.renderClients()}
  if(t.dataset.partId){state.selectedPartId=t.dataset.partId;ui.renderParts()}
  if(t.dataset.openPart){state.selectedPartId=t.dataset.openPart;setView('parts');ui.renderParts()}
  if(t.dataset.machineId){state.selectedMachineId=t.dataset.machineId;ui.renderMachines()}
  if(t.dataset.personnelId){state.selectedPersonnelId=t.dataset.personnelId;ui.renderPersonnel()}
  if(t.dataset.matchRun){$('scrapRun').value=t.dataset.matchRun;ui.updateScrapDefects();ui.findMatchingRuns()}
  if(t.dataset.unlinkMachine&&confirm('¿Desvincular máquina de este NP?'))run(()=>api.unlinkPartMachine(state.selectedPartId,t.dataset.unlinkMachine))
  if(t.dataset.deleteOperation&&confirm('¿Eliminar operación?'))run(()=>api.deleteOperation(t.dataset.deleteOperation));
  if(t.dataset.deleteDefect&&confirm('¿Eliminar defecto?'))run(()=>api.deleteDefect(t.dataset.deleteDefect));
  if(t.dataset.deleteRun&&confirm('¿Eliminar corrida y sus eventos?'))run(()=>api.deleteRun(t.dataset.deleteRun));
  if(t.dataset.deleteScrap&&confirm('¿Eliminar evento?'))run(()=>api.deleteScrapEvent(t.dataset.deleteScrap));
 });
 $('deleteClientBtn').addEventListener('click',()=>{if(state.selectedClientId&&confirm('¿Eliminar cliente? Solo es posible si no tiene datos relacionados.'))run(()=>api.deleteClient(state.selectedClientId))});
 $('deletePartBtn').addEventListener('click',()=>{if(state.selectedPartId&&confirm('¿Eliminar número de parte?'))run(()=>api.deletePart(state.selectedPartId))});
$('deleteMachineBtn').addEventListener('click',()=>{if(state.selectedMachineId&&confirm('¿Eliminar máquina?'))run(()=>api.deleteMachine(state.selectedMachineId))});
 $('deletePersonnelBtn').addEventListener('click',()=>{if(state.selectedPersonnelId&&confirm('¿Desactivar personal?'))run(()=>api.deactivatePersonnel(state.selectedPersonnelId))});
 $('printBarcodeBtn').addEventListener('click',printBarcode);
 $('clientAddPartBtn').addEventListener('click',()=>{setView('parts');$('partClient').value=state.selectedClientId||''});
 $('partAddDefectBtn').addEventListener('click',()=>{setView('catalog');const p=getPart(state.selectedPartId);$('defectClient').value=p?.clientId||'';ui.updateDefectParts();$('defectPartNumber').value=p?.id||'';ui.updateDefectOperations()});
 $('exportBtn').addEventListener('click',exportExcel);
 $('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('authMessage').textContent='';const {error}=await db.auth.signInWithPassword({email:$('loginEmail').value,password:$('loginPassword').value});if(error)$('authMessage').textContent=error.message});
}
function exportExcel(){
 if(!window.XLSX)return toast('La librería de Excel no está disponible.');
 const production=state.runs.map(r=>{const m=metricsForRuns([r]);return{Fecha:r.date,Turno:r.shift,Cliente:getClient(r.clientId)?.name,NP:getPart(r.partId)?.number,Operacion:state.operations.find(x=>x.id===r.operationId)?.code,Maquina:r.machine,Produccion:r.produced,Scrap:m.scrap,Yield:m.yieldRate,PPM:m.ppm,COPQ:m.copq}});
 const scrap=state.scrapEvents.map(e=>{const r=getRun(e.runId),p=getPart(r?.partId);return{Fecha:r?.date,Cliente:getClient(r?.clientId)?.name,NP:p?.number,Defecto:state.defects.find(x=>x.id===e.defectId)?.name,Cantidad:e.quantity,Disposicion:e.disposition,COPQ:copqForEvent(e)}});
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(production),'Produccion');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(scrap),'Scrap');XLSX.writeFile(wb,'GUVEL_General_System.xlsx');
}
async function startSession(user){
 try{await api.loadIdentity(user);await api.loadAll();$('authOverlay').classList.add('hidden');$('companyContext').textContent=state.companyName;$('userEmail').textContent=user.email;$('storageStatus').textContent='Supabase sincronizado';ui.renderAll();ui.populateSelect($('manualSupervisor'),state.personnel.filter(x=>x.active!==false&&(x.role==='supervisor'||x.role==='both')),'Selecciona supervisor',x=>`${x.employeeNo} · ${x.fullName}`);ui.populateSelect($('manualOperator'),state.personnel.filter(x=>x.active!==false&&(x.role==='operator'||x.role==='both')),'Selecciona operador',x=>`${x.employeeNo} · ${x.fullName}`)}catch(e){console.error(e);toast(e.message);$('authOverlay').classList.remove('hidden')}
}
async function init(){
 db=api.initDb();initEvents();window.GUVEL_RENDER_BARCODE=renderBarcode;initTraceability(()=>reload('Producción registrada'));const {data:{session}}=await db.auth.getSession();if(session?.user)await startSession(session.user);
 db.auth.onAuthStateChange(async(event,session)=>{if(event==='SIGNED_OUT'){$('authOverlay').classList.remove('hidden');location.reload()}else if(session?.user)await startSession(session.user)});
}
init();
