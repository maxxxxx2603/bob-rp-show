const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const { db, MODELES, QUESTIONS_CV, PAYE_DEFAULT } = require('../../db/database')
const manager = require('../../bot/manager')

const sj  = (s,fb) => { try { return JSON.parse(s||'null')||fb } catch { return fb } }
const logDB = (id,n,m,d='') => { try { db.prepare('INSERT INTO logs (instance_id,niveau,message,detail) VALUES (?,?,?,?)').run(id,n,m,d) } catch {} }
const alerteDB = (id,n,m) => { try { db.prepare('INSERT INTO alertes (instance_id,niveau,message) VALUES (?,?,?)').run(id,n,m) } catch {} }

function auth(req,res,next){ if(!req.session.admin) return res.status(401).json({error:'Non authentifié'}); next() }

// ── AUTH ──────────────────────────────────────────────────────
router.get('/me', (req,res) => res.json(req.session.admin?{ok:true}:{error:'Non connecté'}))

router.post('/login', async (req,res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'Mot de passe requis' })

  // Priorité 1 : variable d'environnement ADMIN_PASSWORD (Railway)
  const envPassword = process.env.ADMIN_PASSWORD
  if (envPassword) {
    if (password === envPassword) {
      req.session.admin = true
      return res.json({ ok: true })
    }
    return res.status(401).json({ error: 'Mot de passe incorrect' })
  }

  // Priorité 2 : mot de passe en base (fallback / changement manuel)
  const stored = db.prepare("SELECT value FROM panel_config WHERE key='admin_password'").get()
  if (!stored) {
    // Première config si pas de variable env
    if (!password || password.length < 8) return res.status(400).json({ error: 'Min 8 caractères', setup: true })
    db.prepare("INSERT OR REPLACE INTO panel_config (key,value) VALUES ('admin_password',?)").run(await bcrypt.hash(password, 12))
    req.session.admin = true
    return res.json({ ok: true, first: true })
  }
  if (!await bcrypt.compare(password, stored.value)) return res.status(401).json({ error: 'Mot de passe incorrect' })
  req.session.admin = true
  res.json({ ok: true })
})

router.post('/logout', (req,res) => { req.session.destroy(); res.json({ok:true}) })

// ── PANEL CONFIG ──────────────────────────────────────────────
router.get('/panel-config', auth, (req,res) => res.json(Object.fromEntries(db.prepare('SELECT key,value FROM panel_config').all().map(r=>[r.key,r.value]))))
router.post('/panel-config', auth, (req,res) => { const ins=db.prepare('INSERT OR REPLACE INTO panel_config (key,value) VALUES (?,?)'); for(const [k,v] of Object.entries(req.body)) if(k!=='admin_password') ins.run(k,String(v)); res.json({ok:true}) })
router.post('/panel-config/password', auth, async (req,res) => {
  // Si ADMIN_PASSWORD est défini en env, le changement via panel est bloqué
  if (process.env.ADMIN_PASSWORD) return res.status(403).json({ error: 'Mot de passe géré via variable d\'environnement ADMIN_PASSWORD' })
  const {current,nouveau}=req.body; const s=db.prepare("SELECT value FROM panel_config WHERE key='admin_password'").get()
  if(s&&!await bcrypt.compare(current,s.value)) return res.status(401).json({error:'Mot de passe actuel incorrect'})
  if(!nouveau||nouveau.length<8) return res.status(400).json({error:'Min 8 car.'})
  db.prepare("INSERT OR REPLACE INTO panel_config (key,value) VALUES ('admin_password',?)").run(await bcrypt.hash(nouveau,12))
  res.json({ok:true})
})

// ── STATS GLOBALES ────────────────────────────────────────────
router.get('/stats', auth, (req,res) => res.json({
  total:       db.prepare('SELECT COUNT(*) as c FROM instances').get().c,
  actifs:      db.prepare('SELECT COUNT(*) as c FROM instances WHERE bot_online=1').get().c,
  maintenance: db.prepare("SELECT COUNT(*) as c FROM instances WHERE statut='maintenance'").get().c,
  erreurs:     db.prepare("SELECT COUNT(*) as c FROM instances WHERE statut='erreur'").get().c,
  configures:  db.prepare("SELECT COUNT(*) as c FROM instances WHERE statut='configure'").get().c,
  logs_errors: db.prepare("SELECT COUNT(*) as c FROM logs WHERE niveau='error' AND date>=datetime('now','-24 hours')").get().c,
  alertes_non_lues: db.prepare('SELECT COUNT(*) as c FROM alertes WHERE lu=0').get().c,
}))

