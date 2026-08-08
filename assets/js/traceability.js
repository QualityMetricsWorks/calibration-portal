import {$,esc,number,toast} from './utils.js';
import {state,getPart,getClient,getOperation,getMachine,getRun,operationsForPart,machinesForPart,activePersonnelByRole,getPersonnel} from './state.js';
import {populateSelect,renderAll,updateScrapDefects} from './ui.js';
import * as api from './db.js';

const trace={step:1,partId:'',lotNumber:'',quantity:0,operationId:'',machineId:'',supervisorId:'',operatorId:''};
let scanner=null,scanTarget=null,onRegistered=null;

const parsePrefixed=(raw,prefix)=>{const v=String(raw||'').trim();const rx=new RegExp(`^${prefix}\\s*:\\s*`,'i');return v.replace(rx,'').trim()};
const parsePart=raw=>parsePrefixed(raw,'NP');
const parseLot=raw=>parsePrefixed(raw,'LOT');
const parseQty=raw=>{const n=Number(parsePrefixed(raw,'QTY').replace(/[^0-9.]/g,''));return Number.isFinite(n)&&n>0?Math.floor(n):0};

function setStep(n){
 trace.step=n;
 document.querySelectorAll('.trace-step-panel').forEach(x=>x.classList.toggle('active',Number(x.dataset.tracePanel)===n));
 document.querySelectorAll('#traceSteps li').forEach(x=>{const s=Number(x.dataset.step);x.classList.toggle('active',s===n);x.classList.toggle('done',s<n)});
 if(n===4)renderResources();
 if(n===5)renderPeople();
 if(n===6)renderPreview();
}
function result(el,title,subtitle){
 $(el).innerHTML=`<div class="trace-result-card"><div><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></div><span class="trace-result-ok">VALIDADO ✓</span></div>`;
}
function validatePart(raw){
 const value=parsePart(raw);const part=state.parts.find(x=>x.number.toLowerCase()===value.toLowerCase());
 if(!part){toast(`NP no encontrado: ${value||'vacío'}`);return false}
 trace.partId=part.id;$('tracePartScan').value=part.number;
 result('tracePartResult',part.number,`${getClient(part.clientId)?.name||'—'} · ${part.description||'Sin descripción'}`);
 return true;
}
function validateLot(raw){
 const lot=parseLot(raw);if(!lot){toast('El lote es obligatorio.');return false}
 trace.lotNumber=lot;$('traceLotScan').value=lot;result('traceLotResult',lot,'Lote capturado para trazabilidad');return true;
}
function validateQty(raw){
 const qty=parseQty(raw);if(!qty){toast('Cantidad inválida.');return false}
 trace.quantity=qty;$('traceQtyScan').value=String(qty);result('traceQtyResult',`${number(qty)} piezas`,'Cantidad final / envío');return true;
}
function renderResources(){
 populateSelect($('traceOperation'),operationsForPart(trace.partId),'Selecciona operación',x=>`${x.code} · ${x.name}`);
 populateSelect($('traceMachine'),machinesForPart(trace.partId),'Selecciona máquina',x=>`${x.code}${x.name?' · '+x.name:''}`);
 $('traceResourceValidation').innerHTML=`<div class="validation-item">NP identificado y válido</div><div class="validation-item">Máquinas filtradas por relación NP–Máquina</div>`;
}
function renderPeople(){
 populateSelect($('traceSupervisor'),activePersonnelByRole('supervisor'),'Selecciona supervisor',x=>`${x.employeeNo} · ${x.fullName}`);
 populateSelect($('traceOperator'),activePersonnelByRole('operator'),'Selecciona operador',x=>`${x.employeeNo} · ${x.fullName}`);
}
function previewRow(label,value,highlight=false){return `<div class="preview-item ${highlight?'highlight':''}"><span>${esc(label)}</span><strong>${esc(value||'—')}</strong></div>`}
function renderPreview(){
 trace.operationId=$('traceOperation').value;trace.machineId=$('traceMachine').value;trace.supervisorId=$('traceSupervisor').value;trace.operatorId=$('traceOperator').value;
 const p=getPart(trace.partId),op=getOperation(trace.operationId),m=getMachine(trace.machineId),sup=getPersonnel(trace.supervisorId),oper=getPersonnel(trace.operatorId);
 $('traceValidation').innerHTML=[
  'Número de Parte válido',
  'Máquina autorizada para el NP',
  'Operación válida',
  'Lote capturado',
  'Cantidad válida',
  'Supervisor identificado',
  'Operador identificado',
  'Fecha, hora y turno serán asignados por Supabase'
 ].map(x=>`<div class="validation-item">${esc(x)}</div>`).join('');
 $('tracePreview').innerHTML=[
  previewRow('Número de Parte',p?.number,true),
  previewRow('Cliente',getClient(p?.clientId)?.name),
  previewRow('Lote',trace.lotNumber,true),
  previewRow('Cantidad',`${number(trace.quantity)} piezas`,true),
  previewRow('Operación',`${op?.code||''} · ${op?.name||''}`),
  previewRow('Máquina',m?.code),
  previewRow('Supervisor',sup?.fullName),
  previewRow('Operador',oper?.fullName),
  previewRow('Fecha / Hora','Automático al confirmar'),
  previewRow('Turno','Automático según horario de empresa'),
  previewRow('Método','Escaneo'),
  previewRow('Estado','Completado')
 ].join('');
}
function reset(){
 Object.assign(trace,{step:1,partId:'',lotNumber:'',quantity:0,operationId:'',machineId:'',supervisorId:'',operatorId:''});
 ['tracePartScan','traceLotScan','traceQtyScan'].forEach(id=>$(id).value='');
 ['tracePartResult','traceLotResult','traceValidation','tracePreview'].forEach(id=>$(id).innerHTML='');
 $('traceConfirmCheck').checked=false;
 setStep(1);
}
async function startCamera(target){
 scanTarget=target;$('scannerModal').hidden=false;$('scannerTitle').textContent=({part:'Escanear Número de Parte',lot:'Escanear Lote',quantity:'Escanear Cantidad'})[target]||'Escanear código';
 if(!window.Html5Qrcode){toast('El lector de cámara no está disponible. Usa lector USB o captura manual.');return}
 try{
  scanner=new Html5Qrcode('cameraReader');
  await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:280,height:150},aspectRatio:1.6},async decoded=>{
    await stopCamera();applyScan(decoded);
  },()=>{});
 }catch(e){console.error(e);toast('No se pudo iniciar la cámara. Revisa permisos o utiliza lector USB.')}
}
async function stopCamera(){
 $('scannerModal').hidden=true;
 if(scanner){try{await scanner.stop()}catch{}try{scanner.clear()}catch{}scanner=null}
 $('cameraReader').innerHTML='';
}
function applyScan(value){
 if(scanTarget==='part'){if(validatePart(value))setStep(2)}
 if(scanTarget==='lot'){if(validateLot(value))setStep(3)}
 if(scanTarget==='quantity'){if(validateQty(value))setStep(4)}
}
function bindEnter(id,fn,next){$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(fn($(id).value))setStep(next)}})}

