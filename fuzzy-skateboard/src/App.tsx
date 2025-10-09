import { useEffect, useRef, useState } from "react";
import {
  Box,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
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
  // Simulation parameters
  const [mass, setMass] = useState(70);
  const [initialSpeed, setInitialSpeed] = useState(6);
  const [obstaclePosition, setObstaclePosition] = useState(20);
  const [mu, setMu] = useState(0.7);
  const [inclineDeg, setInclineDeg] = useState(0);
  const [rollingResistance, setRollingResistance] = useState(0.01);
  const [timeScale, setTimeScale] = useState(1);
  const [simRunning, setSimRunning] = useState(false);

  // Graph visibility
  const [showPosition, setShowPosition] = useState(false);
  const [showVelocity, setShowVelocity] = useState(false);
  const [showAcceleration, setShowAcceleration] = useState(false);
  const [showBrake, setShowBrake] = useState(false);
  const [showDistance, setShowDistance] = useState(false);

  // Logger and state refs
  const loggerRef = useRef(new Logger(10000));
  const stateRef = useRef<SimulationState>(createDefaultState());
  const rafRef = useRef<number | null>(null);

  // UI tick for throttled updates
  const [uiTick, setUiTick] = useState(0);

  // Tab index for UI
  const [tabIndex, setTabIndex] = useState(0);
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  // Initialize simulation state on mount
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
    loggerRef.current.push({
      t: 0,
      x: s.x,
      v: s.v,
      a: 0,
      brake: 0,
      distance: Math.max(0, s.obstaclePosition - s.x),
    });
  }, []); // run once

  // Update state when parameters change (if not running)
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

  // Physics step callback
  const onPhysicsStep = (s: SimulationState) => {
    const distance = Math.max(0, s.obstaclePosition - s.x);
    const speedForController = Math.max(0, s.v);
    const brakePercent = getBrakePercent(speedForController, distance);
    s.lastBrakePercent = brakePercent;

    loggerRef.current.push({
      t: s.t,
      x: s.x,
      v: s.v,
      a: s.a,
      brake: brakePercent,
      distance,
    });
  };

  // Start/pause/reset handlers
  const handleStart = () => {
    if (!simRunning) {
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

  // Export CSV
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

  // Chart data
  const chartData = loggerRef.current.getAll().map((d) => ({
    t: d.t.toFixed(3),
    x: d.x,
    v: d.v,
    a: d.a,
    brake: d.brake * 100,
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

      <Tabs value={tabIndex} onChange={handleTabChange} centered>
        <Tab label="Simulation" />
        <Tab label="Controls" />
        <Tab label="Fuzzy Tuner" />
        <Tab label="Graphs" />
      </Tabs>

      <Box sx={{ p: 2, flex: 1, overflow: "auto" }}>
        {tabIndex === 0 && (
          <Paper sx={{ p: 1, height: "80vh", width: "100%" }}>
            <SimulationCanvas 
              stateRef={stateRef} 
              uiTick={uiTick} 
              showDebug 
              onStart={handleStart}
              onPause={handlePause}
              onReset={handleReset}
              onExport={handleExportCSV}
              running={simRunning}
            />
          </Paper>
        )}

        {tabIndex === 1 && (
          <Paper sx={{ p: 1 }}>
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
            />
          </Paper>
        )}

        {tabIndex === 2 && (
          <Paper sx={{ p: 1 }}>
            <FuzzyTuner />
          </Paper>
        )}

        {tabIndex === 3 && (
          <Paper sx={{ p: 1 }}>
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
        )}
      </Box>
    </Box>
  );
}

export default App;
