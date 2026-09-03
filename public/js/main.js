// ── Utils ──────────────────────────────────────────────────────
const $    = id  => document.getElementById(id)
const api  = async (u,o={}) => { const r=await fetch(u,{headers:{'Content-Type':'application/json'},credentials:'same-origin',...o}); return r.json() }
const post = (u,b) => api(u,{method:'POST',body:JSON.stringify(b)})
const put  = (u,b) => api(u,{method:'PUT', body:JSON.stringify(b)})
const del  = u    => api(u,{method:'DELETE'})
const fmtD = s    => s?new Date(s).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'
const fmtUp= s    => {if(!s)return'—';const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?`${h}h${m.toString().padStart(2,'0')}m`:`${m}min`}
const fmtM = n    => `$${Number(n||0).toLocaleString('fr-FR')}`

function toast(msg,type='success'){
  const ic={success:'ti-circle-check',error:'ti-alert-circle',warn:'ti-alert-triangle',info:'ti-info-circle'}
  const t=document.createElement('div'); t.className=`toast ${type}`
  t.innerHTML=`<i class="ti ${ic[type]||ic.info}"></i><span>${msg}</span>`
  $('toasts').appendChild(t); setTimeout(()=>t.remove(),3500)
}

function openModal(title,html,w='680px'){
  $('modal-title').textContent=title; $('modal-body').innerHTML=html
  $('modal-box').style.width=w; $('modal-back').style.display='flex'
}
function closeModal(){ $('modal-back').style.display='none' }
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()})

// ── Login ──────────────────────────────────────────────────────
async function initApp(){
  const me=await api('/api/me').catch(()=>({}))
  if(me.ok){launchApp();return}
  const t=await post('/api/login',{password:'__probe__'})
  if(t.setup) $('l-setup').style.display='flex'
  await loadBrandLogin()
}
async function loadBrandLogin(){
  const cfg=await api('/api/panel-config').catch(()=>({}))
  if(cfg.panel_nom)   $('l-title').textContent=cfg.panel_nom
  if(cfg.panel_emoji) $('l-icon').textContent=cfg.panel_emoji
}
async function login(){
  const pwd=$('l-pwd').value.trim(); if(!pwd) return setErr('l-err','Entrez un mot de passe')
  const d=await post('/api/login',{password:pwd}); if(d.error) return setErr('l-err',d.error)
  launchApp()
}
function setErr(id,msg){const e=$(id);e.textContent=msg;e.style.display=msg?'block':'none'}
function toggleEye(id,btn){const i=$(id);i.type=i.type==='password'?'text':'password';btn.querySelector('i').className=i.type==='password'?'ti ti-eye':'ti ti-eye-off'}
async function doLogout(){await post('/api/logout',{});location.reload()}
async function launchApp(){
  $('login-screen').style.display='none'; $('app').style.display='flex'
  await loadBrand(); setupNav(); goPage('dashboard'); startPoll()
}
async function loadBrand(){
  const cfg=await api('/api/panel-config').catch(()=>({}))
  if(cfg.panel_nom){$('sb-title').textContent=cfg.panel_nom;document.title=cfg.panel_nom+' — Panel'}
  if(cfg.panel_emoji) $('sb-icon').textContent=cfg.panel_emoji
}

// ── Nav ────────────────────────────────────────────────────────
const TITLES={dashboard:'Dashboard',activite:'Activité en direct',alertes:'Alertes',instances:'Mes bots',logs:'Logs globaux',settings:'Paramètres','demo-restauration':'Aperçu Restauration','demo-custom':'Aperçu Custom',securite:'Sécurité'}

function setupNav(){document.querySelectorAll('.sb-link[data-p]').forEach(a=>a.addEventListener('click',()=>goPage(a.dataset.p)))}

function goPage(page){
  document.querySelectorAll('.sb-link').forEach(a=>a.classList.remove('active'))
  document.querySelector(`.sb-link[data-p="${page}"]`)?.classList.add('active')
  $('tb-title').textContent=TITLES[page]||page
  $('content').className='content page-enter'
  const fns={dashboard:renderDashboard,activite:renderActivite,alertes:renderAlertes,instances:renderInstances,logs:renderLogs,settings:renderSettings,securite:renderSecurite,'demo-restauration':()=>renderDemo('restauration'),'demo-custom':()=>renderDemo('custom')}
  fns[page]?.()
}
function refreshPage(){
  const ic=$('refresh-ic');ic.classList.add('spinning')
  const cur=document.querySelector('.sb-link.active')?.dataset.p; if(cur) goPage(cur)
  updateHealth(); setTimeout(()=>ic.classList.remove('spinning'),800)
}

// ── Polling ────────────────────────────────────────────────────
let _lastActId=0, _pollTimer=null
function startPoll(){updateHealth(); setInterval(updateHealth,15000); pollActivite()}

async function updateHealth(){
  const s=await api('/api/stats').catch(()=>null); if(!s) return
  const bc=$('b-bots');if(bc)bc.textContent=s.total||''
  const ba=$('b-alert');if(ba){ba.textContent=s.alertes_non_lues||'';ba.style.display=s.alertes_non_lues?'':'none'}
  const dot=$('sb-health')?.querySelector('.h-dot'),lbl=$('h-label')
  if(!dot||!lbl) return
  if(s.erreurs>0)          {dot.className='h-dot red';   lbl.textContent=`${s.erreurs} erreur(s)`}
  else if(s.maintenance>0) {dot.className='h-dot yellow';lbl.textContent=`${s.maintenance} maintenance`}
  else if(s.actifs>0)      {dot.className='h-dot green'; lbl.textContent='Actifs'}
  else                     {dot.className='h-dot gray';  lbl.textContent='En attente'}
}

async function pollActivite(){
  const data=await api(`/api/activite?since=${_lastActId}`).catch(()=>[])
  if(data.length){
    _lastActId=Math.max(...data.map(d=>d.id),_lastActId)
    const ba=$('b-act'); if(ba) ba.textContent=data.length
    // Si on est sur la page activité, refresh le flux
    if(document.querySelector('.sb-link[data-p="activite"]')?.classList.contains('active')) injectActivite(data)
  }
  setTimeout(pollActivite,8000)
}

