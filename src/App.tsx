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
  Snackbar,
  Alert,
  Select,
  MenuItem,
} from "@mui/material";

import SimulationCanvas from "./components/SimulationCanvas";
import ControlsPanel from "./components/ControlsPanel";
import FuzzyTuner from "./components/FuzzyTuner";
import GraphSelector from "./components/GraphSelector";
import TimeSeriesChart from "./components/TimeSeriesChart";
import { createDefaultState, startLoop, stopLoop } from "./physics/engine";
import type { SimulationState, StopReason } from "./physics/engine";
import {
  getBrakePercent,
  getDefaultMFs,
  setMemberships,
} from "./fuzzy/controller";
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
  const [, setStopReason] = useState<StopReason | null>(null);
  // selected skill mode for UI (Beginner | Intermediate | Advanced | Custom)
  const [skillMode, setSkillMode] = useState<
    "Beginner" | "Intermediate" | "Advanced" | "Custom"
  >("Intermediate");

  // Graph visibility — defaults: Velocity, Acceleration, Brake, Distance ON
  const [showVelocity, setShowVelocity] = useState(true);
  const [showAcceleration, setShowAcceleration] = useState(true);
  const [showBrake, setShowBrake] = useState(true);
  const [showDistance, setShowDistance] = useState(true);

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
    // set initial controller mode to Intermediate presets so UI and behavior match
    // Intermediate preset: Brake and Distance tuned to intermediate values
    // (duplicate of FuzzyTuner.presetIntermediate values)
    try {
      const defaults = getDefaultMFs();
      const intermediate = {
        Speed: defaults.Speed,
        Distance: [
          { name: "Close", type: "tri", params: [0, 0, 5] },
          { name: "Medium", type: "tri", params: [3, 9, 15] },
          { name: "Far", type: "tri", params: [12, 20, 30] },
        ],
        Brake: [
          { name: "Soft", type: "tri", params: [0, 0, 0.28] },
          { name: "Moderate", type: "tri", params: [0.12, 0.4, 0.7] },
          { name: "Hard", type: "tri", params: [0.45, 0.8, 1] },
        ],
      };
      setMemberships(intermediate);
    } catch (e) {
      // ignore failures during initial mount
      // eslint-disable-next-line no-console
      console.warn("Failed to set intermediate preset on mount", e);
    }
    // set document title to include default mode
    document.title = `Braking Simulation — ${skillMode}`;
  }, []); // run once

  // apply a preset (also used by the titlebar dropdown)
  function applyPreset(mode: "Beginner" | "Intermediate" | "Advanced") {
    // use the same presets as the tuner: derive from defaults and tweak
    const defaults = getDefaultMFs() as any;
    const copy = JSON.parse(JSON.stringify(defaults));
    if (mode === "Beginner") {
      copy.Brake = [
        { name: "Soft", type: "tri", params: [0, 0, 0.3] },
        { name: "Moderate", type: "tri", params: [0.15, 0.35, 0.6] },
        { name: "Hard", type: "tri", params: [0.4, 0.65, 0.85] },
      ];
      copy.Distance = [
        { name: "Close", type: "tri", params: [0, 0, 8] },
        { name: "Medium", type: "tri", params: [6, 12, 18] },
        { name: "Far", type: "tri", params: [15, 28, 40] },
      ];
      // eject threshold recommendation
      setEjectAccelThreshold(4);
    } else if (mode === "Intermediate") {
      copy.Brake = [
        { name: "Soft", type: "tri", params: [0, 0, 0.28] },
        { name: "Moderate", type: "tri", params: [0.12, 0.4, 0.7] },
        { name: "Hard", type: "tri", params: [0.45, 0.8, 1] },
      ];
      copy.Distance = [
        { name: "Close", type: "tri", params: [0, 0, 5] },
        { name: "Medium", type: "tri", params: [3, 9, 15] },
        { name: "Far", type: "tri", params: [12, 20, 30] },
      ];
      setEjectAccelThreshold(7.5);
    } else if (mode === "Advanced") {
      copy.Brake = [
        { name: "Soft", type: "tri", params: [0, 0, 0.2] },
        { name: "Moderate", type: "tri", params: [0.15, 0.45, 0.75] },
        { name: "Hard", type: "tri", params: [0.6, 0.95, 1] },
      ];
      copy.Distance = [
        { name: "Close", type: "tri", params: [0, 0, 3] },
        { name: "Medium", type: "tri", params: [2.5, 8, 14] },
        { name: "Far", type: "tri", params: [10, 20, 35] },
      ];
      setEjectAccelThreshold(11);
    }

    // commit presets immediately
    setMemberships(copy);
    setSkillMode(mode);
    document.title = `Braking Simulation — ${mode}`;
  }

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
    ejectAccelThreshold,
  ]);

  // snackbar close handler (do not clear logs/stopDetails)
  const handleSnackbarClose = (_: unknown, reason?: string) => {
    // ignore clickaway events (clicks on the screen) to avoid accidental dismissals
    if (reason === "clickaway") return;
    // Mark that the user explicitly dismissed the stop snackbar. This prevents
    // less-severe stop events emitted shortly after from reopening a new
    // snackbar (avoids the "came to rest" popping up under "hit obstacle").
    setStopFinalized(true);
    // intentionally do NOT clear logs or other simulation data here
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
      // clear any dismissal/internal stop suppression when starting a new run
      setStopFinalized(false);
      setLastShownPriority(0);
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
          // centralized stop handler to avoid races
          handleStop(reason);
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
    // reset suppression state when resetting the simulation
    setStopFinalized(false);
    setLastShownPriority(0);
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

  // Intentionally no-op: hiding the snackbar should not clear logs or reset data.

  // allow backdrop click / escape to close the dialog; the dismiss handler
  // must not clear logs or graphs.

  // snackbar Reset action removed; no handler required

  // Chart data
  const chartData = loggerRef.current.getAll().map((d) => ({
    // keep time as a number so chart interpolation/smoothing works correctly
    t: d.t,
    x: d.x,
    v: d.v,
    a: d.a,
    brake: d.brake * 100,
    distance: d.distance,
  }));

  // prefer obstacle/eject over rest when displaying the stop snackbar

  // visible snackbar reason state — once set to a severe reason it won't be
  // downgraded by subsequent less-severe reasons. This prevents both 'rest'
  // and 'obstacle' from appearing stacked when they occur in quick succession.
  const [visibleStop, setVisibleStop] = useState<StopReason | null>(null);
  // When the user dismisses the snackbar we want to ignore lower-priority
  // stop events that might arrive immediately afterwards. Track whether the
  // user has finalized (dismissed) the current stop and the priority of the
  // last shown reason.
  const [stopFinalized, setStopFinalized] = useState(false);
  const [lastShownPriority, setLastShownPriority] = useState(0);

  function priorityOf(r: StopReason) {
    return r === "eject" ? 3 : r === "obstacle" ? 2 : 1;
  }

  // Centralized stop handler — call this when the engine indicates the sim stopped.
  // It sets both the internal stopReason (for state/inspection) and visibleStop
  // using a priority rule so only the most relevant snackbar is shown. If the
  // user manually dismissed the snackbar, ignore subsequent less-severe events
  // until a new run/reset.
  function handleStop(reason: StopReason) {
    const p = priorityOf(reason);
    if (stopFinalized && p <= lastShownPriority) {
      // still record the raw stop reason for inspection, but don't trigger UI
      setStopReason(reason);
      return;
    }

    setStopReason(reason);
    setVisibleStop((prevVisible) => {
      // priority: eject > obstacle > rest
      let newVisible: StopReason | null = prevVisible;
      if (prevVisible === "eject") newVisible = prevVisible;
      else if (reason === "eject") newVisible = "eject";
      else if (prevVisible === "obstacle") newVisible = prevVisible;
      else if (reason === "obstacle") newVisible = "obstacle";
      else if (!prevVisible) newVisible = "rest";

      if (newVisible) {
        setLastShownPriority(priorityOf(newVisible));
        setStopFinalized(false);
      }

      return newVisible;
    });
  }

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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              position: "relative",
            }}
          >
            <Box sx={{ flex: 1, display: "flex", alignItems: "center" }}>
              <Typography variant="h6" sx={{ color: "#fff" }}>
                Fuzzy Skateboard Braking Simulation
              </Typography>
            </Box>

            {/* center the mode dropdown visually in the title bar */}
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <Select
                value={skillMode}
                onChange={(e) => {
                  const val = e.target.value as
                    | "Beginner"
                    | "Intermediate"
                    | "Advanced"
                    | "Custom";
                  if (val === "Custom") {
                    setSkillMode("Custom");
                    document.title = `Braking Simulation — Custom`;
                  } else {
                    applyPreset(val);
                  }
                }}
                sx={{
                  backgroundColor: "#fff",
                  borderRadius: 1,
                  minWidth: 160,
                  color: "rgba(0,0,0,0.87)",
                }}
              >
                <MenuItem value="Beginner">Beginner</MenuItem>
                <MenuItem value="Intermediate">Intermediate</MenuItem>
                <MenuItem value="Advanced">Advanced</MenuItem>
                <MenuItem value="Custom">Custom</MenuItem>
              </Select>
            </Box>
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
                  showVelocity={showVelocity}
                  setShowVelocity={setShowVelocity}
                  showAcceleration={showAcceleration}
                  setShowAcceleration={setShowAcceleration}
                  showBrake={showBrake}
                  setShowBrake={setShowBrake}
                  showDistance={showDistance}
                  setShowDistance={setShowDistance}
                />
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
              mode={skillMode}
            />
          </Paper>
        )}

        {tabIndex === 2 && (
          <Paper sx={{ p: 1 }}>
            <FuzzyTuner mode={skillMode} onModeChange={setSkillMode} />
          </Paper>
        )}
      </Box>
      {/* Stop reason toast (non-modal) */}
      <Snackbar
        open={!!visibleStop}
        onClose={(event?: React.SyntheticEvent | Event, reason?: string) => {
          // hide visibleStop when user dismisses; do not clear logs or stop details
          handleSnackbarClose(event, reason);
          setVisibleStop(null);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={(event?: React.SyntheticEvent | Event, reason?: string) => {
            handleSnackbarClose(event, reason);
            setVisibleStop(null);
          }}
          severity={
            visibleStop === "eject"
              ? "error"
              : visibleStop === "obstacle"
              ? "warning"
              : "info"
          }
          sx={{ width: "100%" }}
        >
          {visibleStop === "eject" && stateRef.current?.stopDetails
            ? `Decel: ${stateRef.current.stopDetails.decel.toFixed(
                2
              )} m/s² — threshold ${stateRef.current.stopDetails.decelThreshold.toFixed(
                2
              )} m/s²`
            : visibleStop === "obstacle"
            ? "The board hit the obstacle."
            : "The board has come to rest."}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
