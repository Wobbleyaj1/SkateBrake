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
  onStart,
  onPause,
  onReset,
  onExport,
  running = false,
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

      // calculate drawing scale so obstacle fits along the slope
      const viewMargin = 40; // px
      const worldMax = Math.max(10, s.obstaclePosition || 10);
      // pixels per meter along-slope
      const pixelsPerMeter = (width - viewMargin * 2) / worldMax;

      // origin on canvas for world x=0 (start of slope)
      const x0 = viewMargin;
      const y0 = height / 2; // baseline vertical origin
      // drawTheta is the visual angle we render. The app stores physics theta in
      // `s.theta` (we map UI incline -> physics theta in App). To make the
      // canvas show the same numeric incline as the slider (so slider=+1 =>
      // canvas shows +1 uphill), we invert the stored physics theta here.
      // That way the UI slider meaning (positive = uphill to the right)
      // is what the user sees, while physics still uses `s.theta`.
      const drawTheta = -s.theta;

      // compute end point of slope in canvas coords using projection along slope
      const endX = x0 + worldMax * pixelsPerMeter * Math.cos(drawTheta);
      const endY = y0 - worldMax * pixelsPerMeter * Math.sin(drawTheta);

      // draw incline as a line from origin to end
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // draw obstacle as a block at obstaclePosition (project along slope)
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

      // draw skateboard (rectangle) at x position
      // project skateboard position along the slope (s.x is distance along slope)
      const skateboardXpx = x0 + s.x * pixelsPerMeter * Math.cos(drawTheta);
      const skateboardYpx = y0 - s.x * pixelsPerMeter * Math.sin(drawTheta);
      // skateboard body
      ctx.save();
      ctx.translate(skateboardXpx, skateboardYpx);
      // rotate so the board aligns with the drawn slope
      ctx.rotate(-drawTheta);
      ctx.fillStyle = "#111827";
      ctx.fillRect(-28, -10, 56, 6);
      // wheels
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      // wheels positioned relative to rotated board
      ctx.arc(-18, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(18, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // rider as a simple circle above board (offset along slope normal)
      // compute a small normal offset to place rider above the board
      const normalOffset = 22;
      const riderX = skateboardXpx + normalOffset * Math.sin(drawTheta);
      const riderY = skateboardYpx - normalOffset * Math.cos(drawTheta);
      ctx.fillStyle = "#fde68a";
      ctx.beginPath();
      ctx.arc(riderX, riderY, 8, 0, Math.PI * 2);
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
        // show the incline in degrees using the UI convention (invert physics theta)
        ctx.fillText(
          `mass=${s.mass.toFixed(1)}kg  mu=${s.mu.toFixed(2)}  incline=${(
            (-s.theta * 180) /
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
      {/* Control buttons */}
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
        <Button variant="outlined" onClick={onReset}>
          Reset
        </Button>
        {onExport && (
          <IconButton onClick={onExport} title="Export CSV">
            <SaveAltIcon />
          </IconButton>
        )}
      </Stack>

      {/* Canvas */}
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
