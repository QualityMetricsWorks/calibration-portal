export const state={clients:[],parts:[],operations:[],defects:[],machines:[],partMachines:[],personnel:[],downtimeReasons:[],downtimeEvents:[],cycleTimes:[],shiftSchedules:[],runs:[],scrapEvents:[],companyId:null,companyName:'',role:'viewer',user:null,selectedClientId:null,selectedPartId:null,selectedMachineId:null,selectedPersonnelId:null,selectedRunId:null,auditLogs:[]};
export const getClient=id=>state.clients.find(x=>x.id===id);
export const getPart=id=>state.parts.find(x=>x.id===id);
export const getOperation=id=>state.operations.find(x=>x.id===id);
export const getDefect=id=>state.defects.find(x=>x.id===id);
export const getRun=id=>state.runs.find(x=>x.id===id);
export const partsForClient=id=>state.parts.filter(x=>!id||x.clientId===id);
export const operationsForPart=id=>state.operations.filter(x=>x.partId===id);
export const defectsForPart=(partId,operationId='')=>state.defects.filter(x=>x.partId===partId&&(!operationId||!x.operationId||x.operationId===operationId));
export const eventsForRun=id=>state.scrapEvents.filter(x=>x.runId===id);

export const getMachine=id=>state.machines.find(x=>x.id===id);
export const machinesForPart=partId=>state.partMachines.filter(x=>x.partId===partId).map(x=>getMachine(x.machineId)).filter(Boolean);
export const partsForMachine=machineId=>state.partMachines.filter(x=>x.machineId===machineId).map(x=>getPart(x.partId)).filter(Boolean);

export const getPersonnel=id=>state.personnel.find(x=>x.id===id);
export const activePersonnelByRole=role=>state.personnel.filter(x=>x.active!==false&&(x.role===role||x.role==='both'));

export const getDowntimeReason=id=>state.downtimeReasons.find(x=>x.id===id);
export const downtimeForRun=id=>state.downtimeEvents.filter(x=>x.runId===id);

export const cycleTimesForPart=partId=>state.cycleTimes.filter(x=>x.partId===partId);
export const getCycleTime=(partId,operationId,machineId)=>state.cycleTimes.find(x=>x.partId===partId&&x.operationId===operationId&&x.machineId===machineId);

export const getShift=code=>state.shiftSchedules.find(x=>x.code===code);
