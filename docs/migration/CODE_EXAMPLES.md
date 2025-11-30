# React + Shadcn/ui Code Examples
## Real Implementation Patterns for FGD Desktop

---

## 🎨 Beautiful Component Examples

### 1. Enhanced Bot Card (Shadcn + Tailwind)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Activity, 
  MoreVertical, 
  Play, 
  Square, 
  Trash2,
  Package,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface BotCardProps {
  bot: {
    id: string;
    role: string;
    state: 'active' | 'inactive' | 'error';
    position: { x: number; y: number; z: number };
    cpu: number;
    memory: number;
    tick: number;
    lastAction: string;
  };
  onSpawn: (id: string) => void;
  onDespawn: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BotCard({ bot, onSpawn, onDespawn, onDelete }: BotCardProps) {
  const stateVariant = {
    active: 'default',
    inactive: 'secondary',
    error: 'destructive',
  }[bot.state];

  const stateIcon = {
    active: <Activity className="h-4 w-4 animate-pulse" />,
    inactive: <Square className="h-4 w-4" />,
    error: <Activity className="h-4 w-4 text-destructive" />,
  }[bot.state];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            {stateIcon}
            <CardTitle className="text-lg">{bot.id}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={stateVariant}>{bot.state.toUpperCase()}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onSpawn(bot.id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Spawn
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDespawn(bot.id)}>
                  <Square className="mr-2 h-4 w-4" />
                  Despawn
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(bot.id)}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {/* Role Badge */}
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{bot.role}</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">CPU:</span>
                <span className="font-mono">{bot.cpu}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memory:</span>
                <span className="font-mono">{bot.memory}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tick:</span>
                <span className="font-mono">{bot.tick}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">X/Y/Z:</span>
                <span className="font-mono text-xs">
                  {bot.position.x.toFixed(0)}/
                  {bot.position.y.toFixed(0)}/
                  {bot.position.z.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Last Action */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Last: <span className="text-foreground">{bot.lastAction}</span>
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 pt-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onSpawn(bot.id)}
                disabled={bot.state === 'active'}
                className="flex-1"
              >
                <Play className="h-3 w-3 mr-1" />
                Spawn
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onDespawn(bot.id)}
                disabled={bot.state === 'inactive'}
                className="flex-1"
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
```

---

### 2. Real-time Console Log with Auto-scroll

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Terminal, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'success' | 'error' | 'warning';
}

interface ConsoleLogProps {
  logs: LogEntry[];
  maxLogs?: number;
}

export function ConsoleLog({ logs, maxLogs = 100 }: ConsoleLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayLogs = logs.slice(-maxLogs);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const levelConfig = {
    info: {
      icon: Info,
      variant: 'default' as const,
      color: 'text-blue-500',
    },
    success: {
      icon: CheckCircle,
      variant: 'default' as const,
      color: 'text-green-500',
    },
    error: {
      icon: AlertCircle,
      variant: 'destructive' as const,
      color: 'text-red-500',
    },
    warning: {
      icon: AlertCircle,
      variant: 'secondary' as const,
      color: 'text-yellow-500',
    },
  };

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Console Log
          <Badge variant="outline" className="ml-auto">
            {displayLogs.length} entries
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea ref={scrollRef} className="h-full px-6 pb-6">
          <div className="space-y-1 font-mono text-sm">
            <AnimatePresence initial={false}>
              {displayLogs.map((log) => {
                const config = levelConfig[log.level];
                const Icon = config.icon;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-start gap-2 p-2 rounded-md hover:bg-accent/50 ${
                      log.level === 'error' ? 'bg-destructive/10' : ''
                    }`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                    <span className="text-muted-foreground text-xs min-w-[80px]">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <p className="flex-1 text-foreground break-all">
                      {log.message}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

---

### 3. Bot Creator Form with Personality Sliders

```tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const botSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  role: z.string().min(1, 'Role is required'),
  description: z.string().optional(),
  personality: z.object({
    curiosity: z.number().min(0).max(1),
    patience: z.number().min(0).max(1),
    motivation: z.number().min(0).max(1),
    empathy: z.number().min(0).max(1),
    aggression: z.number().min(0).max(1),
    creativity: z.number().min(0).max(1),
    loyalty: z.number().min(0).max(1),
  }),
});

type BotFormData = z.infer<typeof botSchema>;

interface BotCreatorProps {
  onSubmit: (data: BotFormData) => Promise<void>;
}

export function BotCreator({ onSubmit }: BotCreatorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [personality, setPersonality] = useState({
    curiosity: 0.5,
    patience: 0.5,
    motivation: 0.5,
    empathy: 0.5,
    aggression: 0.5,
    creativity: 0.5,
    loyalty: 0.5,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BotFormData>({
    resolver: zodResolver(botSchema),
    defaultValues: {
      personality,
    },
  });

  const onSubmitForm = async (data: BotFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit({ ...data, personality });
      reset();
      setPersonality({
        curiosity: 0.5,
        patience: 0.5,
        motivation: 0.5,
        empathy: 0.5,
        aggression: 0.5,
        creativity: 0.5,
        loyalty: 0.5,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const personalityTraits = [
    { key: 'curiosity', label: 'Curiosity', description: 'Exploration tendency' },
    { key: 'patience', label: 'Patience', description: 'Task persistence' },
    { key: 'motivation', label: 'Motivation', description: 'Drive to act' },
    { key: 'empathy', label: 'Empathy', description: 'Social awareness' },
    { key: 'aggression', label: 'Aggression', description: 'Combat willingness' },
    { key: 'creativity', label: 'Creativity', description: 'Novel solutions' },
    { key: 'loyalty', label: 'Loyalty', description: 'Group commitment' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Create New Bot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bot Name</Label>
              <Input
                id="name"
                placeholder="e.g., miner_01"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select {...register('role')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="miner">Miner</SelectItem>
                  <SelectItem value="builder">Builder</SelectItem>
                  <SelectItem value="farmer">Farmer</SelectItem>
                  <SelectItem value="warrior">Warrior</SelectItem>
                  <SelectItem value="explorer">Explorer</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe this bot's purpose..."
                {...register('description')}
              />
            </div>
          </div>

          {/* Personality Traits */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <Label>Personality Traits</Label>
            </div>
            {personalityTraits.map(({ key, label, description }) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between">
                  <div>
                    <Label className="text-sm">{label}</Label>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <span className="text-sm font-mono">
                    {personality[key].toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[personality[key]]}
                  onValueChange={([value]) =>
                    setPersonality((prev) => ({ ...prev, [key]: value }))
                  }
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Bot'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

---

### 4. Live Metrics Chart with Recharts

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Activity, HardDrive, Clock } from 'lucide-react';

interface MetricData {
  time: string;
  cpu: number;
  memory: number;
  queue: number;
  latency: number;
}

interface MetricsChartsProps {
  data: MetricData[];
}

export function MetricsCharts({ data }: MetricsChartsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          System Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cpu" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="cpu" className="gap-2">
              <Activity className="h-4 w-4" />
              CPU
            </TabsTrigger>
            <TabsTrigger value="memory" className="gap-2">
              <HardDrive className="h-4 w-4" />
              Memory
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-2">
              <Activity className="h-4 w-4" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="latency" className="gap-2">
              <Clock className="h-4 w-4" />
              Latency
            </TabsTrigger>
          </TabsList>

          {/* CPU Chart */}
          <TabsContent value="cpu" className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="time"
                  className="text-xs"
                  stroke="currentColor"
                />
                <YAxis
                  domain={[0, 100]}
                  className="text-xs"
                  stroke="currentColor"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#60a5fa"
                  fillOpacity={1}
                  fill="url(#cpuGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Average:</span>
              <span className="font-mono">
                {(data.reduce((sum, d) => sum + d.cpu, 0) / data.length).toFixed(1)}%
              </span>
            </div>
          </TabsContent>

          {/* Memory Chart */}
          <TabsContent value="memory" className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="memory" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Queue Chart */}
          <TabsContent value="queue" className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="queue"
                  stroke="#facc15"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          {/* Latency Chart */}
          <TabsContent value="latency" className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="#f87171"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

---

### 5. Status Bar with Live Connection Status

```tsx
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Activity, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConnectivityStatus {
  api: boolean;
  ws: boolean;
  bridge: 'ok' | 'degraded' | 'error' | 'unknown';
  pluginAge: number | null;
}