function injectActivite(rows){
  const list=$('acti-list'); if(!list) return
  rows.forEach(r=>{
    const div=document.createElement('div'); div.className='acti-line acti-new'
    div.innerHTML=actiLine(r)
    list.insertBefore(div,list.firstChild)
  })
  // Max 100 lignes
  while(list.children.length>100) list.removeChild(list.lastChild)
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
async function renderDashboard(){
  const c=$('content'); c.innerHTML='<div style="color:var(--t2);padding:20px">Chargement…</div>'
  const [stats,insts,alertes]=await Promise.all([api('/api/stats'),api('/api/instances'),api('/api/alertes')])
  const alertesNonLues=alertes.filter(a=>!a.lu)

  c.innerHTML=`
    <div class="g4" style="margin-bottom:22px">
      <div class="card-gold"><div class="stat-l">Bots total</div><div class="stat-v gold">${stats.total}</div></div>
      <div class="card"><div class="stat-l">En ligne</div><div class="stat-v" style="color:var(--green)">${stats.actifs}</div><div class="stat-s">sur ${stats.total}</div></div>
      <div class="card"><div class="stat-l">Maintenance</div><div class="stat-v" style="color:${stats.maintenance?'var(--yel)':'var(--t1)'}">${stats.maintenance}</div></div>
      <div class="card"><div class="stat-l">Erreurs 24h</div><div class="stat-v" style="color:${stats.logs_errors?'var(--red)':'var(--t1)'}">${stats.logs_errors}</div></div>
    </div>

    ${alertesNonLues.length?`
    <div style="background:rgba(239,68,68,.06);border:.5px solid rgba(239,68,68,.25);border-radius:var(--r2);padding:14px 18px;margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--red)"><i class="ti ti-bell"></i> ${alertesNonLues.length} alerte(s) critique(s)</div>
        <button class="btn btn-sm" onclick="post('/api/alertes/tout-lu',{}).then(()=>renderDashboard())">Tout marquer lu</button>
      </div>
      ${alertesNonLues.slice(0,3).map(a=>`
        <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:.5px solid rgba(239,68,68,.15);font-size:12px">
          <span style="font-size:14px">${a.inst_emoji||'🤖'}</span>
          <span style="color:var(--t1);flex:1"><strong>${a.inst_nom}</strong> — ${a.message}</span>
          <span style="color:var(--t3);font-size:11px">${fmtD(a.date)}</span>
          <button class="btn btn-sm" onclick="post('/api/alertes/${a.id}/lu',{}).then(()=>renderDashboard())"><i class="ti ti-x"></i></button>
        </div>`).join('')}
    </div>`:``}

    <div class="sec-title"><i class="ti ti-robot"></i>État des bots</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${!insts.length
        ?`<div class="card" style="text-align:center;padding:40px;color:var(--t2)"><i class="ti ti-robot" style="font-size:38px;opacity:.2;display:block;margin-bottom:14px"></i>Aucun bot — <span style="color:var(--gold);cursor:pointer" onclick="goPage('instances')">créer le premier</span></div>`
        :insts.map(i=>botCard(i,true)).join('')}
    </div>`
}

// ════════════════════════════════════════════════════════════════
// ACTIVITÉ EN DIRECT
// ════════════════════════════════════════════════════════════════
async function renderActivite(){
  const c=$('content'); c.innerHTML='<div style="color:var(--t2);padding:20px">Chargement…</div>'
  const rows=await api('/api/activite')
  if(rows.length) _lastActId=Math.max(...rows.map(r=>r.id),_lastActId)
  c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="sec-title" style="margin:0"><i class="ti ti-activity"></i>Flux en direct — rafraîchi toutes les 8s</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 6px rgba(34,197,94,.5);display:inline-block;animation:pg 2s infinite"></span>
        <span style="font-size:12px;color:var(--green)">En direct</span>
      </div>
    </div>
    <div class="card" id="acti-list" style="padding:0;overflow:hidden">
      ${rows.length?rows.map(r=>`<div class="acti-line">${actiLine(r)}</div>`).join('')
        :'<div style="color:var(--t2);font-size:12px;text-align:center;padding:30px">Aucune activité pour l\'instant — les déclarations des employés apparaîtront ici</div>'}
    </div>`
  const ba=$('b-act'); if(ba) ba.textContent=''
}

function actiLine(r){
  const icons={prod:'ti-tool',vente:'ti-shopping-cart',custom:'ti-car',absence:'ti-calendar-off',depart:'ti-user-off',service_debut:'ti-player-play',service_fin:'ti-player-stop'}
  const cols={prod:'var(--blue)',vente:'var(--green)',custom:'#8b5cf6',absence:'var(--yel)',depart:'var(--red)',service_debut:'var(--green)',service_fin:'var(--t2)'}
  const labels={prod:'Production',vente:'Vente',custom:'Custom',absence:'Absence déclarée',depart:'Départ serveur',service_debut:'Prise de service',service_fin:'Fin de service'}
  const icon=icons[r.type]||'ti-circle', col=cols[r.type]||'var(--t2)', label=labels[r.type]||r.type
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:.5px solid var(--br)">
      <div style="width:32px;height:32px;border-radius:8px;background:${col}18;border:.5px solid ${col}44;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="ti ${icon}" style="font-size:15px;color:${col}"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${r.employe_tag||'Employé'} <span style="color:${col}">${label}</span></div>
        <div style="font-size:11px;color:var(--t2);margin-top:2px">${r.inst_emoji||'🤖'} ${r.inst_nom||''} ${r.detail?`— ${r.detail}`:''}</div>
      </div>
      ${r.montant?`<div style="font-size:13px;font-weight:700;color:var(--gold)">${fmtM(r.montant)}</div>`:''}
      <div style="font-size:11px;color:var(--t3);flex-shrink:0">${fmtD(r.date)}</div>
    </div>`
}

// ════════════════════════════════════════════════════════════════
// ALERTES
// ════════════════════════════════════════════════════════════════
async function renderAlertes(){
  const c=$('content'); c.innerHTML='<div style="color:var(--t2);padding:20px">Chargement…</div>'
  const alertes=await api('/api/alertes')
  c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="sec-title" style="margin:0"><i class="ti ti-bell"></i>Alertes</div>
      <button class="btn btn-gold btn-sm" onclick="post('/api/alertes/tout-lu',{}).then(()=>renderAlertes())"><i class="ti ti-checks"></i> Tout marquer lu</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${!alertes.length?`<div class="card" style="text-align:center;padding:30px;color:var(--t2)"><i class="ti ti-bell-off" style="font-size:32px;opacity:.25;display:block;margin-bottom:10px"></i>Aucune alerte</div>`
        :alertes.map(a=>{
          const col=a.niveau==='error'?'var(--red)':a.niveau==='warn'?'var(--yel)':'var(--blue)'
          const bg=a.niveau==='error'?'var(--rd)':a.niveau==='warn'?'var(--yd)':'var(--bd)'
          return `<div style="display:flex;align-items:center;gap:12px;background:${a.lu?'var(--bg2)':bg};border:.5px solid ${a.lu?'var(--br)':col+'44'};border-radius:var(--r2);padding:14px 16px;opacity:${a.lu?'.55':'1'}">
            <span style="font-size:20px">${a.inst_emoji||'🤖'}</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:500;color:${a.lu?'var(--t2)':'var(--t1)'}">${a.message}</div>
              <div style="font-size:11px;color:var(--t3);margin-top:3px">${a.inst_nom||''} · ${fmtD(a.date)}</div>
            </div>
            ${!a.lu?`<button class="btn btn-sm" onclick="post('/api/alertes/${a.id}/lu',{}).then(()=>renderAlertes())"><i class="ti ti-check"></i> Lu</button>`:''}
          </div>`}).join('')}
    </div>`
}

// ════════════════════════════════════════════════════════════════
// INSTANCES
// ════════════════════════════════════════════════════════════════
async function renderInstances(){
  const c=$('content')
  const [insts,modeles]=await Promise.all([api('/api/instances'),api('/api/modeles')])
  c.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
      <div class="sec-title" style="margin:0"><i class="ti ti-robot"></i>${insts.length} bot(s)</div>
      <button class="btn btn-solid" onclick="openModalCreer()"><i class="ti ti-plus"></i> Nouveau bot</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">${insts.map(i=>botCard(i,false)).join('')}</div>
    <div style="margin-top:22px;background:var(--bg2);border:.5px solid var(--gb);border-radius:var(--r2);padding:18px 20px">
      <div class="sec-title" style="margin-bottom:10px"><i class="ti ti-brand-github"></i>Déployer un bot sur Railway</div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:12px">Après avoir créé un bot ici et téléchargé le modèle correspondant :</div>
      <div style="background:var(--bg0);border:.5px solid var(--br);border-radius:var(--r);padding:14px;font-family:monospace;font-size:12px;color:var(--gold);line-height:2;position:relative">
        <span style="color:var(--t3)"># Terminal Mac/Linux :</span><br>
        cd ~/Downloads && unzip MODELE.zip -d bot-extract && cd bot-extract/MODELE<br>
        git init && git add . && git commit -m "init"<br>
        git remote add origin https://github.com/TON_USER/NOM-BOT.git<br>
        git push -u origin main<br>
        <span style="color:var(--t3)"># Puis sur railway.app → New Project → Deploy from GitHub</span><br>
        <span style="color:var(--t3)"># Variable Railway : SESSION_SECRET=une_chaine_aleatoire_32_chars</span>
      </div>
    </div>`
}

function botCard(inst,compact){
  const st=inst.statut||'configure', live=inst.live||{}
  const pills={actif:`<span class="pill p-green"><i class="ti ti-circle-check"></i> Actif</span>`,configure:`<span class="pill p-gold"><i class="ti ti-settings"></i> À configurer</span>`,maintenance:`<span class="pill p-yellow"><i class="ti ti-tool"></i> Maintenance</span>`,arrete:`<span class="pill p-gray"><i class="ti ti-player-stop"></i> Arrêté</span>`,erreur:`<span class="pill p-red"><i class="ti ti-alert-circle"></i> Erreur</span>`}
  const modeleLabel = inst.modele==='custom'?'🔧 Custom véhicule':'🍽️ Restauration'
  return `
  <div class="bot-card ${st!=='actif'?st:''}" style="border-color:${inst.couleur}44">
    <div class="bc-icon" style="background:${inst.couleur}15;border:.5px solid ${inst.couleur}44">${inst.emoji}</div>
    <div style="flex:1;min-width:0">
      <div class="bc-name">${inst.nom} ${pills[st]||pills.arrete} <span class="pill p-gray">${modeleLabel}</span>
        ${inst.site_url?`<a href="${inst.site_url}" target="_blank" class="pill p-blue" style="text-decoration:none"><i class="ti ti-external-link"></i> Site</a>`:''}
      </div>
      <div class="bc-desc">${inst.description||''}</div>
      <div class="bc-meta">
        <div class="bc-stat" style="color:${inst.bot_online?'var(--green)':'var(--t3)'}"><i class="ti ti-${inst.bot_online?'wifi':'wifi-off'}"></i>${inst.bot_online?'En ligne':'Hors ligne'}</div>
        ${live.tag?`<div class="bc-stat"><i class="ti ti-at"></i>${live.tag}</div>`:''}
        ${live.latency?`<div class="bc-stat"><i class="ti ti-activity"></i>${live.latency}ms</div>`:''}
        ${live.uptime?`<div class="bc-stat"><i class="ti ti-clock"></i>${fmtUp(live.uptime)}</div>`:''}
      </div>
    </div>
    <div class="bc-actions">
      <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">
        ${st==='actif'||st==='erreur'?`<button class="btn btn-yellow btn-sm" onclick="toggleMaint(${inst.id},'${st}')"><i class="ti ti-tool"></i>${compact?'':'Maintenance'}</button>`:''}
        ${st==='maintenance'?`<button class="btn btn-green btn-sm" onclick="toggleMaint(${inst.id},'${st}')"><i class="ti ti-check"></i>${compact?'':'Lever'}</button>`:''}
        ${inst.bot_online
          ?`<button class="btn btn-red btn-sm" onclick="ctrlBot(${inst.id},'stop')"><i class="ti ti-player-stop"></i>${compact?'':'Stop'}</button>
            <button class="btn btn-sm" onclick="ctrlBot(${inst.id},'restart')"><i class="ti ti-refresh"></i>${compact?'':'Restart'}</button>`
          :st!=='configure'?`<button class="btn btn-green btn-sm" onclick="ctrlBot(${inst.id},'start')"><i class="ti ti-player-play"></i>${compact?'':'Démarrer'}</button>`:''}
        <button class="btn btn-gold btn-sm" onclick="openEditor(${inst.id})"><i class="ti ti-settings"></i>${compact?'':'Config'}</button>
        ${!compact?`<button class="btn btn-sm" onclick="openLogsModal(${inst.id})"><i class="ti ti-terminal-2"></i> Logs</button>`:''}
      </div>
      ${st==='configure'?`<div style="font-size:11px;color:var(--gold);margin-top:4px;text-align:right">Configure le token Discord pour démarrer</div>`:''}
    </div>
  </div>`
}

async function ctrlBot(id,action){
  toast({start:'Démarrage…',stop:'Arrêt…',restart:'Redémarrage…'}[action],'info')
  const d=await post(`/api/instances/${id}/${action}`,{}); d.ok?toast('OK','success'):toast(d.error||'Erreur','error')
  refreshPage()
}

function toggleMaint(id,cur){
  if(cur==='maintenance'){post(`/api/instances/${id}/maintenance`,{activer:false}).then(d=>{d.ok?toast('Maintenance levée','success'):toast(d.error,'error');refreshPage()});return}
  openModal('🔧 Maintenance',`
    <div class="fg"><label>Message affiché sur le site</label><textarea id="m-msg" rows="3">Site en maintenance. Revenez bientôt.</textarea></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-yellow" onclick="confirmMaint(${id})"><i class="ti ti-tool"></i> Activer</button>
    </div>`,'480px')
}
async function confirmMaint(id){ const d=await post(`/api/instances/${id}/maintenance`,{activer:true,message:$('m-msg')?.value||'Site en maintenance.'}); d.ok?(toast('Maintenance activée','warn'),closeModal(),refreshPage()):toast(d.error,'error') }

// ── Modal créer ────────────────────────────────────────────────
function openModalCreer(){
  openModal('➕ Nouveau bot',`
    <div style="margin-bottom:16px">
      <div class="sec-title" style="margin-bottom:10px">Choisir un modèle</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="modele-card active" id="mc-restauration" onclick="selectModele('restauration')">
          <div style="font-size:28px;margin-bottom:8px">🍽️</div>
          <div style="font-weight:600;font-size:13px">Restauration</div>
          <div style="font-size:11px;color:var(--t2);margin-top:3px">Prod, vente, craft</div>
          <div class="mc-check"><i class="ti ti-check"></i></div>
        </div>
        <div class="modele-card" id="mc-custom" onclick="selectModele('custom')">
          <div style="font-size:28px;margin-bottom:8px">🔧</div>
          <div style="font-weight:600;font-size:13px">Custom véhicule</div>
          <div style="font-size:11px;color:var(--t2);margin-top:3px">Customisation, montant</div>
          <div class="mc-check"><i class="ti ti-check"></i></div>
        </div>
      </div>
      <input type="hidden" id="n-modele" value="restauration">
    </div>
    <div class="fg"><label>Nom de l'entreprise *</label><input type="text" id="n-nom" placeholder="Ex : Bella Cucina RP" autofocus></div>
    <div class="row2">
      <div class="fg"><label>Emoji</label><input type="text" id="n-emoji" value="🍽️" maxlength="4" style="text-align:center;font-size:20px"></div>
      <div class="fg"><label>Description</label><input type="text" id="n-desc" placeholder="Fast-food downtown"></div>
    </div>
    <div class="fg"><label>Couleur</label>
      <div style="display:flex;gap:10px;align-items:center">
        <div id="n-sw" style="width:36px;height:36px;border-radius:8px;background:#C9A84C;border:.5px solid var(--br2);cursor:pointer;flex-shrink:0" onclick="$('n-cpick').click()"></div>
        <input type="text" id="n-col" value="#C9A84C" oninput="$('n-sw').style.background=this.value" style="max-width:120px">
        <input type="color" id="n-cpick" value="#C9A84C" style="opacity:0;position:absolute" oninput="$('n-col').value=this.value;$('n-sw').style.background=this.value">
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
      <button class="btn" onclick="closeModal()">Annuler</button>
      <button class="btn btn-solid" onclick="creerInst()"><i class="ti ti-plus"></i> Créer</button>
    </div>`,'520px')
}

function selectModele(m){
  $('n-modele').value=m
  document.querySelectorAll('.modele-card').forEach(c=>{c.classList.remove('active')})
  $(`mc-${m}`)?.classList.add('active')
  // Mettre à jour emoji/couleur selon modèle
  const emojis={restauration:'🍽️',custom:'🔧'}
  const cols={restauration:'#C9A84C',custom:'#8b5cf6'}
  const ne=$('n-emoji');if(ne)ne.value=emojis[m]||'🤖'
  const nc=$('n-col'),np=$('n-cpick'),ns=$('n-sw')
  if(nc)nc.value=cols[m]||'#C9A84C'; if(np)np.value=cols[m]||'#C9A84C'; if(ns)ns.style.background=cols[m]||'#C9A84C'
}

async function creerInst(){
  const nom=$('n-nom')?.value?.trim(); if(!nom){toast('Nom requis','error');return}
  const modele=$('n-modele')?.value||'restauration'
  const d=await post('/api/instances',{nom,modele,emoji:$('n-emoji')?.value,description:$('n-desc')?.value,couleur:$('n-col')?.value})
  if(!d.ok){toast(d.error,'error');return}
  // Afficher le guide de déploiement
  closeModal()
  showGuideCreation(d.id, nom, modele, $('n-col')?.value||'#C9A84C', $('n-emoji')?.value||'🤖')
  refreshPage()
}

function showGuideCreation(instId, nom, modele, couleur, emoji){
  const slug = nom.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g,'-')
  const isWin = navigator.platform.includes('Win')
  const extractCmd = isWin
    ? `Expand-Archive -Path "${slug}-bot.zip" -DestinationPath ${slug}-bot -Force`
    : `unzip ${slug}-bot.zip -d ${slug}-bot`
  const cdCmd = isWin ? `cd ${slug}-bot\\${modele==='restauration'?'bella-cucina-bot':'custom-bot'}` : `cd ${slug}-bot/${modele==='restauration'?'bella-cucina-bot':'custom-bot'}`

  openModal(`🚀 ${emoji} ${nom} — Déploiement`, `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:40px;margin-bottom:10px">${emoji}</div>
      <div style="font-size:16px;font-weight:700;background:linear-gradient(135deg,${couleur},#f0c97e);-webkit-background-clip:text;-webkit-text-fill-color:transparent">${nom}</div>
      <div style="font-size:12px;color:var(--t2);margin-top:4px">Modèle : ${modele==='restauration'?'🍽️ Restauration':'🔧 Custom véhicule'}</div>
    </div>

    <!-- Étape 1 : Télécharger -->
    <div class="guide-step">
      <div class="guide-num">1</div>
      <div class="guide-body">
        <div class="guide-title">Télécharge le dossier du bot</div>
        <div class="guide-desc">Le ZIP est personnalisé avec tes paramètres.</div>
        <a href="/api/instances/${instId}/telecharger" class="btn btn-solid" style="display:inline-flex;margin-top:10px;text-decoration:none">
          <i class="ti ti-download"></i> Télécharger ${slug}-bot.zip
        </a>
      </div>
    </div>

    <!-- Étape 2 : Créer repo GitHub -->
    <div class="guide-step">
      <div class="guide-num">2</div>
      <div class="guide-body">
        <div class="guide-title">Crée un repo GitHub</div>
        <div class="guide-desc">Va sur <a href="https://github.com/new" target="_blank" style="color:var(--gold)">github.com/new</a> → donne un nom (ex: <code>${slug}-bot</code>) → Create repository.</div>
      </div>
    </div>

    <!-- Étape 3 : Terminal -->
    <div class="guide-step">
      <div class="guide-num">3</div>
      <div class="guide-body">
        <div class="guide-title">Ouvre ton terminal ${isWin?'(PowerShell)':'(Terminal)'} dans Downloads</div>
        <div class="guide-desc">Colle ces commandes <strong>une par une</strong> :</div>
        <div class="guide-cmds">
          ${[
            isWin ? `cd $env:USERPROFILE\\Downloads` : `cd ~/Downloads`,
            extractCmd,
            cdCmd,
            `git init`,
            `git remote add origin https://github.com/TON_USER/${slug}-bot.git`,
            `git add .`,
            `git commit -m "init ${nom}"`,
            `git push origin master:main --force`,
          ].map(cmd=>`<div class="guide-cmd" onclick="copyCmd(this)">${cmd}<span class="guide-copy"><i class="ti ti-copy"></i></span></div>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--t3);margin-top:6px">⚠️ Remplace <code>TON_USER</code> par ton pseudo GitHub</div>
      </div>
    </div>

    <!-- Étape 4 : Railway -->
    <div class="guide-step">
      <div class="guide-num">4</div>
      <div class="guide-body">
        <div class="guide-title">Déploie sur Railway</div>
        <div class="guide-desc">
          <a href="https://railway.app/new" target="_blank" style="color:var(--gold)">railway.app/new</a> → Deploy from GitHub → sélectionne <strong>${slug}-bot</strong><br>
          <br>
          Variable à ajouter dans Railway → Variables :<br>
          <div class="guide-cmd" style="margin-top:6px" onclick="copyCmd(this)">SESSION_SECRET=<span style="color:var(--t3)">(une suite de lettres/chiffres aléatoires)</span><span class="guide-copy"><i class="ti ti-copy"></i></span></div>
          <br>
          Puis : Settings → Networking → <strong>Generate Domain</strong>
        </div>
      </div>
    </div>

    <!-- Étape 5 : Configurer depuis le site -->
    <div class="guide-step">
      <div class="guide-num">5</div>
      <div class="guide-body">
        <div class="guide-title">Configure tout depuis le site patron</div>
        <div class="guide-desc">
          Ouvre l'URL Railway du bot → crée ton mot de passe → va dans <strong>⚙️ Paramètres</strong> et remplis :<br>
          <br>
          • Token Discord du bot<br>
          • Guild ID du serveur<br>
          • IDs des channels et rôles Discord<br>
          • Nom, couleur, emoji de l'entreprise<br>
          <br>
          Clique <strong>Sauvegarder</strong> → le bot se connecte automatiquement ✅
        </div>
      </div>
    </div>

    <!-- Étape 6 : Lier au showroom -->
    <div class="guide-step" style="border:none">
      <div class="guide-num" style="background:var(--gd);color:var(--gold);border-color:var(--gb)">6</div>
      <div class="guide-body">
        <div class="guide-title">Lier au Showroom (optionnel)</div>
        <div class="guide-desc">
          Dans les paramètres du bot → section Intégration Showroom :<br>
          • URL Showroom : <code style="color:var(--gold)">${location.origin}</code><br>
          • Instance ID : <code style="color:var(--gold)">${instId}</code><br>
          <br>
          Les déclarations des employés apparaîtront en temps réel sur ton dashboard.
        </div>
      </div>
    </div>

    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
      <button class="btn" onclick="closeModal()">Fermer</button>
      <a href="/api/instances/${instId}/telecharger" class="btn btn-solid" style="text-decoration:none"><i class="ti ti-download"></i> Re-télécharger le ZIP</a>
    </div>
  `, '640px')
}

