# OpsCopilot Tally Bridge

A lightweight local HTTP bridge that lets OpsCopilot communicate with your Tally Prime installation.

## How it works

```
OpsCopilot Cloud → HTTPS → Tally Bridge (your PC :9998) → HTTP → Tally Prime (:9000)
```

## Requirements

- Node.js 18 or later  
- Tally Prime with **HTTP server enabled** on port 9000  
- Windows PC where Tally is installed

## Quick Start

### 1. Enable HTTP server in Tally

Open Tally Prime → **Help → Settings → Connectivity → Tally.NET & Remote Access**:
- Enable TallyPrime Server: `Yes`
- Port: `9000`

### 2. Install and start the bridge

```bash
# Install Node.js from https://nodejs.org if not already installed

npm install

# Start the bridge (runs on http://127.0.0.1:9998)
npm start
```

### 3. Configure in OpsCopilot

In OpsCopilot → **Settings → Integrations → Tally**:
- Bridge URL: `http://localhost:9998` (if OpsCopilot is installed locally) or the machine's LAN IP
- Company Name: Your Tally company name

Click **Test Connection** to verify.

## Environment Variables

Create a `.env` file (or set environment variables) to customise:

| Variable         | Default                           | Description                     |
|------------------|-----------------------------------|---------------------------------|
| `BRIDGE_PORT`    | `9998`                            | Port this bridge listens on     |
| `TALLY_PORT`     | `9000`                            | Tally Prime HTTP server port    |
| `TALLY_HOST`     | `127.0.0.1`                       | Tally Prime hostname/IP         |
| `ALLOWED_ORIGIN` | `https://app.opsc-copilot.in`     | CORS allowed origin             |
| `NODE_ENV`       | (unset)                           | Set to `development` for CORS   |

## API Endpoints

| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| GET    | `/api/ping`       | Health check (tests Tally reach)   |
| POST   | `/api/voucher`    | Push a GST return document         |
| GET    | `/api/gst-status` | Query filing status for GSTIN+period|

## Security

- Bridge listens on `127.0.0.1` only — not accessible from the internet
- CORS is restricted to the OpsCopilot domain
- No credentials are stored — only document metadata is forwarded

## Troubleshooting

**"Tally unreachable"** — Check that Tally Prime is open and HTTP server is enabled.  
**Port 9000 in use** — Change `TALLY_PORT` to match your Tally settings.  
**CORS errors** — Set `NODE_ENV=development` for local testing.
