import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    amount: number;
    percent: number;
    isPositive: boolean;
  };
  icon?: ReactNode;
}

export function MetricCard({ title, value, change, icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p
            className={`text-xs ${
              change.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {change.isPositive ? '+' : ''}
            {change.amount >= 0 ? '$' : '-$'}
            {Math.abs(change.amount).toFixed(2)} ({change.isPositive ? '+' : ''}
            {change.percent.toFixed(2)}%)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

