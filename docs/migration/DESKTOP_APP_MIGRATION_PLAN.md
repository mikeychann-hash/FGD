# FGD Desktop App Migration Plan
## React + Vite + Electron + Shadcn/ui + Tailwind

**Date:** November 2024  
**Target:** Modern Windows Desktop Application  
**Tech Stack:** Electron + React 18 + Vite + TypeScript + Shadcn/ui + Tailwind CSS

---

## 🎯 Executive Summary

Transform the current HTML/CSS/Vanilla JS web frontend into a modern, component-based React desktop application with beautiful UI components, real-time WebSocket integration, and native Windows features.

### Current Stack
- **Frontend:** HTML files (dashboard.html, admin.html, fusion.html)
- **Styling:** Custom CSS with CSS variables
- **Charts:** Chart.js
- **Real-time:** Socket.IO client
- **Desktop:** Basic Electron wrapper (exists but underutilized)

### Target Stack
- **Frontend Framework:** React 18 with TypeScript
- **Build Tool:** Vite (instant HMR, optimized builds)
- **UI Components:** Shadcn/ui (accessible, customizable)
- **Styling:** Tailwind CSS + CSS Modules
- **Charts:** Recharts (React-native) or React-Chartjs-2
- **State Management:** Zustand (lightweight) or Context API
- **Desktop:** Enhanced Electron with native integrations

---

## 📊 Architecture Overview

```
FGD-Desktop/
├── electron/                      # Electron main process
│   ├── main.js                   # Window management, IPC
│   ├── preload.js                # Bridge to renderer
│   └── menu.js                   # Native menus
│
├── src/                          # React application
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root component
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # Shadcn/ui primitives
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── slider.tsx
│   │   │   └── ...
│   │   │
│   │   ├── dashboard/            # Dashboard-specific
│   │   │   ├── ClusterGrid.tsx
│   │   │   ├── MetricsCharts.tsx
│   │   │   ├── PolicyPanel.tsx
│   │   │   └── FusionSidebar.tsx
│   │   │
│   │   ├── admin/                # Admin panel
│   │   │   ├── BotList.tsx
│   │   │   ├── BotCreator.tsx
│   │   │   ├── DeadLetterQueue.tsx
│   │   │   ├── ConsoleLog.tsx
│   │   │   └── InventoryViewer.tsx
│   │   │
│   │   ├── fusion/               # Fusion memory
│   │   │   └── FusionDetails.tsx
│   │   │
│   │   └── layout/               # Layout components
│   │       ├── Header.tsx
│   │       ├── Navigation.tsx
│   │       ├── StatusBar.tsx
│   │       └── ThemeToggle.tsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useWebSocket.ts       # WebSocket connection
│   │   ├── useApiCall.ts         # API requests
│   │   ├── useRealtimeData.ts    # Real-time data sync
│   │   ├── useTheme.ts           # Theme management
│   │   └── useKeyboard.ts        # Keyboard shortcuts
│   │
│   ├── lib/                      # Utilities
│   │   ├── api.ts                # API client
│   │   ├── websocket.ts          # WebSocket client
│   │   ├── utils.ts              # Helper functions
│   │   └── constants.ts          # App constants
│   │
│   ├── stores/                   # State management
│   │   ├── authStore.ts          # Authentication
│   │   ├── botStore.ts           # Bot data
│   │   └── uiStore.ts            # UI state
│   │
│   ├── types/                    # TypeScript types
│   │   ├── bot.ts
│   │   ├── metrics.ts
│   │   └── api.ts
│   │
│   └── styles/                   # Global styles
│       ├── globals.css           # Tailwind + custom
│       └── themes.css            # Theme variables
│
├── backend/                      # Keep existing Express server
│   └── (current structure - no changes)
│
├── public/                       # Static assets
│   └── icons/
│
└── config files
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── components.json           # Shadcn/ui config
    └── electron-builder.json     # Build configuration

```

---

## 🚀 Migration Phases

### **Phase 1: Project Setup (Day 1-2)**

#### 1.1 Initialize Vite + React + TypeScript
```bash
# Create new Vite project structure
npm create vite@latest fgd-desktop-app -- --template react-ts

# Move into directory
cd fgd-desktop-app

# Install dependencies
npm install
```

#### 1.2 Install Core Dependencies
```bash
# React ecosystem
npm install react@^18.2.0 react-dom@^18.2.0
npm install react-router-dom@^6.20.0

# State management
npm install zustand@^4.4.7

# UI & Styling
npm install tailwindcss@^3.3.6 postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react@^0.292.0  # Icons

# Charts
npm install recharts@^2.10.3
# OR
npm install react-chartjs-2 chart.js

# Real-time
npm install socket.io-client@^4.6.0

# Forms & Validation
npm install react-hook-form@^7.48.2
npm install zod@^3.22.4
npm install @hookform/resolvers

# Electron
npm install -D electron@^28.0.0
npm install -D electron-builder@^24.9.1
npm install -D concurrently@^8.2.2
npm install -D wait-on@^7.2.0
```

#### 1.3 Setup Tailwind CSS
```bash
npx tailwindcss init -p
```

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

