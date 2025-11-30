# 🎨 FGD Desktop App - Visual Feature Guide

## What You Can Do Now

---

## 🏠 Dashboard Page (/)

### Features
```
┌─────────────────────────────────────────────┐
│  Cluster Health    Active Bots    Metrics   │
│  [Healthy]         [12 bots]      [CPU 62%] │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           CLUSTER NODE GRID                 │
│  [node-1]  [node-2]  [node-3]  [node-4]    │
│  42% CPU   33% CPU   71% CPU   OFFLINE     │
│  Healthy   Healthy   Warning    Offline     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│          METRICS CHARTS                     │
│  [CPU] [Memory] [Queue] [Latency]          │
│  📊 Real-time line/area charts             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  POLICY PANEL          │  FUSION SUMMARY   │
│  Learning Rate: 0.5    │  Skills: 128      │
│  Delegation: 0.7       │  Dialogues: 412   │
│  Cooldown: 5s          │  Outcomes: 76     │
└─────────────────────────────────────────────┘
```

### Interactions
- ⚡ Real-time updates via WebSocket
- 🎨 Animated card entrances
- 🖱️ Hover effects on cards
- 📊 Interactive charts with tooltips

---

## 🤖 Admin Page (/admin)

### Features
```
┌─────────────────────────────────────────────┐
│  STATUS: API ✅ WS ✅ Bridge ⚠️            │
└─────────────────────────────────────────────┘

┌──────────────────┬──────────────────────────┐
│  BOT CREATOR     │  CONSOLE LOG             │
│  Name: [____]    │  > Bot miner_01 spawned  │
│  Role: [Miner▼]  │  > Task mining started   │
│  Personality:    │  > Found diamonds!       │
│  Curiosity  ●──  │  > Returning to base     │
│  Patience   ──●  │  [Auto-scroll enabled]   │
│  [Create Bot]    │                          │
├──────────────────┤                          │
│  BOT LIST        │  ACTION LOG              │
│  ┌────────────┐  │  ✅ mine stone           │
│  │ miner_01   │  │  ❌ build bridge         │
│  │ Miner      │  │  ✅ gather wood          │
│  │ ⚡ Active  │  │                          │
│  │ CPU: 44%   │  │  INVENTORY               │
│  │ [Actions▼] │  │  1. Iron Ore x24        │
│  └────────────┘  │  2. Torch x16           │
│  [+] Add Bot     │  3. Pickaxe x1          │
│                  │                          │
│  DEAD LETTER Q   │  CHEST MANAGER          │
│  ⚠️ Bridge TO    │  📦 Cobblestone x64     │
│  [Retry All]     │  📦 Oak Logs x32        │
│                  │  [Deposit] [Withdraw]    │
│                  │                          │
│                  │  COMMAND INPUT          │
│                  │  > mine until full      │
│                  │  [Execute]              │
└──────────────────┴──────────────────────────┘
```

### Interactions
- 🔐 Login with API key
- ➕ Create bots with personality sliders
- ▶️ Spawn/despawn bots
- 🗑️ Delete bots
- 📋 Real-time console log
- ♻️ Retry failed spawns
- 🎒 View bot inventory
- 📦 Manage chests
- 💬 Execute commands

---

## 🧠 Fusion Page (/fusion)

### Features
```
┌──────────────────┬──────────────────────────┐
│  FUSION STATS    │  KNOWLEDGE DISTRIBUTION │
│  Skills          │  [●●●●●●●○○○] 128       │
│  128 (21%)       │  [●●●●●●●●●●] 412       │
│  ──────────●──   │  [●●●○○○○○○○] 76        │
│                  │                          │
│  Dialogues       │  Total: 616 entries      │
│  412 (67%)       │  Interactions: 1,547     │
│  ──────────────● │  Learning Rate: 87%      │
│                  │                          │
│  Outcomes        │                          │
│  76 (12%)        │                          │
│  ────●───────    │                          │
└──────────────────┴──────────────────────────┘

┌─────────────────────────────────────────────┐
│  🔍 [Search fusion data...]                │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [All 616] [📚 Skills 128] [💬 Dialogues │
│            412] [✨ Outcomes 76]           │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [skill] Mining efficiency optimization     │
│  📊 85% confidence                          │
│  Pattern learned from 45 operations         │
│  🕐 2 hours ago                            │
├─────────────────────────────────────────────┤
│  [dialogue] Greeting response pattern       │
│  📊 92% confidence                          │
│  For new players entering area              │
│  🕐 5 hours ago                            │
├─────────────────────────────────────────────┤
│  [outcome] Settlement defense success       │
│  📊 95% confidence                          │
│  Defended from hostile mobs                 │
│  🕐 1 day ago                              │
└─────────────────────────────────────────────┘
```