export function StatusBar({ connectivity }: { connectivity: ConnectivityStatus }) {
  const isHealthy = connectivity.api && connectivity.ws && connectivity.bridge === 'ok';
  const isDegraded = connectivity.api && connectivity.ws && connectivity.bridge === 'degraded';
  
  const statusColor = isHealthy ? 'text-green-500' : isDegraded ? 'text-yellow-500' : 'text-red-500';
  const StatusIcon = isHealthy ? Wifi : isDegraded ? Activity : connectivity.ws ? AlertCircle : WifiOff;

  return (
    <div className="flex items-center justify-between p-4 border-b bg-card">
      <div className="flex items-center gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
          </motion.div>
          <span className="text-sm font-medium">
            {isHealthy ? 'Connected' : isDegraded ? 'Degraded' : 'Disconnected'}
          </span>
        </div>

        {/* Individual Service Status */}
        <div className="flex items-center gap-2">
          <Badge variant={connectivity.api ? 'default' : 'destructive'}>
            API
          </Badge>
          <Badge variant={connectivity.ws ? 'default' : 'destructive'}>
            WS
          </Badge>
          <Badge 
            variant={
              connectivity.bridge === 'ok' ? 'default' :
              connectivity.bridge === 'degraded' ? 'secondary' :
              'destructive'
            }
          >
            Bridge
          </Badge>
        </div>

        {/* Heartbeat Age */}
        {connectivity.pluginAge !== null && (
          <span className="text-xs text-muted-foreground">
            Heartbeat: {connectivity.pluginAge}s ago
          </span>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-xs text-muted-foreground">
        {new Date().toLocaleTimeString()}
      </span>
    </div>
  );
}
```

---

## 🎯 Best Practices

### Component Organization
```
components/
├── ui/              # Shadcn primitives (don't modify)
├── dashboard/       # Dashboard-specific
├── admin/           # Admin-specific
├── fusion/          # Fusion-specific
└── layout/          # Shared layout
```

### State Management Pattern
```tsx
// Use Zustand for global state
import { create } from 'zustand';

interface BotStore {
  bots: Bot[];
  loading: boolean;
  fetchBots: () => Promise<void>;
}

export const useBotStore = create<BotStore>((set) => ({
  bots: [],
  loading: false,
  fetchBots: async () => {
    set({ loading: true });
    const bots = await api.getBots();
    set({ bots, loading: false });
  },
}));

// Use in components
function BotList() {
  const { bots, loading, fetchBots } = useBotStore();
  
  useEffect(() => {
    fetchBots();
  }, []);
  
  if (loading) return <Skeleton />;
  return <div>{bots.map(...)}</div>;
}
```

### Real-time Pattern
```tsx
function useLiveBots() {
  const { bots, setBots } = useBotStore();
  const { on, off } = useWebSocket();

  useEffect(() => {
    // Listen for updates
    on('bot:spawned', (data) => {
      setBots((prev) => [...prev, data.bot]);
    });

    on('bot:deleted', (data) => {
      setBots((prev) => prev.filter(b => b.id !== data.botId));
    });

    return () => {
      off('bot:spawned');
      off('bot:deleted');
    };
  }, []);

  return bots;
}
```

---

This should give you a solid foundation with real, production-ready code examples!
