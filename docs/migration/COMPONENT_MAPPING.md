# Component Migration Mapping
## HTML → React Component Conversion

This document maps each current HTML file/section to its React component equivalent.

---

## Dashboard (dashboard.html → Dashboard View)

### Current Structure
```
dashboard.html
├── Header with navigation
├── Cluster Grid (#cluster-grid)
├── Charts Section (#charts)
│   ├── CPU Chart
│   ├── Memory Chart
│   ├── Queue Chart
│   └── Latency Chart
├── Policy Panel (#policy-panel)
└── Fusion Sidebar (#fusion-sidebar)
```

### React Component Tree
```
<DashboardPage>
  ├── <Header />
  │   ├── <Navigation />
  │   └── <ThemeToggle />
  ├── <DashboardLayout>
  │   ├── <MainContent>
  │   │   ├── <ClusterGrid nodes={nodes} />
  │   │   ├── <MetricsCharts 
  │   │   │     cpuData={cpuData}
  │   │   │     memoryData={memoryData}
  │   │   │     queueData={queueData}
  │   │   │     latencyData={latencyData}
  │   │   │   />
  │   │   └── <PolicyPanel />
  │   └── <Sidebar>
  │       └── <FusionSummary />
  └── <Footer />
```

### Component Files to Create
- `src/pages/Dashboard.tsx` - Main dashboard page
- `src/components/dashboard/ClusterGrid.tsx`
- `src/components/dashboard/MetricsCharts.tsx`
- `src/components/dashboard/PolicyPanel.tsx`
- `src/components/dashboard/FusionSummary.tsx`

---

## Admin Panel (admin.html → Admin View)

### Current Structure
```
admin.html
├── Login Screen (#loginScreen)
├── Admin Panel (#adminPanel)
│   ├── Status Bar
│   ├── Disconnect Banner
│   ├── Create Bot Form
│   ├── Bot List
│   ├── Console Log
│   ├── Dead Letter Queue
│   ├── Action Dead Letters
│   ├── Action Log
│   ├── Inventory Viewer
│   └── Chest Management
```

### React Component Tree
```
<AdminPage>
  ├── <LoginDialog open={!authenticated} />
  └── <AdminLayout>
      ├── <StatusBar connectivity={connectivity} />
      ├── <DisconnectBanner show={!connected} />
      ├── <TwoColumnLayout>
      │   ├── <LeftColumn>
      │   │   ├── <BotCreator onSubmit={handleCreate} />
      │   │   ├── <BotList 
      │   │   │     bots={bots}
      │   │   │     onSpawn={handleSpawn}
      │   │   │     onDespawn={handleDespawn}
      │   │   │     onDelete={handleDelete}
      │   │   │   />
      │   │   ├── <DeadLetterQueue 
      │   │   │     queue={deadLetters}
      │   │   │     onRetry={handleRetry}
      │   │   │   />
      │   │   └── <ActionDeadLetters
      │   │       queue={actionDeadLetters}
      │   │       onRetry={handleActionRetry}
      │   │     />
      │   └── <RightColumn>
      │       ├── <Tabs>
      │       │   ├── <ConsoleLog messages={logs} />
      │       │   ├── <ActionLog alerts={actionAlerts} />
      │       │   ├── <InventoryViewer 
      │       │   │     botId={invBotId}
      │       │   │     items={inventory}
      │       │   │   />
      │       │   └── <ChestManager 
      │       │         botId={chestBotId}
      │       │         items={chestItems}
      │       │       />
      │       └── <CommandInput onExecute={handleCommand} />
      └── <Footer />
```

### Component Files to Create
- `src/pages/Admin.tsx` - Main admin page
- `src/components/admin/LoginDialog.tsx`
- `src/components/admin/StatusBar.tsx`
- `src/components/admin/BotCreator.tsx`
- `src/components/admin/BotList.tsx`
- `src/components/admin/BotCard.tsx`
- `src/components/admin/DeadLetterQueue.tsx`
- `src/components/admin/ConsoleLog.tsx`
- `src/components/admin/ActionLog.tsx`
- `src/components/admin/InventoryViewer.tsx`
- `src/components/admin/ChestManager.tsx`
- `src/components/admin/CommandInput.tsx`

