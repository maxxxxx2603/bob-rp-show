const Database = require('better-sqlite3')
const path = require('path')
const fs   = require('fs')

const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(path.join(dataDir, 'showroom.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS panel_config (
    key TEXT PRIMARY KEY, value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    modele TEXT DEFAULT 'restauration',
    emoji TEXT DEFAULT '🍽️',
    couleur TEXT DEFAULT '#C9A84C',
    description TEXT DEFAULT '',
    site_url TEXT DEFAULT '',
    discord_token TEXT DEFAULT '',
    discord_client_id TEXT DEFAULT '',
    guild_id TEXT DEFAULT '',
    channel_cv TEXT DEFAULT '',
    channel_logs TEXT DEFAULT '',
    channel_productions TEXT DEFAULT '',
    channel_ventes TEXT DEFAULT '',
    channel_alertes TEXT DEFAULT '',
    channel_welcome TEXT DEFAULT '',
    channel_annonces TEXT DEFAULT '',
    channel_absences TEXT DEFAULT '',
    role_employe TEXT DEFAULT '',
    role_attente_entretien TEXT DEFAULT '',
    role_patron TEXT DEFAULT '',
    grades_json TEXT DEFAULT '[]',
    articles_json TEXT DEFAULT '[]',
    questions_cv_json TEXT DEFAULT '[]',
    paye_json TEXT DEFAULT '{}',
    statut TEXT DEFAULT 'configure',
    maintenance_msg TEXT DEFAULT 'Site en maintenance. Revenez bientôt.',
    maintenance_depuis TEXT,
    bot_online INTEGER DEFAULT 0,
    bot_ping_at TEXT,
    bot_tag TEXT DEFAULT '',
    bot_latency INTEGER DEFAULT 0,
    date_creation TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    niveau TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    detail TEXT DEFAULT '',
    date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
  );

  -- Flux activité en direct (push depuis les bots)
  CREATE TABLE IF NOT EXISTS activite (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    employe_tag TEXT DEFAULT '',
    detail TEXT DEFAULT '',
    montant REAL DEFAULT 0,
    date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
  );

  -- Alertes critiques
  CREATE TABLE IF NOT EXISTS alertes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    niveau TEXT DEFAULT 'warn',
    message TEXT NOT NULL,
    lu INTEGER DEFAULT 0,
    date TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
  );
`)

const ins = db.prepare('INSERT OR IGNORE INTO panel_config (key,value) VALUES (?,?)')
ins.run('panel_nom',   'RP Showroom')
ins.run('panel_emoji', '🎮')

const GRADES_RESTAURATION = [
  { nom:'Stagiaire',    emoji:'🔰', couleur:'#6b7280', ordre:0, mode_paye:'pourcentage', taux_base:3,  bonus_prod:0.5, bonus_vente:1,   bonus_heure:0.2, prix_piece:100,  role_discord:'' },
  { nom:'Employé',      emoji:'👤', couleur:'#60a5fa', ordre:1, mode_paye:'pourcentage', taux_base:5,  bonus_prod:1,   bonus_vente:2,   bonus_heure:0.5, prix_piece:150,  role_discord:'' },
  { nom:'Senior',       emoji:'⭐', couleur:'#a78bfa', ordre:2, mode_paye:'pourcentage', taux_base:8,  bonus_prod:1.5, bonus_vente:3,   bonus_heure:0.8, prix_piece:200,  role_discord:'' },
  { nom:'Chef de rang', emoji:'🍴', couleur:'#f59e0b', ordre:3, mode_paye:'pourcentage', taux_base:10, bonus_prod:2,   bonus_vente:4,   bonus_heure:1,   prix_piece:280,  role_discord:'' },
  { nom:'Manager',      emoji:'👑', couleur:'#c9a84c', ordre:4, mode_paye:'pourcentage', taux_base:12, bonus_prod:2.5, bonus_vente:5,   bonus_heure:1.2, prix_piece:350,  role_discord:'' },
  { nom:'Directeur',    emoji:'💎', couleur:'#ef4444', ordre:5, mode_paye:'pourcentage', taux_base:15, bonus_prod:3,   bonus_vente:6,   bonus_heure:1.5, prix_piece:500,  role_discord:'' },
]

const GRADES_CUSTOM = [
  { nom:'Stagiaire',    emoji:'🔰', couleur:'#6b7280', ordre:0, mode_paye:'pourcentage', taux_base:5,  bonus_prod:0, bonus_vente:0, bonus_heure:0, prix_piece:0, role_discord:'' },
  { nom:'Technicien',   emoji:'🔧', couleur:'#60a5fa', ordre:1, mode_paye:'pourcentage', taux_base:8,  bonus_prod:0, bonus_vente:0, bonus_heure:0, prix_piece:0, role_discord:'' },
  { nom:'Senior',       emoji:'⭐', couleur:'#8b5cf6', ordre:2, mode_paye:'pourcentage', taux_base:12, bonus_prod:0, bonus_vente:0, bonus_heure:0, prix_piece:0, role_discord:'' },
  { nom:'Chef atelier', emoji:'👑', couleur:'#f59e0b', ordre:3, mode_paye:'pourcentage', taux_base:15, bonus_prod:0, bonus_vente:0, bonus_heure:0, prix_piece:0, role_discord:'' },
  { nom:'Directeur',    emoji:'💎', couleur:'#ef4444', ordre:4, mode_paye:'pourcentage', taux_base:20, bonus_prod:0, bonus_vente:0, bonus_heure:0, prix_piece:0, role_discord:'' },
]

const ARTICLES_RESTAURATION = ['Burger RP x1','Pizza Margherita','Frites Large','Soda Cola 6pack','Café Espresso','Menu Enfant','Salade Caesar']
const ARTICLES_CUSTOM = ['Custom carrosserie','Custom peinture','Custom moteur','Custom intérieur','Custom jantes','Custom kit aero','Custom full build']

const QUESTIONS_CV = ["Quel poste vous intéresse ?","Avez-vous de l'expérience RP ?","Quelles sont vos disponibilités en jeu ?","Décrivez-vous en 3 mots","Pourquoi rejoindre notre entreprise ?"]

const PAYE_DEFAULT = { mode:'pourcentage', base_heures:50 }

const MODELES = {
  restauration: { emoji:'🍽️', couleur:'#C9A84C', grades:GRADES_RESTAURATION, articles:ARTICLES_RESTAURATION },
  custom:       { emoji:'🔧', couleur:'#8b5cf6', grades:GRADES_CUSTOM,        articles:ARTICLES_CUSTOM },
}

module.exports = { db, MODELES, QUESTIONS_CV, PAYE_DEFAULT }