#### 1.4 Initialize Shadcn/ui
```bash
npx shadcn-ui@latest init
```

Select:
- TypeScript: Yes
- Style: Default
- Base color: Slate
- CSS variables: Yes

#### 1.5 Install Initial Shadcn Components
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add scroll-area
```

---

### **Phase 2: Core Infrastructure (Day 2-3)**

#### 2.1 Setup API Client (`src/lib/api.ts`)
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('apiKey');
  if (token) {
    config.headers['X-API-Key'] = token;
  }
  return config;
});

// API methods
export const api = {
  // Bots
  getBots: () => apiClient.get('/api/bots'),
  createBot: (data: any) => apiClient.post('/api/bots', data),
  deleteBot: (id: string) => apiClient.delete(`/api/bots/${id}`),
  spawnBot: (id: string) => apiClient.post(`/api/bots/${id}/spawn`),
  despawnBot: (id: string) => apiClient.post(`/api/bots/${id}/despawn`),
  
  // System
  getHealth: () => apiClient.get('/api/health'),
  getSystemStats: () => apiClient.get('/api/system/stats'),
  
  // Cluster
  getClusterStatus: () => apiClient.get('/data/cluster_status.json'),
  getMetrics: () => apiClient.get('/data/metrics.json'),
  
  // Fusion
  getFusionData: () => apiClient.get('/data/fused_knowledge.json'),
  
  // Dead letter
  getDeadLetters: () => apiClient.get('/api/bots/dead-letter'),
  retryDeadLetters: () => apiClient.post('/api/bots/dead-letter/retry'),
};
```

#### 2.2 Setup WebSocket Hook (`src/hooks/useWebSocket.ts`)
```typescript
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const apiKey = localStorage.getItem('apiKey');
    
    socketRef.current = io(WS_URL, {
      auth: { apiKey },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const on = (event: string, callback: (...args: any[]) => void) => {
    socketRef.current?.on(event, callback);
  };

  const off = (event: string) => {
    socketRef.current?.off(event);
  };

  const emit = (event: string, data: any) => {
    socketRef.current?.emit(event, data);
  };

  return { socket: socketRef.current, isConnected, on, off, emit };
}
```

#### 2.3 Setup State Store (`src/stores/authStore.ts`)
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  apiKey: string | null;
  isAuthenticated: boolean;
  login: (key: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      apiKey: null,
      isAuthenticated: false,
      login: (key: string) => {
        localStorage.setItem('apiKey', key);
        set({ apiKey: key, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('apiKey');
        set({ apiKey: null, isAuthenticated: false });
      },
    }),
    {
      name: 'fgd-auth-storage',
    }
  )
);
```

#### 2.4 Theme System (`src/hooks/useTheme.ts`)
```typescript
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, setTheme, toggleTheme };
}
```

---

### **Phase 3: Component Migration (Day 3-6)**

#### 3.1 Convert Dashboard Components

**ClusterGrid.tsx** - Replace cluster grid rendering
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface Node {
  name: string;
  status: string;
  cpu: number;
  memory: number;
  tasks: number;
}

export function ClusterGrid({ nodes }: { nodes: Node[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {nodes.map((node) => (
        <Card key={node.name} className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {node.name}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={node.status === 'healthy' ? 'default' : 'destructive'}>
              {node.status.toUpperCase()}
            </Badge>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU:</span>
                <span>{node.cpu}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memory:</span>
                <span>{node.memory}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tasks:</span>
                <span>{node.tasks}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**MetricsCharts.tsx** - Replace Chart.js charts with Recharts
```typescript
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MetricsChartsProps {
  cpuData: { time: string; value: number }[];
  memoryData: { time: string; value: number }[];
}

