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
 state.companyId=p.company_id;state.role=p.role||'viewer';
 const {data:c,error:ce}=await db.from('companies').select('name').eq('id',state.companyId).single();if(ce)throw ce;
 state.companyName=c?.name||'Organización';
}
export async function loadAll(){
 const [c,p,o,d,m,pm,pe,r,s]=await Promise.all([
  db.from('clients').select('*').order('name'),
  db.from('part_numbers').select('*').order('number'),
  db.from('operations').select('*').order('code'),
  db.from('defects').select('*').order('code'),
  db.from('machines').select('*').order('code'),
  db.from('part_machines').select('*'),
  db.from('personnel').select('*').eq('active',true).order('full_name'),
  db.from('production_runs').select('*').order('run_date',{ascending:false}),
  db.from('scrap_events').select('*').order('created_at',{ascending:false})
 ]);
 const err=[c,p,o,d,m,pm,pe,r,s].find(x=>x.error)?.error;if(err)throw err;
 state.clients=c.data.map(x=>({id:x.id,name:x.name,code:x.code||''}));
 state.parts=p.data.map(x=>({id:x.id,clientId:x.client_id,number:x.number,description:x.description||'',costPerPiece:Number(x.cost_per_piece||0),currency:x.currency||'USD'}));
 state.operations=o.data.map(x=>({id:x.id,partId:x.part_id,code:x.code,name:x.name}));
 state.defects=d.data.map(x=>({id:x.id,partId:x.part_id,operationId:x.operation_id||'',code:x.code,name:x.name,category:x.category||''}));
 state.machines=m.data.map(x=>({id:x.id,code:x.code,name:x.name||''}));
 state.partMachines=pm.data.map(x=>({id:x.id,partId:x.part_id,machineId:x.machine_id}));
 state.personnel=pe.data.map(x=>({id:x.id,employeeNo:x.employee_no,fullName:x.full_name,role:x.personnel_role,active:x.active}));
 state.runs=r.data.map(x=>({id:x.id,date:x.run_date,shift:x.shift,clientId:x.client_id,partId:x.part_id,operationId:x.operation_id,machineId:x.machine_id||'',machine:x.machine||'',lotNumber:x.lot_number||'',operatorId:x.operator_id||'',supervisorId:x.supervisor_id||'',status:x.status||'completed',captureMethod:x.capture_method||'manual',manualReason:x.manual_reason||'',produced:Number(x.produced||0),plannedMinutes:Number(x.planned_minutes||0),notes:x.notes||'',completedAt:x.completed_at||'',createdAt:x.created_at}));
 state.scrapEvents=s.data.map(x=>({id:x.id,runId:x.production_run_id,defectId:x.defect_id,quantity:Number(x.quantity||0),disposition:x.disposition,reason:x.reason||'',extraCost:Number(x.extra_cost||0),notes:x.notes||'',createdAt:x.created_at}));
 state.selectedClientId=state.selectedClientId||state.clients[0]?.id||null;state.selectedPartId=state.selectedPartId||state.parts[0]?.id||null;
}
const common=()=>({company_id:state.companyId});
export async function insertClient(x){return check(await db.from('clients').insert({...common(),name:x.name,code:x.code||null}).select().single())}
export async function deleteClient(id){check(await db.from('clients').delete().eq('id',id))}
export async function insertPart(x){return check(await db.from('part_numbers').insert({...common(),client_id:x.clientId,number:x.number,description:x.description||null,cost_per_piece:x.costPerPiece||0,currency:x.currency||'USD'}).select().single())}
export async function deletePart(id){check(await db.from('part_numbers').delete().eq('id',id))}

export async function updatePart(id,x){return check(await db.from('part_numbers').update({description:x.description||null,cost_per_piece:x.costPerPiece||0,currency:x.currency||'USD'}).eq('id',id).select().single())}

export async function insertPersonnel(x){return check(await db.from('personnel').insert({...common(),employee_no:x.employeeNo,full_name:x.fullName,personnel_role:x.role,active:true}).select().single())}
export async function deactivatePersonnel(id){return check(await db.from('personnel').update({active:false}).eq('id',id).select().single())}
export async function registerProduction(x){
 const {data,error}=await db.rpc('register_production_run',{
   p_part_id:x.partId,
   p_operation_id:x.operationId,
   p_machine_id:x.machineId,
   p_quantity:x.quantity,
   p_lot_number:x.lotNumber||null,
   p_operator_id:x.operatorId,
   p_supervisor_id:x.supervisorId,
   p_status:x.status||'completed',
   p_capture_method:x.captureMethod||'scan',
   p_manual_reason:x.manualReason||null
 });
 if(error)throw error;
 return data;
}

export async function insertMachine(x){return check(await db.from('machines').insert({...common(),code:x.code,name:x.name||null}).select().single())}
export async function deleteMachine(id){check(await db.from('machines').delete().eq('id',id))}
export async function linkPartMachine(partId,machineId){return check(await db.from('part_machines').upsert({...common(),part_id:partId,machine_id:machineId},{onConflict:'part_id,machine_id'}).select().single())}
export async function unlinkPartMachine(partId,machineId){check(await db.from('part_machines').delete().eq('part_id',partId).eq('machine_id',machineId))}

export async function insertOperation(x){return check(await db.from('operations').insert({...common(),part_id:x.partId,code:x.code,name:x.name}).select().single())}
export async function deleteOperation(id){check(await db.from('operations').delete().eq('id',id))}
export async function insertDefect(x){return check(await db.from('defects').insert({...common(),part_id:x.partId,operation_id:x.operationId||null,code:x.code,name:x.name,category:x.category||null}).select().single())}
export async function deleteDefect(id){check(await db.from('defects').delete().eq('id',id))}
export async function insertRun(x){return check(await db.from('production_runs').insert({...common(),run_date:x.date,shift:x.shift,client_id:x.clientId,part_id:x.partId,operation_id:x.operationId,machine_id:x.machineId||null,machine:x.machine||null,produced:x.produced,planned_minutes:x.plannedMinutes||null,notes:x.notes||null}).select().single())}
export async function deleteRun(id){check(await db.from('production_runs').delete().eq('id',id))}
export async function insertScrapEvent(x){return check(await db.from('scrap_events').insert({...common(),production_run_id:x.runId,defect_id:x.defectId,quantity:x.quantity,disposition:x.disposition,reason:x.reason||null,extra_cost:x.extraCost||0,notes:x.notes||null}).select().single())}
export async function deleteScrapEvent(id){check(await db.from('scrap_events').delete().eq('id',id))}
function check(res){if(res.error)throw res.error;return res.data}
