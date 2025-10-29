import { useMemo, useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Slider,
  Stack,
  LinearProgress,
  Tooltip,
  IconButton,
  Popover,
} from "@mui/material";
import {
  getDefaultMFs,
  setMemberships,
  getBrakePercent,
  computeBrakeWithMFs,
} from "../fuzzy/controller";

/**
 * Simple UI to show and adjust membership function parameters.
 * The underlying fuzzy controller exposes helpers to get and set the MFs.
 * Adjustments are applied globally via setMemberships (mutates controller defaults).
 *
 * Note: For an actual persistent UI you'd want to store MF values in React state or in context,
 * and update the controller functions immutably. For brevity and clarity we mutate via API.
 */

type MFs = Record<
  string,
  Array<{ name: string; type: string; params: number[] }>
>;

export default function FuzzyTuner({
  onModeChange,
}: {
  onModeChange?: (
    mode: "Beginner" | "Intermediate" | "Advanced" | "Custom"
  ) => void;
}) {
  // fetch defaults from controller
  const defaults = getDefaultMFs() as MFs;
  const [local, setLocal] = useState<MFs>(defaults);
  // staged mode inside tuner; not saved to parent until Apply is pressed
  const [stagedMode, setStagedMode] = useState<
    "Beginner" | "Intermediate" | "Advanced" | "Custom"
  >("Custom");

  // sample inputs for live preview
  const [sampleSpeed, setSampleSpeed] = useState<number>(4);
  const [sampleDistance, setSampleDistance] = useState<number>(8);

  const paramRanges = useMemo<
    Record<string, { min: number; max: number; step: number }>
  >(
    () => ({
      Speed: { min: 0, max: 12, step: 0.1 },
      Distance: { min: 0, max: 40, step: 0.1 },
      Brake: { min: 0, max: 1, step: 0.01 },
    }),
    []
  );

  function updateParam(
    group: string,
    mfIdx: number,
    paramIdx: number,
    v: number
  ) {
    // create a new copy and update state; call onModeChange after state update
    setLocal((prev) => {
      const copy: any = JSON.parse(JSON.stringify(prev));
      copy[group][mfIdx].params[paramIdx] = v;
      return copy;
    });
    setStagedMode("Custom");
  }

  function apply() {
    setMemberships(local);
    if (onModeChange) onModeChange(stagedMode);
  }

  function reset() {
    const d = getDefaultMFs() as MFs;
    setLocal(d);
    setStagedMode("Custom");
  }

  function presetBeginner() {
    // Beginner: brake earlier (distance treated as closer) and softer outputs
    const d = getDefaultMFs() as any;
    const copy = JSON.parse(JSON.stringify(d));
    if (copy.Brake) {
      // softer brake outputs (Hard caps below 1)
      copy.Brake = [
        { name: "Soft", type: "tri", params: [0, 0, 0.3] },
        { name: "Moderate", type: "tri", params: [0.15, 0.35, 0.6] },
        { name: "Hard", type: "tri", params: [0.4, 0.65, 0.85] },
      ];
    }
    if (copy.Distance) {
      // treat distances as closer so braking begins earlier
      copy.Distance = [
        { name: "Close", type: "tri", params: [0, 0, 8] },
        { name: "Medium", type: "tri", params: [6, 12, 18] },
        { name: "Far", type: "tri", params: [15, 28, 40] },
      ];
    }
    setLocal(copy);
    setStagedMode("Beginner");
  }

  function presetIntermediate() {
    // Intermediate: split the difference between Beginner and Advanced
    const d = getDefaultMFs() as any;
    const copy = JSON.parse(JSON.stringify(d));
    if (copy.Brake) {
      copy.Brake = [
        { name: "Soft", type: "tri", params: [0, 0, 0.28] },
        { name: "Moderate", type: "tri", params: [0.12, 0.4, 0.7] },
        { name: "Hard", type: "tri", params: [0.45, 0.8, 1] },
      ];
    }
    if (copy.Distance) {
      copy.Distance = [
        { name: "Close", type: "tri", params: [0, 0, 5] },
        { name: "Medium", type: "tri", params: [3, 9, 15] },
        { name: "Far", type: "tri", params: [12, 20, 30] },
      ];
    }
    setLocal(copy);
    setStagedMode("Intermediate");
  }

  function presetAdvanced() {
    // Advanced: brake later (distance treated as farther) but harder outputs
    const d = getDefaultMFs() as any;
    const copy = JSON.parse(JSON.stringify(d));
    if (copy.Brake) {
      // stronger braking: Hard peaks closer to 1
      copy.Brake = [
        { name: "Soft", type: "tri", params: [0, 0, 0.2] },
        { name: "Moderate", type: "tri", params: [0.15, 0.45, 0.75] },
        { name: "Hard", type: "tri", params: [0.6, 0.95, 1] },
      ];
    }
    if (copy.Distance) {
      // treat distances as farther so braking happens later
      copy.Distance = [
        { name: "Close", type: "tri", params: [0, 0, 3] },
        { name: "Medium", type: "tri", params: [2.5, 8, 14] },
        { name: "Far", type: "tri", params: [10, 20, 35] },
      ];
    }
    setLocal(copy);
    setStagedMode("Advanced");
  }

  const brakePreview = useMemo(() => {
    try {
      return computeBrakeWithMFs(local, sampleSpeed, sampleDistance);
    } catch (e) {
      return getBrakePercent(sampleSpeed, sampleDistance);
    }
  }, [sampleSpeed, sampleDistance, local]);

  const [applied, setApplied] = useState(false);
  // popover for info
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const handleInfoClick = (e: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(e.currentTarget);
  const handleInfoClose = () => setAnchorEl(null);
  const infoOpen = Boolean(anchorEl);

  // canvas refs map for MF plots
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  // draw MF shapes for a group onto its canvas
  function drawMFsOnCanvas(
    group: string,
    cvs: HTMLCanvasElement | null,
    mfs: any[]
  ) {
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const w = (cvs.width = 240);
    const h = (cvs.height = 60);
    ctx.clearRect(0, 0, w, h);
    // domain depends on group
    const domain =
      group === "Brake" ? [0, 1] : group === "Speed" ? [0, 12] : [0, 40];
    const [a, b] = domain;
    // draw background grid
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    // draw each MF
    const colors = ["#0284c7", "#0ea5a4", "#ef4444", "#7c3aed"];
    mfs.forEach((mf, idx) => {
      ctx.beginPath();
      ctx.strokeStyle = colors[idx % colors.length];
      ctx.lineWidth = 2;
      const samples = 120;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const x = a + (b - a) * t;
        // evaluate triangular/trap
        let yv = 0;
        const p = mf.params;
        if (mf.type === "tri") {
          const [p0, p1, p2] = p;
          if (x <= p0 || x >= p2) yv = 0;
          else if (x <= p1) yv = (x - p0) / (p1 - p0 || 1);
          else yv = (p2 - x) / (p2 - p1 || 1);
        } else {
          // trap
          const [p0, p1, p2, p3] = p;
          if (x <= p0 || x >= p3) yv = 0;
          else if (x >= p1 && x <= p2) yv = 1;
          else if (x > p0 && x < p1) yv = (x - p0) / (p1 - p0 || 1);
          else yv = (p3 - x) / (p3 - p2 || 1);
        }
        const px = t * w;
        const py = h - yv * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
  }

  // redraw canvases when local MFs change
  useEffect(() => {
    Object.entries(local).forEach(([group, mfs]) => {
      const cvs = canvasRefs.current[group];
      drawMFsOnCanvas(group, cvs, mfs as any[]);
    });
  }, [local]);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h6">Fuzzy Tuner</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Tweak membership functions for Speed, Distance and Brake. Use the
            live preview to see brake output for a sample speed & distance.
            Click Apply to make changes active.
          </Typography>
        </Box>
        <Box>
          <Tooltip title="Explain membership functions and presets">
            <IconButton size="small" onClick={handleInfoClick}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.88 15h-1.75v-6h1.75v6zM12 8.75c-.48 0-.88-.39-.88-.87s.4-.87.88-.87c.49 0 .88.39.88.87s-.4.87-.88.87z"
                  fill="currentColor"
                />
              </svg>
            </IconButton>
          </Tooltip>
          <Popover
            open={infoOpen}
            anchorEl={anchorEl}
            onClose={handleInfoClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <Box sx={{ p: 2, maxWidth: 320 }}>
              <Typography variant="subtitle2">Membership functions</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Each group (Speed, Distance, Brake) is represented by triangular
                or trapezoidal membership functions. Move the sliders to reshape
                them. The mini-plots next to each group show the shape of the
                functions. Use presets to quickly choose Beginner / Intermediate
                / Advanced behavior.
              </Typography>
            </Box>
          </Popover>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 2,
        }}
      >
        <Box sx={{ flex: "1 1 60%" }}>
          {Object.entries(local).map(([group, mfs]) => (
            <Box key={group} sx={{ mb: 2 }}>
              <Typography variant="subtitle2">{group}</Typography>
              <Typography variant="caption" color="text.secondary">
                {group === "Speed" && "Range: 0–12 m/s"}
                {group === "Distance" && "Range: 0–40 m"}
                {group === "Brake" && "Range: 0–1 (0%–100%)"}
              </Typography>

              <canvas
                ref={(el) => {
                  canvasRefs.current[group] = el;
                }}
                style={{
                  width: 240,
                  height: 60,
                  display: "block",
                  marginTop: 8,
                }}
              />

              <Box sx={{ mt: 1 }}>
                {mfs.map((mf: any, i: number) => (
                  <Box
                    key={i}
                    sx={{
                      mb: 1,
                      p: 1,
                      borderRadius: 1,
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography variant="body2">{mf.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        type: {mf.type}
                      </Typography>
                    </Stack>

                    <Box sx={{ mt: 1 }}>
                      {mf.params.map((p: number, pi: number) => (
                        <Box key={pi} sx={{ mb: 1 }}>
                          <Stack
                            direction="row"
                            spacing={2}
                            alignItems="center"
                          >
                            <Tooltip title={`Parameter ${pi} of ${mf.name}`}>
                              <Typography variant="caption">p{pi}</Typography>
                            </Tooltip>
                            <Slider
                              value={p}
                              min={paramRanges[group].min}
                              max={paramRanges[group].max}
                              step={paramRanges[group].step}
                              onChange={(_, v) =>
                                updateParam(
                                  group,
                                  i,
                                  pi,
                                  Array.isArray(v) ? v[0] : v
                                )
                              }
                              sx={{ flex: 1 }}
                            />
                            <Typography
                              variant="caption"
                              sx={{ width: 60, textAlign: "right" }}
                            >
                              {typeof p === "number"
                                ? p.toFixed(group === "Brake" ? 2 : 1)
                                : p}
                            </Typography>
                          </Stack>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              variant="contained"
              onClick={() => {
                apply();
                setApplied(true);
                setTimeout(() => setApplied(false), 1400);
              }}
            >
              Apply
            </Button>
            <Button variant="outlined" onClick={reset}>
              Reset
            </Button>
            <Button variant="text" onClick={presetBeginner}>
              Beginner
            </Button>
            <Button variant="text" onClick={presetIntermediate}>
              Intermediate
            </Button>
            <Button variant="text" onClick={presetAdvanced}>
              Advanced
            </Button>
            {applied && (
              <Typography variant="caption" sx={{ alignSelf: "center" }}>
                Applied ✓
              </Typography>
            )}
          </Stack>
        </Box>

        <Box sx={{ flex: "0 0 35%" }}>
          <Box
            sx={{ p: 1, border: "1px solid rgba(0,0,0,0.06)", borderRadius: 1 }}
          >
            <Typography variant="subtitle2">Live Preview</Typography>
            <Typography variant="caption" color="text.secondary">
              Adjust sample inputs to see the controller output
            </Typography>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption">
                Speed: {sampleSpeed.toFixed(1)} m/s
              </Typography>
              <Slider
                value={sampleSpeed}
                min={0}
                max={12}
                step={0.1}
                onChange={(_, v) => setSampleSpeed(Array.isArray(v) ? v[0] : v)}
              />

              <Typography variant="caption">
                Distance: {sampleDistance.toFixed(1)} m
              </Typography>
              <Slider
                value={sampleDistance}
                min={0}
                max={40}
                step={0.1}
                onChange={(_, v) =>
                  setSampleDistance(Array.isArray(v) ? v[0] : v)
                }
              />

              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  Brake Output: {(brakePreview * 100).toFixed(0)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, Math.max(0, brakePreview * 100))}
                  sx={{ height: 12, borderRadius: 1, mt: 1 }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
