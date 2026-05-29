#!/usr/bin/env node
'use strict'

const express = require('express')
const cors = require('cors')
const http = require('node:http')
const { buildVoucherXml, buildStatusQueryXml } = require('./tally-xml')

const PORT = parseInt(process.env.BRIDGE_PORT ?? '9998', 10)
const TALLY_PORT = parseInt(process.env.TALLY_PORT ?? '9000', 10)
const TALLY_HOST = process.env.TALLY_HOST ?? '127.0.0.1'
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://app.opsc-copilot.in'

const app = express()

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (local tools) only in dev
      if (!origin || origin === ALLOWED_ORIGIN || process.env.NODE_ENV === 'development') {
        return cb(null, true)
      }
      cb(new Error(`CORS: origin ${origin} not allowed`))
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }),
)
app.use(express.json())

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/ping', async (_req, res) => {
  try {
    await tallyRequest('<ENVELOPE><HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER><BODY><EXPORTDATA><REQUESTDESC><REPORTNAME>List of Companies</REPORTNAME></REQUESTDESC></EXPORTDATA></BODY></ENVELOPE>')
    res.json({ ok: true, tally: 'reachable' })
  } catch (err) {
    res.status(503).json({ ok: false, tally: 'unreachable', error: String(err) })
  }
})

// ── Push voucher ──────────────────────────────────────────────────────────────
app.post('/api/voucher', async (req, res) => {
  const { companyName, gstin, filingPeriod, documentId, documentName, documentType } = req.body

  if (!documentId) {
    return res.status(400).json({ error: 'documentId is required' })
  }

  try {
    const xml = buildVoucherXml({ companyName, gstin, filingPeriod, documentId, documentName, documentType })
    const responseXml = await tallyRequest(xml)

    // Extract REMOTEID or MASTERID from Tally response as our tallyId
    const tallyIdMatch = responseXml.match(/<REMOTEID>([^<]+)<\/REMOTEID>/) ??
                         responseXml.match(/<MASTERID>([^<]+)<\/MASTERID>/)
    const tallyId = tallyIdMatch?.[1] ?? documentId

    res.json({ ok: true, tallyId, raw: responseXml.slice(0, 500) })
  } catch (err) {
    console.error('[tally-bridge] voucher push failed:', err)
    res.status(502).json({ error: String(err) })
  }
})

// ── GST filing status ─────────────────────────────────────────────────────────
app.get('/api/gst-status', async (req, res) => {
  const { gstin, period } = req.query

  if (!gstin || !period) {
    return res.status(400).json({ error: 'gstin and period are required' })
  }

  try {
    const xml = buildStatusQueryXml(String(gstin), String(period))
    const responseXml = await tallyRequest(xml)

    // Simple heuristic: if Tally returned any VOUCHER tags, consider Filed
    const hasFiling = responseXml.includes('<VOUCHER')
    res.json({
      gstin,
      period,
      status: hasFiling ? 'Filed' : 'Pending',
      raw: responseXml.slice(0, 1000),
    })
  } catch (err) {
    console.error('[tally-bridge] status query failed:', err)
    res.status(502).json({ error: String(err) })
  }
})

// ── Tally HTTP transport ──────────────────────────────────────────────────────
function tallyRequest(xmlBody) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(xmlBody, 'utf8')
    const options = {
      hostname: TALLY_HOST,
      port: TALLY_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': buf.byteLength,
      },
    }

    const req = http.request(options, (tallyRes) => {
      let data = ''
      tallyRes.setEncoding('utf8')
      tallyRes.on('data', (chunk) => (data += chunk))
      tallyRes.on('end', () => resolve(data))
    })

    req.setTimeout(10_000, () => {
      req.destroy()
      reject(new Error('Tally request timed out after 10s'))
    })

    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[tally-bridge] Listening on http://127.0.0.1:${PORT}`)
  console.log(`[tally-bridge] Forwarding to Tally at ${TALLY_HOST}:${TALLY_PORT}`)
  console.log(`[tally-bridge] Allowed origin: ${ALLOWED_ORIGIN}`)
})
