import {state} from './state.js';
let db=null;
export function client(){return db}
export function initDb(){
 const cfg=window.QUALITY_SUMMARY_CONFIG;
 if(!cfg?.supabaseUrl||!cfg?.supabasePublishableKey)throw new Error('Falta configurar Supabase.');
 db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
 return db;
}
export async function loadIdentity(user){
 state.user=user;
 const {data:p,error}=await db.from('profiles').select('company_id,role,display_name').eq('user_id',user.id).single();
 if(error)throw new Error('Usuario sin perfil/empresa. Ejecuta el bootstrap.');
 state.companyId=p.company_id;state.role=p.role||'guest';
 const {data:c,error:ce}=await db.from('companies').select('name').eq('id',state.companyId).single();if(ce)throw ce;
 state.companyName=c?.name||'Organización';
}
export async function loadAll(){
 const desc={ascending:false};
 const [c,p,o,d,m,pm,pe,dr,de,ct,sh,r,s]=await Promise.all([
  db.from('clients').select('*').order('created_at',desc),
  db.from('part_numbers').select('*').order('created_at',desc),
  db.from('operations').select('*').order('created_at',desc),
  db.from('defects').select('*').order('created_at',desc),
  db.from('machines').select('*').order('created_at',desc),
  db.from('part_machines').select('*').order('created_at',desc),
  db.from('personnel').select('*').eq('active',true).order('created_at',desc),
  db.from('downtime_reasons').select('*').eq('active',true).order('created_at',desc),
  db.from('downtime_events').select('*').order('created_at',desc),
  db.from('part_cycle_times').select('*').order('created_at',desc),
  db.from('shift_schedules').select('*').eq('active',true).order('created_at',desc),
  db.from('production_runs').select('*').order('created_at',desc),
  db.from('scrap_events').select('*').order('created_at',desc)
 ]);
 const err=[c,p,o,d,m,pm,pe,dr,de,ct,sh,r,s].find(x=>x.error)?.error;if(err)throw err;
 state.clients=c.data.map(x=>({id:x.id,name:x.name,code:x.code||'',createdAt:x.created_at||''}));
 state.parts=p.data.map(x=>({id:x.id,clientId:x.client_id,number:x.number,description:x.description||'',costPerPiece:Number(x.cost_per_piece||0),currency:x.currency||'USD',createdAt:x.created_at||''}));
 state.operations=o.data.map(x=>({id:x.id,partId:x.part_id,code:x.code,name:x.name,createdAt:x.created_at||''}));
 state.defects=d.data.map(x=>({id:x.id,partId:x.part_id,operationId:x.operation_id||'',code:x.code,name:x.name,category:x.category||'',createdAt:x.created_at||''}));
 state.machines=m.data.map(x=>({id:x.id,code:x.code,name:x.name||'',createdAt:x.created_at||''}));
 state.partMachines=pm.data.map(x=>({id:x.id,partId:x.part_id,machineId:x.machine_id,createdAt:x.created_at||''}));
 state.personnel=pe.data.map(x=>({id:x.id,employeeNo:x.employee_no,fullName:x.full_name,role:x.personnel_role,active:x.active,createdAt:x.created_at||''}));
 state.downtimeReasons=dr.data.map(x=>({id:x.id,code:x.code,name:x.name,category:x.category,downtimeType:x.downtime_type||'unplanned',active:x.active,createdAt:x.created_at||''}));
 state.downtimeEvents=de.data.map(x=>({id:x.id,runId:x.run_id,reasonId:x.reason_id,minutes:Number(x.minutes||0),eventType:x.event_type||'unplanned',notes:x.notes||'',createdAt:x.created_at||''}));
 state.cycleTimes=ct.data.map(x=>({id:x.id,partId:x.part_id,operationId:x.operation_id,machineId:x.machine_id,idealCycleSeconds:Number(x.ideal_cycle_seconds||0),createdAt:x.created_at||''}));
 state.shiftSchedules=sh.data.map(x=>({id:x.id,code:x.shift_code,name:x.shift_name||x.shift_code,startTime:x.start_time,endTime:x.end_time,breakMinutes:Number(x.planned_break_minutes||0),active:x.active,createdAt:x.created_at||''}));
 state.runs=r.data.map(x=>({id:x.id,date:x.run_date,shift:x.shift,clientId:x.client_id,partId:x.part_id,operationId:x.operation_id,machineId:x.machine_id||'',machine:x.machine||'',lotNumber:x.lot_number||'',operatorId:x.operator_id||'',supervisorId:x.supervisor_id||'',status:x.status||'completed',captureMethod:x.capture_method||'manual',manualReason:x.manual_reason||'',produced:Number(x.produced||0),plannedMinutes:Number(x.planned_minutes||0),notes:x.notes||'',completedAt:x.completed_at||'',createdAt:x.created_at||''}));
 state.scrapEvents=s.data.map(x=>({id:x.id,runId:x.production_run_id,defectId:x.defect_id,quantity:Number(x.quantity||0),disposition:x.disposition,reason:x.reason||'',extraCost:Number(x.extra_cost||0),notes:x.notes||'',createdAt:x.created_at||''}));
 state.selectedClientId=state.selectedClientId||state.clients[0]?.id||null;state.selectedPartId=state.selectedPartId||state.parts[0]?.id||null;
}

