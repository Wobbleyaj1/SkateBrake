import { Box, FormControlLabel, Checkbox, Typography } from "@mui/material";

type Props = {
  showPosition: boolean;
  setShowPosition: (v: boolean) => void;
  showVelocity: boolean;
  setShowVelocity: (v: boolean) => void;
  showAcceleration: boolean;
  setShowAcceleration: (v: boolean) => void;
  showBrake: boolean;
  setShowBrake: (v: boolean) => void;
  showDistance: boolean;
  setShowDistance: (v: boolean) => void;
};

export default function GraphSelector(props: Props) {
  return (
    <Box>
      <Typography variant="subtitle1">Graphs (default: OFF)</Typography>
      <FormControlLabel
        control={
          <Checkbox
            checked={props.showPosition}
            onChange={(e) => props.setShowPosition(e.target.checked)}
          />
        }
        label="Position (m)"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={props.showVelocity}
            onChange={(e) => props.setShowVelocity(e.target.checked)}
          />
        }
        label="Velocity (m/s)"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={props.showAcceleration}
            onChange={(e) => props.setShowAcceleration(e.target.checked)}
          />
        }
        label="Acceleration (m/s²)"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={props.showBrake}
            onChange={(e) => props.setShowBrake(e.target.checked)}
          />
        }
        label="Brake (%)"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={props.showDistance}
            onChange={(e) => props.setShowDistance(e.target.checked)}
          />
        }
        label="Distance (m)"
      />
    </Box>
  );
}
