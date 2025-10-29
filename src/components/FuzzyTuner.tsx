import { useState } from "react";
import { Box, Typography, Button, Grid, TextField } from "@mui/material";
import { getDefaultMFs, setMemberships } from "../fuzzy/controller";

/**
 * Simple UI to show and adjust membership function parameters.
 * The underlying fuzzy controller exposes helpers to get and set the MFs.
 * Adjustments are applied globally via setMemberships (mutates controller defaults).
 *
 * Note: For an actual persistent UI you'd want to store MF values in React state or in context,
 * and update the controller functions immutably. For brevity and clarity we mutate via API.
 */

export default function FuzzyTuner() {
  // get default MFs from controller module
  const defaults = getDefaultMFs();
  const [local, setLocal] = useState(defaults);

  const handleChange = (
    group: string,
    idx: number,
    paramIdx: number,
    value: number
  ) => {
    const copy = JSON.parse(JSON.stringify(local));
    copy[group][idx].params[paramIdx] = value;
    setLocal(copy);
  };

  const apply = () => {
    setMemberships(local);
  };

  const reset = () => {
    const d = getDefaultMFs();
    setLocal(d);
    setMemberships(d);
  };

  return (
    <Box>
      <Typography variant="subtitle1">Fuzzy Membership Tuner</Typography>
      <Typography variant="caption" color="text.secondary">
        Adjust triangular MF parameters (quick tuning).
      </Typography>

      {Object.entries(local).map(([group, mfs]: any) => (
        <Box key={group} sx={{ mt: 1 }}>
          <Typography variant="body2">{group}</Typography>
          <Grid container spacing={1}>
            {mfs.map((mf: any, i: number) => (
              <Grid key={i}>
                <Typography variant="caption">{mf.name}</Typography>
                <Grid container spacing={1}>
                  {mf.params.map((p: number, pi: number) => (
                    <Grid key={pi}>
                      <TextField
                        size="small"
                        label={`p${pi}`}
                        value={p}
                        onChange={(e) =>
                          handleChange(group, i, pi, Number(e.target.value))
                        }
                        type="number"
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}

      <Box sx={{ mt: 1 }}>
        <Button variant="outlined" onClick={apply} sx={{ mr: 1 }}>
          Apply
        </Button>
        <Button variant="text" onClick={reset}>
          Reset
        </Button>
      </Box>
    </Box>
  );
}
