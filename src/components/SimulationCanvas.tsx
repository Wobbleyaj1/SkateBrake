import React, { useEffect } from "react";
import { Box, Stack, Button, IconButton } from "@mui/material";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import type { SimulationState } from "../physics/engine";

type Props = {
  stateRef: React.RefObject<SimulationState>;
  width?: number;
  height?: number;
  uiTick?: number;
  showDebug?: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  onExport?: () => void;
  running?: boolean;
};

export default function SimulationCanvas({
  stateRef,
  width = 800,
  height = 400,
  uiTick,
  showDebug = true,
  onStart,
  onPause,
  onExport,
  running = false,
}: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const flashStartRef = React.useRef<number | null>(null);
  const lastStopTRef = React.useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    if (!stateRef.current) return;

    const draw = () => {
      const s = stateRef.current!;
      // detect new eject event and initiate a flash
      if (s.stopDetails && s.stopDetails.cause === "decel") {
        if (lastStopTRef.current !== s.t) {
          lastStopTRef.current = s.t;
          flashStartRef.current = performance.now();
        }
      }
      // background
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      // calculate drawing scale so obstacle fits along the slope
      const viewMargin = 40; // px
      const worldMax = Math.max(10, s.obstaclePosition || 10);
      const pixelsPerMeter = (width - viewMargin * 2) / worldMax;

      const x0 = viewMargin;
      const y0 = height / 2;
      const drawTheta = -s.theta;

      const endX = x0 + worldMax * pixelsPerMeter * Math.cos(drawTheta);
      const endY = y0 - worldMax * pixelsPerMeter * Math.sin(drawTheta);

      // incline
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // obstacle
      const obstacleXpx =
        x0 + s.obstaclePosition * pixelsPerMeter * Math.cos(drawTheta);
      const obstacleYpx =
        y0 - s.obstaclePosition * pixelsPerMeter * Math.sin(drawTheta);
      const obsW = 18;
      const obsH = 32;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(obstacleXpx - obsW / 2, obstacleYpx - obsH, obsW, obsH);
      ctx.strokeStyle = "#b91c1c";
      ctx.strokeRect(obstacleXpx - obsW / 2, obstacleYpx - obsH, obsW, obsH);

      // skateboard
      const skateboardXpx = x0 + s.x * pixelsPerMeter * Math.cos(drawTheta);
      const skateboardYpx = y0 - s.x * pixelsPerMeter * Math.sin(drawTheta);
      ctx.save();
      ctx.translate(skateboardXpx, skateboardYpx);
      ctx.rotate(-drawTheta);
      ctx.fillStyle = "#111827";
      ctx.fillRect(-28, -10, 56, 6);
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.arc(-18, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(18, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // rider
      const normalOffset = 22;
      const riderX = skateboardXpx + normalOffset * Math.sin(drawTheta);
      const riderY = skateboardYpx - normalOffset * Math.cos(drawTheta);
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(riderX, riderY, 8, 0, Math.PI * 2);
      ctx.fill();

      // HUD
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
            (-s.theta * 180) /
            Math.PI
          ).toFixed(1)}°`,
          10,
          height - 12
        );
      }
      // Flash overlay when ejection occurs (brief red flash)
      const flashStart = flashStartRef.current;
      if (flashStart) {
        const elapsed = performance.now() - flashStart;
        const dur = 600; // ms
        if (elapsed < dur) {
          const alpha = 0.6 * (1 - elapsed / dur);
          ctx.fillStyle = `rgba(220, 38, 38, ${alpha.toFixed(3)})`;
          ctx.fillRect(0, 0, width, height);
        } else {
          // clear flash
          flashStartRef.current = null;
        }
      }
    };

    draw();
  }, [uiTick, width, height, stateRef, showDebug]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        flex: 1,
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 2, justifyContent: "center" }}
      >
        {!running ? (
          <Button variant="contained" color="primary" onClick={onStart}>
            Start
          </Button>
        ) : (
          <Button variant="contained" color="secondary" onClick={onPause}>
            Pause
          </Button>
        )}
        {onExport && (
          <IconButton onClick={onExport} title="Export CSV">
            <SaveAltIcon />
          </IconButton>
        )}
      </Stack>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "stretch",
          justifyContent: "stretch",
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </Box>
    </Box>
  );
}
