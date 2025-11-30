import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Compass } from "lucide-react";

interface Position {
  x: number;
  y: number;
  z: number;
}

interface Entity {
  id: string;
  type: "bot" | "player";
  name: string;
  position: Position;
  lastUpdate: number;
}

export function LiveMap() {
  const { on, off } = useWebSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [entities, setEntities] = useState<Map<string, Entity>>(new Map());
  const [zoom, setZoom] = useState(4); // pixels per block
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleBotMove = (data: any) => {
      setEntities(prev => {
        const next = new Map(prev);
        // Only update if moved significantly or new
        next.set(`bot-${data.botId}`, {
          id: data.botId,
          type: "bot",
          name: data.botId,
          position: data.position,
          lastUpdate: Date.now()
        });
        return next;
      });
    };

    const handlePlayerMove = (data: any) => {
      setEntities(prev => {
        const next = new Map(prev);
        next.set(`player-${data.username}`, {
          id: data.username,
          type: "player",
          name: data.username,
          position: data.position,
          lastUpdate: Date.now()
        });
        return next;
      });
    };

    on("bot:move", handleBotMove);
    on("player:move", handlePlayerMove);

    return () => {
      off("bot:move");
      off("player:move");
    };
  }, [on, off]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle resizing (simple approach)
    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight || 400;
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f172a"; // slate-950
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2 + offset.x;
    const centerY = canvas.height / 2 + offset.y;

    // Grid
    ctx.strokeStyle = "#1e293b"; // slate-800
    ctx.lineWidth = 1;
    const gridSize = 16 * zoom; // Chunk size approx
    const startX = (centerX % gridSize) - gridSize;
    const startY = (centerY % gridSize) - gridSize;

    for (let x = startX; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Origin (0,0)
    const originX = centerX;
    const originY = centerY;
    ctx.strokeStyle = "#ef4444"; // red-500
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX - 10, originY);
    ctx.lineTo(originX + 10, originY);
    ctx.moveTo(originX, originY - 10);
    ctx.lineTo(originX, originY + 10);
    ctx.stroke();

    // Entities
    entities.forEach(entity => {
      // Minecraft coords: X is East/West, Z is North/South. 
      // Map view: X is horizontal, Y is vertical. So Z -> Y.
      const x = centerX + entity.position.x * zoom;
      const y = centerY + entity.position.z * zoom;

      // Skip if out of bounds
      if (x < -20 || x > canvas.width + 20 || y < -20 || y > canvas.height + 20) return;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = entity.type === "bot" ? "#10b981" : "#3b82f6"; // green vs blue
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(entity.name, x, y - 10);
      
      // Coordinates text
      ctx.fillStyle = "#94a3b8"; // slate-400
      ctx.font = "10px monospace";
      ctx.fillText(`${Math.round(entity.position.x)}, ${Math.round(entity.position.z)}`, x, y + 15);
    });

  }, [entities, zoom, offset]);

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Live Map</CardTitle>
        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(z * 1.5, 20))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(z / 1.5, 0.5))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setOffset({ x: 0, y: 0 })}>
            <Compass className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-move block"
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startY = e.clientY;
            const startOffset = { ...offset };
            const handleMouseMove = (me: MouseEvent) => {
              setOffset({
                x: startOffset.x + (me.clientX - startX),
                y: startOffset.y + (me.clientY - startY)
              });
            };
            const handleMouseUp = () => {
              window.removeEventListener("mousemove", handleMouseMove);
              window.removeEventListener("mouseup", handleMouseUp);
            };
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
          }}
        />
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 p-1 rounded">
          Zoom: {zoom.toFixed(1)}x
        </div>
      </CardContent>
    </Card>
  );
}

