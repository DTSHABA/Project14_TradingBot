import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import type { Trade } from '@/types/trading';

interface TradeDistributionChartProps {
  trades: Trade[];
  isLoading?: boolean;
}

interface HourDataPoint {
  hour: string;
  buy: number;
  sell: number;
  total: number;
}

export function TradeDistributionChart({ trades, isLoading }: TradeDistributionChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade Distribution by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-secondary animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  const processHourData = (): HourDataPoint[] => {
    const closedTrades = trades.filter(t => t.exit_time);
    
    if (closedTrades.length === 0) return [];

    // Initialize hours (0-23)
    const hourData: { [key: number]: { buy: number; sell: number } } = {};
    for (let i = 0; i < 24; i++) {
      hourData[i] = { buy: 0, sell: 0 };
    }

    // Count trades by hour
    closedTrades.forEach(trade => {
      const hour = new Date(trade.exit_time!).getHours();
      if (trade.direction === 'BUY') {
        hourData[hour].buy++;
      } else {
        hourData[hour].sell++;
      }
    });

    // Convert to array format
    return Object.entries(hourData).map(([hour, counts]) => ({
      hour: `${hour}:00`,
      buy: counts.buy,
      sell: counts.sell,
      total: counts.buy + counts.sell,
    }));
  };

  const chartData = processHourData();

  if (chartData.length === 0 || chartData.every(d => d.total === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade Distribution by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-muted-foreground">
            No trades to display
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{payload[0].payload.hour}</p>
          <div className="space-y-1 text-sm">
            <p className="text-green-600">Buy: {payload[0].payload.buy}</p>
            <p className="text-red-600">Sell: {payload[0].payload.sell}</p>
            <p className="font-semibold">Total: {payload[0].payload.total} trades</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const totalBuy = chartData.reduce((sum, d) => sum + d.buy, 0);
  const totalSell = chartData.reduce((sum, d) => sum + d.sell, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trade Distribution by Hour of Day</CardTitle>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Buy: </span>
              <span className="font-semibold text-green-600">{totalBuy}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sell: </span>
              <span className="font-semibold text-red-600">{totalSell}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="hour" 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: '#e5e7eb', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend style={{ color: '#e5e7eb' }} />
            <Bar dataKey="buy" fill="hsl(142, 76%, 36%)" name="Buy" />
            <Bar dataKey="sell" fill="hsl(0, 84%, 60%)" name="Sell" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

