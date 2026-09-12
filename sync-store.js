/* Durable per-account outbox. Transactions commit records and pending writes together. */
(function(root){
  const copy = x => JSON.parse(JSON.stringify(x));
  const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
  const equal = (a,b) => JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
  const empty = () => ({records:[],pending:{},conflicts:{}});
  const own=(object,key)=>Object.hasOwn(object,key)?object[key]:undefined;
  function validDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
  }
  function validRecord(x){
    return !!x&&typeof x.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x.id)&&!['__proto__','constructor','prototype'].includes(x.id)&&
      (!Object.hasOwn(x,'deleted')||typeof x.deleted==='boolean')&&
      (x.deleted===true||(typeof x.descricao==='string'&&typeof x.categoria==='string'&&typeof x.valor==='number'&&Number.isFinite(x.valor)&&Math.abs(x.valor)<=Number.MAX_SAFE_INTEGER&&
       validDate(x.data)&&(!Object.hasOwn(x,'vencimento')||x.vencimento===''||validDate(x.vencimento))&&
       ['entrada','saida'].includes(x.tipo)&&['pessoal','restaurante'].includes(x.controle)&&['pago','pendente'].includes(x.status)));
  }
  function queue(state,before,after){
    const old = new Map(before.map(x=>[x.id,x]));
    const current = new Map(state.records.map(x=>[x.id,x]));
    for(const value of after){
      if(!validRecord(value))throw Error('Lançamento inválido. Verifique os campos.');
      if(equal(old.get(value.id),value)) continue;
      if(!equal(current.get(value.id),old.get(value.id))) throw Error('Este lançamento mudou em outra aba. Reabra o formulário e tente novamente.');
      const previous=own(state.pending,value.id);
      state.pending[value.id]={opId:crypto.randomUUID(),base:previous?previous.base:(old.get(value.id)||null),value:copy(value)};
      current.set(value.id,copy(value));
    }
    state.records=[...current.values()];
    return state;
  }
  function acknowledge(state,sent,response){
    const accepted=new Set(response.accepted);
    for(const item of sent){
      const id=item.value.id, pending=own(state.pending,id);
      if(!pending)continue;
      if(accepted.has(item.opId)){
        if(pending.opId===item.opId){delete state.pending[id];delete state.conflicts[id];}
        else pending.base=item.value; // An edit made while the request was in flight.
      }else if(own(response.conflicts,id)) state.conflicts[id]=response.conflicts[id];
    }
    const merged=new Map(response.records.map(x=>[x.id,x]));
    Object.values(state.pending).forEach(x=>merged.set(x.value.id,x.value));
    state.records=[...merged.values()];
    return state;
  }
  let dbPromise;
  function database(){
    return dbPromise ||= new Promise((resolve,reject)=>{
      const request=indexedDB.open('finance-account-v2',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('accounts');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async function update(uid,fn){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('accounts','readwrite'), store=tx.objectStore('accounts');
      let result, failure;
      const request=store.get(uid);
      request.onsuccess=()=>{
        try{result=fn(request.result||empty());store.put(result,uid);}
        catch(e){failure=e;tx.abort();}
      };
      tx.oncomplete=()=>resolve(copy(result));
      tx.onabort=()=>reject(failure||tx.error||Error('Falha ao salvar neste dispositivo.'));
      tx.onerror=()=>{};
    });
  }
  root.FinanceStore={copy,equal,validRecord,empty,queue,acknowledge,update,read:uid=>update(uid,x=>x)};
  if(typeof module!=='undefined')module.exports=root.FinanceStore;
})(globalThis);
