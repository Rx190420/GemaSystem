const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js')
const qrcode   = require('qrcode-terminal')
const express  = require('express')
const fs       = require('fs')
const path     = require('path')

// ── Config ────────────────────────────────────────────────────────────────────

// Railway (and most container hosts) assign the port to listen on via `PORT` —
// WHATSAPP_BOT_PORT stays as a local-dev override so `start-bot.bat` keeps working.
const PORT       = process.env.PORT || process.env.WHATSAPP_BOT_PORT || 3001
const API_SECRET = process.env.WHATSAPP_BOT_SECRET || ''
// RAILWAY_VOLUME_MOUNT_PATH is injected automatically by Railway once a Volume
// is attached to this service (no manual env var needed for it) — if present,
// store the session inside it so it survives redeploys. WHATSAPP_BOT_DATA
// still wins if someone sets it explicitly; plain relative path for local dev.
const DATA_PATH  = process.env.WHATSAPP_BOT_DATA
    || (process.env.RAILWAY_VOLUME_MOUNT_PATH && path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, '.wwebjs_auth'))
    || './.wwebjs_auth'
// Points at a system-installed Chromium (see Dockerfile) instead of downloading
// puppeteer's own copy — set by the container image, not needed for local dev.
const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined

// ── Session store ─────────────────────────────────────────────────────────────

const sessions = new Map() // sessionId -> SessionState

function SessionState(id) {
    this.id         = id
    this.client     = null
    this.isReady    = false
    this.qrLastSeen = null
    this.phone      = null
    this.name       = null
}

function makePuppeteerArgs() {
    return {
        headless: true,
        executablePath: CHROME_PATH,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
        ],
    }
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

async function initSession(sessionId) {
    if (sessions.has(sessionId)) {
        const existing = sessions.get(sessionId)
        if (existing.client) return existing
    }

    const state = new SessionState(sessionId)
    sessions.set(sessionId, state)

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId, dataPath: DATA_PATH }),
        puppeteer:    makePuppeteerArgs(),
        restartOnAuthFail: true,
    })

    state.client = client

    client.on('qr', qr => {
        state.qrLastSeen = qr
        state.isReady    = false
        console.log(`\n📱  QR [${sessionId}] — escanea con WhatsApp`)
        qrcode.generate(qr, { small: true })
    })

    client.on('authenticated', () => {
        console.log(`🔐  [${sessionId}] autenticado`)
        state.qrLastSeen = null
    })

    client.on('auth_failure', msg => {
        console.error(`❌  [${sessionId}] auth fallida:`, msg)
        state.isReady = false
    })

    client.on('ready', () => {
        state.isReady    = true
        state.qrLastSeen = null
        state.phone      = client.info?.wid?.user
        state.name       = client.info?.pushname
        console.log(`✅  [${sessionId}] listo — +${state.phone} (${state.name})`)
    })

    client.on('disconnected', reason => {
        state.isReady = false
        state.phone   = null
        state.name    = null
        console.warn(`⚠️  [${sessionId}] desconectado:`, reason)
    })

    client.initialize().catch(err => {
        console.error(`❌  [${sessionId}] initialize error:`, err.message)
        sessions.delete(sessionId)
    })

    return state
}

async function destroySession(sessionId) {
    const state = sessions.get(sessionId)
    if (!state) return false
    try { await state.client?.destroy() } catch {}
    sessions.delete(sessionId)
    return true
}

// ── Auto-restore sessions on startup ─────────────────────────────────────────

