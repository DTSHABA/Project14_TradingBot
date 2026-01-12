import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Trade } from '@/types/trading';

interface PnLChartProps {
  trades: Trade[];
  isLoading?: boolean;
}

interface ChartDataPoint {
  date: string;
  pnl: number;
  cumulativePnL: number;
}

export function PnLChart({ trades, isLoading }: PnLChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>P&L Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-secondary animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  // Process trades into daily P&L data
  const processChartData = (): ChartDataPoint[] => {
    const closedTrades = trades.filter(t => t.exit_time && t.pnl);
    
    if (closedTrades.length === 0) return [];

    // Group trades by date
    const dailyPnL = new Map<string, number>();
    
    closedTrades.forEach(trade => {
      const date = new Date(trade.exit_time!).toLocaleDateString();
      const pnl = parseFloat(trade.pnl!);
      dailyPnL.set(date, (dailyPnL.get(date) || 0) + pnl);
    });

    // Convert to array and calculate cumulative P&L
    const sortedDates = Array.from(dailyPnL.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    let cumulative = 0;
    return sortedDates.map(date => {
      const pnl = dailyPnL.get(date) || 0;
      cumulative += pnl;
      return {
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pnl,
        cumulativePnL: cumulative,
      };
    });
  };

  const chartData = processChartData();

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>P&L Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            No closed trades to display
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1 text-sm">
            <p className={`${payload[0].value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Daily P&L: ${payload[0].value.toFixed(2)}
            </p>
            <p className={`${payload[1].value >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              Cumulative: ${payload[1].value.toFixed(2)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>P&L Trend Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
              style={{ color: '#e5e7eb' }}
            />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Daily P&L"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="cumulativePnL"
              stroke="hsl(217, 91%, 60%)"
              strokeWidth={2}
              name="Cumulative P&L"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

