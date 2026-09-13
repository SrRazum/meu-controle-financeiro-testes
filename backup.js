/* Account snapshot validation. No credentials or session data belong in this format. */
(function(root){
 const S=typeof module!=='undefined'?require('./sync-store.js'):root.FinanceStore;
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const keys=(x,allowed)=>object(x)&&Object.keys(x).every(k=>allowed.includes(k));
 const fail=()=>{throw Error('Arquivo de backup inválido ou incompatível.');};
 const safe=k=>typeof k==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(k)&&!['__proto__','constructor','prototype'].includes(k);
 function validate(backup,uid,project){
  if(!keys(backup,['format','version','uid','project','createdAt','state'])||backup.format!=='finance-account-backup'||backup.version!==1)fail();
  if(backup.uid!==uid||backup.project!==project)throw Error('Este backup pertence a outra conta ou projeto.');
  if(typeof backup.createdAt!=='string'||!Number.isFinite(Date.parse(backup.createdAt)))fail();
  const state=backup.state;
  if(!keys(state,['records','pending','conflicts'])||!Array.isArray(state.records)||state.records.length>100000||!object(state.pending)||!object(state.conflicts))fail();
  const records=new Map();
  for(const r of state.records){if(!S.validRecord(r)||records.has(r.id))fail();records.set(r.id,r);}
  const ids=new Set();
  for(const [id,op] of Object.entries(state.pending)){
   if(!safe(id)||!keys(op,['opId','base','value'])||typeof op.opId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(op.opId)||ids.has(op.opId))fail();
   ids.add(op.opId);
   if(!S.validRecord(op.value)||op.value.id!==id||!S.equal(records.get(id),op.value))fail();
   if(op.base!==null&&(!S.validRecord(op.base)||op.base.id!==id))fail();
  }
  for(const [id,conflict] of Object.entries(state.conflicts)){
   if(!safe(id)||!Object.hasOwn(state.pending,id)||!keys(conflict,['remote'])||!Object.hasOwn(conflict,'remote'))fail();
   if(conflict.remote!==null&&(!S.validRecord(conflict.remote)||conflict.remote.id!==id))fail();
  }
  return S.copy(state);
 }
 function create(state,uid,project){const backup={format:'finance-account-backup',version:1,uid,project,createdAt:new Date().toISOString(),state:S.copy(state)};validate(backup,uid,project);return backup;}
 function restore(current,backup,uid,project){
  const incoming=validate(backup,uid,project),next=S.copy(current),records=new Map(next.records.map(x=>[x.id,x]));
  for(const record of incoming.records){
   const id=record.id,local=records.get(id),op=Object.hasOwn(incoming.pending,id)?incoming.pending[id]:null;
   const localOp=Object.hasOwn(next.pending,id)?next.pending[id]:null;
   if(localOp){
    if(op&&!S.equal(localOp.value,op.value))throw Error('Há alterações pendentes diferentes para o mesmo lançamento. Sincronize e resolva as pendências atuais antes de restaurar. Nenhum dado foi substituído.');
    continue;
   }
   // Current records win over historical, already-synced backup records.
   if(local&&!op)continue;
   if(local&&S.equal(local,record))continue;
   records.set(id,S.copy(record));
   // An absent historical record must be checked against the server before recovery.
   next.pending[id]=op?S.copy(op):{opId:crypto.randomUUID(),base:S.copy(record),value:S.copy(record)};
   if(local&&!S.equal(local,next.pending[id].base))next.conflicts[id]={remote:S.copy(local)};
   else if(Object.hasOwn(incoming.conflicts,id))next.conflicts[id]=S.copy(incoming.conflicts[id]);
  }
  next.records=[...records.values()];
  validate(create(next,uid,project),uid,project);
  return next;
 }
 root.FinanceBackup={validate,create,restore};
 if(typeof module!=='undefined')module.exports=root.FinanceBackup;
})(globalThis);