export async function listCompanyUsers(){return check(await db.rpc('admin_list_company_users'))}
export async function assignUserProfile(x){return check(await db.rpc('admin_upsert_user_profile',{p_email:x.email,p_role:x.role,p_display_name:x.displayName||null}))}
export async function updateUserProfile(x){return check(await db.rpc('admin_update_user_profile',{p_user_id:x.userId,p_role:x.role,p_display_name:x.displayName||null,p_active:x.active}))}
const common=()=>({company_id:state.companyId});
const localAdd=(key,row)=>{if(!row)return row;const map={clients:x=>({id:x.id,name:x.name,code:x.code||'',createdAt:x.created_at||x.createdAt||new Date().toISOString()}),parts:x=>({id:x.id,clientId:x.client_id,number:x.number,description:x.description||'',costPerPiece:Number(x.cost_per_piece||0),currency:x.currency||'USD',createdAt:x.created_at||new Date().toISOString()}),operations:x=>({id:x.id,partId:x.part_id,code:x.code,name:x.name,createdAt:x.created_at||new Date().toISOString()}),defects:x=>({id:x.id,partId:x.part_id,operationId:x.operation_id||'',code:x.code,name:x.name,category:x.category||'',createdAt:x.created_at||new Date().toISOString()}),machines:x=>({id:x.id,code:x.code,name:x.name||'',createdAt:x.created_at||new Date().toISOString()}),personnel:x=>({id:x.id,employeeNo:x.employee_no,fullName:x.full_name,role:x.personnel_role,active:x.active,createdAt:x.created_at||new Date().toISOString()}),downtimeReasons:x=>({id:x.id,code:x.code,name:x.name,category:x.category,downtimeType:x.downtime_type||'unplanned',active:x.active,createdAt:x.created_at||new Date().toISOString()}),cycleTimes:x=>({id:x.id,partId:x.part_id,operationId:x.operation_id,machineId:x.machine_id,idealCycleSeconds:Number(x.ideal_cycle_seconds||0),createdAt:x.created_at||new Date().toISOString()}),shiftSchedules:x=>({id:x.id,code:x.shift_code,name:x.shift_name||x.shift_code,startTime:x.start_time,endTime:x.end_time,breakMinutes:Number(x.planned_break_minutes||0),active:x.active,createdAt:x.created_at||new Date().toISOString()}),runs:x=>({id:x.id,date:x.run_date,shift:x.shift,clientId:x.client_id,partId:x.part_id,operationId:x.operation_id,machineId:x.machine_id||'',machine:x.machine||'',lotNumber:x.lot_number||'',operatorId:x.operator_id||'',supervisorId:x.supervisor_id||'',status:x.status||'completed',captureMethod:x.capture_method||'manual',manualReason:x.manual_reason||'',produced:Number(x.produced||0),plannedMinutes:Number(x.planned_minutes||0),notes:x.notes||'',completedAt:x.completed_at||'',createdAt:x.created_at||new Date().toISOString()}),scrapEvents:x=>({id:x.id,runId:x.production_run_id,defectId:x.defect_id,quantity:Number(x.quantity||0),disposition:x.disposition,reason:x.reason||'',extraCost:Number(x.extra_cost||0),notes:x.notes||'',createdAt:x.created_at||new Date().toISOString()})};const fn=map[key];if(!fn)return row;const item=fn(row);state[key]=[item,...(state[key]||[]).filter(x=>x.id!==item.id)];return item};
const localRemove=(key,id)=>{state[key]=(state[key]||[]).filter(x=>x.id!==id)};
const localReplace=(key,id,row)=>{const list=state[key]||[],item=localAdd(key,row);state[key]=[item,...list.filter(x=>x.id!==id&&x.id!==item.id)]};