// ── INSTANCES ─────────────────────────────────────────────────
function hydrateInst(inst){
  const modele = MODELES[inst.modele] || MODELES.restauration
  return {
    ...inst,
    discord_token: inst.discord_token ? '••••'+inst.discord_token.slice(-6) : '',
    grades:        sj(inst.grades_json,       modele.grades),
    articles:      sj(inst.articles_json,     modele.articles),
    questions_cv:  sj(inst.questions_cv_json, QUESTIONS_CV),
    paye:          sj(inst.paye_json,         PAYE_DEFAULT),
    live:          manager.getBotInfo(inst.id),
  }
}

router.get('/instances', auth, (req,res) => res.json(db.prepare('SELECT * FROM instances ORDER BY date_creation').all().map(hydrateInst)))
router.get('/instances/:id', auth, (req,res) => {
  const inst=db.prepare('SELECT * FROM instances WHERE id=?').get(req.params.id)
  if(!inst) return res.status(404).json({error:'Introuvable'})
  res.json(hydrateInst(inst))
})

router.post('/instances', auth, (req,res) => {
  const {nom,modele='restauration',emoji,couleur,description}=req.body
  if(!nom) return res.status(400).json({error:'Nom requis'})
  const m = MODELES[modele]||MODELES.restauration
  const r=db.prepare('INSERT INTO instances (nom,modele,emoji,couleur,description,grades_json,articles_json,questions_cv_json,paye_json) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(nom,modele,emoji||m.emoji,couleur||m.couleur,description||'',JSON.stringify(m.grades),JSON.stringify(m.articles),JSON.stringify(QUESTIONS_CV),JSON.stringify(PAYE_DEFAULT))
  res.json({ok:true,id:r.lastInsertRowid})
})

router.put('/instances/:id', auth, (req,res) => {
  const id=req.params.id; const inst=db.prepare('SELECT * FROM instances WHERE id=?').get(id)
  if(!inst) return res.status(404).json({error:'Introuvable'})
  const b=req.body; const token=b.discord_token&&!b.discord_token.includes('••')?b.discord_token:inst.discord_token
  db.prepare(`UPDATE instances SET nom=?,emoji=?,couleur=?,description=?,site_url=?,
    discord_token=?,discord_client_id=?,guild_id=?,
    channel_cv=?,channel_logs=?,channel_productions=?,channel_ventes=?,channel_alertes=?,channel_welcome=?,channel_annonces=?,channel_absences=?,
    role_employe=?,role_attente_entretien=?,role_patron=?,
    grades_json=?,articles_json=?,questions_cv_json=?,paye_json=? WHERE id=?`).run(
    b.nom??inst.nom,b.emoji??inst.emoji,b.couleur??inst.couleur,b.description??inst.description,b.site_url??inst.site_url,
    token,b.discord_client_id??inst.discord_client_id,b.guild_id??inst.guild_id,
    b.channel_cv??inst.channel_cv,b.channel_logs??inst.channel_logs,b.channel_productions??inst.channel_productions,
    b.channel_ventes??inst.channel_ventes,b.channel_alertes??inst.channel_alertes,b.channel_welcome??inst.channel_welcome,
    b.channel_annonces??inst.channel_annonces,b.channel_absences??inst.channel_absences,
    b.role_employe??inst.role_employe,b.role_attente_entretien??inst.role_attente_entretien,b.role_patron??inst.role_patron,
    b.grades?JSON.stringify(b.grades):inst.grades_json,
    b.articles?JSON.stringify(b.articles):inst.articles_json,
    b.questions_cv?JSON.stringify(b.questions_cv):inst.questions_cv_json,
    b.paye?JSON.stringify(b.paye):inst.paye_json,
    id)
  res.json({ok:true})
})

router.delete('/instances/:id', auth, async (req,res) => {
  await manager.stopBot(Number(req.params.id)).catch(()=>{})
  db.prepare('DELETE FROM instances WHERE id=?').run(req.params.id)
  res.json({ok:true})
})

// ── CONTRÔLE BOT ──────────────────────────────────────────────
router.post('/instances/:id/start', auth, async (req,res) => {
  const id=Number(req.params.id); const r=await manager.startBot(id)
  if(r.ok) logDB(id,'info','Bot démarré')
  else { logDB(id,'error','Échec démarrage',r.error); alerteDB(id,'error',`Bot hors ligne : ${r.error}`) }
  res.json(r)
})
router.post('/instances/:id/stop', auth, async (req,res) => {
  const id=Number(req.params.id); const r=await manager.stopBot(id)
  if(r.ok) logDB(id,'info','Bot arrêté')
  res.json(r)
})
router.post('/instances/:id/restart', auth, async (req,res) => {
  const id=Number(req.params.id); const r=await manager.restartBot(id)
  if(r.ok) logDB(id,'info','Bot redémarré')
  else alerteDB(id,'error',`Redémarrage échoué : ${r.error}`)
  res.json(r)
})

// ── MAINTENANCE ───────────────────────────────────────────────
router.post('/instances/:id/maintenance', auth, (req,res) => {
  const id=Number(req.params.id); const inst=db.prepare('SELECT statut FROM instances WHERE id=?').get(id)
  if(!inst) return res.status(404).json({error:'Introuvable'})
  const {activer,message}=req.body; const nouveau=activer?'maintenance':'actif'
  db.prepare("UPDATE instances SET statut=?,maintenance_msg=?,maintenance_depuis=CASE WHEN ?='maintenance' THEN datetime('now') ELSE NULL END WHERE id=?").run(nouveau,message||'Site en maintenance.',nouveau,id)
  logDB(id,'info',`Maintenance ${activer?'activée':'levée'}`)
  res.json({ok:true})
})

// ── LOGS ──────────────────────────────────────────────────────
router.get('/instances/:id/logs', auth, (req,res) => {
  const {limit=100,niveau}=req.query; let q='SELECT * FROM logs WHERE instance_id=?',p=[req.params.id]
  if(niveau){q+=' AND niveau=?';p.push(niveau)}; q+=' ORDER BY id DESC LIMIT ?'; p.push(Math.min(Number(limit),500))
  res.json(db.prepare(q).all(...p))
})
router.post('/instances/:id/log', (req,res) => {
  const {secret,niveau,message,detail}=req.body
  const inst=db.prepare('SELECT * FROM instances WHERE id=?').get(req.params.id)
  if(!inst) return res.status(404).json({error:'Introuvable'})
  if(secret!==inst.guild_id&&secret!==process.env.LOG_SECRET) return res.status(403).json({error:'Non autorisé'})
  logDB(inst.id,niveau||'info',message,detail||'')
  res.json({ok:true})
})

// ── ACTIVITÉ EN DIRECT (push depuis bots) ─────────────────────
router.post('/instances/:id/activite', (req,res) => {
  const {secret,type,employe_tag,detail,montant}=req.body
  const inst=db.prepare('SELECT * FROM instances WHERE id=?').get(req.params.id)
  if(!inst) return res.status(404).json({error:'Introuvable'})
  if(secret!==inst.guild_id&&secret!==process.env.LOG_SECRET) return res.status(403).json({error:'Non autorisé'})
  db.prepare('INSERT INTO activite (instance_id,type,employe_tag,detail,montant) VALUES (?,?,?,?,?)').run(inst.id,type,employe_tag||'',detail||'',Number(montant)||0)
  db.prepare('DELETE FROM activite WHERE instance_id=? AND id NOT IN (SELECT id FROM activite WHERE instance_id=? ORDER BY id DESC LIMIT 200)').run(inst.id,inst.id)
  res.json({ok:true})
})

router.get('/activite', auth, (req,res) => {
  const since=req.query.since||0
  const rows=db.prepare('SELECT a.*,i.nom as inst_nom,i.emoji as inst_emoji,i.couleur as inst_couleur FROM activite a JOIN instances i ON a.instance_id=i.id WHERE a.id>? ORDER BY a.id DESC LIMIT 50').all(since)
  res.json(rows)
})

// ── ALERTES ───────────────────────────────────────────────────
router.get('/alertes', auth, (req,res) => {
  const rows=db.prepare('SELECT al.*,i.nom as inst_nom,i.emoji as inst_emoji FROM alertes al JOIN instances i ON al.instance_id=i.id ORDER BY al.id DESC LIMIT 50').all()
  res.json(rows)
})
router.post('/alertes/:id/lu', auth, (req,res) => { db.prepare('UPDATE alertes SET lu=1 WHERE id=?').run(req.params.id); res.json({ok:true}) })
router.post('/alertes/tout-lu', auth, (req,res) => { db.prepare('UPDATE alertes SET lu=1').run(); res.json({ok:true}) })

// ── MAINTENANCE CHECK (depuis bots) ───────────────────────────
router.get('/public/maintenance/:guild_id', (req,res) => {
  const inst=db.prepare('SELECT statut,maintenance_msg,maintenance_depuis,nom,emoji FROM instances WHERE guild_id=?').get(req.params.guild_id)
  if(!inst) return res.json({maintenance:false})
  res.json({maintenance:inst.statut==='maintenance',message:inst.maintenance_msg,depuis:inst.maintenance_depuis,nom:inst.nom,emoji:inst.emoji})
})

// ── MODÈLES disponibles ───────────────────────────────────────
router.get('/modeles', auth, (req,res) => res.json(Object.entries(MODELES).map(([id,m])=>({id,...m,grades:m.grades.length,articles:m.articles.length}))))

module.exports = router

// ── TÉLÉCHARGER le modèle personnalisé pour un bot ───────────
router.get('/instances/:id/telecharger', auth, (req, res) => {
  const inst = db.prepare('SELECT * FROM instances WHERE id=?').get(req.params.id)
  if (!inst) return res.status(404).json({ error: 'Instance introuvable' })

  const modele = inst.modele || 'restauration'
  const AdmZip = require('adm-zip')
  const path   = require('path')
  const fs     = require('fs')

  // Chercher le ZIP du modèle (code du bot)
  const modeleZip = path.join(process.cwd(), 'modeles', `${modele}.zip`)

  try {
    let zip
    if (fs.existsSync(modeleZip)) {
      // Utiliser le vrai code du bot comme base
      zip = new AdmZip(modeleZip)
    } else {
      // Fallback : ZIP vide avec juste la config
      zip = new AdmZip()
    }

    // Écraser le .env avec les vraies valeurs
    const envContent = [
      `# ── ${inst.nom} — Configuration ──`,
      `# NE PAS PARTAGER CE FICHIER`,
      ``,
      `DISCORD_TOKEN=${inst.discord_token || 'METS_TON_TOKEN_ICI'}`,
      `CLIENT_ID=${inst.discord_client_id || ''}`,
      `GUILD_ID=${inst.guild_id || ''}`,
      ``,
      `SESSION_SECRET=${generateSecret()}`,
      `PORT=3000`,
      ``,
      `# Channels`,
      `CHANNEL_CV=${inst.channel_cv || ''}`,
      `CHANNEL_LOGS=${inst.channel_logs || ''}`,
      `CHANNEL_PRODUCTIONS=${inst.channel_productions || ''}`,
      `CHANNEL_VENTES=${inst.channel_ventes || ''}`,
      `CHANNEL_ALERTES=${inst.channel_alertes || ''}`,
      `CHANNEL_WELCOME=${inst.channel_welcome || ''}`,
      `CHANNEL_ANNONCES=${inst.channel_annonces || ''}`,
      `CHANNEL_ABSENCES=${inst.channel_absences || ''}`,
      ``,
      `# Rôles`,
      `ROLE_EMPLOYE=${inst.role_employe || ''}`,
      `ROLE_ATTENTE_ENTRETIEN=${inst.role_attente_entretien || ''}`,
      `ROLE_PATRON=${inst.role_patron || ''}`,
    ].join('\n')

    // Remplacer ou ajouter le .env (chercher dans le zip d'abord)
    const entries = zip.getEntries()
    const envEntry = entries.find(e => e.entryName.endsWith('.env') || e.entryName.endsWith('.env.example'))
    if (envEntry) {
      zip.deleteFile(envEntry.entryName)
    }
    // Ajouter au bon niveau (dans le dossier racine du bot)
    const rootDir = entries.length > 0 ? (entries[0].entryName.split('/')[0] + '/') : ''
    zip.addFile(rootDir + '.env', Buffer.from(envContent, 'utf8'))

    const zipBuffer = zip.toBuffer()
    const filename  = `${inst.nom.replace(/\s+/g, '-').toLowerCase()}-bot.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', zipBuffer.length)
    res.send(zipBuffer)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function generateSecret(len = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
