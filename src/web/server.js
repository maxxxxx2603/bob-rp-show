const express = require('express')
const session = require('express-session')
const path    = require('path')
const { uploadsDir } = require('../db/database')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended:true }))
app.use(express.static(path.join(process.cwd(),'public')))
app.use('/uploads', express.static(uploadsDir))

app.use(session({
  secret: process.env.SESSION_SECRET||'showroom-dev-secret',
  resave:false, saveUninitialized:false,
  cookie:{ secure:false, maxAge:1000*60*60*24*7 }
}))

// Servir les modèles ZIP
app.use('/modeles', require('express').static(require('path').join(process.cwd(), 'modeles')))
app.use('/api', require('./routes/api'))
app.get('*', (_,res) => res.sendFile(path.join(process.cwd(),'public','index.html')))

function startWeb() {
  const PORT = process.env.PORT||4000
  app.listen(PORT,'0.0.0.0',()=>console.log(`🌐 Panel : http://0.0.0.0:${PORT}`))
}
module.exports = { startWeb }
