# FGD Desktop - Quick Start Guide
## Get Your React + Electron App Running in 30 Minutes

---

## ⚡ Prerequisites

- **Node.js** 18+ installed
- **npm** or **yarn** package manager
- Your existing FGD backend server ready to run

---

## 🚀 Step-by-Step Setup

### Step 1: Create New Vite Project (5 minutes)

```bash
# Navigate to your FGD directory
cd C:\Users\Admin\Desktop\FGD-main

# Create new frontend directory
npm create vite@latest desktop-app -- --template react-ts

# Move into it
cd desktop-app

# Install base dependencies
npm install
```

### Step 2: Install All Dependencies (5 minutes)

```bash
# UI & Styling
npm install tailwindcss postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react

# Charts
npm install recharts

# State & Data
npm install zustand
npm install axios
npm install socket.io-client

# Forms
npm install react-hook-form @hookform/resolvers zod

# Routing
npm install react-router-dom

# Animations
npm install framer-motion

# Electron
npm install -D electron electron-builder
npm install -D concurrently wait-on
npm install -D cross-env
```

### Step 3: Initialize Tailwind (2 minutes)

```bash
npx tailwindcss init -p
```

Replace `tailwind.config.js`:
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
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### Step 4: Initialize Shadcn/ui (3 minutes)

```bash
npx shadcn-ui@latest init
```

**Select these options:**
- TypeScript: Yes
- Style: Default
- Base color: Slate  
- CSS variables: Yes
- React Server Components: No
- Write to src/components/ui: Yes
- Configure import alias: @/components (default)

### Step 5: Add Shadcn Components (5 minutes)

```bash
# Core UI components
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
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add select
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add progress
```

### Step 6: Setup Project Structure (5 minutes)

```bash
# Create directory structure
mkdir src/components/dashboard
mkdir src/components/admin
mkdir src/components/fusion
mkdir src/components/layout
mkdir src/hooks
mkdir src/lib
mkdir src/stores
mkdir src/types
mkdir src/pages
```

### Step 7: Create Core Files

#### `src/lib/api.ts`
```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('apiKey');
  if (token) {
    config.headers['X-API-Key'] = token;
  }
  return config;
});

export const api = {
  getBots: () => apiClient.get('/api/bots'),
  createBot: (data: any) => apiClient.post('/api/bots', data),
  deleteBot: (id: string) => apiClient.delete(`/api/bots/${id}`),
  spawnBot: (id: string) => apiClient.post(`/api/bots/${id}/spawn`),
};
```

#### `src/stores/authStore.ts`
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

#### `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Fusion from './pages/Fusion';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/fusion" element={<Fusion />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

#### `src/pages/Dashboard.tsx`
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background p-8">
      <Card>
        <CardHeader>
          <CardTitle>FGD Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Dashboard coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

### Step 8: Setup Electron (5 minutes)

Create `electron/main.cjs`:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

### Step 9: Update package.json Scripts

Add to your `package.json`:
```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "electron:dev": "concurrently \"npm run dev\" \"cross-env NODE_ENV=development wait-on http://localhost:5173 && electron .\"",
    "electron:build": "npm run build && electron-builder"
  }
}
```

### Step 10: Create .env File

Create `.env` in desktop-app directory:
```env
VITE_API_BASE=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## 🎮 Running Your App

### Development Mode

**Terminal 1:** Start your existing FGD backend
```bash
cd C:\Users\Admin\Desktop\FGD-main
npm start
```

**Terminal 2:** Start React + Electron
```bash
cd C:\Users\Admin\Desktop\FGD-main\desktop-app
npm run electron:dev
```

### Web-Only Development (Faster)
```bash
npm run dev
# Then open http://localhost:5173 in browser
```

---

## ✅ Verify Everything Works

You should see:
1. Electron window opens
2. Dark theme applied
3. "FGD Dashboard" card visible
4. No console errors
5. DevTools open (in dev mode)

---

## 🎯 Next Steps

### Phase 1: Build Your First Component (30 min)
1. Create a simple bot list component
2. Fetch data from your API
3. Display in a card

**Example:**
```tsx
// src/components/admin/BotList.tsx
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

export function BotList() {
  const [bots, setBots] = useState([]);

  useEffect(() => {
    api.getBots().then(res => setBots(res.data.bots));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bots</CardTitle>
      </CardHeader>
      <CardContent>
        {bots.length === 0 ? (
          <p>No bots found</p>
        ) : (
          <ul>
            {bots.map(bot => (
              <li key={bot.id}>{bot.id}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

### Phase 2: Add This to Admin Page
```tsx
// src/pages/Admin.tsx
import { BotList } from '@/components/admin/BotList';

export default function Admin() {
  return (
    <div className="p-8">
      <BotList />
    </div>
  );
}
```

### Phase 3: Test It!
```bash
npm run electron:dev
```

Navigate to `/admin` and you should see your bots!

---

## 🐛 Common Issues

### Port 5173 already in use
```bash
# Kill the process
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Module not found errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Electron won't start
```bash
# Make sure wait-on is working
npx wait-on http://localhost:5173
```

### Tailwind styles not applying
1. Check `tailwind.config.js` content paths
2. Verify `@tailwind` directives in `index.css`
3. Restart dev server

---

## 📚 Learning Resources

- **Your migration docs:** `/docs/migration/`
- **Shadcn/ui docs:** https://ui.shadcn.com
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Recharts:** https://recharts.org
- **Electron:** https://electronjs.org/docs

---

## 🎉 Success!

You now have:
- ✅ React + TypeScript + Vite
- ✅ Tailwind CSS + Shadcn/ui
- ✅ Electron desktop wrapper
- ✅ API client setup
- ✅ Basic routing
- ✅ Dark theme
- ✅ Development workflow

**Time to start building your beautiful desktop app! 🚀**
