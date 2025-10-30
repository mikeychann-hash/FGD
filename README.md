# AICraft Cluster Dashboard

A beautiful, real-time monitoring dashboard for AICraft cluster management with WebSocket support, admin panel, and theme switching.

## Features

- 🎨 Beautiful UI with smooth animations
- 🔄 Real-time updates via WebSocket
- 🌓 Dark/Light theme toggle
- 📊 Interactive charts with Chart.js
- ⚡ Complete admin control panel
- 🖥️ Node detail modals
- ♿ Accessible (WCAG compliant)

## Quick Start

```bash
npm install
npm start
```

Visit: `http://localhost:3000`

## API Endpoints

- `GET /api/cluster` - Cluster nodes
- `GET /api/metrics` - System metrics
- `GET /api/fusion` - Fusion knowledge
- `GET /api/stats` - Statistics
- `GET /api/logs` - System logs
- `GET /api/nodes/:id` - Node details
- `POST /api/config` - Update config
- `POST /api/policy` - Update policy
