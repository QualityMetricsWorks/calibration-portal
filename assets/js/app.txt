import {$,toast,esc} from './utils.js';
import {state,getClient,getPart,getRun} from './state.js';
import * as api from './db.js';
import * as ui from './ui.js';
import {metricsForRuns,copqForEvent} from './metrics.js';
import {initTraceability,renderBarcode,printBarcode} from './traceability.js';
import {initI18n,applyLanguage,tr} from './i18n.js';

let db;
const canCapture=()=>['admin','manager','supervisor'].includes(state.role);
const canManage=()=>['admin','manager'].includes(state.role);
const canAdmin=()=>state.role==='admin';

let currentView='dashboard';
function applyRolePermissions(){const r=state.role;document.body.dataset.role=r;document.querySelectorAll('.management-access').forEach(x=>x.hidden=!['admin','manager'].includes(r));document.querySelectorAll('.capture-access').forEach(x=>x.hidden=!['admin','manager','supervisor'].includes(r));document.querySelectorAll('.admin-only').forEach(x=>x.hidden=r!=='admin');document.querySelectorAll('.audit-access').forEach(x=>x.hidden=!['admin','manager'].includes(r));const allowed={dashboard:true,runs:true,data:true,history:['admin','manager'].includes(r),capture:['admin','manager','supervisor'].includes(r),clients:['admin','manager'].includes(r),parts:['admin','manager'].includes(r),machines:['admin','manager'].includes(r),personnel:['admin','manager'].includes(r),catalog:['admin','manager'].includes(r),users:r==='admin',settings:['admin','manager'].includes(r)};if(!allowed[currentView])setView('dashboard');}
async function renderUsersAdmin(){
 const b=$('usersAdminBody');if(!b||state.role!=='admin')return;
 b.innerHTML='<tr><td colspan="6" class="users-loading">Cargando usuarios…</td></tr>';
 try{
  const rows=await api.listCompanyUsers();
  const count=$('usersCount');if(count)count.textContent=(rows||[]).length;
  b.innerHTML=(rows||[]).map(u=>`<tr>
   <td><div class="user-cell"><span class="user-avatar">${(u.display_name||u.email||'U').trim().slice(0,1).toUpperCase()}</span><div><strong>${esc(u.email||'—')}</strong><small>${u.user_id.slice(0,8)}…</small></div></div></td>
   <td><input class="user-name-edit" value="${esc(u.display_name||'')}" data-user-name="${u.user_id}"></td>
   <td><select class="user-role-edit role-${u.role}" data-user-role="${u.user_id}">${['admin','manager','supervisor','guest'].map(r=>`<option value="${r}" ${r===u.role?'selected':''}>${tr(r[0].toUpperCase()+r.slice(1))}</option>`).join('')}</select></td>
   <td><span class="user-status ${u.active?'active':'inactive'}"><i></i>${u.active?'Activo':'Inactivo'}</span></td>
   <td class="user-last-access">${u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleString(document.documentElement.lang==='en'?'en-US':'es-MX'):'—'}</td>
   <td><button class="btn btn-secondary btn-sm" data-user-save="${u.user_id}">Guardar</button></td>
  </tr>`).join('')||'<tr><td colspan="6" class="empty">No hay usuarios asignados.</td></tr>';
 }catch(e){console.error('GUVEL users module:',e);const count=$('usersCount');if(count)count.textContent='0';b.innerHTML='<tr><td colspan="6" class="empty">No se pudo cargar Usuarios. El acceso al portal continúa disponible.</td></tr>'}
}
function bindUserAdmin(){$('userAssignForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!canAdmin())return toast('Solo Admin.');try{await api.assignUserProfile({email:$('userAssignEmail').value.trim(),displayName:$('userAssignName').value.trim(),role:$('userAssignRole').value});toast('Usuario asignado correctamente');e.target.reset();await renderUsersAdmin()}catch(err){toast(err.message||'No se pudo asignar el usuario.')}});document.body.addEventListener('click',async e=>{const b=e.target.closest('[data-user-save]');if(!b||!canAdmin())return;const id=b.dataset.userSave,role=document.querySelector(`[data-user-role="${id}"]`)?.value,name=document.querySelector(`[data-user-name="${id}"]`)?.value||'';try{await api.updateUserProfile({userId:id,role,displayName:name,active:true});toast('Permisos actualizados');await renderUsersAdmin()}catch(err){toast(err.message||'No se pudo actualizar el usuario.')}})}
function setView(view){
 currentView=view;
 document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
 $(`${view}View`)?.classList.add('active');
 document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
 $('exportBtn').hidden=view!=='data';
 const pageLabels={dashboard:'Dashboard',capture:'Captura',clients:'Clientes',parts:'Números de Parte',machines:'Máquinas',personnel:'Personal',catalog:'Catálogo',runs:'Corridas',users:'Usuarios',data:'Datos',history:'Historial',settings:'Configuración'}; $('pageTitle').textContent=tr(pageLabels[view]||view); $('pageTitle').setAttribute('data-i18n',pageLabels[view]||view);
 if(view==='runs')refreshRunsView();
 else if(view==='users'){renderUsersAdmin();applyLanguage()}
 else if(view==='history')refreshAuditView();
 else applyLanguage();
}
async function reload(msg='Sistema Actualizado'){
 await api.loadAll();ui.renderAll();applyLanguage();$('storageStatus').textContent='Sistema Actualizado';if(msg)toast(msg);
}
async function refreshRunsView(){
 const list=$('runList');
 try{
   // v1.4.3: navigation uses the synchronized local state instead of
   // issuing the full 13-query loadAll() on every visit.
   ui.renderRuns();
   applyLanguage();
 }catch(e){
   console.error(e);
   if(list)list.innerHTML=`<div class="run-zero-state error"><strong>No se pudieron cargar las corridas.</strong><small>${esc(e.message||'Error')}</small></div>`;
   toast(e.message||'Error al cargar corridas');
 }
}

let auditRowsCache=[];
async function refreshAuditView(){
 const body=$('auditHistoryBody');
 if(!body)return;
 body.innerHTML='<tr><td colspan="6"><div class="run-loading"><span></span><strong>Cargando historial…</strong></div></td></tr>';
 try{
  const rows=await api.listAuditLogs(500);
  auditRowsCache=rows||[];
  renderAuditHistory();
  applyLanguage();
 }catch(e){
  console.error('GUVEL audit:',e);
  body.innerHTML=`<tr><td colspan="6"><div class="run-zero-state error"><strong>No se pudo cargar el historial.</strong><small>${esc(e.message||'Error')}</small></div></td></tr>`;
 }
}
function auditActionLabel(a){return ({INSERT:'Creación',UPDATE:'Modificación',DELETE:'Eliminación'})[a]||a||'—'}
function auditTableLabel(t){
 const map={production_runs:'Producción',scrap_events:'Calidad',downtime_events:'Mantenimiento',part_numbers:'Números de Parte',clients:'Clientes',machines:'Máquinas',personnel:'Personal',operations:'Operaciones',defects:'Defectos',downtime_reasons:'Catálogo de Paros',part_machines:'Vínculos NP / Máquina',part_cycle_times:'Tiempos de Ciclo',shift_schedules:'Turnos',profiles:'Usuarios'};
 return map[t]||t||'—';
}
function auditChangeSummary(r){
 if(r.action==='INSERT')return 'Registro creado';
 if(r.action==='DELETE')return 'Registro eliminado';
 const old=r.old_data||{},next=r.new_data||{},keys=[...new Set([...Object.keys(old),...Object.keys(next)])];
 const changed=keys.filter(k=>JSON.stringify(old[k])!==JSON.stringify(next[k])).slice(0,4);
 return changed.length?changed.join(', '):'Sin diferencias detectadas';
}
function renderAuditHistory(){
 const body=$('auditHistoryBody');if(!body)return;
 const q=($('auditSearch')?.value||'').trim().toLowerCase(),af=$('auditActionFilter')?.value||'';
 const rows=auditRowsCache.filter(r=>{
  const hay=`${r.actor_email||''} ${r.actor_name||''} ${r.table_name||''} ${auditTableLabel(r.table_name)} ${r.action||''} ${r.record_id||''}`.toLowerCase();
  return (!q||hay.includes(q))&&(!af||r.action===af);
 });
 const count=$('auditCount');if(count)count.textContent=rows.length;
 const last=auditRowsCache[0];
 $('auditLastChange').textContent=last?.created_at?new Date(last.created_at).toLocaleString(document.documentElement.lang==='en'?'en-US':'es-MX'):'—';
 $('auditLastUser').textContent=last?.actor_name||last?.actor_email||'—';
 $('auditCompany').textContent=state.companyName||'—';
 body.innerHTML=rows.map(r=>{
   const actionClass=String(r.action||'').toLowerCase();
   const actor=esc(r.actor_name||r.actor_email||'Sistema');
   const date=r.created_at?new Date(r.created_at).toLocaleString(document.documentElement.lang==='en'?'en-US':'es-MX'):'—';
   return `<tr>
     <td>${date}</td>
     <td><div class="audit-user-cell"><span class="audit-avatar">${actor.slice(0,1).toUpperCase()}</span><span><strong>${actor}</strong><small>${esc(r.actor_email||'')}</small></span></div></td>
     <td><span class="audit-action ${actionClass}">${auditActionLabel(r.action)}</span></td>
     <td>${esc(auditTableLabel(r.table_name))}<small class="audit-raw-table">${esc(r.table_name||'')}</small></td>
     <td><code>${esc(String(r.record_id||'—').slice(0,12))}</code></td>
     <td><button class="btn btn-ghost btn-sm" data-audit-detail="${esc(r.id)}">Ver detalle</button><span class="audit-summary">${esc(auditChangeSummary(r))}</span></td>
   </tr>`;
 }).join('')||'<tr><td colspan="6" class="empty">No hay cambios para los filtros seleccionados.</td></tr>';
}
function showAuditDetail(id){
 const r=auditRowsCache.find(x=>String(x.id)===String(id));if(!r)return;
 $('auditDetailTitle').textContent=`${auditActionLabel(r.action)} · ${auditTableLabel(r.table_name)}`;
 const oldJson=JSON.stringify(r.old_data||{},null,2),newJson=JSON.stringify(r.new_data||{},null,2);
 $('auditDetailBody').innerHTML=`
  <div class="audit-meta-grid">
   <div><span>Usuario</span><strong>${esc(r.actor_name||r.actor_email||'Sistema')}</strong></div>
   <div><span>Correo</span><strong>${esc(r.actor_email||'—')}</strong></div>
   <div><span>Fecha / Hora</span><strong>${r.created_at?new Date(r.created_at).toLocaleString(document.documentElement.lang==='en'?'en-US':'es-MX'):'—'}</strong></div>
   <div><span>Registro</span><strong>${esc(r.record_id||'—')}</strong></div>
  </div>
  <div class="audit-json-grid">
   <div><p class="eyebrow">ANTES</p><pre>${esc(oldJson)}</pre></div>
   <div><p class="eyebrow">DESPUÉS</p><pre>${esc(newJson)}</pre></div>
  </div>`;
 $('auditDetailModal').hidden=false;
}
async function run(fn,msg='Guardado correctamente'){
 try{
   $('storageStatus').textContent='Sincronizando…';
   await fn();
   // v1.4.3: CRUD methods update local state after successful Supabase writes.
   // Avoid a full 13-query reload after every click; this keeps dependent
   // selectors, catalogs and dashboards responsive.
   ui.renderAll();
   applyLanguage();
   $('storageStatus').textContent='Sistema Actualizado';
   if(msg)toast(msg);
 }catch(e){console.error(e);$('storageStatus').textContent='Error';toast(e.message||'Error')}
}

function bindTabs(){
 document.querySelectorAll('.dashboard-tab[data-dashboard-tab]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-dashboard-tab]').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('[data-dashboard-panel]').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');document.querySelector(`[data-dashboard-panel="${b.dataset.dashboardTab}"]`)?.classList.add('active');
  document.querySelector('.maintenance-filter').hidden=b.dataset.dashboardTab!=='maintenance';ui.renderDashboard();
 }));
 document.querySelectorAll('[data-catalog-tab]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('[data-catalog-tab]').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('[data-catalog-panel]').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');document.querySelector(`[data-catalog-panel="${b.dataset.catalogTab}"]`)?.classList.add('active');
 }));
 document.querySelectorAll('.history-tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.history-tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.history-panel').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');document.querySelector(`[data-history-panel="${b.dataset.historyTab}"]`)?.classList.add('active');
 }));
 document.querySelectorAll('.detail-tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.detail-tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.part-tab-panel').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');document.querySelector(`[data-part-panel="${b.dataset.partTab}"]`)?.classList.add('active');
  if(b.dataset.partTab==='cycle-times')ui.renderCycleTimes();
 }));
}

