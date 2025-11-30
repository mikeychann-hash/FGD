# FGD Desktop Application

Modern Windows desktop application for managing the AICraft Federation Governance Dashboard.

Built with **React 19** + **Vite** + **Electron** + **Shadcn/ui** + **Tailwind CSS**

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- FGD backend server ready

### 1. Install Dependencies (if not done)
```bash
npm install
```

### 2. Install Missing Radix UI Components
```bash
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-select
```

### 3. Start Development

**Terminal 1 - Start Backend:**
```bash
cd ..
npm start
```
The backend should start on http://localhost:3000

**Terminal 2 - Start Frontend:**
```bash
npm run dev
```
Then open http://localhost:5173 in your browser

**OR run with Electron:**
```bash
npm run electron:dev
```

---

## 📁 Project Structure

```
desktop-app/
├── src/
│   ├── components/
│   │   ├── ui/              # Shadcn/ui components
│   │   ├── dashboard/       # Dashboard-specific components
│   │   ├── admin/           # Admin panel components
│   │   ├── fusion/          # Fusion memory components
│   │   └── layout/          # App shell, header, navigation
│   ├── hooks/               # Custom React hooks
│   │   ├── useTheme.ts      # Dark/light theme toggle
│   │   └── useWebSocket.ts  # WebSocket connection
│   ├── lib/                 # Utilities
│   │   ├── api.ts           # API client (Axios)
│   │   └── utils.ts         # Helper functions
│   ├── pages/               # Route pages
│   │   ├── Dashboard.tsx    # Cluster monitoring
│   │   ├── Admin.tsx        # Bot management
│   │   └── Fusion.tsx       # Fusion knowledge
│   ├── stores/              # Zustand state management
│   │   ├── authStore.ts
│   │   ├── botStore.ts
│   │   ├── connectivityStore.ts
│   │   ├── metricsStore.ts
│   │   └── fusionStore.ts
│   ├── types/               # TypeScript types
│   ├── App.tsx              # Main app with routing
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles + Tailwind
├── electron/
│   └── main.cjs             # Electron main process
├── public/                  # Static assets
├── .env                     # Environment variables
├── package.json
├── tailwind.config.js       # Tailwind configuration
├── tsconfig.json            # TypeScript config
└── vite.config.ts           # Vite build config
```

---

## 🎨 Features

### Dashboard Page (`/`)
- **Cluster Grid** - Live status of all nodes
- **Metrics Charts** - CPU, Memory, Queue, Latency visualizations
- **Policy Panel** - Adjust learning rate, delegation bias, cooldown
- **Fusion Summary** - Quick stats on skills, dialogues, outcomes

### Admin Page (`/admin`)
- **Bot Management**
  - Create bots with custom roles and personality traits
  - Spawn/despawn bots
  - Delete bots
  - View bot status, CPU, memory, tick count
- **Real-time Console Log** - Auto-scrolling log viewer
- **Dead Letter Queue** - Failed spawns with retry
- **Action Log** - History of bot actions
- **Inventory Viewer** - Bot inventory contents
- **Chest Manager** - Chest interaction controls
- **Command Input** - Natural language commands
- **Status Bar** - Connection status (API, WebSocket, Bridge)

### Fusion Page (`/fusion`)
- Knowledge base viewer
- Skills, dialogues, outcomes tables
- Real-time updates

---

## 🛠️ Technology Stack

### Core
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Lightning-fast dev server
- **Electron** - Desktop wrapper

### UI & Styling
- **Shadcn/ui** - Beautiful, accessible components
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Headless component primitives
- **Lucide React** - Icon library

### State & Data
- **Zustand** - State management
- **Axios** - HTTP client
- **Socket.IO Client** - Real-time communication
- **React Hook Form** - Form handling
- **Zod** - Schema validation

### Charts & Visualization
- **Recharts** - React-native charts

### Animation
- **Framer Motion** - Smooth animations

---

## 🔧 Available Scripts

### Development
```bash
# Start Vite dev server (web only)
npm run dev

# Start with Electron (desktop)
npm run electron:dev

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix
```

### Production
```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Build Electron app
npm run electron:build
```

---

## 🌐 Environment Variables

Create `.env` file:
```env
VITE_API_BASE=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## 🎯 Next Steps

### High Priority
1. **Install missing Radix dependencies:**
   ```bash
   npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-select
   ```

2. **Test the app:**
   - Start backend: `cd .. && npm start`
   - Start frontend: `npm run dev`
   - Navigate to http://localhost:5173
   - Test Dashboard → Admin → Fusion pages

3. **Fix any TypeScript errors:**
   ```bash
   npm run lint
   ```

### Medium Priority
4. Implement Fusion page fully
5. Wire up WebSocket real-time updates
6. Add toast notifications
7. Add page animations

### Polish
8. Add keyboard shortcuts
9. Enhance Electron integration
10. System tray + notifications

---

## 🐛 Troubleshooting

### Port 5173 already in use
```bash
# Windows - Kill process on port 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Module not found
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript errors
```bash
# Check for errors
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Styles not applying
1. Check `tailwind.config.js` content paths
2. Verify `@tailwind` directives in `index.css`
3. Restart dev server

### WebSocket not connecting
1. Ensure backend is running on port 3000
2. Check `.env` has correct `VITE_WS_URL`
3. Check browser console for errors

---

## 📚 Documentation

All migration documentation is in:
```
../docs/migration/
├── INDEX.md               # Start here
├── README.md              # Executive summary
├── QUICK_START.md         # Setup guide
├── CODE_EXAMPLES.md       # Component examples
├── COMPONENT_MAPPING.md   # Architecture map
├── BEFORE_AFTER.md        # Comparisons
└── BUILD_STATUS.md        # Current progress
```

---

## 🎨 Customization

### Colors
Edit `tailwind.config.js` and `src/index.css`:
```css
:root {
  --primary: 217.2 91.2% 59.8%;      /* Blue */
  --secondary: 217.2 32.6% 17.5%;    /* Dark Blue */
  --accent: 217.2 32.6% 17.5%;       /* Highlight */
  --destructive: 0 62.8% 30.6%;      /* Red */
  --muted: 217.2 32.6% 17.5%;        /* Gray */
}
```

### Theme Toggle
Theme toggle is in the header. Persists to localStorage.

### Add New Pages
1. Create page in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link in `src/components/layout/Navigation.tsx`

---

## 🔗 Resources

- **Shadcn/ui:** https://ui.shadcn.com
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Recharts:** https://recharts.org
- **Zustand:** https://github.com/pmndrs/zustand
- **Electron:** https://electronjs.org/docs
- **Framer Motion:** https://framer.com/motion

---

## 📄 License

GPL-3.0 (same as parent FGD project)

---

## 🎉 Status

**Current Phase:** MVP Complete ✅
- Core infrastructure: ✅ Done
- Dashboard page: ✅ Done  
- Admin page: ✅ Done
- Fusion page: ⚠️ Basic structure
- WebSocket integration: ⚠️ Needs testing
- Error handling: ⚠️ Needs improvement

**Next Phase:** Testing & Polish
- Test with real backend
- Fix TypeScript errors
- Add animations
- Add toast notifications
- Full Fusion page implementation

---

**Ready to run?**
```bash
npm run dev
```

**Then open:** http://localhost:5173 🚀