export async function insertClient(x){const row=check(await db.from('clients').insert({...common(),name:x.name,code:x.code||null}).select().single());localAdd('clients',row);return row}
export async function deleteClient(id){const r=await db.from('clients').delete().eq('id',id);check(r);localRemove('clients',id)}
export async function insertPart(x){const row=check(await db.from('part_numbers').insert({...common(),client_id:x.clientId,number:x.number,description:x.description||null,cost_per_piece:x.costPerPiece||0,currency:x.currency||'USD'}).select().single());localAdd('parts',row);return row}
export async function deletePart(id){const r=await db.from('part_numbers').delete().eq('id',id);check(r);localRemove('parts',id)}

export async function updatePart(id,x){const row=check(await db.from('part_numbers').update({description:x.description||null,cost_per_piece:x.costPerPiece||0,currency:x.currency||'USD'}).eq('id',id).select().single());localReplace('parts',id,row);return row}


export async function insertDowntimeReason(x){const row=check(await db.from('downtime_reasons').insert({...common(),code:x.code,name:x.name,category:x.category,downtime_type:x.downtimeType||'unplanned',active:true}).select().single());localAdd('downtimeReasons',row);return row}
export async function deleteDowntimeReason(id){const row=check(await db.from('downtime_reasons').update({active:false}).eq('id',id).select().single());localRemove('downtimeReasons',id);return row}
export async function insertDowntimeEvents(runId,items){if(!items?.length)return [];const rows=check(await db.from('downtime_events').insert(items.map(x=>({...common(),run_id:runId,reason_id:x.reasonId,minutes:x.minutes,event_type:x.eventType||'unplanned',notes:x.notes||null}))).select());state.downtimeEvents=[...rows.map(x=>({id:x.id,runId:x.run_id,reasonId:x.reason_id,minutes:Number(x.minutes||0),eventType:x.event_type||'unplanned',notes:x.notes||'',createdAt:x.created_at||new Date().toISOString()})),...state.downtimeEvents];return rows}


export async function upsertCycleTime(x){const row=check(await db.from('part_cycle_times').upsert({...common(),part_id:x.partId,operation_id:x.operationId,machine_id:x.machineId,ideal_cycle_seconds:x.idealCycleSeconds},{onConflict:'part_id,operation_id,machine_id'}).select().single());localReplace('cycleTimes',row.id,row);return row}
export async function deleteCycleTime(id){const r=await db.from('part_cycle_times').delete().eq('id',id);check(r);localRemove('cycleTimes',id)}


export async function upsertShift(x){const row=check(await db.from('shift_schedules').upsert({...common(),shift_code:x.code,shift_name:x.name,start_time:x.startTime,end_time:x.endTime,planned_break_minutes:x.breakMinutes||0,active:true},{onConflict:'company_id,shift_code'}).select().single());localReplace('shiftSchedules',row.id,row);return row}
export async function deactivateShift(id){const row=check(await db.from('shift_schedules').update({active:false}).eq('id',id).select().single());localRemove('shiftSchedules',id);return row}