$('printRunBtn')?.addEventListener('click',()=>window.print());

function resetQualityCapture(){
 $('scrapMatchForm').reset();$('scrapEventForm').reset();$('scrapRun').value='';$('matchedRunsList').innerHTML='';$('selectedRunSummary').textContent='Completa los datos para localizar la corrida.';ui.renderSelects();
}
function resetDowntimeCapture(){
 $('downtimeMatchForm').reset();$('downtimeEventForm').reset();$('downtimeRun').value='';$('matchedDowntimeRunsList').innerHTML='';$('selectedDowntimeRunSummary').textContent='Completa los datos para localizar la corrida.';ui.renderSelects();
}

function initEvents(){
 document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
 $('auditSearch')?.addEventListener('input',renderAuditHistory);$('auditActionFilter')?.addEventListener('change',renderAuditHistory);$('refreshAuditBtn')?.addEventListener('click',refreshAuditView);
 document.body.addEventListener('click',e=>{const d=e.target.closest('[data-audit-detail]');if(d)showAuditDetail(d.dataset.auditDetail);if(e.target.closest('[data-close-audit]'))$('auditDetailModal').hidden=true});
 $('auditDetailModal')?.addEventListener('click',e=>{if(e.target.id==='auditDetailModal')e.currentTarget.hidden=true});

 $('refreshDataBtn').addEventListener('click',()=>reload());
 $('signOutBtn').addEventListener('click',()=>db.auth.signOut());
 bindTabs();
 bindUserAdmin();$('refreshUsersBtn')?.addEventListener('click',renderUsersAdmin);

 $('clearFiltersBtn').addEventListener('click',()=>{['filterStart','filterEnd','filterClient','filterPartNumber','filterMachine'].forEach(id=>$(id).value='');$('filterPeriod').value='current';applyPeriod('current');ui.updateFilterParts();ui.renderDashboard()});
 ['filterStart','filterEnd','filterPartNumber','filterMachine'].forEach(id=>$(id).addEventListener('change',ui.renderDashboard));
 $('filterClient').addEventListener('change',()=>{ui.updateFilterParts();ui.renderDashboard()});
 $('filterPeriod').addEventListener('change',()=>{applyPeriod($('filterPeriod').value);ui.renderDashboard()});

 // Quality capture
 $('scrapClient').addEventListener('change',ui.updateScrapParts);
 $('scrapPart').addEventListener('change',ui.updateScrapOperations);
 ['scrapOperation','scrapMachine'].forEach(id=>$(id).addEventListener('change',ui.findMatchingRuns));
 $('scrapLot').addEventListener('input',ui.findMatchingRuns);
 $('findProductionBtn').addEventListener('click',ui.findMatchingRuns);
 $('cancelScrapBtn').addEventListener('click',()=>{resetQualityCapture();toast('Captura de calidad cancelada')});
 $('scrapEventForm').addEventListener('submit',e=>{
  e.preventDefault();if(!canCapture())return toast('Tu rol no tiene permisos de captura.');
  const runObj=getRun($('scrapRun').value),qty=Number($('scrapQuantity').value);
  const existing=state.scrapEvents.filter(x=>x.runId===runObj?.id).reduce((s,x)=>s+Number(x.quantity||0),0);
  if(!runObj)return toast('Selecciona una corrida.');
  if(existing+qty>runObj.produced)return toast('La suma de eventos no puede exceder la producción.');
  run(()=>api.insertScrapEvent({runId:runObj.id,defectId:$('scrapDefect').value,quantity:qty,disposition:$('scrapDisposition').value,extraCost:Number($('scrapExtraCost').value||0),reason:$('scrapReason').value.trim(),notes:$('scrapNotes').value.trim()}),'Evento de calidad registrado').then(()=>{$('scrapQuantity').value='';$('scrapExtraCost').value='0';$('scrapReason').value='';$('scrapNotes').value=''});
 });

 // Independent downtime capture
 $('downtimeClient').addEventListener('change',ui.updateDowntimeParts);
 $('downtimePart').addEventListener('change',ui.updateDowntimeOperations);
 ['downtimeOperation','downtimeMachine'].forEach(id=>$(id).addEventListener('change',ui.findDowntimeMatchingRuns));
 $('downtimeLot').addEventListener('input',ui.findDowntimeMatchingRuns);
 $('findDowntimeRunBtn').addEventListener('click',ui.findDowntimeMatchingRuns);
 $('manualDowntimeReason').addEventListener('change',()=>{const r=state.downtimeReasons.find(x=>x.id===$('manualDowntimeReason').value);if(r)$('manualDowntimeType').value=r.downtimeType||'unplanned'});
 $('cancelDowntimeBtn').addEventListener('click',()=>{resetDowntimeCapture();toast('Captura de tiempo muerto cancelada')});
 $('downtimeEventForm').addEventListener('submit',e=>{
  e.preventDefault();if(!canCapture())return toast('Tu rol no tiene permisos de captura.');
  const runObj=getRun($('downtimeRun').value);if(!runObj)return toast('Selecciona una corrida.');
  const item={reasonId:$('manualDowntimeReason').value,minutes:Number($('manualDowntimeMinutes').value),eventType:$('manualDowntimeType').value,notes:$('manualDowntimeNotes').value.trim()};
  if(!item.reasonId||item.minutes<=0)return toast('Selecciona motivo y minutos.');
  run(()=>api.insertDowntimeEvents(runObj.id,[item]),'Tiempo muerto registrado').then(()=>{$('manualDowntimeMinutes').value='';$('manualDowntimeNotes').value=''});
 });

 // Shift settings
 $('shiftForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');run(()=>api.upsertShift({code:$('shiftCode').value.trim().toUpperCase(),name:$('shiftName').value.trim(),startTime:$('shiftStart').value,endTime:$('shiftEnd').value,breakMinutes:Number($('shiftBreakMinutes').value||0)}),'Turno actualizado').then(()=>e.target.reset())});

 // Masters
 $('clientForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');run(()=>api.insertClient({name:$('clientName').value.trim(),code:$('clientCode').value.trim()})).then(()=>e.target.reset())});
 $('partForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');run(()=>api.insertPart({clientId:$('partClient').value,number:$('partNumberName').value.trim(),description:$('partDescription').value.trim(),costPerPiece:Number($('partCost').value||0),currency:$('partCurrency').value})).then(()=>e.target.reset())});
 $('partEditForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');if(!state.selectedPartId)return;run(()=>api.updatePart(state.selectedPartId,{description:$('editPartDescription').value.trim(),costPerPiece:Number($('editPartCost').value||0),currency:$('editPartCurrency').value})).then(()=>{$('partEditForm').hidden=true})});
 $('editPartBtn').addEventListener('click',()=>{$('partEditForm').hidden=false});
 $('cancelPartEditBtn').addEventListener('click',()=>{$('partEditForm').hidden=true});

 $('partMachineForm').addEventListener('submit',e=>{e.preventDefault();if(!state.selectedPartId||!$('partMachineSelect').value)return;run(()=>api.linkPartMachine(state.selectedPartId,$('partMachineSelect').value))});
 $('cycleTimeForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');if(!state.selectedPartId)return;run(()=>api.upsertCycleTime({partId:state.selectedPartId,operationId:$('cycleTimeOperation').value,machineId:$('cycleTimeMachine').value,idealCycleSeconds:Number($('cycleTimeSeconds').value)}),'Tiempo ciclo actualizado').then(()=>{$('cycleTimeSeconds').value=''})});
 $('cancelCycleTimeBtn').addEventListener('click',()=>{$('cycleTimeForm').reset();ui.renderCycleTimes()});

 $('machineForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');run(()=>api.insertMachine({code:$('machineCode').value.trim(),name:$('machineName').value.trim()})).then(()=>e.target.reset())});
 $('personnelForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');run(()=>api.insertPersonnel({employeeNo:$('personnelEmployeeNo').value.trim(),fullName:$('personnelName').value.trim(),role:$('personnelRole').value})).then(()=>e.target.reset())});
 $('editPersonnelBtn')?.addEventListener('click',()=>{const p=state.personnel.find(x=>x.id===state.selectedPersonnelId);if(!p)return;$('editPersonnelEmployeeNo').value=p.employeeNo||'';$('editPersonnelName').value=p.fullName||'';$('editPersonnelRole').value=p.role||'operator';$('personnelEditForm').hidden=false});
 $('cancelPersonnelEditBtn')?.addEventListener('click',()=>{$('personnelEditForm').hidden=true});
 $('personnelEditForm')?.addEventListener('submit',e=>{e.preventDefault();if(!canManage())return;const id=state.selectedPersonnelId;run(()=>api.updatePersonnel(id,{employeeNo:$('editPersonnelEmployeeNo').value.trim(),fullName:$('editPersonnelName').value.trim(),role:$('editPersonnelRole').value}),'Personal actualizado').then(()=>{$('personnelEditForm').hidden=true})});
 $('operationForm').addEventListener('submit',e=>{e.preventDefault();if(!state.selectedPartId)return toast('Selecciona un NP.');run(()=>api.insertOperation({partId:state.selectedPartId,code:$('operationCode').value.trim(),name:$('operationName').value.trim()})).then(()=>e.target.reset())});
 $('defectForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');run(()=>api.insertDefect({partId:$('defectPartNumber').value,operationId:$('defectOperation').value,code:$('defectCode').value.trim(),name:$('defectName').value.trim(),category:$('defectCategory').value})).then(()=>{e.target.reset();ui.renderSelects()})});
 $('downtimeReasonForm').addEventListener('submit',e=>{e.preventDefault();if(!canManage())return toast('Solo Admin o Manager.');run(()=>api.insertDowntimeReason({code:$('downtimeCode').value.trim(),name:$('downtimeName').value.trim(),category:$('downtimeCategory').value,downtimeType:$('downtimeType').value})).then(()=>e.target.reset())});

 // Dashboard settings and custom dashboard creation
 document.querySelectorAll('[data-dashboard-settings]').forEach(btn=>btn.addEventListener('click',()=>{
   const kind=btn.dataset.dashboardSettings,modal=$('dashboardSettingsModal'),sel=$('dashboardMetricSelect');if(!modal||!sel)return;
   sel.innerHTML=ui.dashboardMetricOptions(kind).map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('');
   modal.dataset.kind=kind;const first=sel.value;const r=ui.getDashboardSetting(kind,first);
   $('dashboardMin').value=r.min;$('dashboardMax').value=r.max;$('dashboardTarget').value=r.target;modal.hidden=false;
 }));
 $('dashboardMetricSelect')?.addEventListener('change',e=>{const r=ui.getDashboardSetting($('dashboardSettingsModal').dataset.kind,e.target.value);$('dashboardMin').value=r.min;$('dashboardMax').value=r.max;$('dashboardTarget').value=r.target});
 const closeDash=()=>{$('dashboardSettingsModal').hidden=true};$('closeDashboardSettingsBtn')?.addEventListener('click',closeDash);$('cancelDashboardSettingsBtn')?.addEventListener('click',closeDash);
 $('dashboardSettingsForm')?.addEventListener('submit',e=>{e.preventDefault();const kind=$('dashboardSettingsModal').dataset.kind,metric=$('dashboardMetricSelect').value,min=Number($('dashboardMin').value),max=Number($('dashboardMax').value),target=Number($('dashboardTarget').value);if(!(max>min)&&!(max===min&&min===0))return toast('El máximo debe ser mayor al mínimo.');if(target<min||target>max)return toast('La meta debe estar dentro del rango.');ui.saveDashboardSetting(kind,metric,{min,max,target});closeDash();ui.renderDashboard()});
 document.body.addEventListener('click',e=>{const b=e.target.closest('[data-add-custom-dashboard]');if(!b)return;const kind=b.dataset.addCustomDashboard;const name=prompt('Nombre del dashboard adicional:');if(!name?.trim())return;ui.addCustomDashboard(kind,name.trim());ui.renderDashboard()});
 // Searches
 $('clientSearch').addEventListener('input',ui.renderClients);$('partSearch').addEventListener('input',ui.renderParts);$('machineSearch').addEventListener('input',ui.renderMachines);$('personnelSearch').addEventListener('input',ui.renderPersonnel);$('defectSearch').addEventListener('input',ui.renderCatalog);$('downtimeSearch').addEventListener('input',ui.renderDowntimeCatalog);$('runSearch').addEventListener('input',ui.renderRuns);$('productionHistorySearch').addEventListener('input',ui.renderHistory);$('scrapHistorySearch').addEventListener('input',ui.renderHistory);
 document.querySelectorAll('.form-cancel-btn').forEach(b=>b.addEventListener('click',()=>b.closest('form')?.reset()));

 document.body.addEventListener('click',e=>{
  const t=e.target.closest('[data-client-id],[data-part-id],[data-run-id],[data-open-part],[data-machine-id],[data-personnel-id],[data-match-run],[data-match-downtime-run],[data-unlink-machine],[data-delete-operation],[data-delete-defect],[data-delete-run],[data-delete-scrap],[data-delete-downtime-reason],[data-delete-cycle-time],[data-delete-shift]');
  if(!t)return;
  if(t.dataset.clientId){state.selectedClientId=t.dataset.clientId;ui.renderClients()}
  if(t.dataset.runId){state.selectedRunId=t.dataset.runId;ui.renderRuns();applyLanguage()}
  if(t.dataset.partId){state.selectedPartId=t.dataset.partId;ui.renderParts()}
  if(t.dataset.openPart){state.selectedPartId=t.dataset.openPart;setView('parts');ui.renderParts()}
  if(t.dataset.machineId){state.selectedMachineId=t.dataset.machineId;ui.renderMachines()}
  if(t.dataset.personnelId){state.selectedPersonnelId=t.dataset.personnelId;ui.renderPersonnel()}
  if(t.dataset.matchRun){$('scrapRun').value=t.dataset.matchRun;ui.updateScrapDefects();ui.findMatchingRuns()}
  if(t.dataset.matchDowntimeRun){$('downtimeRun').value=t.dataset.matchDowntimeRun;ui.renderSelectedDowntimeRun();ui.findDowntimeMatchingRuns()}
  if(t.dataset.unlinkMachine&&confirm('¿Desvincular máquina de este NP?'))run(()=>api.unlinkPartMachine(state.selectedPartId,t.dataset.unlinkMachine));
  if(t.dataset.deleteOperation&&confirm('¿Eliminar operación?'))run(()=>api.deleteOperation(t.dataset.deleteOperation));
  if(t.dataset.deleteDefect&&confirm('¿Eliminar defecto?'))run(()=>api.deleteDefect(t.dataset.deleteDefect));
  if(t.dataset.deleteRun&&confirm('¿Eliminar corrida y sus eventos?'))run(()=>api.deleteRun(t.dataset.deleteRun));
  if(t.dataset.deleteScrap&&confirm('¿Eliminar evento?'))run(()=>api.deleteScrapEvent(t.dataset.deleteScrap));
  if(t.dataset.deleteDowntimeReason&&confirm('¿Desactivar motivo de paro?'))run(()=>api.deleteDowntimeReason(t.dataset.deleteDowntimeReason));
  if(t.dataset.deleteCycleTime&&confirm('¿Eliminar este tiempo ciclo?'))run(()=>api.deleteCycleTime(t.dataset.deleteCycleTime),'Tiempo ciclo eliminado');
  if(t.dataset.deleteShift&&confirm('¿Desactivar este turno?'))run(()=>api.deactivateShift(t.dataset.deleteShift),'Turno desactivado');
 });

 $('deleteClientBtn').addEventListener('click',()=>{if(state.selectedClientId&&confirm('¿Eliminar cliente?'))run(()=>api.deleteClient(state.selectedClientId))});
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
 const production=state.runs.map(r=>{const m=metricsForRuns([r]);return{Fecha:r.date,Turno:r.shift,Cliente:getClient(r.clientId)?.name,NP:getPart(r.partId)?.number,Operacion:state.operations.find(x=>x.id===r.operationId)?.code,Maquina:state.machines.find(x=>x.id===r.machineId)?.code,Produccion:r.produced,Scrap:m.scrap,Yield:m.yieldRate,PPM:m.ppm,COPQ:m.copq}});
 const quality=state.scrapEvents.map(e=>{const r=getRun(e.runId),p=getPart(r?.partId);return{Fecha:r?.date,Cliente:getClient(r?.clientId)?.name,NP:p?.number,Defecto:state.defects.find(x=>x.id===e.defectId)?.name,Cantidad:e.quantity,Disposicion:e.disposition,COPQ:copqForEvent(e)}});
 const downtime=state.downtimeEvents.map(e=>{const r=getRun(e.runId),reason=state.downtimeReasons.find(x=>x.id===e.reasonId);return{Fecha:r?.date,Cliente:getClient(r?.clientId)?.name,NP:getPart(r?.partId)?.number,Maquina:state.machines.find(x=>x.id===r?.machineId)?.code,Paro:reason?.name,Tipo:reason?.downtimeType,Minutos:e.minutes}});
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(production),'Produccion');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(quality),'Calidad');XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(downtime),'Mantenimiento');XLSX.writeFile(wb,'GUVEL_General_System_v1.0.1.xlsx');
}

