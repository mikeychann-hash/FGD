import { Activity, BarChart3, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClusterGrid, type ClusterNode } from "@/components/dashboard/ClusterGrid";
import { FusionSummary } from "@/components/dashboard/FusionSummary";
import { MetricsCharts, type MetricPoint } from "@/components/dashboard/MetricsCharts";
import { PolicyPanel } from "@/components/dashboard/PolicyPanel";
import { useEffect } from "react";
import { useMetricsStore } from "@/stores/metricsStore";
import { Card as ShimmerCard } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebSocket } from "@/hooks/useWebSocket";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 },
  },
};

export default function Dashboard() {
  const { nodes, metrics, loading, error, fetchCluster, fetchMetrics, setNodes, setMetrics } =
    useMetricsStore();
  const { on, off } = useWebSocket();

  useEffect(() => {
    fetchCluster();
    fetchMetrics();
  }, [fetchCluster, fetchMetrics]);

  useEffect(() => {
    on("cluster:update", (data) => {
      const payload = (data as { nodes?: ClusterNode[] })?.nodes;
      if (payload) setNodes(payload);
    });
    on("metrics:update", (data) => {
      const payload = (data as { metrics?: MetricPoint[] })?.metrics;
      if (payload) setMetrics(payload);
    });
    return () => {
      off("cluster:update");
      off("metrics:update");
    };
  }, [on, off, setNodes, setMetrics]);

  const displayNodes = nodes;
  const displayMetrics = metrics;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Cluster Health" icon={<Activity className="h-5 w-5 text-muted-foreground" />}>
          <Badge>{error ? "Unknown" : "Healthy"}</Badge>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading health..." : error ? error : "All nodes responsive"}
          </p>
        </StatCard>
        <StatCard title="Active Bots" icon={<Network className="h-5 w-5 text-muted-foreground" />}>
          <p className="text-3xl font-semibold">12</p>
          <p className="text-sm text-muted-foreground">2 pending spawn</p>
        </StatCard>
        <StatCard title="Metrics" icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">CPU</span>
            <span className="font-mono">62%</span>
          </div>
          <Button variant="outline" className="w-full mt-2">
            View metrics
          </Button>
        </StatCard>
      </motion.div>

      <motion.div variants={itemVariants}>
        {loading ? <DashboardSkeleton /> : <ClusterGrid nodes={displayNodes} />}
      </motion.div>

      <motion.div variants={itemVariants}>
        {loading ? <DashboardSkeleton /> : <MetricsCharts data={displayMetrics} />}
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PolicyPanel />
        </div>
        <FusionSummary />
      </motion.div>
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <ShimmerCard className="p-4 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-24 w-full" />
    </ShimmerCard>
  );
}

function StatCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}