function copyCmd(el){
  const text = el.textContent.replace('', '').trim()
  navigator.clipboard.writeText(text).then(()=>{
    const ic = el.querySelector('.guide-copy')
    if(ic){ ic.innerHTML='<i class="ti ti-check"></i>'; ic.style.color='var(--green)'; setTimeout(()=>{ ic.innerHTML='<i class="ti ti-copy"></i>'; ic.style.color='' },1500) }
  })
}

// ── Éditeur config instance ────────────────────────────────────
let _inst=null
async function openEditor(id){
  _inst=await api(`/api/instances/${id}`)
  openModal(`⚙️ ${_inst.nom}`,buildEditor(),'760px')
}

function buildEditor(){
  return `<div style="display:flex;height:540px;margin:-20px -22px">
    <div style="width:170px;background:var(--bg1);border-right:.5px solid var(--gb);padding:10px 8px;display:flex;flex-direction:column;gap:2px;flex-shrink:0">
      ${[['design','ti-palette','Design'],['discord','ti-brand-discord','Discord'],['channels','ti-hash','Channels'],['roles','ti-shield','Rôles'],['grades','ti-award','Grades & Paie'],['articles','ti-package','Articles'],['cv','ti-file-text','Questions CV']]
        .map(([id,icon,label],i)=>`<button class="cfg-tab ${i===0?'active':''}" onclick="swCfg('${id}')" data-ct="${id}"><i class="ti ${icon}"></i>${label}</button>`).join('')}
      <div style="flex:1"></div>
      <button class="btn btn-red btn-sm" style="width:100%;justify-content:center;margin-top:6px" onclick="deleteInst(${_inst.id},'${_inst.nom}')"><i class="ti ti-trash"></i> Supprimer</button>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;overflow:hidden">
      ${pDesign()}${pDiscord()}${pChannels()}${pRoles()}${pGrades()}${pArticles()}${pCV()}
      <div style="padding:12px 20px;border-top:.5px solid var(--gb);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0">
        <button class="btn" onclick="closeModal()">Annuler</button>
        <button class="btn btn-solid" onclick="saveInst()"><i class="ti ti-device-floppy"></i> Sauvegarder</button>
      </div>
    </div>
  </div>`
}

