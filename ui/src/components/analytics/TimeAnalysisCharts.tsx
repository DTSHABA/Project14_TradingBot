import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import type { TimeAnalysis } from '@/types/trading';

interface TimeAnalysisChartsProps {
  data: TimeAnalysis | null;
  isLoading?: boolean;
}

export function TimeAnalysisCharts({ data, isLoading }: TimeAnalysisChartsProps) {
  if (isLoading || !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-secondary animate-pulse rounded w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-80 bg-secondary animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{data.hour !== undefined ? `${data.hour}:00` : data.day || data.session}</p>
          <div className="space-y-1 text-sm">
            <p>Trades: {data.trades}</p>
            <p className="text-green-600">Win Rate: {data.win_rate.toFixed(1)}%</p>
            <p className={`font-semibold ${data.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              P&L: ${data.pnl.toFixed(2)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* By Hour */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Hour of Day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.by_hour} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="hour" 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                label={{ value: 'Hour (UTC)', position: 'insideBottom', offset: -5, style: { fill: '#e5e7eb' } }}
              />
              <YAxis 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                label={{ value: 'P&L ($)', angle: -90, position: 'insideLeft', style: { fill: '#e5e7eb' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" fill="hsl(217, 91%, 60%)" name="P&L" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Day of Week */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Day of Week</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.by_day_of_week} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day" 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                label={{ value: 'P&L ($)', angle: -90, position: 'insideLeft', style: { fill: '#e5e7eb' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" fill="hsl(142, 76%, 36%)" name="P&L" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Session */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Performance by Trading Session</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.by_session} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="session" 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                label={{ value: 'P&L ($)', angle: -90, position: 'insideLeft', style: { fill: '#e5e7eb' } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" fill="hsl(217, 91%, 60%)" name="P&L" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Win Rate by Hour */}
      <Card>
        <CardHeader>
          <CardTitle>Win Rate by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data.by_hour} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="hour" 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                label={{ value: 'Hour (UTC)', position: 'insideBottom', offset: -5, style: { fill: '#e5e7eb' } }}
              />
              <YAxis 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft', style: { fill: '#e5e7eb' } }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="win_rate" 
                stroke="hsl(142, 76%, 36%)" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Win Rate by Day */}
      <Card>
        <CardHeader>
          <CardTitle>Win Rate by Day of Week</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.by_day_of_week} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="day" 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft', style: { fill: '#e5e7eb' } }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="win_rate" fill="hsl(142, 76%, 36%)" name="Win Rate" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