---

## Fusion Memory (fusion.html → Fusion View)

### Current Structure
```
fusion.html
├── Header with navigation
├── Breadcrumb
├── Fusion Details Section
│   ├── Skills Stats
│   ├── Dialogues Stats
│   └── Outcomes Stats
└── Fusion Data Display (pre tags)
```

### React Component Tree
```
<FusionPage>
  ├── <Header />
  ├── <Breadcrumb path={['Dashboard', 'Fusion Memory']} />
  ├── <FusionStats
  │     skills={skillsCount}
  │     dialogues={dialoguesCount}
  │     outcomes={outcomesCount}
  │   />
  └── <FusionDataViewer
        skills={skillsData}
        dialogues={dialoguesData}
        outcomes={outcomesData}
      />
```

### Component Files to Create
- `src/pages/Fusion.tsx`
- `src/components/fusion/FusionStats.tsx`
- `src/components/fusion/FusionDataViewer.tsx`
- `src/components/fusion/SkillsTable.tsx`
- `src/components/fusion/DialoguesTable.tsx`
- `src/components/fusion/OutcomesTable.tsx`

---

## Shared/Layout Components

### Create These Reusable Components

#### Navigation
```tsx
// src/components/layout/Header.tsx
- Logo/Title
- Navigation links (Dashboard, Admin, Fusion)
- Theme toggle
- User menu (logout)

// src/components/layout/Navigation.tsx
- Active route highlighting
- Icons (lucide-react)
- Responsive mobile menu

// src/components/layout/ThemeToggle.tsx
- Sun/Moon icon
- Toggle between light/dark
```

#### Status & Feedback
```tsx
// src/components/layout/StatusBar.tsx
- Connection status dot
- API/WebSocket/Bridge status
- Last heartbeat time

// src/components/ui/Notification.tsx (Toast)
- Success/Error/Info/Warning variants
- Auto-dismiss
- Queue management

// src/components/layout/Footer.tsx
- Copyright
- Version info
```

---

## Hooks to Create

### Data Fetching
```typescript
// src/hooks/useBots.ts
export function useBots() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadBots();
  }, []);
  
  const loadBots = async () => { ... };
  const createBot = async (data) => { ... };
  const deleteBot = async (id) => { ... };
  
  return { bots, loading, createBot, deleteBot, refresh: loadBots };
}

// src/hooks/useCluster.ts
export function useCluster() { ... }

// src/hooks/useFusion.ts
export function useFusion() { ... }

// src/hooks/useMetrics.ts
export function useMetrics() { ... }
```

### Real-time Updates
```typescript
// src/hooks/useWebSocket.ts
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  
  // Setup socket connection
  // Return event listeners
  
  return { isConnected, on, off, emit };
}

// src/hooks/useRealtimeData.ts
export function useRealtimeData<T>(
  initialFetch: () => Promise<T>,
  socketEvent: string
) {
  const [data, setData] = useState<T | null>(null);
  const { on, off } = useWebSocket();
  
  useEffect(() => {
    initialFetch().then(setData);
    
    on(socketEvent, (newData) => {
      setData(newData);
    });
    
    return () => off(socketEvent);
  }, []);
  
  return data;
}
```

### UI State
```typescript
// src/hooks/useTheme.ts
export function useTheme() { ... }

// src/hooks/useKeyboard.ts
export function useKeyboard(shortcuts: Shortcut[]) { ... }

// src/hooks/useNotification.ts
export function useNotification() {
  const { toast } = useToast();
  
  return {
    success: (msg) => toast({ title: msg, variant: 'success' }),
    error: (msg) => toast({ title: msg, variant: 'destructive' }),
    info: (msg) => toast({ title: msg }),
  };
}
```

---

## State Management Structure

### Zustand Stores