function swCfg(id){document.querySelectorAll('.cfg-tab').forEach(t=>t.classList.remove('active'));document.querySelector(`.cfg-tab[data-ct="${id}"]`)?.classList.add('active');document.querySelectorAll('.cfg-panel').forEach(p=>p.classList.remove('active'));$(`cp-${id}`)?.classList.add('active')}

function pDesign(){return `<div class="cfg-panel active" id="cp-design">
  <div class="fg"><label>Nom</label><input type="text" id="e-nom" value="${_inst.nom}"></div>
  <div class="row2">
    <div class="fg"><label>Emoji</label><input type="text" id="e-emoji" value="${_inst.emoji}" style="text-align:center;font-size:20px" maxlength="4"></div>
    <div class="fg"><label>Couleur</label>
      <div style="display:flex;gap:8px;align-items:center">
        <div id="e-sw" style="width:32px;height:32px;border-radius:6px;background:${_inst.couleur};border:.5px solid var(--br2);cursor:pointer;flex-shrink:0" onclick="$('e-cpick').click()"></div>
        <input type="text" id="e-color" value="${_inst.couleur}" oninput="$('e-sw').style.background=this.value" style="flex:1">
        <input type="color" id="e-cpick" value="${_inst.couleur}" style="opacity:0;position:absolute" oninput="$('e-color').value=this.value;$('e-sw').style.background=this.value">
      </div>
    </div>
  </div>
  <div class="fg"><label>Description</label><input type="text" id="e-desc" value="${_inst.description||''}"></div>
  <div class="fg"><label>URL du site patron (Railway URL)</label><input type="url" id="e-siteurl" value="${_inst.site_url||''}" placeholder="https://mon-bot.railway.app"></div>
</div>`}

function pDiscord(){return `<div class="cfg-panel" id="cp-discord">
  <div class="fg"><label>Token Discord *</label>
    <div style="position:relative">
      <input type="password" id="e-token" value="" placeholder="${_inst.discord_token||'Collez le token…'}" style="padding-right:44px">
      <button onclick="toggleEye('e-token',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--t2);cursor:pointer;font-size:16px"><i class="ti ti-eye"></i></button>
    </div>
    <div class="hint">Laissez vide pour conserver le token actuel.</div>
  </div>
  <div class="row2">
    <div class="fg"><label>Client ID</label><input type="text" id="e-cid" value="${_inst.discord_client_id||''}"></div>
    <div class="fg"><label>Guild ID</label><input type="text" id="e-gid" value="${_inst.guild_id||''}"></div>
  </div>
</div>`}

function chF(k,icon,label){return `<div class="fg"><label><i class="ti ${icon}" style="font-size:12px;opacity:.7;margin-right:4px"></i>${label}</label><input type="text" id="e-ch-${k}" value="${_inst[`channel_${k}`]||''}" placeholder="ID Discord"></div>`}

function pChannels(){return `<div class="cfg-panel" id="cp-channels"><div class="row2">
  ${chF('cv','ti-file-text','Channel CV')}${chF('logs','ti-terminal-2','Channel Logs')}
  ${chF('productions','ti-tool','Channel Productions')}${chF('ventes','ti-shopping-cart','Channel Ventes')}
  ${chF('alertes','ti-bell','Channel Alertes')}${chF('welcome','ti-door-enter','Channel Welcome')}
  ${chF('annonces','ti-speakerphone','Channel Annonces')}${chF('absences','ti-calendar-off','Channel Absences')}
</div></div>`}

function roF(k,icon,label){return `<div class="fg"><label><i class="ti ${icon}" style="font-size:12px;opacity:.7;margin-right:4px"></i>${label}</label><input type="text" id="e-ro-${k}" value="${_inst[`role_${k}`]||''}" placeholder="ID Discord"></div>`}

function pRoles(){return `<div class="cfg-panel" id="cp-roles">
  ${roF('employe','ti-user','Rôle Employé')}${roF('attente_entretien','ti-clock','Rôle Attente entretien')}${roF('patron','ti-crown','Rôle Patron')}
  <div style="background:var(--gd);border:.5px solid var(--gb);border-radius:var(--r);padding:10px 12px;font-size:12px;color:var(--gold)">
    Les rôles par grade se configurent dans l'onglet Grades (colonne Rôle Discord ID).
  </div>
</div>`}

function pGrades(){
  const grades=_inst.grades||[]
  return `<div class="cfg-panel" id="cp-grades">
  <div style="font-size:12px;color:var(--t2);margin-bottom:10px">2 modes : <strong style="color:var(--gold)">% du CA</strong> ou <strong style="color:var(--gold)">à la pièce</strong>. Rôle Discord ID pour attribution auto.</div>
  <div style="display:grid;grid-template-columns:28px 1fr 60px 28px 80px 70px 70px 80px 28px;gap:4px;font-size:9px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;padding-bottom:6px;border-bottom:.5px solid var(--br);margin-bottom:8px">
    <div></div><div>Nom</div><div>Mode</div><div>Emo</div><div style="text-align:center">%/Pièce$</div><div style="text-align:center">+Prod$</div><div style="text-align:center">+Vente$</div><div>Rôle Discord</div><div></div>
  </div>
  <div id="grades-list">${grades.map((g,i)=>gradeRow(g,i)).join('')}</div>
  <button class="btn btn-gold btn-sm" onclick="addGradeRow()" style="margin-top:10px"><i class="ti ti-plus"></i> Ajouter</button>
  <div class="sep-gold"></div>
  <div class="fg" style="margin-bottom:0"><label>Salaire base / heure ($)</label>
    <input type="number" id="e-paye-heure" value="${_inst.paye?.base_heures||50}" min="0" step="10" style="max-width:140px">
  </div>
</div>`}

function gradeRow(g,i){
  const isPiece=g.mode_paye==='piece'
  return `<div class="grade-row" data-gi="${i}" style="display:grid;grid-template-columns:28px 1fr 60px 28px 80px 70px 70px 80px 28px;gap:4px;align-items:center;margin-bottom:5px">
    <input type="color" value="${g.couleur||'#888888'}" style="width:28px;height:28px;padding:2px;border-radius:6px;cursor:pointer">
    <input type="text" value="${g.nom||''}" placeholder="Nom" style="font-size:12px;padding:5px 6px">
    <div style="display:flex;gap:2px">
      <button class="paye-opt ${!isPiece?'active':''}" onclick="setPayeMode(this,'pourcent')" style="font-size:9px;padding:3px 5px;border-radius:4px;cursor:pointer;border:.5px solid var(--br2);background:${!isPiece?'var(--gd)':'transparent'};color:${!isPiece?'var(--gold)':'var(--t2)'};font-family:inherit">%</button>
      <button class="paye-opt ${isPiece?'active':''}" onclick="setPayeMode(this,'piece')" style="font-size:9px;padding:3px 5px;border-radius:4px;cursor:pointer;border:.5px solid var(--br2);background:${isPiece?'var(--gd)':'transparent'};color:${isPiece?'var(--gold)':'var(--t2)'};font-family:inherit">pièce</button>
    </div>
    <input type="text" value="${g.emoji||'⭐'}" style="text-align:center;font-size:14px;padding:5px 2px">
    <input type="number" value="${isPiece?g.prix_piece||0:g.taux_base||0}" min="0" step="${isPiece?50:0.5}" class="val-principale" style="font-size:12px;padding:5px 6px;text-align:center">
    <input type="number" value="${g.bonus_prod||0}" min="0" step="0.1" style="font-size:12px;padding:5px 6px;text-align:center">
    <input type="number" value="${g.bonus_vente||0}" min="0" step="0.1" style="font-size:12px;padding:5px 6px;text-align:center">
    <input type="text" value="${g.role_discord||''}" placeholder="Role ID" style="font-size:11px;padding:5px 6px">
    <button onclick="this.closest('.grade-row').remove()" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:16px;padding:0"><i class="ti ti-x"></i></button>
  </div>`
}

function setPayeMode(btn,mode){
  const row=btn.closest('.grade-row'); row.querySelectorAll('.paye-opt').forEach(b=>{b.style.background='transparent';b.style.color='var(--t2)'})
  btn.style.background='var(--gd)'; btn.style.color='var(--gold)'
  const inp=row.querySelector('.val-principale'); inp.step=mode==='piece'?'50':'0.5'
}
function addGradeRow(){const list=$('grades-list'),i=list.querySelectorAll('.grade-row').length;const d=document.createElement('div');d.innerHTML=gradeRow({nom:'Nouveau grade',emoji:'⭐',couleur:'#6b7280',mode_paye:'pourcentage',taux_base:5,bonus_prod:1,bonus_vente:2,prix_piece:150,role_discord:''},i);list.appendChild(d.firstElementChild)}

function pArticles(){return `<div class="cfg-panel" id="cp-articles">
  <div style="font-size:12px;color:var(--t2);margin-bottom:14px">Articles disponibles pour les déclarations.</div>
  <div class="chips" id="art-chips">
    ${(_inst.articles||[]).map(a=>`<span class="chip">${typeof a==='object'?a.nom:a}<button class="chip-x" onclick="this.closest('.chip').remove()"><i class="ti ti-x"></i></button></span>`).join('')}
  </div>
  <div class="add-row"><input type="text" id="new-art" placeholder="Ajouter un article…"><button class="btn btn-gold btn-sm" onclick="addArt()"><i class="ti ti-plus"></i></button></div>
</div>`}

function pCV(){const qs=_inst.questions_cv||[];return `<div class="cfg-panel" id="cp-cv">
  <div style="font-size:12px;color:var(--t2);margin-bottom:14px">Questions pour /cv sur Discord. Max 5.</div>
  <div id="cv-qs">${qs.map((q,i)=>`<div class="cv-q-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><span style="color:var(--t3);font-size:12px;width:18px;text-align:right;flex-shrink:0">${i+1}.</span><input type="text" value="${q}" placeholder="Question ${i+1}" style="flex:1;font-size:12px"><button onclick="this.closest('.cv-q-row').remove();reNumCV()" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:16px;padding:0"><i class="ti ti-x"></i></button></div>`).join('')}</div>
  <button class="btn btn-gold btn-sm" onclick="addCVQ()" style="margin-top:10px"><i class="ti ti-plus"></i> Ajouter</button>
</div>`}