async function startSession(user){
 try{await api.loadIdentity(user);await api.loadAll();$('authOverlay').classList.add('hidden');$('companyContext').textContent=state.companyName;$('userEmail').textContent=user.email;$('storageStatus').textContent='Sistema Actualizado';applyRolePermissions();ui.renderAll();applyLanguage()}
 catch(e){console.error(e);toast(e.message);$('authOverlay').classList.remove('hidden')}
}
function iso(d){return d.toISOString().slice(0,10)}
function applyPeriod(v){
 const now=new Date(),s=new Date(now),e=new Date(now);if(v==='custom')return;
 if(v==='current')s.setDate(1);
 else if(v==='previous_day'){s.setDate(now.getDate()-1);e.setDate(now.getDate()-1)}
 else if(v==='previous_week'){const day=(now.getDay()+6)%7;e.setDate(now.getDate()-day-1);s.setTime(e.getTime());s.setDate(e.getDate()-6)}
 else if(v==='previous_month'){s.setMonth(now.getMonth()-1,1);e.setDate(0)}
 else if(v==='previous_quarter'){const q=Math.floor(now.getMonth()/3);s.setMonth((q-1)*3,1);e.setMonth(q*3,0)}
 else if(v==='previous_half'){const half=now.getMonth()<6?0:1;s.setFullYear(half?now.getFullYear():now.getFullYear()-1);s.setMonth(half?0:6,1);e.setFullYear(s.getFullYear());e.setMonth(s.getMonth()+6,0)}
 else if(v==='previous_year'){s.setFullYear(now.getFullYear()-1,0,1);e.setFullYear(now.getFullYear()-1,11,31)}
 $('filterStart').value=iso(s);$('filterEnd').value=iso(e)
}
async function init(){
 db=api.initDb();initI18n();initEvents();window.GUVEL_RENDER_BARCODE=renderBarcode;initTraceability(()=>{ui.renderAll();applyLanguage();$('storageStatus').textContent='Sistema Actualizado';toast('Producción registrada correctamente')});applyPeriod('current');
 const {data:{session}}=await db.auth.getSession();if(session?.user)await startSession(session.user);
 db.auth.onAuthStateChange(async(event,session)=>{if(event==='SIGNED_OUT'){$('authOverlay').classList.remove('hidden');location.reload()}else if(session?.user)await startSession(session.user)});
}
init();
