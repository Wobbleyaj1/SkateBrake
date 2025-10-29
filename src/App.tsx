import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";

import SimulationCanvas from "./components/SimulationCanvas";
import ControlsPanel from "./components/ControlsPanel";
import FuzzyTuner from "./components/FuzzyTuner";
import GraphSelector from "./components/GraphSelector";
import TimeSeriesChart from "./components/TimeSeriesChart";
import { createDefaultState, startLoop, stopLoop } from "./physics/engine";
import type { SimulationState, StopReason } from "./physics/engine";
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
  const [ejectAccelThreshold, setEjectAccelThreshold] = useState(8);
  // last reason the sim ended (rest | obstacle | eject)
  const [stopReason, setStopReason] = useState<StopReason | null>(null);

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
    s.theta = -(inclineDeg * Math.PI) / 180;
    s.c_roll = rollingResistance;
    s.ejectAccelThreshold = ejectAccelThreshold;
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
      stateRef.current.theta = -(inclineDeg * Math.PI) / 180;
      stateRef.current.c_roll = rollingResistance;
      stateRef.current.x = 0;
      stateRef.current.t = 0;
      stateRef.current.ejectAccelThreshold = ejectAccelThreshold;
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
    ejectAccelThreshold,
  ]);

  // snackbar close handler (do not clear logs/stopDetails)
  const handleSnackbarClose = (_: unknown, reason?: string) => {
    // ignore clickaway events (clicks on the screen) to avoid accidental dismissals
    if (reason === "clickaway") return;
    handleDialogDismiss();
  };

  // Physics step callback
  const onPhysicsStep = (s: SimulationState) => {
    const distance = Math.max(0, s.obstaclePosition - s.x);
    // use speed magnitude for controller input so braking decisions are
    // based on how fast the skateboard is moving, regardless of direction
    const speedForController = Math.abs(s.v);
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
      s.theta = -(inclineDeg * Math.PI) / 180;
      s.c_roll = rollingResistance;
      loggerRef.current.clear();
      setSimRunning(true);
      // clear previous stop reason/details
      setStopReason(null);
      stateRef.current.stopDetails = null;
      startLoop({
        stateRef,
        onStep: onPhysicsStep,
        timeScale,
        uiCallback: () => setUiTick((t) => t + 1),
        rafRef,
        onEnd: (reason) => {
          // update UI state when engine stops itself
          setSimRunning(false);
          setUiTick((t) => t + 1);
          setStopReason(reason);
        },
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
    // debug: log when reset is invoked to help trace unexpected resets
    // (user reported clicking on the screen triggers chart reset)
    // This will appear in the browser console when the handler runs.
    // Use console.log so it's visible even if debug-level logs are filtered.
    // eslint-disable-next-line no-console
    console.log("handleReset called", new Error().stack);
    const s = createDefaultState();
    s.mass = mass;
    s.v = initialSpeed;
    s.x = 0;
    s.obstaclePosition = obstaclePosition;
    s.mu = mu;
    s.theta = -(inclineDeg * Math.PI) / 180;
    s.c_roll = rollingResistance;
    // no geometry defaults here; engine defaults are used
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
    setStopReason(null);
    stateRef.current.stopDetails = null;
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

  const handleDialogDismiss = () => {
    // Only close the dialog. Do NOT clear stopDetails or logs here —
    // closing the dialog should not reset graphs or recorded data.
    // debug: log dialog dismiss
    // eslint-disable-next-line no-console
    console.log("handleDialogDismiss called");
    setStopReason(null);
  };

  // Global click logger (temporary) to help diagnose which element is receiving clicks
  // that might be triggering Reset or other side effects. Enabled only in dev.
  React.useEffect(() => {
    function onGlobalClick(e: MouseEvent) {
      // eslint-disable-next-line no-console
      console.log(
        "Global click target:",
        (e.target as Element)?.tagName,
        e.target
      );
    }
    window.addEventListener("click", onGlobalClick, true);
    return () => window.removeEventListener("click", onGlobalClick, true);
  }, []);

  // allow backdrop click / escape to close the dialog; the dismiss handler
  // must not clear logs or graphs.

  const handleDialogReset = () => {
    handleReset();
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
      }}
    >
      <CssBaseline />
      <AppBar position="static" sx={{ width: "100%" }}>
        <Toolbar>
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Typography variant="h6">
              Fuzzy Skateboard Braking — Demo
            </Typography>
            {stopReason && (
              <Typography variant="caption" component="div">
                {stopReason === "eject"
                  ? "Simulation stopped: rider ejected"
                  : stopReason === "obstacle"
                  ? "Simulation stopped: hit obstacle"
                  : "Simulation stopped: at rest"}
              </Typography>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Tabs value={tabIndex} onChange={handleTabChange} centered>
        <Tab label="Simulation" />
        <Tab label="Controls" />
        <Tab label="Fuzzy Tuner" />
      </Tabs>

      <Box sx={{ p: 2, flex: 1, overflow: "auto" }}>
        {tabIndex === 0 && (
          <Paper sx={{ p: 1, height: "80vh", width: "100%" }}>
            <Box sx={{ display: "flex", height: "100%" }}>
              {/* Left: Simulation (50%) */}
              <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>
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
              </Box>

              {/* Right: Graphs (50%) */}
              <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
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
              </Box>
            </Box>
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
              ejectAccelThreshold={ejectAccelThreshold}
              setEjectAccelThreshold={setEjectAccelThreshold}
            />
          </Paper>
        )}

        {tabIndex === 2 && (
          <Paper sx={{ p: 1 }}>
            <FuzzyTuner />
          </Paper>
        )}
      </Box>
      {/* Stop reason toast (non-modal) */}
      <Snackbar
        open={!!stopReason}
        autoHideDuration={8000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={
            stopReason === "eject"
              ? "error"
              : stopReason === "obstacle"
              ? "warning"
              : "info"
          }
          sx={{ width: "100%" }}
          action={
            <Button color="inherit" size="small" onClick={handleDialogReset}>
              Reset
            </Button>
          }
        >
          {stopReason === "eject" && stateRef.current?.stopDetails
            ? `Decel: ${stateRef.current.stopDetails.decel.toFixed(
                2
              )} m/s² — threshold ${stateRef.current.stopDetails.decelThreshold.toFixed(
                2
              )} m/s²`
            : stopReason === "obstacle"
            ? "The board hit the obstacle."
            : "The board has come to rest."}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