function addCVQ(){const l=$('cv-qs');if(l.querySelectorAll('.cv-q-row').length>=5){toast('Max 5 questions','warn');return};const d=document.createElement('div');d.innerHTML=`<div class="cv-q-row" style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><span style="color:var(--t3);font-size:12px;width:18px;text-align:right;flex-shrink:0">${l.querySelectorAll('.cv-q-row').length+1}.</span><input type="text" placeholder="Question" style="flex:1;font-size:12px"><button onclick="this.closest('.cv-q-row').remove();reNumCV()" style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:16px;padding:0"><i class="ti ti-x"></i></button></div>`;l.appendChild(d.firstElementChild)}
function reNumCV(){$('cv-qs')?.querySelectorAll('.cv-q-row').forEach((r,i)=>{const s=r.querySelector('span');if(s)s.textContent=`${i+1}.`})}
function addArt(){const inp=$('new-art');if(!inp?.value?.trim())return;const chips=$('art-chips');const s=document.createElement('span');s.className='chip';s.innerHTML=`${inp.value.trim()}<button class="chip-x" onclick="this.closest('.chip').remove()"><i class="ti ti-x"></i></button>`;chips.appendChild(s);inp.value=''}

function collectGrades(){
  return Array.from($('grades-list')?.querySelectorAll('.grade-row')||[]).map((row,i)=>{
    const inp=row.querySelectorAll('input'),btns=row.querySelectorAll('.paye-opt')
    const isPiece=Array.from(btns).find(b=>b.style.background==='var(--gd)')?.textContent?.trim()==='pièce'
    const val=+inp[4].value
    return {couleur:inp[0].value,nom:inp[1].value.trim(),emoji:inp[3].value,mode_paye:isPiece?'piece':'pourcentage',taux_base:isPiece?5:val,prix_piece:isPiece?val:150,bonus_prod:+inp[5].value,bonus_vente:+inp[6].value,role_discord:inp[7].value.trim(),ordre:i}
  })
}

async function saveInst(){
  const d=await put(`/api/instances/${_inst.id}`,{
    nom:$('e-nom')?.value,emoji:$('e-emoji')?.value,couleur:$('e-color')?.value,
    description:$('e-desc')?.value,site_url:$('e-siteurl')?.value,
    discord_token:$('e-token')?.value,discord_client_id:$('e-cid')?.value,guild_id:$('e-gid')?.value,
    channel_cv:$('e-ch-cv')?.value,channel_logs:$('e-ch-logs')?.value,channel_productions:$('e-ch-productions')?.value,
    channel_ventes:$('e-ch-ventes')?.value,channel_alertes:$('e-ch-alertes')?.value,channel_welcome:$('e-ch-welcome')?.value,
    channel_annonces:$('e-ch-annonces')?.value,channel_absences:$('e-ch-absences')?.value,
    role_employe:$('e-ro-employe')?.value,role_attente_entretien:$('e-ro-attente_entretien')?.value,role_patron:$('e-ro-patron')?.value,
    grades:$('grades-list')?collectGrades():undefined,
    articles:$('art-chips')?Array.from($('art-chips').querySelectorAll('.chip')).map(c=>c.childNodes[0]?.textContent?.trim()).filter(Boolean):undefined,
    questions_cv:$('cv-qs')?Array.from($('cv-qs').querySelectorAll('input[type=text]')).map(i=>i.value.trim()).filter(Boolean):undefined,
    paye:$('e-paye-heure')?{base_heures:+$('e-paye-heure').value}:undefined,
  })
  d.ok?(toast('Sauvegardé ✅','success'),closeModal(),refreshPage()):toast(d.error||'Erreur','error')
}

async function deleteInst(id,nom){
  if(!confirm(`Supprimer "${nom}" ?`))return
  const d=await del(`/api/instances/${id}`); d.ok?(toast(`${nom} supprimé`,'success'),closeModal(),refreshPage()):toast(d.error,'error')
}

// ── Logs modal ────────────────────────────────────────────────
async function openLogsModal(id){
  const inst=await api(`/api/instances/${id}`); const logs=await api(`/api/instances/${id}/logs?limit=80`)
  openModal(`📋 Logs — ${inst.nom}`,`
    <div style="display:flex;gap:6px;margin-bottom:12px">
      ${['all','error','warn','success','info'].map(n=>`<button class="btn btn-sm ${n==='all'?'btn-gold':''}" onclick="filterLogs(${id},'${n}',this)">${n==='all'?'Tous':n}</button>`).join('')}
    </div>
    <div id="log-list" style="max-height:420px;overflow-y:auto">${renderLogLines(logs)}</div>`,'620px')
}
async function filterLogs(id,niveau,btn){document.querySelectorAll('#modal-body .btn').forEach(b=>b.classList.remove('btn-gold'));btn.classList.add('btn-gold');const logs=await api(`/api/instances/${id}/logs${niveau!=='all'?`?niveau=${niveau}`:''}&limit=80`);const l=$('log-list');if(l)l.innerHTML=renderLogLines(logs)}

async function renderLogs(){
  const c=$('content');c.innerHTML='<div style="color:var(--t2);padding:20px">Chargement…</div>'
  const insts=await api('/api/instances');const all=[]
  await Promise.all(insts.map(async inst=>{const logs=await api(`/api/instances/${inst.id}/logs?limit=50`);logs.forEach(l=>{l._nom=inst.nom;l._emoji=inst.emoji});all.push(...logs)}))
  all.sort((a,b)=>new Date(b.date)-new Date(a.date))
  c.innerHTML=`<div class="sec-title"><i class="ti ti-terminal-2"></i>Logs globaux (${all.length})</div><div class="card">${renderLogLines(all.slice(0,200))}</div>`
}

function renderLogLines(logs){
  if(!logs.length) return '<div style="color:var(--t2);font-size:12px;text-align:center;padding:20px">Aucun log</div>'
  const ic={info:'ti-info-circle',warn:'ti-alert-triangle',error:'ti-alert-circle',success:'ti-circle-check'}
  const cl={info:'var(--t2)',warn:'var(--yel)',error:'var(--red)',success:'var(--green)'}
  return logs.map(l=>`<div class="log-line"><span class="log-time">${fmtD(l.date)}</span>${l._nom?`<span class="log-inst">${l._emoji} ${l._nom}</span>`:''}<i class="ti ${ic[l.niveau]||'ti-info-circle'}" style="font-size:14px;color:${cl[l.niveau]||'var(--t2)'};flex-shrink:0"></i><span class="log-msg">${l.message}${l.detail?` <span style="color:var(--t3);font-size:11px">— ${l.detail}</span>`:''}</span></div>`).join('')
}

// ════════════════════════════════════════════════════════════════
// DÉMO INTERACTIVE (restauration + custom)
// ════════════════════════════════════════════════════════════════
let _demoSvcOn=false,_demoStart=null,_demoTimer=null
let _demoHistoResto=[
  {type:'vente',art:'Pizza Margherita',prix:1200,date:'14:32'},
  {type:'prod', art:'Burger RP x1',    prix:0,   date:'12:10'},
  {type:'vente',art:'Soda Cola 6pack', prix:450, date:'Hier'},
]
let _demoHistoCustom=[
  {type:'custom',art:'Custom carrosserie',prix:25000,date:'15:20'},
  {type:'custom',art:'Custom peinture',   prix:8500, date:'12:45'},
]

const DEMO_CFG={
  restauration:{couleur:'#C9A84C',emoji:'🍽️',nom:'Bella Cucina RP',articles:['Burger RP x1','Pizza Margherita','Frites Large','Soda Cola 6pack','Café Espresso'],grades:['Stagiaire','Employé','Senior','Chef de rang','Manager','Directeur'],type_decl:'prod/vente'},
  custom:      {couleur:'#8b5cf6',emoji:'🔧',nom:'Apex Custom RP', articles:['Custom carrosserie','Custom peinture','Custom moteur','Custom intérieur','Custom jantes'],grades:['Stagiaire','Technicien','Senior','Chef atelier','Directeur'],type_decl:'custom'},
}