export function initTraceability(callback){
 onRegistered=callback;
 document.querySelectorAll('.capture-mode-card').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.capture-mode-card').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.capture-mode-panel').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');$(`capture${b.dataset.captureMode[0].toUpperCase()+b.dataset.captureMode.slice(1)}Panel`).classList.add('active');
 }));
 document.querySelectorAll('.scan-camera-btn').forEach(b=>b.addEventListener('click',()=>startCamera(b.dataset.scanTarget)));
 $('closeScannerBtn').addEventListener('click',stopCamera);
 $('resetTraceBtn').addEventListener('click',reset);
 $('tracePartContinue').addEventListener('click',()=>{if(validatePart($('tracePartScan').value))setStep(2)});
 $('traceLotContinue').addEventListener('click',()=>{if(validateLot($('traceLotScan').value))setStep(3)});
 $('traceQtyContinue').addEventListener('click',()=>{if(validateQty($('traceQtyScan').value))setStep(4)});
 bindEnter('tracePartScan',validatePart,2);bindEnter('traceLotScan',validateLot,3);bindEnter('traceQtyScan',validateQty,4);
 $('traceResourceContinue').addEventListener('click',()=>{if(!$('traceOperation').value||!$('traceMachine').value)return toast('Selecciona operación y máquina.');trace.operationId=$('traceOperation').value;trace.machineId=$('traceMachine').value;setStep(5)});
 $('tracePeopleContinue').addEventListener('click',()=>{if(!$('traceSupervisor').value||!$('traceOperator').value)return toast('Selecciona supervisor y operador.');setStep(6)});
 document.querySelectorAll('.trace-back').forEach(b=>b.addEventListener('click',()=>setStep(Number(b.dataset.backStep))));
 $('traceConfirmBtn').addEventListener('click',async()=>{
  if(!$('traceConfirmCheck').checked)return toast('Confirma la información antes de registrar.');
  try{
   $('traceConfirmBtn').disabled=true;$('traceConfirmBtn').textContent='Registrando…';
   const data=await api.registerProduction({partId:trace.partId,operationId:trace.operationId,machineId:trace.machineId,quantity:trace.quantity,lotNumber:trace.lotNumber,operatorId:trace.operatorId,supervisorId:trace.supervisorId,status:'completed',captureMethod:'scan'});
   toast(data?.action==='finalized_partial'?'Parcial finalizado correctamente':'Producción registrada correctamente');
   reset();if(onRegistered)await onRegistered();
  }catch(e){console.error(e);toast(e.message||'No se pudo registrar la producción.')}
  finally{$('traceConfirmBtn').disabled=false;$('traceConfirmBtn').textContent='Confirmar producción'}
 });
 reset();
}

export function renderBarcode(){
 const p=getPart(state.selectedPartId),svg=$('partBarcode');if(!p||!svg)return;
 $('barcodePayload').textContent=p.number;
 if(window.JsBarcode){try{JsBarcode(svg,p.number,{format:'CODE128',displayValue:true,font:'Inter',fontSize:13,height:46,margin:4,lineColor:'#17212B',background:'#FFFFFF'});}catch(e){console.error(e)}}
}
export function printBarcode(){
 const p=getPart(state.selectedPartId);if(!p)return;
 const svg=$('partBarcode')?.outerHTML||'';
 const w=window.open('','_blank','width=700,height=450');
 w.document.write(`<html><head><title>${esc(p.number)}</title><style>body{font-family:Arial;display:grid;place-items:center;height:100vh;margin:0}.label{border:1px solid #bbb;padding:24px;text-align:center}.brand{font-size:13px;font-weight:700;margin-bottom:12px}.pn{font-size:20px;font-weight:700;margin:8px}</style></head><body><div class="label"><div class="brand">GUVEL GENERAL SYSTEM</div><div class="pn">${esc(p.number)}</div>${svg}</div><script>window.onload=()=>window.print()<\/script></body></html>`);
 w.document.close();
}
