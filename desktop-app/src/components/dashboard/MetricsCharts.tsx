import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MetricPoint {
  time: string;
  cpu: number;
  memory: number;
  queue: number;
  latency: number;
}

export function MetricsCharts({ data }: { data: MetricPoint[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <MetricCard title="CPU Utilization">
        <AreaChartInner data={data} dataKey="cpu" color="#60a5fa" />
      </MetricCard>
      <MetricCard title="Memory Usage">
        <BarChartInner data={data} dataKey="memory" color="#34d399" />
      </MetricCard>
      <MetricCard title="Queue Depth">
        <LineChartInner data={data} dataKey="queue" color="#f59e0b" />
      </MetricCard>
      <MetricCard title="Latency (ms)">
        <LineChartInner data={data} dataKey="latency" color="#f87171" />
      </MetricCard>
    </div>
  );
}

function MetricCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[240px] min-w-[280px]">{children}</div>
      </CardContent>
    </Card>
  );
}

function AreaChartInner({
  data,
  dataKey,
  color,
}: {
  data: MetricPoint[];
  dataKey: keyof MetricPoint;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`${dataKey}Gradient`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.7} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="time" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fillOpacity={1}
          fill={`url(#${dataKey}Gradient)`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function BarChartInner({
  data,
  dataKey,
  color,
}: {
  data: MetricPoint[];
  dataKey: keyof MetricPoint;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="time" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartInner({
  data,
  dataKey,
  color,
}: {
  data: MetricPoint[];
  dataKey: keyof MetricPoint;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="time" className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
