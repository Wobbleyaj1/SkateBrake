import React, { useEffect } from "react";
import type { SimulationState } from "../physics/engine";

type Props = {
  stateRef: React.RefObject<SimulationState>;
  width?: number;
  height?: number;
  uiTick?: number;
  showDebug?: boolean;
};

/**
 * Draws a simple 2D representation of scooter+rider on an incline.
 * Coordinates:
 *  - x in meters maps to pixels via a scale computed from obstacle distance.
 */
export default function SimulationCanvas({
  stateRef,
  width = 800,
  height = 400,
  uiTick,
  showDebug = true,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    if (!stateRef.current) return;

    // draw function reading from stateRef
    const draw = () => {
      const s = stateRef.current!;
      // background
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      // calculate drawing scale so obstacle fits
      const viewMargin = 20; // px
      const worldMax = Math.max(10, s.obstaclePosition || 10);
      const pixelsPerMeter = (width - viewMargin * 2) / worldMax;

      // ground line coordinates (we will tilt by theta)
      const midY = height / 2;
      const theta = s.theta;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // draw incline as a long line
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      // compute start and end in world meters mapped to pixels
      const x0 = viewMargin;
      const y0 = midY - Math.tan(theta) * x0 * 0.2;
      const x1 = width - viewMargin;
      const y1 = midY - Math.tan(theta) * x1 * 0.2;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();

      // draw obstacle as a block at obstaclePosition
      const obstacleXpx = viewMargin + s.obstaclePosition * pixelsPerMeter;
      const obstacleYpx = y0 + (obstacleXpx - x0) * Math.tan(theta) * 0.2;
      const obsW = 18;
      const obsH = 32;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(obstacleXpx - obsW / 2, obstacleYpx - obsH, obsW, obsH);
      ctx.strokeStyle = "#b91c1c";
      ctx.strokeRect(obstacleXpx - obsW / 2, obstacleYpx - obsH, obsW, obsH);

      // draw skateboard (rectangle) at x position
      const skateboardXpx = viewMargin + s.x * pixelsPerMeter;
      const skateboardYpx = y0 + (skateboardXpx - x0) * Math.tan(theta) * 0.2;
      // skateboard body
      ctx.save();
      ctx.translate(skateboardXpx, skateboardYpx);
      ctx.rotate(-Math.atan(0.2 * Math.tan(theta))); // small tilt to match slope
      ctx.fillStyle = "#111827";
      ctx.fillRect(-28, -10, 56, 6);
      // wheels
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-18, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(18, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // rider as a simple circle above board
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(skateboardXpx, skateboardYpx - 22, 8, 0, Math.PI * 2);
      ctx.fill();

      // HUD overlays
      ctx.fillStyle = "#0f172a";
      ctx.font = "14px Inter, Roboto, sans-serif";
      ctx.fillText(`x: ${s.x.toFixed(2)} m`, 10, 20);
      ctx.fillText(`v: ${s.v.toFixed(2)} m/s`, 10, 38);
      ctx.fillText(`a: ${s.a.toFixed(2)} m/s²`, 10, 56);
      ctx.fillText(
        `brake: ${(s.lastBrakePercent * 100 || 0).toFixed(1)} %`,
        10,
        74
      );
      ctx.fillText(
        `distance to obstacle: ${Math.max(0, s.obstaclePosition - s.x).toFixed(
          2
        )} m`,
        10,
        92
      );

      if (showDebug) {
        ctx.fillStyle = "#475569";
        ctx.font = "12px monospace";
        ctx.fillText(
          `mass=${s.mass.toFixed(1)}kg  mu=${s.mu.toFixed(2)}  incline=${(
            (s.theta * 180) /
            Math.PI
          ).toFixed(1)}°`,
          10,
          height - 12
        );
      }
    };

    // draw once immediately and on uiTick changes
    draw();
    // also set up an interval to draw at 30 FPS controlled by uiTick changes
    // When uiTick changes (provided by host), redraw to reflect recent physics state
    // We use effect depending on uiTick below.
  }, [uiTick, width, height, stateRef, showDebug]);

  // Also react to uiTick changes by redrawing (simple trick: effect above triggers on uiTick)
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    // just re-run the draw logic (call same code path)
    if (!stateRef.current) return;
    // we call the same code as above but simpler: reuse draw by triggering re-render via uiTick prop
    // (the previous effect will run due to uiTick dependency)
  }, [uiTick]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}
