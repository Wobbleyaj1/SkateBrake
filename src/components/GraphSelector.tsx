import { Box, FormControlLabel, Checkbox } from "@mui/material";

type Props = {
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
