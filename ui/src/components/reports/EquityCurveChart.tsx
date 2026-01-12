import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Trade } from '@/types/trading';

interface EquityCurveChartProps {
  trades: Trade[];
  isLoading?: boolean;
}

interface EquityDataPoint {
  date: string;
  equity: number;
  trades: number;
}

export function EquityCurveChart({ trades, isLoading }: EquityCurveChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Equity Curve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-secondary animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const processEquityData = (): EquityDataPoint[] => {
    const closedTrades = trades.filter(t => t.exit_time && t.pnl);
    
    if (closedTrades.length === 0) return [];

    // Sort trades by exit time
    const sortedTrades = [...closedTrades].sort((a, b) => 
      new Date(a.exit_time!).getTime() - new Date(b.exit_time!).getTime()
    );

    // Calculate cumulative equity (starting from 0)
    let cumulativeEquity = 0;
    const equityData: EquityDataPoint[] = [];

    sortedTrades.forEach((trade, index) => {
      const pnl = parseFloat(trade.pnl!);
      cumulativeEquity += pnl;
      
      equityData.push({
        date: new Date(trade.exit_time!).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        equity: Math.round(cumulativeEquity * 100) / 100,
        trades: index + 1,
      });
    });

    return equityData;
  };

  const chartData = processEquityData();

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Equity Curve</CardTitle>
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
          <p className="font-semibold mb-2">{data.date}</p>
          <div className="space-y-1 text-sm">
            <p className={`font-semibold ${data.equity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Equity: ${data.equity.toFixed(2)}
            </p>
            <p className="text-muted-foreground">Trade #{data.trades}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const finalEquity = chartData[chartData.length - 1]?.equity || 0;
  const maxEquity = Math.max(...chartData.map(d => d.equity), 0);
  const minEquity = Math.min(...chartData.map(d => d.equity), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Equity Curve</CardTitle>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Current Equity</p>
            <p className={`text-2xl font-bold ${finalEquity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${finalEquity.toFixed(2)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeOpacity={0.5} />
            <Line
              type="monotone"
              dataKey="equity"
              stroke={finalEquity >= 0 ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)"}
              strokeWidth={3}
              dot={{ r: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div>
            <span className="text-muted-foreground">Peak: </span>
            <span className="font-semibold text-green-600">${maxEquity.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Drawdown: </span>
            <span className="font-semibold text-red-600">${Math.abs(minEquity).toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

