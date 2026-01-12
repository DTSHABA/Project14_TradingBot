import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Trade } from '@/types/trading';

interface HoldTimeChartProps {
  trades: Trade[];
  isLoading?: boolean;
}

interface HoldTimeDataPoint {
  range: string;
  count: number;
  avgPnL: number;
  wins: number;
  losses: number;
}

export function HoldTimeChart({ trades, isLoading }: HoldTimeChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hold Time Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-secondary animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const processHoldTimeData = (): HoldTimeDataPoint[] => {
    const closedTrades = trades.filter(t => t.exit_time && t.hold_time_seconds && t.pnl);
    
    if (closedTrades.length === 0) return [];

    // Define time ranges in minutes
    const ranges = [
      { label: '0-5 min', min: 0, max: 5 },
      { label: '5-15 min', min: 5, max: 15 },
      { label: '15-30 min', min: 15, max: 30 },
      { label: '30-60 min', min: 30, max: 60 },
      { label: '1-2 hours', min: 60, max: 120 },
      { label: '2+ hours', min: 120, max: Infinity },
    ];

    const rangeData: { [key: string]: { count: number; totalPnL: number; wins: number; losses: number } } = {};
    
    ranges.forEach(range => {
      rangeData[range.label] = { count: 0, totalPnL: 0, wins: 0, losses: 0 };
    });

    // Categorize trades
    closedTrades.forEach(trade => {
      const minutes = (trade.hold_time_seconds || 0) / 60;
      const pnl = parseFloat(trade.pnl!);
      
      for (const range of ranges) {
        if (minutes >= range.min && minutes < range.max) {
          const data = rangeData[range.label];
          data.count++;
          data.totalPnL += pnl;
          if (pnl > 0) {
            data.wins++;
          } else {
            data.losses++;
          }
          break;
        }
      }
    });

    // Convert to array and calculate averages
    return ranges.map(range => {
      const data = rangeData[range.label];
      return {
        range: range.label,
        count: data.count,
        avgPnL: data.count > 0 ? data.totalPnL / data.count : 0,
        wins: data.wins,
        losses: data.losses,
      };
    }).filter(d => d.count > 0); // Only show ranges with trades
  };

  const chartData = processHoldTimeData();

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hold Time Analysis</CardTitle>
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
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{data.range}</p>
          <div className="space-y-1 text-sm">
            <p>Total Trades: {data.count}</p>
            <p className="text-green-600">Wins: {data.wins}</p>
            <p className="text-red-600">Losses: {data.losses}</p>
            <p className={`font-semibold ${data.avgPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Avg P&L: ${data.avgPnL.toFixed(2)}
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
        <CardTitle>Hold Time Analysis</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Trade performance by hold time duration
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="range" 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" name="Number of Trades">
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.avgPnL >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Profitable Range</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Unprofitable Range</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

