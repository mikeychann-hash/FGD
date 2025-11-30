import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export function PolicyPanel() {
  const [learningRate, setLearningRate] = useState([1]);
  const [delegation, setDelegation] = useState([0.5]);
  const [cooldown, setCooldown] = useState([8000]);

  const handleApply = () => {
    console.log({
      learningRate: learningRate[0],
      delegationBias: delegation[0],
      cooldownMs: cooldown[0],
    });
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
        <SliderRow
          label="Learning Rate"
          value={learningRate}
          min={0.1}
          max={2}
          step={0.1}
          onChange={setLearningRate}
        />
        <SliderRow
          label="Delegation Bias"
          value={delegation}
          min={0}
          max={1}
          step={0.05}
          onChange={setDelegation}
        />
        <SliderRow
          label="Cooldown (ms)"
          value={cooldown}
          min={1000}
          max={30000}
          step={500}
          onChange={setCooldown}
        />
        <Button className="w-full" onClick={handleApply}>
          Apply Policy
        </Button>
      </CardContent>
    </Card>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number[];
  min: number;
  max: number;
  step: number;
  onChange: (value: number[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{value[0].toFixed(2)}</span>
      </Label>
      <Slider min={min} max={max} step={step} value={value} onValueChange={onChange} />
    </div>
  );
}
