import {
  Box,
  Slider,
  Typography,
  Divider,
} from "@mui/material";

type Props = {
  mass: number;
  setMass: (v: number) => void;
  initialSpeed: number;
  setInitialSpeed: (v: number) => void;
  obstaclePosition: number;
  setObstaclePosition: (v: number) => void;
  mu: number;
  setMu: (v: number) => void;
  inclineDeg: number;
  setInclineDeg: (v: number) => void;
  rollingResistance: number;
  setRollingResistance: (v: number) => void;
  timeScale: number;
  setTimeScale: (v: number) => void;
};

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <Box sx={{ my: 1 }}>
      <Typography variant="caption">
        {label}: <strong>{format ? format(value) : value}</strong>
      </Typography>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step ?? (max - min) / 100}
        onChange={(_, v) => onChange(Array.isArray(v) ? v[0] : v)}
        valueLabelDisplay="auto"
      />
    </Box>
  );
}

export default function ControlsPanel(props: Props) {
  const {
    mass,
    setMass,
    initialSpeed,
    setInitialSpeed,
    obstaclePosition,
    setObstaclePosition,
    mu,
    setMu,
    inclineDeg,
    setInclineDeg,
    rollingResistance,
    setRollingResistance,
    timeScale,
    setTimeScale,
  } = props;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Simulation Controls
      </Typography>
      <LabeledSlider
        label="Mass (kg)"
        value={mass}
        min={30}
        max={120}
        step={1}
        onChange={setMass}
      />
      <LabeledSlider
        label="Initial Speed (m/s)"
        value={initialSpeed}
        min={0}
        max={12}
        step={0.1}
        onChange={setInitialSpeed}
      />
      <LabeledSlider
        label="Obstacle Position (m)"
        value={obstaclePosition}
        min={5}
        max={50}
        step={0.5}
        onChange={setObstaclePosition}
      />
      <LabeledSlider
        label="Friction Coefficient (μ)"
        value={mu}
        min={0.1}
        max={1.2}
        step={0.01}
        onChange={setMu}
      />
      <LabeledSlider
        label="Incline (degrees)"
        value={inclineDeg}
        min={-20}
        max={20}
        step={0.1}
        onChange={setInclineDeg}
      />
      <LabeledSlider
        label="Rolling Resistance"
        value={rollingResistance}
        min={0}
        max={0.1}
        step={0.001}
        onChange={setRollingResistance}
        format={(v) => v.toFixed(3)}
      />
      <LabeledSlider
        label="Time Scale"
        value={timeScale}
        min={0.1}
        max={3}
        step={0.1}
        onChange={setTimeScale}
      />

      <Divider sx={{ my: 1 }} />

      <Typography variant="caption" color="text.secondary">
        Tip: Use the Simulation tab to start/pause/reset the simulation, then toggle graphs here to visualize results. Use
        the Fuzzy Tuner panel to adjust membership functions if desired.
      </Typography>
    </Box>
  );
}
