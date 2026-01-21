import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { SignalAnalysis } from '@/types/trading';

interface SignalAnalysisChartsProps {
  data: SignalAnalysis | null;
  isLoading?: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'];

export function SignalAnalysisCharts({ data, isLoading }: SignalAnalysisChartsProps) {
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
          <p className="font-semibold mb-2">{data.name || data.reason || data.confidence_range}</p>
          <div className="space-y-1 text-sm">
            {data.value !== undefined && <p>Count: {data.value}</p>}
            {data.win_rate !== undefined && (
              <p className="text-green-600">Win Rate: {data.win_rate.toFixed(1)}%</p>
            )}
            {data.trades !== undefined && <p>Trades: {data.trades}</p>}
          </div>
        </div>
      );
    }
    return null;
  };

  const rejectionData = data.rejection_reasons.map((r) => ({
    name: r.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: r.count,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Approval Rate Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Signal Approval Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">
                {data.approval_rate.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                {data.total_signals} total signals
              </p>
            </div>
            <div className="flex justify-between text-sm">
              <div>
                <span className="text-muted-foreground">Approved: </span>
                <span className="font-semibold text-green-600">
                  {Math.round((data.approval_rate / 100) * data.total_signals)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Rejected: </span>
                <span className="font-semibold text-red-600">
                  {Math.round(((100 - data.approval_rate) / 100) * data.total_signals)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rejection Reasons Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Rejection Reasons</CardTitle>
        </CardHeader>
        <CardContent>
          {rejectionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={rejectionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {rejectionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No rejection data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confidence vs Outcome */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Win Rate by Signal Confidence</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.confidence_vs_outcome} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="confidence_range" 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                label={{ value: 'Confidence Range (%)', position: 'insideBottom', offset: -5, style: { fill: '#e5e7eb' } }}
              />
              <YAxis 
                tick={{ fill: '#e5e7eb', fontSize: 12 }}
                domain={[0, 100]}
                label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft', style: { fill: '#e5e7eb' } }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="win_rate" fill="hsl(142, 76%, 36%)" name="Win Rate">
                {data.confidence_vs_outcome.map((item, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={item.win_rate >= 50 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">≥50% Win Rate</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-muted-foreground">&lt;50% Win Rate</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rejection Reasons Bar Chart */}
      {rejectionData.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rejection Reasons Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={rejectionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: '#e5e7eb', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis 
                  tick={{ fill: '#e5e7eb', fontSize: 12 }}
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: '#e5e7eb' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="hsl(0, 84%, 60%)" name="Rejections">
                  {rejectionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