export async function insertPersonnel(x){const row=check(await db.from('personnel').insert({...common(),employee_no:x.employeeNo,full_name:x.fullName,personnel_role:x.role,active:true}).select().single());localAdd('personnel',row);return row}
export async function deactivatePersonnel(id){const row=check(await db.from('personnel').update({active:false}).eq('id',id).select().single());localRemove('personnel',id);return row}
export async function registerProduction(x){
 const {data,error}=await db.rpc('register_production_run',{
   p_part_id:x.partId,
   p_operation_id:x.operationId,
   p_machine_id:x.machineId,
   p_quantity:x.quantity,
   p_run_date:x.runDate,
   p_shift:x.shift,
   p_lot_number:x.lotNumber||null,
   p_operator_id:x.operatorId,
   p_supervisor_id:x.supervisorId,
   p_status:x.status||'completed',
   p_capture_method:x.captureMethod||'scan',
   p_manual_reason:x.manualReason||null
 });
 if(error)throw error;
 // RPC returns the new run id/metadata. Merge it locally so dependent selectors,
 // runs and dashboard views update immediately without a full database reload.
 if(data?.id){
   const item={id:data.id,date:data.run_date||x.runDate,shift:data.shift,clientId:x.clientId||state.parts.find(p=>p.id===x.partId)?.clientId||'',partId:x.partId,operationId:x.operationId,machineId:x.machineId||'',machine:x.machine||'',lotNumber:x.lotNumber||'',operatorId:x.operatorId||'',supervisorId:x.supervisorId||'',status:x.status||'completed',captureMethod:x.captureMethod||'scan',manualReason:x.manualReason||'',produced:Number(x.quantity||0),plannedMinutes:Number(x.plannedMinutes||0),notes:x.notes||'',completedAt:data.completed_at||'',createdAt:data.created_at||new Date().toISOString()};
   const oldRun=state.runs.find(r=>r.id===item.id);
   if(oldRun)item.produced=oldRun.produced;
   state.runs=[item,...state.runs.filter(r=>r.id!==item.id)];
 }
 return data;
}

export async function insertMachine(x){const row=check(await db.from('machines').insert({...common(),code:x.code,name:x.name||null}).select().single());localAdd('machines',row);return row}
export async function deleteMachine(id){const r=await db.from('machines').delete().eq('id',id);check(r);localRemove('machines',id)}
export async function linkPartMachine(partId,machineId){const row=check(await db.from('part_machines').upsert({...common(),part_id:partId,machine_id:machineId},{onConflict:'part_id,machine_id'}).select().single());const item={id:row.id,partId:row.part_id||partId,machineId:row.machine_id||machineId};state.partMachines=[item,...state.partMachines.filter(x=>x.id!==item.id&&!(x.partId===partId&&x.machineId===machineId))];return row}
export async function unlinkPartMachine(partId,machineId){const r=await db.from('part_machines').delete().eq('part_id',partId).eq('machine_id',machineId);check(r);state.partMachines=state.partMachines.filter(x=>!(x.partId===partId&&x.machineId===machineId))}

export async function insertOperation(x){const row=check(await db.from('operations').insert({...common(),part_id:x.partId,code:x.code,name:x.name}).select().single());localAdd('operations',row);return row}
export async function deleteOperation(id){const r=await db.from('operations').delete().eq('id',id);check(r);localRemove('operations',id)}
export async function insertDefect(x){const row=check(await db.from('defects').insert({...common(),part_id:x.partId,operation_id:x.operationId||null,code:x.code,name:x.name,category:x.category||null}).select().single());localAdd('defects',row);return row}
export async function deleteDefect(id){const r=await db.from('defects').delete().eq('id',id);check(r);localRemove('defects',id)}
export async function insertRun(x){const row=check(await db.from('production_runs').insert({...common(),run_date:x.date,shift:x.shift,client_id:x.clientId,part_id:x.partId,operation_id:x.operationId,machine_id:x.machineId||null,machine:x.machine||null,produced:x.produced,planned_minutes:x.plannedMinutes||null,notes:x.notes||null}).select().single());localAdd('runs',row);return row}
export async function deleteRun(id){const r=await db.from('production_runs').delete().eq('id',id);check(r);localRemove('runs',id)}
export async function insertScrapEvent(x){const row=check(await db.from('scrap_events').insert({...common(),production_run_id:x.runId,defect_id:x.defectId,quantity:x.quantity,disposition:x.disposition,reason:x.reason||null,extra_cost:x.extraCost||0,notes:x.notes||null}).select().single());localAdd('scrapEvents',row);return row}
export async function deleteScrapEvent(id){const r=await db.from('scrap_events').delete().eq('id',id);check(r);localRemove('scrapEvents',id)}

export async function listAuditLogs(limit=500){
  const {data,error}=await db.rpc('list_company_audit_logs',{p_limit:limit});
  if(error)throw error;
  return data||[];
}

function check(res){if(res.error)throw res.error;return res.data}
