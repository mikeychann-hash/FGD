import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Layers, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export type FusionStatsData = {
  skills: number;
  dialogues: number;
  outcomes: number;
  totalInteractions?: number;
  learningRate?: number;
};

export function FusionStats({ stats }: { stats: FusionStatsData }) {
  const total = stats.skills + stats.dialogues + stats.outcomes;
  const skillsPercent = total > 0 ? (stats.skills / total) * 100 : 0;
  const dialoguesPercent = total > 0 ? (stats.dialogues / total) * 100 : 0;
  const outcomesPercent = total > 0 ? (stats.outcomes / total) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Fusion Memory Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <StatWithProgress
            icon={<Layers className="h-4 w-4" />}
            label="Skills"
            value={stats.skills}
            percent={skillsPercent}
            color="bg-blue-500"
          />
          <StatWithProgress
            icon={<MessageCircle className="h-4 w-4" />}
            label="Dialogues"
            value={stats.dialogues}
            percent={dialoguesPercent}
            color="bg-purple-500"
          />
          <StatWithProgress
            icon={<Sparkles className="h-4 w-4" />}
            label="Outcomes"
            value={stats.outcomes}
            percent={outcomesPercent}
            color="bg-green-500"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Knowledge Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat
              icon={<Layers className="h-4 w-4 text-blue-500" />}
              label="Skills"
              value={stats.skills}
              color="text-blue-500"
            />
            <Stat
              icon={<MessageCircle className="h-4 w-4 text-purple-500" />}
              label="Dialogues"
              value={stats.dialogues}
              color="text-purple-500"
            />
            <Stat
              icon={<Sparkles className="h-4 w-4 text-green-500" />}
              label="Outcomes"
              value={stats.outcomes}
              color="text-green-500"
            />
          </div>
          <div className="pt-3 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Knowledge</span>
              <span className="font-semibold">{total}</span>
            </div>
            {stats.totalInteractions && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Interactions</span>
                <span className="font-semibold">{stats.totalInteractions}</span>
              </div>
            )}
            {stats.learningRate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Learning Rate</span>
                <span className="font-semibold">{(stats.learningRate * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatWithProgress({
  icon,
  label,
  value,
  percent,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  percent: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="relative">
        <Progress value={percent} className="h-2" />
        <div
          className={`absolute inset-y-0 left-0 h-2 rounded-full ${color} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">{percent.toFixed(1)}% of total</p>
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border bg-card/50 p-3 text-center"
    >
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </motion.div>
  );
}