```typescript
// src/stores/authStore.ts
interface AuthState {
  apiKey: string | null;
  isAuthenticated: boolean;
  login: (key: string) => Promise<void>;
  logout: () => void;
}

// src/stores/botStore.ts
interface BotState {
  bots: Bot[];
  loading: boolean;
  error: string | null;
  fetchBots: () => Promise<void>;
  createBot: (data: CreateBotData) => Promise<void>;
  updateBot: (id: string, data: Partial<Bot>) => Promise<void>;
  deleteBot: (id: string) => Promise<void>;
}

// src/stores/uiStore.ts
interface UIState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
}

// src/stores/connectivityStore.ts
interface ConnectivityState {
  api: boolean;
  ws: boolean;
  bridge: 'ok' | 'degraded' | 'error' | 'unknown';
  pluginAge: number | null;
  updateStatus: (status: Partial<ConnectivityState>) => void;
}
```

---

## Styling Migration

### CSS Variables → Tailwind Theme

**Current (style.css):**
```css
:root {
  --bg-gradient: radial-gradient(...);
  --card-bg: rgba(17, 24, 39, 0.92);
  --accent: #60a5fa;
  --text-primary: #e2e8f0;
}
```

**New (tailwind.config.js):**
```javascript
theme: {
  extend: {
    colors: {
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      accent: {
        DEFAULT: '#60a5fa',
        foreground: '#ffffff',
      },
    },
  },
}
```

**Usage:**
```tsx
// Before: <div class="card">
// After:  <Card>

// Before: <span class="status-badge ok">
// After:  <Badge variant="success">
```

---

## Animation Migration

### CSS Animations → Framer Motion

**Before (CSS):**
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.card {
  animation: fadeIn 0.5s ease-out;
}
```

**After (Framer Motion):**
```tsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  <Card>...</Card>
</motion.div>
```

---

## Chart Migration

### Chart.js → Recharts

**Before (dashboard.js):**
```javascript
new Chart(ctx, {
  type: 'line',
  data: {
    labels: timestamps,
    datasets: [{
      label: 'CPU %',
      data: cpuData,
      borderColor: '#60a5fa',
    }]
  }
});
```

**After (React):**
```tsx
<ResponsiveContainer width="100%" height={200}>
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="time" />
    <YAxis domain={[0, 100]} />
    <Tooltip />
    <Line
      type="monotone"
      dataKey="cpu"
      stroke="#60a5fa"
      strokeWidth={2}
    />
  </LineChart>
</ResponsiveContainer>
```

---

## Routing Structure

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="admin" element={<Admin />} />
          <Route path="fusion" element={<Fusion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Priority Order for Migration

### Week 1: Core Infrastructure
1. ✅ Project setup (Vite + React + TypeScript)
2. ✅ Install dependencies
3. ✅ Setup Tailwind + Shadcn/ui
4. ✅ Create API client & WebSocket hook
5. ✅ Create auth store
6. ✅ Create basic layout components

### Week 2: Dashboard View
7. ✅ Migrate Dashboard page
8. ✅ Create ClusterGrid component
9. ✅ Create MetricsCharts component
10. ✅ Create PolicyPanel component
11. ✅ Create FusionSummary component
12. ✅ Wire up WebSocket real-time updates

### Week 3: Admin View
13. ✅ Migrate Admin page
14. ✅ Create BotList component
15. ✅ Create BotCreator component
16. ✅ Create ConsoleLog component
17. ✅ Create DeadLetterQueue component
18. ✅ Create InventoryViewer component
19. ✅ Create ChestManager component

### Week 4: Polish & Package
20. ✅ Migrate Fusion page
21. ✅ Add animations (Framer Motion)
22. ✅ Add keyboard shortcuts
23. ✅ Enhance Electron integration
24. ✅ System tray & notifications
25. ✅ Build & test installer

---

## Testing Migration

### Test Each Component As You Build

```bash
# Run dev mode
npm run dev

# Test in Electron
npm run electron:dev

# Build for production
npm run electron:build:win
```

### Checklist Per Component
- [ ] Renders correctly with mock data
- [ ] API integration works
- [ ] WebSocket updates work
- [ ] Responsive on different screen sizes
- [ ] Dark/light theme both work
- [ ] Keyboard shortcuts work
- [ ] Error states handled
- [ ] Loading states shown

---

Ready to start building? This mapping should give you a clear path forward!
