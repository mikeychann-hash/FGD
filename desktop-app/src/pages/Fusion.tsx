import { FusionDataViewer, type FusionRecord } from "@/components/fusion/FusionDataViewer";
import { FusionStats, type FusionStatsData } from "@/components/fusion/FusionStats";
import { useEffect } from "react";
import { useFusionStore } from "@/stores/fusionStore";
import { Skeleton } from "@/components/ui/skeleton";
import { useWebSocket } from "@/hooks/useWebSocket";
import { motion } from "framer-motion";

export default function Fusion() {
  const { records, stats, loading, error, fetchFusion, setRecords, setStats } = useFusionStore();
  const { on, off } = useWebSocket();

  useEffect(() => {
    fetchFusion();
  }, [fetchFusion]);

  useEffect(() => {
    on("fusion:update", (data) => {
      const payload = data as { records?: FusionRecord[]; stats?: FusionStatsData };
      if (payload.records) setRecords(payload.records);
      if (payload.stats) setStats(payload.stats);
    });

    on("fusion:new", (data) => {
      const payload = data as { record?: FusionRecord };
      if (payload.record) {
        setRecords((prev) => [payload.record!, ...prev]);
      }
    });

    return () => {
      off("fusion:update");
      off("fusion:new");
    };
  }, [on, off, setRecords, setStats]);

  const displayStats = stats;
  const displayRecords = records;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <FusionStats stats={displayStats} />
      )}

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive font-medium">Error loading fusion data</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <Skeleton className="h-[500px] w-full" />
      ) : (
        <FusionDataViewer items={displayRecords} />
      )}
    </motion.div>
  );
}