### Interactions
- 🔍 Search across all fusion data
- 🏷️ Filter by category (Skills/Dialogues/Outcomes)
- 📊 View confidence scores
- ⏰ See timestamps
- 🎨 Smooth animations
- ⚡ Real-time updates

---

## 🎯 UI Components Available

### Buttons
```
[Primary]  [Secondary]  [Outline]  [Ghost]  [Destructive]
```

### Badges
```
[Default]  [Success]  [Warning]  [Destructive]  [Outline]
```

### Cards
```
┌──────────────┐
│  Card Title  │
├──────────────┤
│  Content     │
│  goes here   │
└──────────────┘
```

### Forms
```
Label: [Input field__________]
       [Textarea____________]
       [Select dropdown ▼  ]
       [●──────○] Slider
```

### Toasts
```
┌─────────────────────────┐
│  ✓ Bot spawned!    [×] │
│  miner_01 is now active │
└─────────────────────────┘

┌─────────────────────────┐
│  ⚠️ Connection lost [×] │
│  Reconnecting...        │
└─────────────────────────┘
```

### Progress Bars
```
CPU:    [████████────────]  62%
Memory: [██████──────────]  45%
```

### Tabs
```
[Active] [Inactive] [Inactive]
─────────
Content shown here
```

### Dialogs
```
┌─────────────────────────┐
│  Confirm Action    [×] │
├─────────────────────────┤
│  Are you sure you want │
│  to delete this bot?   │
│                         │
│  [Cancel]  [Confirm]   │
└─────────────────────────┘
```

---

## 🎨 Theme System

### Dark Mode (Default)
- Background: Deep blue-black (#0b0f1a)
- Cards: Dark with subtle border
- Text: Light gray on dark
- Primary: Bright blue (#60a5fa)
- Accent: Purple highlights

### Light Mode
- Background: White
- Cards: White with shadow
- Text: Dark on light
- Primary: Blue
- Accent: Purple

### Toggle
Located in header - switches instantly, persists to localStorage

---

## ⌨️ Keyboard Shortcuts (Coming Soon)

### Navigation
- `Ctrl + 1` - Dashboard
- `Ctrl + 2` - Admin
- `Ctrl + 3` - Fusion

### Actions
- `Ctrl + K` - Command palette
- `Ctrl + B` - Toggle sidebar
- `Ctrl + ,` - Settings
- `Escape` - Close dialogs

### Search
- `Ctrl + F` - Focus search
- `Ctrl + /` - Toggle search bar

---

## 🔔 Notifications

### Toast Notifications (Now Available!)
```javascript
// Success
toast({
  title: "Bot spawned!",
  description: "miner_01 is now active",
  variant: "success"
});

// Error
toast({
  title: "Connection failed",
  description: "Could not reach backend",
  variant: "destructive"
});

// Info
toast({
  title: "Update available",
  description: "Click to download v2.0"
});
```

### Native Notifications (Coming Soon)
Desktop notifications when:
- Bot spawns successfully
- Bot encounters error
- WebSocket disconnects
- New fusion data learned

---

## 📱 Responsive Design

### Desktop (>1200px)
- Full sidebar navigation
- Multi-column layouts
- All features visible
- Large charts

### Tablet (768px - 1200px)
- Collapsible sidebar
- Two-column layouts
- Compact cards
- Medium charts

### Mobile (<768px)
- Hidden sidebar (menu icon)
- Single column
- Stacked cards
- Small charts

---

## 🎬 Animations

### Page Transitions
- Fade in on route change
- Smooth slide animations
- Staggered card entrances

### Component Animations
- Hover effects on cards
- Button press feedback
- Toast slide in/out
- Progress bar fills
- Chart data updates

### Loading States
- Skeleton screens
- Fade in when loaded
- Smooth state transitions

---

## 🚀 Performance

### Fast Load Times
- Initial load: <2s
- Page transitions: <0.5s
- Chart updates: <0.1s
- Toast appearance: instant

### Optimizations
- Code splitting by route
- Lazy loaded components
- Memoized expensive calculations
- Virtual scrolling for large lists

---

## 🎯 Next Features

### Coming Soon
- [ ] Error boundaries
- [ ] Keyboard shortcuts
- [ ] System tray integration
- [ ] Native notifications
- [ ] Auto-update system
- [ ] Export data (CSV/JSON)
- [ ] Custom themes
- [ ] Multi-window support

---

**Ready to explore? Start the app!**

```bash
cd C:\Users\Admin\Desktop\FGD-main\desktop-app
npm run dev
```

Then open: http://localhost:5173 🚀