function autoRestore() {
    if (!fs.existsSync(DATA_PATH)) return
    const entries = fs.readdirSync(DATA_PATH).filter(e => e.startsWith('session-'))
    if (!entries.length) return
    console.log(`\n🔄  Restaurando ${entries.length} sesión(es) guardada(s)...`)
    for (const entry of entries) {
        const id = entry.replace('session-', '')
        initSession(id).catch(err => console.error(`❌  Restore [${id}]:`, err.message))
    }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function resolveId(client, phone) {
    const rawId = formatChatId(phone)
    if (!rawId) return null
    const numberId = await client.getNumberId(rawId.replace('@c.us', ''))
    return numberId ? numberId._serialized : null
}

function formatChatId(phone) {
    let clean = String(phone).replace(/[^\d]/g, '')
    if (!clean) return null
    if (/^\d{10}$/.test(clean)) clean = '52' + clean
    if (clean.startsWith('0'))  clean = clean.slice(1)
    if (clean.length < 10) return null
    return clean + '@c.us'
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

async function generateQrPng(value) {
    const QRCode = require('qrcode')
    const dataUrl = await QRCode.toDataURL(value, { width: 512, margin: 2, errorCorrectionLevel: 'H' })
    return dataUrl.replace('data:image/png;base64,', '')
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express()
app.use(express.json({ limit: '5mb' }))

app.use((req, res, next) => {
    if (!API_SECRET) return next()
    const token = req.headers['x-api-key'] || req.query.key
    if (token !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' })
    next()
})

// ── GET /sessions ─────────────────────────────────────────────────────────────

app.get('/sessions', (req, res) => {
    const list = []
    for (const [id, s] of sessions) {
        list.push({ id, ready: s.isReady, has_qr: !!s.qrLastSeen, phone: s.phone, name: s.name })
    }
    res.json(list)
})

// ── POST /sessions/:id/init ───────────────────────────────────────────────────

app.post('/sessions/:id/init', async (req, res) => {
    try {
        // If a session is stuck (exists but not ready and no QR pending), restart it
        const existing = sessions.get(req.params.id)
        if (existing && !existing.isReady && !existing.qrLastSeen) {
            await destroySession(req.params.id)
        }
        await initSession(req.params.id)
        res.json({ ok: true, message: `Sesión "${req.params.id}" iniciando...` })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// ── GET /sessions/:id/status ──────────────────────────────────────────────────
// Includes QR base64 in the response when available — avoids a second round-trip

app.get('/sessions/:id/status', async (req, res) => {
    const s = sessions.get(req.params.id)
    if (!s) return res.json({ started: false, ready: false, has_qr: false, qr: null })

    let qr = null
    if (s.qrLastSeen) {
        try {
            const QRCode = require('qrcode')
            const dataUrl = await QRCode.toDataURL(s.qrLastSeen, { width: 300, margin: 2 })
            qr = dataUrl
        } catch {}
    }

    res.json({ started: true, ready: s.isReady, has_qr: !!s.qrLastSeen, qr, phone: s.phone, name: s.name })
})

// ── GET /sessions/:id/qr ──────────────────────────────────────────────────────

app.get('/sessions/:id/qr', async (req, res) => {
    const s = sessions.get(req.params.id)
    if (!s)            return res.status(404).json({ error: 'Sesión no iniciada' })
    if (!s.qrLastSeen) return res.status(404).json({ error: s.isReady ? 'Ya conectado' : 'QR no disponible aún' })
    try {
        const png = await generateQrPng(s.qrLastSeen)
        res.json({ qr: 'data:image/png;base64,' + png })
    } catch {
        res.json({ qr_string: s.qrLastSeen })
    }
})

// ── DELETE /sessions/:id ──────────────────────────────────────────────────────

app.delete('/sessions/:id', async (req, res) => {
    const ok = await destroySession(req.params.id)
    if (!ok) return res.status(404).json({ error: 'Sesión no encontrada' })
    res.json({ ok: true })
})

// ── POST /sessions/:id/send ───────────────────────────────────────────────────

app.post('/sessions/:id/send', async (req, res) => {
    const s = sessions.get(req.params.id)
    if (!s)         return res.status(404).json({ error: 'Sesión no iniciada' })
    if (!s.isReady) return res.status(503).json({ error: 'Sesión no conectada', has_qr: !!s.qrLastSeen })

    const { phone, message } = req.body
    if (!phone || !message) return res.status(400).json({ error: 'Se requieren "phone" y "message"' })

    try {
        const chatId = await resolveId(s.client, phone)
        if (!chatId) return res.status(404).json({ error: `${phone} no tiene WhatsApp` })
        await s.client.sendMessage(chatId, message)
        console.log(`📤  [${req.params.id}] → ${chatId}: ${message.slice(0, 60)}…`)
        res.json({ ok: true, to: chatId })
    } catch (err) {
        console.error(`❌  [${req.params.id}] send:`, err.message)
        res.status(500).json({ error: err.message })
    }
})

// ── POST /sessions/:id/send-qr ────────────────────────────────────────────────

app.post('/sessions/:id/send-qr', async (req, res) => {
    const s = sessions.get(req.params.id)
    if (!s)         return res.status(404).json({ error: 'Sesión no iniciada' })
    if (!s.isReady) return res.status(503).json({ error: 'Sesión no conectada' })

    const { phone, qr_value, caption } = req.body
    if (!phone || !qr_value) return res.status(400).json({ error: 'Se requieren "phone" y "qr_value"' })

    try {
        const chatId = await resolveId(s.client, phone)
        if (!chatId) return res.status(404).json({ error: `${phone} no tiene WhatsApp` })

        const base64 = await generateQrPng(qr_value)
        const media  = new MessageMedia('image/png', base64, 'codigo-qr.png')
        await s.client.sendMessage(chatId, media, { caption: caption || '' })

        console.log(`📤  [${req.params.id}] QR → ${chatId}`)
        res.json({ ok: true, to: chatId })
    } catch (err) {
        console.error(`❌  [${req.params.id}] send-qr:`, err.message)
        res.status(500).json({ error: err.message })
    }
})

// ── POST /sessions/:id/send-batch ─────────────────────────────────────────────

app.post('/sessions/:id/send-batch', async (req, res) => {
    const s = sessions.get(req.params.id)
    if (!s)         return res.status(404).json({ error: 'Sesión no iniciada' })
    if (!s.isReady) return res.status(503).json({ error: 'Sesión no conectada' })

    const { recipients, message } = req.body
    if (!Array.isArray(recipients) || !message) return res.status(400).json({ error: 'Se requieren "recipients" y "message"' })

    const results = []
    for (const { phone, name } of recipients) {
        const body = name ? message.replace(/\{\{nombre\}\}/g, name) : message
        try {
            await delay(Math.floor(Math.random() * 800) + 400)
            const chatId = await resolveId(s.client, phone)
            if (!chatId) { results.push({ phone, ok: false, error: 'Sin WhatsApp' }); continue }
            await s.client.sendMessage(chatId, body)
            results.push({ phone, ok: true })
        } catch (err) {
            results.push({ phone, ok: false, error: err.message })
        }
    }

    const sent   = results.filter(r => r.ok).length
    const failed = results.filter(r => !r.ok).length
    console.log(`📤  [${req.params.id}] batch: ${sent}/${sent + failed}`)
    res.json({ sent, failed, results })
})

// ── Start ─────────────────────────────────────────────────────────────────────

// '0.0.0.0' — not '127.0.0.1'. Loopback-only is invisible to anything outside
// the process itself; Railway's network (and any other container host) reaches
// the app through its own proxy/network layer, which needs it to listen on
// all interfaces. This was the actual reason the bot never worked on Railway:
// bound to localhost, there was nothing outside the container that could
// ever reach it, no matter how the rest of the deploy was configured.
//
// '::' rather than '0.0.0.0' — Railway's private network (the one the Laravel
// backend uses to reach this bot via *.railway.internal) is IPv6. Binding
// only to 0.0.0.0 (IPv4) made the port fix from before necessary but not
// sufficient: the backend still couldn't reach it over the private network.
// '::' is the IPv6 wildcard and — with Node's default dual-stack socket —
// also accepts IPv4 connections, so this covers both.
app.listen(PORT, '::', () => {
    console.log('\n🤖  GemaSystem WhatsApp Bot Manager')
    console.log(`    API:  http://[::]:${PORT}/sessions`)
    if (API_SECRET) console.log('    Auth: activo (x-api-key)')
    console.log()
    autoRestore()
})

process.on('SIGINT', async () => {
    console.log('\nCerrando sesiones...')
    for (const [id] of sessions) await destroySession(id)
    process.exit(0)
})

// Keep the bot alive even on uncaught errors — Puppeteer can throw spuriously on Windows
process.on('uncaughtException', err => {
    console.error('⚠️  uncaughtException (bot continúa):', err.message)
})
process.on('unhandledRejection', (reason) => {
    console.error('⚠️  unhandledRejection (bot continúa):', reason?.message ?? reason)
})
