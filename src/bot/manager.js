const { Client, GatewayIntentBits, Events } = require('discord.js')
const { db } = require('../db/database')

const bots = new Map()

function log(id,n,m,d='') { try { db.prepare('INSERT INTO logs (instance_id,niveau,message,detail) VALUES (?,?,?,?)').run(id,n,m,d) } catch {} }
function alerte(id,n,m)    { try { db.prepare('INSERT INTO alertes (instance_id,niveau,message) VALUES (?,?,?)').run(id,n,m) } catch {} }
function activite(id,type,tag,detail,montant=0) { try { db.prepare('INSERT INTO activite (instance_id,type,employe_tag,detail,montant) VALUES (?,?,?,?,?)').run(id,type,tag,detail,montant) } catch {} }

function setHealth(id,data) {
  db.prepare("UPDATE instances SET bot_online=?,bot_ping_at=datetime('now'),bot_tag=?,bot_latency=? WHERE id=?").run(data.online?1:0,data.tag||'',data.latency||0,id)
}

async function startBot(instanceId) {
  const inst=db.prepare('SELECT * FROM instances WHERE id=?').get(instanceId)
  if(!inst)               return {ok:false,error:'Instance introuvable'}
  if(!inst.discord_token) return {ok:false,error:'Token Discord manquant — configure l\'instance'}
  if(bots.has(instanceId)) await stopBot(instanceId)

  const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages]})
  client._instanceId=instanceId; client._startedAt=new Date()

  client.once(Events.ClientReady,()=>{
    const tag=client.user.tag, ping=client.ws.ping
    console.log(`✅ [#${instanceId}] ${tag} (${ping}ms)`)
    log(instanceId,'success',`Bot connecté : ${tag}`,`${ping}ms`)
    setHealth(instanceId,{online:true,tag,latency:ping})
    db.prepare("UPDATE instances SET statut=CASE WHEN statut IN ('configure','arrete','erreur') THEN 'actif' ELSE statut END WHERE id=?").run(instanceId)
  })

  client.on('error',err=>{
    log(instanceId,'error','Erreur Discord',err.message)
    alerte(instanceId,'error',`Bot en erreur : ${err.message}`)
    setHealth(instanceId,{online:false,tag:''})
    db.prepare("UPDATE instances SET statut='erreur' WHERE id=?").run(instanceId)
  })

  // Alerte critique : membre qui quitte
  client.on(Events.GuildMemberRemove,async member=>{
    if(member.guild.id!==inst.guild_id) return
    log(instanceId,'warn',`Membre parti : ${member.user.tag}`)
    alerte(instanceId,'warn',`⚠️ ${member.user.tag} a quitté le serveur — compte à rendre`)
    activite(instanceId,'depart',member.user.tag,'Membre parti du serveur')
    const chId=inst.channel_alertes; if(!chId) return
    try {
      const {EmbedBuilder}=require('discord.js')
      client.channels.cache.get(chId)?.send({embeds:[new EmbedBuilder().setColor(0xef4444).setTitle('⚠️ Membre parti').setDescription(`**${member.user.tag}** a quitté le Discord.`).setTimestamp()]})
    } catch {}
  })

  // Heartbeat 30s
  client._hb=setInterval(()=>{ if(!client.isReady()) return; setHealth(instanceId,{online:true,tag:client.user?.tag||'',latency:client.ws.ping}) },30_000)

  try {
    await client.login(inst.discord_token)
    bots.set(instanceId,{client,startedAt:new Date()})
    return {ok:true}
  } catch(err) {
    log(instanceId,'error','Échec connexion',err.message)
    alerte(instanceId,'error',`Connexion échouée : ${err.message}`)
    setHealth(instanceId,{online:false,tag:''})
    db.prepare("UPDATE instances SET statut='erreur' WHERE id=?").run(instanceId)
    return {ok:false,error:err.message}
  }
}

async function stopBot(instanceId) {
  const e=bots.get(instanceId); if(!e) return {ok:false,error:'Bot non démarré'}
  clearInterval(e.client._hb); e.client.destroy(); bots.delete(instanceId)
  setHealth(instanceId,{online:false,tag:''})
  db.prepare("UPDATE instances SET statut='arrete' WHERE id=?").run(instanceId)
  return {ok:true}
}

async function restartBot(instanceId) { await stopBot(instanceId); await new Promise(r=>setTimeout(r,1500)); return startBot(instanceId) }

function getBotInfo(instanceId) {
  const e=bots.get(instanceId); if(!e) return {running:false}
  return {running:true,startedAt:e.startedAt,tag:e.client.user?.tag||'—',latency:e.client.ws.ping,uptime:Math.floor((Date.now()-e.startedAt)/1000)}
}

function getBots() { return bots }

async function bootAll() {
  const list=db.prepare("SELECT id FROM instances WHERE statut IN ('actif','erreur') AND discord_token!=''").all()
  console.log(`🚀 Boot : ${list.length} bot(s)`)
  for(const {id} of list){ await startBot(id); await new Promise(r=>setTimeout(r,1000)) }
}

module.exports = {startBot,stopBot,restartBot,getBotInfo,getBots,bootAll}
