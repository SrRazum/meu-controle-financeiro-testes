/* Account-first onboarding. Never writes to finance_vault. */
let __supabase=null, __syncBusy=false, account=null, epoch=0, view=[], bootPromise;
const LAST_ACCOUNT='finance-last-account-v2';
const AUTH_STORAGE='finance-auth-v2',SIGNED_OUT='finance-signed-out-v2';
function clearLocalSession(){
  [AUTH_STORAGE,AUTH_STORAGE+'-user',AUTH_STORAGE+'-code-verifier',LAST_ACCOUNT].forEach(key=>localStorage.removeItem(key));
}
let signingOut=false;
let retryAt=0, failures=0;
let syncRequested=false;
function usableSession(session){
  if(signingOut||localStorage.getItem(SIGNED_OUT)==='1')return null;
  if(session?.user){localStorage.setItem(LAST_ACCOUNT,JSON.stringify(session.user));return session;}
  if(!navigator.onLine&&!signingOut){
    try{const user=JSON.parse(localStorage.getItem(LAST_ACCOUNT));if(user?.id)return {user};}catch(e){}
  }
  return null;
}
const $=id=>document.getElementById(id);
function statusTextSync(text,state='busy'){$('syncMsg').textContent=text;$('syncStatus').textContent=text;$('syncDot').className='sync-dot '+state;}
function stampRecord(x){x.updatedAt=new Date().toISOString();return x;}
function refreshSyncUI(){
  $('syncLogged').style.display=account?'block':'none';
  $('syncUser').textContent=account?'Conta: '+account.email:'';
  $('syncRecover').style.display=account?'block':'none';
  $('syncCredentials').style.display=account?'none':'block';
}
function display(state){
  data=FinanceStore.copy(state.records);view=FinanceStore.copy(data);render();
  const n=Object.keys(state.pending).length,c=Object.keys(state.conflicts).length;
  statusTextSync(c?`${c} conflito(s): abra Sincronizar para revisar.`:n?`${n} alteração(ões) salva(s) neste dispositivo; aguardando envio.`:'Dados locais carregados. Verificando nuvem…');
  const box=$('conflicts');box.replaceChildren();
  for(const [id,conflict] of Object.entries(state.conflicts)){
    const pending=state.pending[id];if(!pending)continue;
    const section=document.createElement('div'),detail=document.createElement('pre');
    detail.style.cssText='white-space:pre-wrap;max-height:180px;overflow:auto';
    detail.textContent='Neste dispositivo: '+JSON.stringify(pending.value,null,2)+'\nNa nuvem: '+JSON.stringify(conflict.remote,null,2);
    section.append(detail);
    for(const [label,local] of [['Usar minha alteração',true],['Usar versão da nuvem',false]]){
      const button=document.createElement('button');button.textContent=label;
      button.onclick=()=>resolveConflict(id,local,pending.opId,conflict.remote).catch(e=>statusTextSync(e.message,'err'));section.append(button);
    }
    box.append(section);
  }
}
async function activate(session){
  const next=session?.user||null;
  if(account?.id===next?.id&&(unlocked||!next))return;
  const ticket=++epoch;account=next;unlocked=false;
  retryAt=0;failures=0;
  data=[];view=[];render();closeEdit();limparForm();$('editForm').reset();
  $('conflicts').replaceChildren();$('syncRecoverPassword').value='';$('syncRecoverResult').textContent='';
  $('lockScreen').classList.remove('hidden');refreshSyncUI();
  if(!next){statusTextSync('Entre na sua conta. A fila de cada conta permanece neste dispositivo.','');return;}
  try{
    const state=await FinanceStore.read(next.id);
    if(ticket!==epoch)return;
    display(state);unlocked=true;$('lockScreen').classList.add('hidden');closeSyncModal();
    navigator.storage?.persist?.().catch(()=>{});
    setTimeout(()=>syncNow(),0);
  }catch(e){if(ticket===epoch)statusTextSync('Não foi possível abrir o armazenamento local. '+e.message,'err');}
}
function initCloud(){
  return bootPromise ||= (async()=>{
    if(!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY||!window.supabase){statusTextSync('Configure um projeto Supabase de testes para iniciar.','err');return false;}
    if(localStorage.getItem(SIGNED_OUT)==='1')clearLocalSession();
    if(!navigator.onLine)await activate(usableSession(null));
    if(!__supabase){
      __supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:AUTH_STORAGE}
      });
      __supabase.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT')localStorage.removeItem(LAST_ACCOUNT);
        void activate(usableSession(session));
        if(event==='TOKEN_REFRESHED')setTimeout(()=>syncNow(),0);
      });
    }
    const {data:result,error}=await __supabase.auth.getSession();
    if(error&&!navigator.onLine){await activate(usableSession(null));return false;}
    if(error)throw error;
    await activate(usableSession(result.session));return !!result.session;
  })().catch(e=>{statusTextSync('Não foi possível iniciar: '+e.message,'err');bootPromise=null;return false;});
}
async function openSyncModal(){ $('syncModal').classList.add('show');await initCloud();refreshSyncUI(); }
function closeSyncModal(){ $('syncModal').classList.remove('show'); }
async function authenticate(signup){
  await initCloud();if(!__supabase||account||signingOut)return;
  const email=$('syncEmail').value.trim(),password=$('syncPassword').value;
  if(!email||password.length<6){statusTextSync('Informe e-mail e senha de pelo menos 6 caracteres.','err');return;}
  try{
    localStorage.removeItem(SIGNED_OUT);
    const {data:result,error}=await __supabase.auth[signup?'signUp':'signInWithPassword']({email,password});
    if(error)throw error;
    $('syncPassword').value='';
    if(result.session)await activate(result.session);
    else statusTextSync('Verifique seu e-mail para confirmar a conta. Se já possui conta, use Entrar.','');
  }catch(e){statusTextSync('Não foi possível entrar/criar a conta. Verifique os dados e a conexão.','err');}
}
function syncLogin(){return authenticate(false);}
function syncSignup(){return authenticate(true);}
async function syncLogout(){
  if(!__supabase||signingOut)return;
  signingOut=true;localStorage.setItem(SIGNED_OUT,'1');localStorage.removeItem(LAST_ACCOUNT);
  await activate(null);
  try{
    // The pinned SDK returns early on failed remote logout. Clear offline tokens
    // first so a disconnected logout cannot silently reopen on the next launch.
    if(!navigator.onLine)clearLocalSession();
    const {error}=await __supabase.auth.signOut({scope:'local'});
    if(error)throw error;
  }catch(e){statusTextSync('Sessão encerrada neste dispositivo. Não foi possível confirmar a saída no servidor.','');}
  finally{clearLocalSession();signingOut=false;}
}
async function save(){
  if(!account||!unlocked)throw Error('Entre na conta antes de salvar.');
  const uid=account.id,ticket=epoch,before=FinanceStore.copy(view),after=FinanceStore.copy(data);
  try{
    const state=await FinanceStore.update(uid,s=>FinanceStore.queue(s,before,after));
    if(ticket===epoch){display(state);void syncNow();}
  }catch(e){
    if(ticket===epoch){
      alert('Alteração não salva. '+e.message);
      data=FinanceStore.copy(before);view=FinanceStore.copy(before);render();
      try{const state=await FinanceStore.read(uid);if(ticket===epoch)display(state);}
      catch(readError){if(ticket===epoch)statusTextSync('Armazenamento indisponível. Não feche o formulário antes de copiar os dados.','err');}
    }
    throw e;
  }
}
async function syncNow(manual=false){
  if(!account||!unlocked||!__supabase)return;
  if(__syncBusy){if(manual)syncRequested=true;return;}
  if(!manual&&Date.now()<retryAt)return;
  if(!navigator.onLine){statusTextSync('Offline: alterações preservadas neste dispositivo.');return;}
  const uid=account.id,ticket=epoch;__syncBusy=true;
  try{
    const run=async()=>{
      const state=await FinanceStore.read(uid);
      if(ticket!==epoch)return;
      const sent=Object.values(state.pending).filter(x=>!Object.hasOwn(state.conflicts,x.value.id)).slice(0,1000);
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      let result;
      try{result=await __supabase.rpc('finance_sync_v2',{expected_user:uid,operations:sent}).abortSignal(controller.signal);}
      finally{clearTimeout(timer);}
      const {data:response,error}=result;
      if(error)throw error;
      if(!response||!Array.isArray(response.records)||response.records.some(x=>!FinanceStore.validRecord(x)))throw Error('Resposta da nuvem inválida.');
      if(ticket!==epoch)return;
      const next=await FinanceStore.update(uid,s=>FinanceStore.acknowledge(s,sent,response));
      if(ticket!==epoch)return;
      display(next);
      failures=0;retryAt=0;
      if(!Object.keys(next.pending).length)statusTextSync('Sincronizado com a nuvem.','ok');
    };
    if(navigator.locks)await navigator.locks.request('finance-sync-'+uid,run);else await run();
  }catch(e){if(ticket===epoch){
    retryAt=Date.now()+Math.min(300000,15000*2**Math.min(failures++,5));
    statusTextSync('Envio pendente. Seus dados locais foram preservados. '+e.message,'err');
  }}
  finally{__syncBusy=false;if(syncRequested){syncRequested=false;setTimeout(()=>syncNow(true),0);}}
}
async function resolveConflict(id,local,opId,remote){
  const uid=account?.id,ticket=epoch;if(!uid)return;
  const state=await FinanceStore.update(uid,s=>{
    if(s.pending[id]?.opId!==opId||!FinanceStore.equal(s.conflicts[id]?.remote,remote))throw Error('Conflito mudou. Revise novamente.');
    if(local){s.pending[id].base=remote;s.pending[id].opId=crypto.randomUUID();}
    else {delete s.pending[id];s.records=s.records.filter(x=>x.id!==id);if(remote)s.records.push(remote);}
    delete s.conflicts[id];return s;
  });
  if(ticket===epoch){display(state);void syncNow();}
}
async function importLegacy(source){
  if(!account||!unlocked)return;
  const uid=account.id,ticket=epoch,password=$('syncRecoverPassword').value;
  $('syncRecoverResult').textContent='Verificando cofre antigo…';
  try{
    let raw;
    if(source==='cloud'){
      const {data:row,error}=await __supabase.from('finance_vault').select('payload').eq('user_id',uid).maybeSingle();
      if(error)throw error;raw=row?.payload;
    }else raw=localStorage.getItem(SECURE_KEY)||localStorage.getItem(LEGACY_KEY);
    if(!raw)throw Error('Nenhum cofre antigo encontrado.');
    const parsed=typeof raw==='string'?JSON.parse(raw):raw;
    const records=Array.isArray(parsed)?parsed:await decryptData(password,parsed);
    if(!Array.isArray(records)||records.some(x=>!FinanceStore.validRecord(x)))throw Error('Formato antigo inválido.');
    if(ticket!==epoch)return;
    if(!confirm(`Importar ${records.length} registros para ${account.email}? Confirme que estes dados pertencem a esta conta. O cofre original será preservado.`)){if(ticket===epoch)$('syncRecoverResult').textContent='Importação cancelada.';return;}
    const state=await FinanceStore.update(uid,s=>{
      const before=FinanceStore.copy(s.records),map=new Map(before.map(x=>[x.id,x]));
      for(const x of records){if(map.has(x.id)&&!FinanceStore.equal(map.get(x.id),x))throw Error('Há registros diferentes com o mesmo ID. Resolva a migração antes de importar.');map.set(x.id,x);}
      return FinanceStore.queue(s,before,[...map.values()]);
    });
    if(ticket===epoch){display(state);$('syncRecoverResult').textContent='Importação local concluída. Acompanhe o envio pelo status de sincronização.';void syncNow();}
  }catch(e){if(ticket===epoch){$('syncRecoverResult').textContent='Importação não concluída: '+e.message;statusTextSync('Importação não concluída: '+e.message,'err');}}
  finally{$('syncRecoverPassword').value='';}
}
window.addEventListener('online',()=>syncNow(true));
window.addEventListener('storage',event=>{if(event.key===SIGNED_OUT&&event.newValue==='1')void activate(null);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void syncNow(true);});
setInterval(()=>syncNow(),15000);
window.addEventListener('DOMContentLoaded',()=>{ $('appVersion').textContent='V1.15 · teste de atualização 2';refreshSyncUI();void initCloud(); });