function renderDemo(modele){
  const cfg=DEMO_CFG[modele]||DEMO_CFG.restauration
  const acc=cfg.couleur
  const c=$('content')

  c.innerHTML=`
  <style>
    .demo-acc{color:${acc}}
    .demo-btn-acc{background:${acc}20;border:.5px solid ${acc}55;color:${acc}}
    .demo-card{background:#0f1013;border:.5px solid rgba(255,255,255,.07);border-radius:14px;padding:15px;margin-bottom:12px}
  </style>

  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div style="font-size:12px;color:var(--t2)">Données fictives interactives — aperçu du modèle <strong style="color:${acc}">${cfg.nom}</strong></div>
    <div style="display:flex;gap:6px;background:var(--bg1);padding:3px;border-radius:var(--r)">
      <button class="btn btn-sm ${modele==='restauration'?'btn-gold':''}" onclick="goPage('demo-restauration')">🍽️ Restauration</button>
      <button class="btn btn-sm ${modele==='custom'?'btn-gold':''}" onclick="goPage('demo-custom')">🔧 Custom</button>
    </div>
    <div style="display:flex;gap:6px;background:var(--bg1);padding:3px;border-radius:var(--r)">
      <button class="btn btn-sm active" id="dvtab-emp" onclick="demoSwitch('emp',${JSON.stringify(cfg).split('"').join("'")},this)" style="color:${acc}">👤 Employé</button>
      <button class="btn btn-sm" id="dvtab-pat" onclick="demoSwitch('pat',${JSON.stringify(cfg).split('"').join("'")},this)">👑 Patron</button>
    </div>
  </div>

  <!-- Frame employé -->
  <div id="df-emp" style="background:#08090b;border:.5px solid ${acc}55;border-radius:16px;overflow:hidden">
    <div style="background:#0f1013;border-bottom:.5px solid ${acc}44;padding:10px 16px;display:flex;align-items:center;gap:10px">
      <div style="display:flex;gap:5px"><div style="width:10px;height:10px;border-radius:50%;background:#ef4444"></div><div style="width:10px;height:10px;border-radius:50%;background:#facc15"></div><div style="width:10px;height:10px;border-radius:50%;background:#22c55e"></div></div>
      <div style="font-size:12px;font-weight:600;color:${acc};flex:1;text-align:center">${cfg.emoji} ${cfg.nom} — Espace Employé</div>
    </div>
    <div style="padding:18px;max-height:600px;overflow-y:auto">

      <!-- Profil -->
      <div style="display:flex;align-items:center;gap:14px;background:#12141a;border:.5px solid ${acc}44;border-radius:14px;padding:15px;margin-bottom:12px">
        <div style="width:56px;height:56px;border-radius:50%;background:${acc}20;border:2px solid ${acc}55;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:${acc};flex-shrink:0">KR</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700;margin-bottom:5px">Karim_RP</div>
          <span style="background:${acc}18;border:.5px solid ${acc}44;border-radius:99px;padding:2px 10px;font-size:11px;font-weight:600;color:${acc};display:inline-block;margin-bottom:6px">👑 Manager</span>
          <div style="display:flex;gap:5px;flex-wrap:wrap">
            <span style="background:rgba(96,165,250,.1);border:.5px solid rgba(96,165,250,.3);border-radius:99px;padding:2px 8px;font-size:11px;color:#60a5fa">Modérateur</span>
            <span style="background:rgba(34,197,94,.1);border:.5px solid rgba(34,197,94,.3);border-radius:99px;padding:2px 8px;font-size:11px;color:#22c55e">Serveur PvP</span>
            <span style="background:rgba(167,139,250,.1);border:.5px solid rgba(167,139,250,.3);border-radius:99px;padding:2px 8px;font-size:11px;color:#a78bfa">Staff</span>
          </div>
        </div>
        <div style="font-size:11px;color:#3d4260;text-align:right">depuis<br>04/07/26</div>
      </div>

      <!-- Service -->
      <div class="demo-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:10px;color:#3d4260;text-transform:uppercase;letter-spacing:.08em;font-weight:600">TEMPS RÉEL</span>
          <span id="d-svc-st" style="font-size:11px;color:#7a7f96">Hors service</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.03);border-radius:8px;padding:10px 14px;margin-bottom:10px">
          <span style="font-size:13px;color:#7a7f96">Service en cours</span>
          <span id="d-chrono" style="font-size:24px;font-weight:700;color:#22c55e;font-family:monospace">00:00:00</span>
        </div>
        <button id="d-svc-btn" onclick="demoToggleSvc('${acc}')" style="width:100%;padding:11px;border-radius:9px;background:rgba(34,197,94,.1);border:.5px solid rgba(34,197,94,.3);color:#22c55e;font-size:13px;font-weight:600;cursor:pointer">▶ Prendre le service</button>
      </div>

      <!-- Stats -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
        ${modele==='custom'
          ?[['Customs','12','ce mois','#eceef3'],['CA total',`$${(432000).toLocaleString('fr-FR')}`,`ce mois`,'#eceef3'],['Temps svc','8h30','ce mois','#eceef3'],['Paye est.',`~$${(51840).toLocaleString('fr-FR')}`,'non contractuelle',acc]]
          :[['Productions','18','ce mois','#eceef3'],['CA ventes','$8 200','ce mois','#eceef3'],['Temps svc','5h42','ce mois','#eceef3'],['Paye est.','~$4 100','non contractuelle',acc]]
        }.map(([l,v,s,col])=>`<div style="background:#12141a;border:.5px solid rgba(255,255,255,.06);border-radius:12px;padding:11px;text-align:center"><div style="font-size:9px;color:#3d4260;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${l}</div><div style="font-size:17px;font-weight:700;color:${col}">${v}</div><div style="font-size:10px;color:#3d4260;margin-top:2px">${s}</div></div>`).join('')}
      </div>

      <!-- Classement mensuel -->
      <div class="demo-card">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${acc};margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="ti ti-trophy" style="font-size:14px"></i>Classement mensuel</div>
        ${[['🥇','Karim_RP',modele==='custom'?432000:8200,acc],['🥈','Sarah_Lux',modele==='custom'?284000:6500,'#7a7f96'],['🥉','Tom_B',modele==='custom'?156000:3200,'#7a7f96']].map(([med,tag,ca,col])=>`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:.5px solid rgba(255,255,255,.06);font-size:12px">
            <span style="font-size:18px">${med}</span>
            <span style="flex:1;font-weight:500;color:${col}">${tag}</span>
            <span style="font-weight:700;color:${col}">$${ca.toLocaleString('fr-FR')}</span>
          </div>`).join('')}
      </div>

      <!-- Déclarer -->
      <div class="demo-card">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${acc};margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="ti ti-package" style="font-size:14px"></i>${modele==='custom'?'Déclarer une custom':'Déclarer une production / vente'}</div>
        ${modele==='custom'?`
          <div style="margin-bottom:10px"><div style="font-size:11px;color:#7a7f96;margin-bottom:4px">Montant ($)</div>
            <input type="number" id="d-montant" placeholder="Ex: 25000" style="width:100%;padding:8px 10px;background:#0f1013;border:.5px solid rgba(255,255,255,.12);border-radius:7px;color:#eceef3;font-size:12px;outline:none">
          </div>
          <div style="margin-bottom:10px"><div style="font-size:11px;color:#7a7f96;margin-bottom:4px">Description (optionnel)</div>
            <input type="text" id="d-desc-custom" placeholder="Ex: Full carrosserie + peinture" style="width:100%;padding:8px 10px;background:#0f1013;border:.5px solid rgba(255,255,255,.12);border-radius:7px;color:#eceef3;font-size:12px;outline:none">
          </div>`:`
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div><div style="font-size:11px;color:#7a7f96;margin-bottom:4px">Article</div>
              <select id="d-article" style="width:100%;padding:8px 10px;background:#0f1013;border:.5px solid rgba(255,255,255,.12);border-radius:7px;color:#eceef3;font-size:12px;outline:none">
                ${cfg.articles.map(a=>`<option>${a}</option>`).join('')}
              </select></div>
            <div><div style="font-size:11px;color:#7a7f96;margin-bottom:4px">Prix ($) — si vente</div>
              <input type="number" id="d-prix" placeholder="0" style="width:100%;padding:8px 10px;background:#0f1013;border:.5px solid rgba(255,255,255,.12);border-radius:7px;color:#eceef3;font-size:12px;outline:none">
            </div>
          </div>`}
        <div id="d-upload-zone" onclick="document.getElementById('d-file').click()" style="background:rgba(255,255,255,.03);border:.5px dashed rgba(255,255,255,.15);border-radius:8px;padding:14px;text-align:center;cursor:pointer;margin-bottom:10px;transition:all .15s">
          <i class="ti ti-camera" style="font-size:20px;color:#3d4260;display:block;margin-bottom:5px"></i>
          <div id="d-file-name" style="font-size:12px;color:#7a7f96">${modele==='custom'?'Photo de la facture (obligatoire)':'Preuve photo (obligatoire)'}</div>
          <input type="file" id="d-file" accept="image/*" style="display:none" onchange="demoFileSelected(this,'${acc}')">
        </div>
        ${modele==='custom'
          ?`<button onclick="demoDeclCustom('${acc}')" style="width:100%;padding:10px;border-radius:8px;background:${acc}18;border:.5px solid ${acc}44;color:${acc};font-size:13px;font-weight:600;cursor:pointer"><i class="ti ti-tool"></i> Déclarer la custom</button>`
          :`<div style="display:flex;gap:8px">
            <button onclick="demoDeclResto('prod','${acc}')" style="flex:1;padding:9px;border-radius:8px;background:rgba(96,165,250,.1);border:.5px solid rgba(96,165,250,.3);color:#60a5fa;font-size:12px;font-weight:600;cursor:pointer"><i class="ti ti-tool"></i> Production</button>
            <button onclick="demoDeclResto('vente','${acc}')" style="flex:1;padding:9px;border-radius:8px;background:rgba(34,197,94,.1);border:.5px solid rgba(34,197,94,.3);color:#22c55e;font-size:12px;font-weight:600;cursor:pointer"><i class="ti ti-shopping-cart"></i> Vente</button>
          </div>`}
      </div>

      <!-- Historique -->
      <div class="demo-card">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${acc};margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="ti ti-history" style="font-size:14px"></i>Historique</div>
        <div id="d-histo">
          ${(modele==='custom'?_demoHistoCustom:_demoHistoResto).map(h=>demoHistoLine(h,acc)).join('')}
        </div>
      </div>

      <!-- Absences -->
      <div class="demo-card">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${acc};margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="ti ti-calendar-off" style="font-size:14px"></i>Absences</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div><div style="font-size:11px;color:#7a7f96;margin-bottom:4px">Du</div><input type="date" id="d-abs-debut" style="width:100%;padding:7px 10px;background:#0f1013;border:.5px solid rgba(255,255,255,.12);border-radius:7px;color:#eceef3;font-size:12px;outline:none"></div>
          <div><div style="font-size:11px;color:#7a7f96;margin-bottom:4px">Au</div><input type="date" id="d-abs-fin" style="width:100%;padding:7px 10px;background:#0f1013;border:.5px solid rgba(255,255,255,.12);border-radius:7px;color:#eceef3;font-size:12px;outline:none"></div>
        </div>
        <textarea id="d-abs-raison" placeholder="Raison (optionnel)…" rows="2" style="width:100%;padding:8px 10px;background:#0f1013;border:.5px solid rgba(255,255,255,.12);border-radius:7px;color:#eceef3;font-size:12px;outline:none;resize:none;margin-bottom:8px"></textarea>
        <button onclick="demoDeclAbsence('${acc}')" style="width:100%;padding:9px;border-radius:8px;background:${acc}18;border:.5px solid ${acc}44;color:${acc};font-size:12px;font-weight:600;cursor:pointer"><i class="ti ti-send"></i> Déclarer l'absence</button>
        <div id="d-abs-list" style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:.5px solid rgba(255,255,255,.06);font-size:12px">
            <div><div style="font-weight:500">10/09 → 12/09</div><div style="color:#7a7f96;font-size:11px">Vacances</div></div>
            <span style="background:rgba(34,197,94,.1);border:.5px solid rgba(34,197,94,.3);border-radius:99px;padding:2px 8px;font-size:10px;color:#22c55e">Acceptée</span>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Frame patron -->
  <div id="df-pat" style="background:#08090b;border:.5px solid ${acc}55;border-radius:16px;overflow:hidden;display:none;margin-top:16px">
    <div style="background:#0f1013;border-bottom:.5px solid ${acc}44;padding:10px 16px;display:flex;align-items:center;gap:10px">
      <div style="display:flex;gap:5px"><div style="width:10px;height:10px;border-radius:50%;background:#ef4444"></div><div style="width:10px;height:10px;border-radius:50%;background:#facc15"></div><div style="width:10px;height:10px;border-radius:50%;background:#22c55e"></div></div>
      <div style="font-size:12px;font-weight:600;color:${acc};flex:1;text-align:center">${cfg.emoji} ${cfg.nom} — Dashboard Patron</div>
    </div>
    <div style="padding:18px;max-height:600px;overflow-y:auto">

      <!-- Stats patron -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">
        ${[['Employés','7',acc],['CA mois','$24k','#eceef3'],['Déclarations','47','#eceef3'],['CV en att.','3','#facc15'],['Abs. en att.','1','#ef4444']].map(([l,v,col])=>`<div style="background:#12141a;border:.5px solid rgba(255,255,255,.06);border-radius:12px;padding:11px;text-align:center"><div style="font-size:9px;color:#3d4260;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">${l}</div><div style="font-size:18px;font-weight:700;color:${col}">${v}</div></div>`).join('')}
      </div>

      <!-- Tabs patron -->
      <div id="pat-tabs" style="display:flex;gap:4px;background:#0f1013;border-radius:9px;padding:3px;margin-bottom:14px;flex-wrap:wrap">
        ${['Équipe','Déclarations','Classement','Absences','CV','Comptabilité'].map((t,i)=>`<button class="demo-ptab" id="dpt-${t}" style="padding:6px 12px;border-radius:7px;font-size:11px;font-weight:500;cursor:pointer;border:none;background:${i===0?`${acc}18`:'transparent'};color:${i===0?acc:'#7a7f96'};border:${i===0?`.5px solid ${acc}44`:'none'}" onclick="demoPatTab(this,'dp2-${t.toLowerCase().replace('é','e').replace('â','a')}','${acc}')">${t}</button>`).join('')}
      </div>

      <!-- Équipe -->
      <div id="dp2-equipe">
        ${[['Karim_RP','Manager',acc,modele==='custom'?432000:8200],['Sarah_Lux','Chef '+(modele==='custom'?'atelier':'de rang'),'#f59e0b',modele==='custom'?284000:6500],['Tom_B',modele==='custom'?'Technicien':'Employé','#60a5fa',modele==='custom'?156000:3200],['Nova_RP','Stagiaire','#6b7280',modele==='custom'?48000:900]].map(([t,g,col,ca])=>`
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:.5px solid rgba(255,255,255,.06)">
            <div style="width:34px;height:34px;border-radius:50%;background:${col}22;border:.5px solid ${col}44;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${col};flex-shrink:0">${t.slice(0,2).toUpperCase()}</div>
            <div style="flex:1"><div style="font-size:13px;font-weight:500">${t}</div><div style="font-size:11px;color:${col}">${g}</div></div>
            <div style="text-align:right"><div style="font-size:12px;color:${acc};font-weight:600">$${ca.toLocaleString('fr-FR')}</div><div style="font-size:10px;color:#3d4260">CA mois</div></div>
            <div style="display:flex;gap:5px">
              <select style="font-size:10px;padding:3px 6px;background:#0f1013;border:.5px solid rgba(255,255,255,.12);border-radius:6px;color:#eceef3;cursor:pointer">${cfg.grades.map(g2=>`<option>${g2}</option>`).join('')}</select>
              <button style="background:rgba(239,68,68,.1);border:.5px solid rgba(239,68,68,.3);color:#ef4444;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px"><i class="ti ti-alert-triangle"></i></button>
            </div>
          </div>`).join('')}
      </div>

      <!-- Déclarations (toutes) -->
      <div id="dp2-declarations" style="display:none">
        ${(modele==='custom'
          ?[['Karim_RP','custom','Custom carrosserie',25000,'15:20'],['Sarah_Lux','custom','Custom peinture',8500,'12:45'],['Tom_B','custom','Custom moteur',32000,'Hier'],['Nova_RP','custom','Custom jantes',4500,'Hier']]
          :[['Karim_RP','vente','Pizza Margherita',1200,'14:32'],['Sarah_Lux','prod','Burger RP x1',0,'12:10'],['Tom_B','vente','Soda Cola 6pack',450,'Hier'],['Nova_RP','prod','Frites Large',0,'Hier']]
        ).map(([tag,type,art,prix,date])=>`
          <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:.5px solid rgba(255,255,255,.06);font-size:12px">
            <span style="padding:2px 8px;border-radius:99px;font-size:10px;background:${type==='vente'||type==='custom'?'rgba(34,197,94,.1)':'rgba(96,165,250,.1)'};color:${type==='vente'||type==='custom'?'#22c55e':'#60a5fa'};border:.5px solid ${type==='vente'||type==='custom'?'rgba(34,197,94,.25)':'rgba(96,165,250,.25)'}">${type==='custom'?'Custom':type==='vente'?'Vente':'Prod'}</span>
            <span style="flex:1;color:#eceef3">${art}</span>
            <span style="color:#7a7f96">${tag}</span>
            ${prix?`<span style="color:${acc};font-weight:600">$${prix.toLocaleString('fr-FR')}</span>`:''}
            <span style="color:#60a5fa;font-size:11px;cursor:pointer"><i class="ti ti-photo"></i></span>
            <span style="color:#3d4260;font-size:11px">${date}</span>
          </div>`).join('')}
      </div>

      <!-- Classement -->
      <div id="dp2-classement" style="display:none">
        <div style="font-size:11px;color:#7a7f96;margin-bottom:12px">Classement mensuel par CA — mis à jour en temps réel</div>
        ${[['🥇','Karim_RP','Manager',acc,modele==='custom'?432000:8200,95],['🥈','Sarah_Lux','Chef '+(modele==='custom'?'atelier':'de rang'),'#f59e0b',modele==='custom'?284000:6500,62],['🥉','Tom_B',modele==='custom'?'Technicien':'Employé','#60a5fa',modele==='custom'?156000:3200,34],['4️⃣','Nova_RP','Stagiaire','#6b7280',modele==='custom'?48000:900,10]].map(([med,tag,grade,col,ca,pct])=>`
          <div style="padding:12px 0;border-bottom:.5px solid rgba(255,255,255,.06)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <span style="font-size:20px">${med}</span>
              <div style="flex:1"><div style="font-size:13px;font-weight:600;color:${col}">${tag}</div><div style="font-size:11px;color:#7a7f96">${grade}</div></div>
              <div style="font-size:14px;font-weight:700;color:${acc}">$${ca.toLocaleString('fr-FR')}</div>
            </div>
            <div style="background:rgba(255,255,255,.06);border-radius:99px;height:4px;overflow:hidden">
              <div style="background:${col};height:100%;width:${pct}%;border-radius:99px;transition:width .5s"></div>
            </div>
          </div>`).join('')}
      </div>

      <!-- Absences patron -->
      <div id="dp2-absences" style="display:none">
        <div id="dp2-abs-list">
          <div style="background:rgba(255,255,255,.03);border:.5px solid rgba(255,255,255,.07);border-radius:10px;padding:12px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <div><div style="font-size:13px;font-weight:500">Tom_B <span style="font-size:11px;color:#60a5fa">Technicien</span></div><div style="font-size:12px;color:#7a7f96;margin-top:2px">15/09 → 18/09</div><div style="font-size:11px;color:#3d4260">Vacances famille</div></div>
              <span style="background:rgba(250,204,21,.12);border:.5px solid rgba(250,204,21,.3);border-radius:99px;padding:2px 9px;font-size:10px;color:#facc15">En attente</span>
            </div>
            <div style="display:flex;gap:6px">
              <button onclick="demoAccepterAbs(this,'${acc}')" style="flex:1;padding:7px;border-radius:7px;background:rgba(34,197,94,.1);border:.5px solid rgba(34,197,94,.3);color:#22c55e;cursor:pointer;font-size:12px"><i class="ti ti-check"></i> Accepter</button>
              <button onclick="demoRefuserAbs(this)" style="flex:1;padding:7px;border-radius:7px;background:rgba(239,68,68,.08);border:.5px solid rgba(239,68,68,.25);color:#ef4444;cursor:pointer;font-size:12px"><i class="ti ti-x"></i> Refuser</button>
            </div>
          </div>
        </div>
      </div>

      <!-- CV -->
      <div id="dp2-cv" style="display:none">
        <div style="background:rgba(255,255,255,.03);border:.5px solid rgba(255,255,255,.07);border-radius:12px;padding:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:10px"><div style="font-weight:600">Nova_RP</div><div style="font-size:11px;color:#7a7f96">Il y a 2h</div></div>
          ${[['Poste','Manager'],['Expérience','3 ans en RP'],['Dispo','Tous les soirs 20h+'],['3 mots','Sérieux, investi, loyal'],['Motivation','Rejoindre la meilleure équipe']].map(([q,r])=>`<div style="font-size:12px;margin-bottom:5px"><span style="color:#7a7f96">${q} :</span> ${r}</div>`).join('')}
          <div style="display:flex;gap:8px;margin-top:12px">
            <button onclick="this.parentElement.parentElement.style.opacity='.4'" style="flex:1;padding:8px;border-radius:7px;background:rgba(34,197,94,.1);border:.5px solid rgba(34,197,94,.3);color:#22c55e;cursor:pointer;font-size:12px"><i class="ti ti-check"></i> Accepter</button>
            <button onclick="this.parentElement.parentElement.style.opacity='.4'" style="flex:1;padding:8px;border-radius:7px;background:rgba(239,68,68,.08);border:.5px solid rgba(239,68,68,.25);color:#ef4444;cursor:pointer;font-size:12px"><i class="ti ti-x"></i> Refuser</button>
          </div>
        </div>
      </div>

      <!-- Comptabilité -->
      <div id="dp2-comptabilite" style="display:none">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          ${[['Total paie',`$${(17340).toLocaleString('fr-FR')}`,acc],['Frais','$1 200','#ef4444'],['Net',`-$${(18540).toLocaleString('fr-FR')}`,'#7a7f96']].map(([l,v,col])=>`<div style="background:#12141a;border:.5px solid rgba(255,255,255,.07);border-radius:10px;padding:12px;text-align:center"><div style="font-size:9px;color:#3d4260;text-transform:uppercase;margin-bottom:4px">${l}</div><div style="font-size:18px;font-weight:700;color:${col}">${v}</div></div>`).join('')}
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>${['Employé','Grade','CA','Paie estimée'].map(h=>`<th style="font-size:10px;color:${acc};text-transform:uppercase;letter-spacing:.06em;padding:8px 10px;border-bottom:.5px solid ${acc}33;text-align:left">${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${[['Karim_RP','Manager',acc,modele==='custom'?432000:8200,modele==='custom'?51840:4100],['Sarah_Lux','Chef','#f59e0b',modele==='custom'?284000:6500,modele==='custom'?28400:2800],['Tom_B','Tech/Employé','#60a5fa',modele==='custom'?156000:3200,modele==='custom'?12480:1500],['Nova_RP','Stagiaire','#6b7280',modele==='custom'?48000:900,modele==='custom'?2400:270]].map(([n,g,col,ca,paie])=>`
              <tr><td style="padding:9px 10px;border-bottom:.5px solid rgba(255,255,255,.05);font-size:12px">${n}</td>
              <td style="padding:9px 10px;border-bottom:.5px solid rgba(255,255,255,.05);font-size:11px;color:${col}">${g}</td>
              <td style="padding:9px 10px;border-bottom:.5px solid rgba(255,255,255,.05);font-size:12px;color:${acc}">$${ca.toLocaleString('fr-FR')}</td>
              <td style="padding:9px 10px;border-bottom:.5px solid rgba(255,255,255,.05);font-size:12px;font-weight:600;color:${acc}">~$${paie.toLocaleString('fr-FR')}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

    </div>
  </div>`

  // Démarrer le chrono
  if(_demoTimer) clearInterval(_demoTimer); _demoSvcOn=false; _demoStart=null
}

// ── Helpers démo ──────────────────────────────────────────────
function demoHistoLine(h,acc){
  const col=h.type==='vente'||h.type==='custom'?'rgba(34,197,94,.1)':'rgba(96,165,250,.1)'
  const tcol=h.type==='vente'||h.type==='custom'?'#22c55e':'#60a5fa'
  const label=h.type==='custom'?'Custom':h.type==='vente'?'Vente':'Prod'
  return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:.5px solid rgba(255,255,255,.06);font-size:12px">
    <span style="padding:2px 8px;border-radius:99px;font-size:10px;background:${col};color:${tcol};border:.5px solid ${tcol}44">${label}</span>
    <span style="flex:1;color:#eceef3">${h.art}</span>
    ${h.prix?`<span style="color:${acc};font-weight:600">$${h.prix.toLocaleString('fr-FR')}</span>`:''}
    ${h.img?`<img src="${h.img}" style="width:28px;height:28px;border-radius:5px;object-fit:cover;cursor:pointer;border:.5px solid rgba(255,255,255,.1)" onclick="window.open(this.src)">`:'<div style="width:28px;height:28px;border-radius:5px;background:rgba(255,255,255,.04);border:.5px dashed rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center"><i class="ti ti-photo" style="font-size:11px;color:#3d4260"></i></div>'}
    <span style="color:#3d4260;font-size:11px">${h.date}</span>
  </div>`
}

function demoSwitch(tab,cfgStr,btn){
  $('df-emp').style.display=tab==='emp'?'':'none'
  $('df-pat').style.display=tab==='pat'?'':'none'
  document.querySelectorAll('#dvtab-emp,#dvtab-pat').forEach(b=>{b.style.color='var(--t2)';b.style.borderColor='transparent'})
}

function demoPatTab(btn,panelId,acc){
  document.querySelectorAll('.demo-ptab').forEach(b=>{b.style.background='transparent';b.style.color='#7a7f96';b.style.border='none'})
  btn.style.background=acc+'18'; btn.style.color=acc; btn.style.border=`.5px solid ${acc}44`
  ;['dp2-equipe','dp2-declarations','dp2-classement','dp2-absences','dp2-cv','dp2-comptabilite'].forEach(id=>{const e=$(id);if(e)e.style.display='none'})
  const p=$(panelId); if(p) p.style.display=''
}

function demoToggleSvc(acc){
  _demoSvcOn=!_demoSvcOn
  const btn=$('d-svc-btn'),st=$('d-svc-st')
  if(_demoSvcOn){
    _demoStart=Date.now()
    if(_demoTimer) clearInterval(_demoTimer)
    _demoTimer=setInterval(()=>{
      const el=$('d-chrono'); if(!el){clearInterval(_demoTimer);return}
      const diff=Math.floor((Date.now()-_demoStart)/1000)
      el.textContent=`${String(Math.floor(diff/3600)).padStart(2,'0')}:${String(Math.floor((diff%3600)/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}`
    },1000)
    if(btn){btn.textContent='⏹ Fin de service';btn.style.background='rgba(239,68,68,.12)';btn.style.borderColor='rgba(239,68,68,.4)';btn.style.color='#ef4444'}
    if(st){st.style.color='#22c55e';st.innerHTML=`<span style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:4px"></span>En service`}
  } else {
    clearInterval(_demoTimer)
    const el=$('d-chrono'); if(el) el.textContent='00:00:00'
    if(btn){btn.textContent='▶ Prendre le service';btn.style.background='rgba(34,197,94,.1)';btn.style.borderColor='rgba(34,197,94,.3)';btn.style.color='#22c55e'}
    if(st){st.style.color='#7a7f96';st.textContent='Hors service'}
  }
}

function demoFileSelected(input,acc){
  const fn=$('d-file-name'),zone=$('d-upload-zone')
  if(input.files[0]){
    fn.textContent='✅ '+input.files[0].name; fn.style.color='#22c55e'
    if(zone){zone.style.background='rgba(34,197,94,.05)';zone.style.borderColor='rgba(34,197,94,.3)'}
  }
}

function demoDeclResto(type,acc){
  const art=$('d-article')?.value||'Article', prix=type==='vente'?Number($('d-prix')?.value||0):0
  const file=$('d-file')?.files?.[0]; if(!file){toast('Preuve photo obligatoire','warn');return}
  const img=URL.createObjectURL(file)
  const now=new Date(); const time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const h=$('d-histo'); if(!h) return
  const d=document.createElement('div'); d.innerHTML=demoHistoLine({type,art,prix,img,date:time},acc); h.insertBefore(d.firstElementChild,h.firstChild)
  $('d-file').value=''; $('d-file-name').textContent='Preuve photo (obligatoire)'; $('d-file-name').style.color='#7a7f96'
  if($('d-upload-zone')){$('d-upload-zone').style.background='rgba(255,255,255,.03)';$('d-upload-zone').style.borderColor='rgba(255,255,255,.15)'}
  if($('d-prix')) $('d-prix').value=''
  toast(type==='vente'?`Vente déclarée — ${art}`:`Production déclarée — ${art}`,'success')
}

function demoDeclCustom(acc){
  const montant=Number($('d-montant')?.value||0), desc=$('d-desc-custom')?.value||'Custom véhicule'
  const file=$('d-file')?.files?.[0]; if(!montant){toast('Montant requis','warn');return}; if(!file){toast('Photo obligatoire','warn');return}
  const img=URL.createObjectURL(file)
  const now=new Date(); const time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const h=$('d-histo'); if(!h) return
  const d=document.createElement('div'); d.innerHTML=demoHistoLine({type:'custom',art:desc,prix:montant,img,date:time},acc); h.insertBefore(d.firstElementChild,h.firstChild)
  $('d-file').value=''; $('d-montant').value=''; $('d-desc-custom').value=''
  $('d-file-name').textContent='Photo de la facture (obligatoire)'; $('d-file-name').style.color='#7a7f96'
  if($('d-upload-zone')){$('d-upload-zone').style.background='rgba(255,255,255,.03)';$('d-upload-zone').style.borderColor='rgba(255,255,255,.15)'}
  toast(`Custom déclarée — $${montant.toLocaleString('fr-FR')}`,'success')
}

function demoDeclAbsence(acc){
  const debut=$('d-abs-debut')?.value, fin=$('d-abs-fin')?.value, raison=$('d-abs-raison')?.value
  if(!debut||!fin){toast('Renseigne les dates','warn');return}
  const list=$('d-abs-list'); if(!list) return
  const d=document.createElement('div')
  d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:.5px solid rgba(255,255,255,.06);font-size:12px">
    <div><div style="font-weight:500">${debut} → ${fin}</div><div style="color:#7a7f96;font-size:11px">${raison||'—'}</div></div>
    <span style="background:rgba(250,204,21,.12);border:.5px solid rgba(250,204,21,.3);border-radius:99px;padding:2px 8px;font-size:10px;color:#facc15">En attente</span>
  </div>`
  list.insertBefore(d.firstElementChild, list.firstChild)
  $('d-abs-debut').value=''; $('d-abs-fin').value=''; $('d-abs-raison').value=''
  toast('Absence déclarée — en attente de validation','info')
}

function demoAccepterAbs(btn,acc){
  const card=btn.closest('div[style*="border-radius:10px"]')
  const badge=card.querySelector('span[style*="border-radius:99px"]')
  if(badge){badge.style.background='rgba(34,197,94,.1)';badge.style.borderColor='rgba(34,197,94,.3)';badge.style.color='#22c55e';badge.textContent='Acceptée'}
  btn.parentElement.style.display='none'
  toast('Absence acceptée — notif Discord envoyée ✅','success')
}
function demoRefuserAbs(btn){
  const card=btn.closest('div[style*="border-radius:10px"]')
  const badge=card.querySelector('span[style*="border-radius:99px"]')
  if(badge){badge.style.background='rgba(239,68,68,.1)';badge.style.borderColor='rgba(239,68,68,.3)';badge.style.color='#ef4444';badge.textContent='Refusée'}
  btn.parentElement.style.display='none'
  toast('Absence refusée — notif Discord envoyée','warn')
}

// ════════════════════════════════════════════════════════════════
// SETTINGS & SÉCURITÉ
// ════════════════════════════════════════════════════════════════
async function renderSettings(){
  const cfg=await api('/api/panel-config')
  $('content').innerHTML=`
    <div style="max-width:460px">
      <div class="sec-title"><i class="ti ti-settings"></i>Apparence du panel</div>
      <div class="card-gold">
        <div class="fg"><label>Nom du panel</label><input type="text" id="ps-nom" value="${cfg.panel_nom||'RP Showroom'}"></div>
        <div class="fg" style="margin-bottom:0"><label>Emoji</label><input type="text" id="ps-emoji" value="${cfg.panel_emoji||'🎮'}" maxlength="4" style="max-width:80px;text-align:center;font-size:20px"></div>
        <div class="sep-gold"></div>
        <button class="btn btn-solid" onclick="saveSettings()"><i class="ti ti-device-floppy"></i> Sauvegarder</button>
      </div>
    </div>`
}
async function saveSettings(){ const d=await post('/api/panel-config',{panel_nom:$('ps-nom')?.value,panel_emoji:$('ps-emoji')?.value}); d.ok?(toast('Sauvegardé','success'),loadBrand()):toast(d.error,'error') }

function renderSecurite(){
  $('content').innerHTML=`
    <div style="max-width:440px">
      <div class="sec-title"><i class="ti ti-shield-lock"></i>Mot de passe admin</div>
      <div class="card-gold">
        <div class="fg"><label>Mot de passe actuel</label><input type="password" id="sc-cur" placeholder="••••••••"></div>
        <div class="fg"><label>Nouveau mot de passe</label><input type="password" id="sc-new" placeholder="Min 8 caractères"></div>
        <div class="fg" style="margin-bottom:0"><label>Confirmer</label><input type="password" id="sc-cfm" placeholder="Répétez"></div>
        <div id="sc-err" class="lc-err" style="display:none;margin-top:10px"></div>
        <div class="sep-gold"></div>
        <button class="btn btn-solid" onclick="changePassword()"><i class="ti ti-lock"></i> Changer</button>
      </div>
    </div>`
}
async function changePassword(){
  const cur=$('sc-cur')?.value,nv=$('sc-new')?.value,cf=$('sc-cfm')?.value
  if(nv!==cf) return setErr('sc-err','Les mots de passe ne correspondent pas')
  if(nv.length<8) return setErr('sc-err','Minimum 8 caractères')
  $('sc-err').style.display='none'
  const d=await post('/api/panel-config/password',{current:cur,nouveau:nv})
  d.ok?(toast('Mot de passe changé ✅','success'),$('sc-cur').value=$('sc-new').value=$('sc-cfm').value=''):setErr('sc-err',d.error)
}

initApp()
