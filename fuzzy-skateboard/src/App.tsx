import { useEffect, useRef, useState } from "react";
import {
  Box,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Grid,
  Paper,
} from "@mui/material";
import SimulationCanvas from "./components/SimulationCanvas";
import ControlsPanel from "./components/ControlsPanel";
import FuzzyTuner from "./components/FuzzyTuner";
import GraphSelector from "./components/GraphSelector";
import TimeSeriesChart from "./components/TimeSeriesChart";
import { createDefaultState, startLoop, stopLoop } from "./physics/engine";
import type { SimulationState } from "./physics/engine";
import { getBrakePercent } from "./fuzzy/controller";
import { Logger } from "./utils/logger";

function App() {
  // Simulation parameters (editable by ControlsPanel)
  const [mass, setMass] = useState(70); // kg
  const [initialSpeed, setInitialSpeed] = useState(6); // m/s
  const [obstaclePosition, setObstaclePosition] = useState(20); // m
  const [mu, setMu] = useState(0.7); // friction coefficient
  const [inclineDeg, setInclineDeg] = useState(0); // degrees
  const [rollingResistance, setRollingResistance] = useState(0.01); // c_roll
  const [timeScale, setTimeScale] = useState(1); // speed multiplier
  const [simRunning, setSimRunning] = useState(false);

  // Which graphs to display (GraphSelector)
  const [showPosition, setShowPosition] = useState(false);
  const [showVelocity, setShowVelocity] = useState(false);
  const [showAcceleration, setShowAcceleration] = useState(false);
  const [showBrake, setShowBrake] = useState(false);
  const [showDistance, setShowDistance] = useState(false);

  // Fuzzy tuner state will be provided to FuzzyTuner via import-defined defaults in controller.
  const loggerRef = useRef(new Logger(10000));
  const stateRef = useRef<SimulationState>(createDefaultState());
  const rafRef = useRef<number | null>(null);

  // UI-visible sampled data frequency (throttle UI updates)
  const [uiTick, setUiTick] = useState(0);

  // On mount: initialize simulation state
  useEffect(() => {
    const s = createDefaultState();
    s.mass = mass;
    s.v = initialSpeed;
    s.x = 0;
    s.obstaclePosition = obstaclePosition;
    s.mu = mu;
    s.theta = (inclineDeg * Math.PI) / 180;
    s.c_roll = rollingResistance;
    stateRef.current = s;
    loggerRef.current.clear();
    // make one log entry
    loggerRef.current.push({
      t: 0,
      x: s.x,
      v: s.v,
      a: 0,
      brake: 0,
      distance: Math.max(0, s.obstaclePosition - s.x),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // When parameters change (but not while running), update state (use Reset to apply when running)
  useEffect(() => {
    if (!simRunning) {
      stateRef.current.mass = mass;
      stateRef.current.v = initialSpeed;
      stateRef.current.obstaclePosition = obstaclePosition;
      stateRef.current.mu = mu;
      stateRef.current.theta = (inclineDeg * Math.PI) / 180;
      stateRef.current.c_roll = rollingResistance;
      stateRef.current.x = 0;
      stateRef.current.t = 0;
      loggerRef.current.clear();
    }
  }, [
    mass,
    initialSpeed,
    obstaclePosition,
    mu,
    inclineDeg,
    rollingResistance,
    simRunning,
  ]);

  // Physics loop callback - runs every physics step inside engine
  const onPhysicsStep = (s: SimulationState) => {
    // Apply fuzzy controller: inputs are speed (magnitude) and distance
    const distance = Math.max(0, s.obstaclePosition - s.x);
    const speedForController = Math.max(0, s.v);
    const brakePercent = getBrakePercent(speedForController, distance); // 0..1

    // store brake in state and compute F_brake inside engine.step as needed
    s.lastBrakePercent = brakePercent;

    // log the sample
    loggerRef.current.push({
      t: s.t,
      x: s.x,
      v: s.v,
      a: s.a,
      brake: brakePercent,
      distance,
    });

    // throttle UI re-renders: bump a tiny state every 100ms approx.
    // (we don't re-render on every physics step)
  };

  // start/pause/resume/reset controls
  const handleStart = () => {
    if (!simRunning) {
      // ensure state has current params before starting
      const s = stateRef.current;
      s.mass = mass;
      s.v = initialSpeed;
      s.x = 0;
      s.t = 0;
      s.obstaclePosition = obstaclePosition;
      s.mu = mu;
      s.theta = (inclineDeg * Math.PI) / 180;
      s.c_roll = rollingResistance;
      loggerRef.current.clear();
      setSimRunning(true);
      // start loop
      startLoop({
        stateRef,
        onStep: onPhysicsStep,
        timeScale,
        uiCallback: () => setUiTick((t) => t + 1),
        rafRef,
      });
    }
  };

  const handlePause = () => {
    if (simRunning) {
      stopLoop(rafRef);
      setSimRunning(false);
    }
  };

  const handleReset = () => {
    stopLoop(rafRef);
    const s = createDefaultState();
    s.mass = mass;
    s.v = initialSpeed;
    s.x = 0;
    s.obstaclePosition = obstaclePosition;
    s.mu = mu;
    s.theta = (inclineDeg * Math.PI) / 180;
    s.c_roll = rollingResistance;
    stateRef.current = s;
    loggerRef.current.clear();
    loggerRef.current.push({
      t: 0,
      x: s.x,
      v: s.v,
      a: 0,
      brake: 0,
      distance: Math.max(0, s.obstaclePosition - s.x),
    });
    setSimRunning(false);
    setUiTick((t) => t + 1);
  };

  // Expose a function to export CSV from logger
  const handleExportCSV = () => {
    const csv = loggerRef.current.toCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "simulation_log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Data for charts are derived from logger; memoization is not necessary for clarity
  const chartData = loggerRef.current.getAll().map((d) => ({
    t: d.t.toFixed(3),
    x: d.x,
    v: d.v,
    a: d.a,
    brake: d.brake * 100, // percent
    distance: d.distance,
  }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">Fuzzy Skateboard Braking — Demo</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, flex: 1, overflow: "auto" }}>
        <Grid container spacing={2}>
          <Grid>
            <Paper sx={{ p: 1, height: "80vh" }}>
              <SimulationCanvas
                stateRef={stateRef}
                width={900}
                height={500}
                uiTick={uiTick}
                showDebug
              />
            </Paper>
          </Grid>

          <Grid>
            <Paper sx={{ p: 1, mb: 2 }}>
              <ControlsPanel
                mass={mass}
                setMass={setMass}
                initialSpeed={initialSpeed}
                setInitialSpeed={setInitialSpeed}
                obstaclePosition={obstaclePosition}
                setObstaclePosition={setObstaclePosition}
                mu={mu}
                setMu={setMu}
                inclineDeg={inclineDeg}
                setInclineDeg={setInclineDeg}
                rollingResistance={rollingResistance}
                setRollingResistance={setRollingResistance}
                timeScale={timeScale}
                setTimeScale={setTimeScale}
                onStart={handleStart}
                onPause={handlePause}
                onReset={handleReset}
                onExport={handleExportCSV}
                running={simRunning}
              />
            </Paper>

            <Paper sx={{ p: 1, mb: 2 }}>
              <FuzzyTuner />
            </Paper>

            <Paper sx={{ p: 1, mb: 2 }}>
              <GraphSelector
                showPosition={showPosition}
                setShowPosition={setShowPosition}
                showVelocity={showVelocity}
                setShowVelocity={setShowVelocity}
                showAcceleration={showAcceleration}
                setShowAcceleration={setShowAcceleration}
                showBrake={showBrake}
                setShowBrake={setShowBrake}
                showDistance={showDistance}
                setShowDistance={setShowDistance}
              />
            </Paper>

            <Paper sx={{ p: 1 }}>
              {/* charts: render only selected charts */}
              {showPosition && (
                <TimeSeriesChart
                  data={chartData}
                  dataKey="x"
                  name="Position (m)"
                />
              )}
              {showVelocity && (
                <TimeSeriesChart
                  data={chartData}
                  dataKey="v"
                  name="Velocity (m/s)"
                />
              )}
              {showAcceleration && (
                <TimeSeriesChart
                  data={chartData}
                  dataKey="a"
                  name="Acceleration (m/s²)"
                />
              )}
              {showBrake && (
                <TimeSeriesChart
                  data={chartData}
                  dataKey="brake"
                  name="Brake (%)"
                />
              )}
              {showDistance && (
                <TimeSeriesChart
                  data={chartData}
                  dataKey="distance"
                  name="Distance (m)"
                />
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default App;
