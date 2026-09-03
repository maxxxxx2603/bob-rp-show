require('dotenv').config()
const { startWeb } = require('./web/server')
const { bootAll }  = require('./bot/manager')

console.log('🎮 RP Showroom — Démarrage…')
startWeb()
setTimeout(bootAll, 2000)
