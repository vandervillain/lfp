const { createServer } = require('https')
const { parse } = require('url')
const next = require('next')
const fs = require('fs')
const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const httpsOptions = {
  key: fs.readFileSync('../../etc/letsencrypt/live/rando.gg/privkey.pem'),
  cert: fs.readFileSync('../../etc/letsencrypt/live/rando.gg/cert.pem'),
}
app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true)
    const { pathname, query } = parsedUrl
    if (pathname == '/.well-known/acme-challenge/ln3ocgHJTO9ArpgN-T4pnXx3_rnobI4FKQfh9kGWaX4') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('ln3ocgHJTO9ArpgN-T4pnXx3_rnobI4FKQfh9kGWaX4.pmAAB-Bu06aZDsrEaDfmvRR3aC9r3VP_pw-Jbu5zing')
    } else handle(req, res, parsedUrl)
  }).listen(3000, err => {
    if (err) throw err
    console.log('> Server started on https://localhost:3000')
  })
})