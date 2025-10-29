import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Paper, Typography } from "@mui/material";

type DataPoint = { [key: string]: any };

export default function TimeSeriesChart({
  data,
  dataKey,
  name,
}: {
  data: DataPoint[];
  dataKey: string;
  name?: string;
}) {
  return (
    <Paper sx={{ height: 200, p: 1, mt: 1 }}>
      <Typography variant="subtitle2">{name}</Typography>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#1976d2"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </Paper>
  );
}