export function MetricsCharts({ cpuData, memoryData }: MetricsChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* CPU Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">CPU Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Memory Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Memory Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={memoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="value" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

**PolicyPanel.tsx** - Replace policy controls
```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export function PolicyPanel() {
  const [learningRate, setLearningRate] = useState([1.0]);
  const [delegationBias, setDelegationBias] = useState([0.4]);
  const [cooldown, setCooldown] = useState([10000]);

  const handleApply = async () => {
    // API call to apply policy
    console.log({ learningRate: learningRate[0], delegationBias: delegationBias[0], cooldown: cooldown[0] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Policy Control Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="flex justify-between">
            <span>Learning Rate</span>
            <span className="text-sm text-muted-foreground">{learningRate[0].toFixed(1)}</span>
          </Label>
          <Slider
            value={learningRate}
            onValueChange={setLearningRate}
            min={0.1}
            max={2}
            step={0.1}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex justify-between">
            <span>Delegation Bias</span>
            <span className="text-sm text-muted-foreground">{delegationBias[0].toFixed(2)}</span>
          </Label>
          <Slider
            value={delegationBias}
            onValueChange={setDelegationBias}
            min={0}
            max={1}
            step={0.05}
          />
        </div>

        <div className="space-y-2">
          <Label className="flex justify-between">
            <span>Cooldown (ms)</span>
            <span className="text-sm text-muted-foreground">{cooldown[0]}</span>
          </Label>
          <Slider
            value={cooldown}
            onValueChange={setCooldown}
            min={1000}
            max={30000}
            step={1000}
          />
        </div>

        <Button onClick={handleApply} className="w-full">
          Apply Policy
        </Button>
      </CardContent>
    </Card>
  );
}
```

#### 3.2 Convert Admin Panel Components

**BotList.tsx**, **BotCreator.tsx**, **ConsoleLog.tsx** - Similar component pattern

---

### **Phase 4: Electron Integration (Day 6-7)**

#### 4.1 Enhanced Electron Main Process
```javascript
// electron/main.js
const { app, BrowserWindow, ipcMain, nativeTheme, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let tray;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  createTray();
  setupIPC();
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../public/icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { label: 'Hide', click: () => mainWindow.hide() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow.show());
}

function setupIPC() {
  ipcMain.handle('get-config', () => ({
    apiBase: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000',
  }));
}

app.whenReady().then(createWindow);
```

#### 4.2 System Tray + Notifications
- Show bot spawn notifications
- System tray quick actions
- Auto-update support

---

### **Phase 5: Polish & Features (Day 7-8)**

#### 5.1 Keyboard Shortcuts
```typescript
// src/hooks/useKeyboard.ts
export function useKeyboard() {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+K: Command palette
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        // Open command palette
      }
      
      // Ctrl+B: Toggle sidebar
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        // Toggle sidebar
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
}
```

#### 5.2 Animations with Framer Motion
```bash
npm install framer-motion
```

```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  {content}
</motion.div>
```

---

### **Phase 6: Build & Package (Day 8)**

#### 6.1 Configure electron-builder
```json
// electron-builder.json
{
  "appId": "com.fgd.desktop",
  "productName": "FGD Desktop",
  "directories": {
    "output": "release"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "backend/**/*"
  ],
  "win": {
    "target": ["nsis", "portable"],
    "icon": "public/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  }
}
```

#### 6.2 Build Scripts
```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "electron:dev": "concurrently \"npm run dev\" \"wait-on http://localhost:5173 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win"
  }
}
```

---

## 📈 Migration Benefits

### Performance
- ⚡ **Faster Development:** Vite HMR vs page reloads
- 🚀 **Better UX:** React virtual DOM vs manual DOM manipulation
- 📦 **Smaller Bundle:** Tree-shaking eliminates unused code
- 🔄 **Optimized Updates:** React reconciliation vs full re-renders

### Developer Experience
- 🎯 **Type Safety:** TypeScript catches errors before runtime
- 🧩 **Component Reusability:** Share components across views
- 🎨 **Better Styling:** Tailwind + Shadcn = consistent, beautiful UI
- 🔧 **Modern Tooling:** ESLint, Prettier, VS Code integration

### User Experience
- 🎭 **Smooth Animations:** Framer Motion + CSS transitions
- ⌨️ **Keyboard Shortcuts:** Power user features
- 🌓 **Better Theming:** Seamless light/dark mode
- 📱 **Responsive:** Works on all screen sizes
- 🔔 **Native Notifications:** OS-level integration

---

## 🎨 UI Comparison

### Before (Current)
```html
<div class="node-card">
  <span class="status-badge ok">HEALTHY</span>
  <strong>node-1</strong>
  <small>CPU: 45%</small>
  <small>Memory: 62%</small>
</div>
```

### After (React + Shadcn)
```tsx
<Card className="hover:shadow-lg transition-all">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>node-1</CardTitle>
      <Badge variant="success">HEALTHY</Badge>
    </div>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <MetricRow label="CPU" value="45%" progress={45} />
      <MetricRow label="Memory" value="62%" progress={62} />
    </div>
  </CardContent>
</Card>
```

---

## 🔧 Development Workflow

### Running in Development
```bash
# Terminal 1: Start backend (existing Express server)
npm run start

# Terminal 2: Start React dev server + Electron
npm run electron:dev
```

### Building for Production
```bash
# Build and package Windows app
npm run electron:build:win

# Output: release/FGD-Desktop-Setup-1.0.0.exe
```

---

## 📚 Learning Resources

- **Shadcn/ui:** https://ui.shadcn.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Recharts:** https://recharts.org/en-US/
- **Zustand:** https://github.com/pmndrs/zustand
- **Electron:** https://www.electronjs.org/docs/latest
- **Vite:** https://vitejs.dev/guide/

---

## ✅ Success Criteria

- [ ] All current features working in React
- [ ] Beautiful, accessible UI with Shadcn components
- [ ] Real-time updates via WebSocket
- [ ] Keyboard shortcuts implemented
- [ ] Light/dark theme toggle
- [ ] Windows installer builds successfully
- [ ] Native notifications working
- [ ] System tray integration
- [ ] Performance better than current version

---

## 🎯 Next Steps

1. **Review this plan** - Any changes or additions?
2. **Create project structure** - Set up Vite + React
3. **Install dependencies** - All packages listed above
4. **Start migration** - Begin with Phase 1
5. **Iterate** - Build, test, refine

Ready to begin? Let's start with Phase 1!
