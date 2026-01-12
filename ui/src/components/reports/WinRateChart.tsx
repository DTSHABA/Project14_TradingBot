import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Trade } from '@/types/trading';

interface WinRateChartProps {
  trades: Trade[];
  isLoading?: boolean;
}

interface WinRateDataPoint {
  period: string;
  winRate: number;
  wins: number;
  losses: number;
  total: number;
}

export function WinRateChart({ trades, isLoading }: WinRateChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Win Rate Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-secondary animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const processWinRateData = (): WinRateDataPoint[] => {
    const closedTrades = trades.filter(t => t.exit_time && t.pnl);
    
    if (closedTrades.length === 0) return [];

    // Group trades by date
    const dailyStats = new Map<string, { wins: number; losses: number }>();
    
    closedTrades.forEach(trade => {
      const date = new Date(trade.exit_time!).toLocaleDateString();
      const pnl = parseFloat(trade.pnl!);
      const isWin = pnl > 0;
      
      const stats = dailyStats.get(date) || { wins: 0, losses: 0 };
      if (isWin) {
        stats.wins++;
      } else {
        stats.losses++;
      }
      dailyStats.set(date, stats);
    });

    // Convert to array with win rate calculation
    const sortedDates = Array.from(dailyStats.keys()).sort((a, b) => 
      new Date(a).getTime() - new Date(b).getTime()
    );

    return sortedDates.map(date => {
      const stats = dailyStats.get(date)!;
      const total = stats.wins + stats.losses;
      const winRate = total > 0 ? (stats.wins / total) * 100 : 0;
      
      return {
        period: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
        wins: stats.wins,
        losses: stats.losses,
        total,
      };
    });
  };

  const chartData = processWinRateData();

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Win Rate Trend</CardTitle>
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
          <p className="font-semibold mb-2">{data.period}</p>
          <div className="space-y-1 text-sm">
            <p className="text-green-600">Wins: {data.wins}</p>
            <p className="text-red-600">Losses: {data.losses}</p>
            <p className="font-semibold">Win Rate: {data.winRate.toFixed(1)}%</p>
            <p className="text-muted-foreground">Total: {data.total} trades</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Calculate overall win rate
  const totalWins = chartData.reduce((sum, day) => sum + day.wins, 0);
  const totalTrades = chartData.reduce((sum, day) => sum + day.total, 0);
  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Win Rate Trend</CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Overall</p>
            <p className={`text-2xl font-bold ${overallWinRate >= 50 ? 'text-green-600' : 'text-red-600'}`}>
              {overallWinRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorWinRate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="period" 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            {/* Reference line at 50% */}
            <line 
              x1="0" 
              y1="50%" 
              x2="100%" 
              y2="50%" 
              stroke="hsl(var(--muted-foreground))" 
              strokeDasharray="5 5" 
              strokeOpacity={0.5}
            />
            <Area
              type="monotone"
              dataKey="winRate"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              fill="url(#colorWinRate)"
              dot={{ r: 4, fill: 'hsl(142, 76%, 36%)' }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-8 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Win Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-muted-foreground/50" style={{ borderTop: '2px dashed' }} />
            <span className="text-muted-foreground">50% Baseline</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

