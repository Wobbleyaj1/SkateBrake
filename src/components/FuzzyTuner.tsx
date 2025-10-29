import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Slider,
  Stack,
  LinearProgress,
  Tooltip,
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

export default function FuzzyTuner() {
  // fetch defaults from controller
  const defaults = getDefaultMFs() as MFs;
  const [local, setLocal] = useState<MFs>(defaults);

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
    setLocal((prev) => {
      const copy: any = JSON.parse(JSON.stringify(prev));
      copy[group][mfIdx].params[paramIdx] = v;
      return copy;
    });
  }

  function apply() {
    setMemberships(local);
  }

  function reset() {
    const d = getDefaultMFs() as MFs;
    setLocal(d);
    setMemberships(d);
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
  }

  const brakePreview = useMemo(() => {
    try {
      return computeBrakeWithMFs(local, sampleSpeed, sampleDistance);
    } catch (e) {
      return getBrakePercent(sampleSpeed, sampleDistance);
    }
  }, [sampleSpeed, sampleDistance, local]);

  const [applied, setApplied] = useState(false);

  return (
    <Box>
      <Typography variant="h6">Fuzzy Tuner</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Tweak membership functions for Speed, Distance and Brake. Use the live
        preview to see brake output for a sample speed & distance. Click Apply
        to make changes active.
      </Typography>

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
