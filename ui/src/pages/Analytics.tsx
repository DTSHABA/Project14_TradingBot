import { useState, useEffect } from 'react';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import { useTradeHistory } from '@/hooks/useTradeHistory';
import { getPerformanceMetrics, getTimeAnalysis, getSignalAnalysis } from '@/lib/api/analytics';
import { TradeHistoryTable, type TradeFilters } from '@/components/reports/TradeHistoryTable';
import { PerformanceMetricsCards } from '@/components/analytics/PerformanceMetricsCards';
import { TimeAnalysisCharts } from '@/components/analytics/TimeAnalysisCharts';
import { SignalAnalysisCharts } from '@/components/analytics/SignalAnalysisCharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { PerformanceMetrics, TimeAnalysis, SignalAnalysis } from '@/types/trading';

export function Analytics() {
  const { accounts } = useMT5Connection();
  const activeAccount = accounts.find((a) => a.is_active);

  const [filters, setFilters] = useState<TradeFilters>({});
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [timeAnalysis, setTimeAnalysis] = useState<TimeAnalysis | null>(null);
  const [signalAnalysis, setSignalAnalysis] = useState<SignalAnalysis | null>(null);
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('month');
  
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingTimeAnalysis, setIsLoadingTimeAnalysis] = useState(true);
  const [isLoadingSignalAnalysis, setIsLoadingSignalAnalysis] = useState(true);

  const {
    trades,
    pagination,
    isLoading: tradesLoading,
    error: tradesError,
    goToPage,
    applyFilters,
  } = useTradeHistory({
    limit: 20,
    mt5_account_id: activeAccount?.id,
    enabled: !!activeAccount,
    pollInterval: 10000, // Poll every 10 seconds for new trades
  });

  // Fetch performance metrics with polling
  useEffect(() => {
    if (!activeAccount) return;

    const fetchMetrics = () => {
      setIsLoadingMetrics(true);
      getPerformanceMetrics({
        mt5_account_id: activeAccount.id,
        date_from: filters.date_from,
        date_to: filters.date_to,
      })
        .then(setMetrics)
        .catch((err) => {
          console.error('Error fetching metrics:', err);
          setMetrics(null);
        })
        .finally(() => {
          setIsLoadingMetrics(false);
        });
    };

    // Initial fetch
    fetchMetrics();

    // Set up polling every 15 seconds
    const intervalId = setInterval(fetchMetrics, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeAccount, filters.date_from, filters.date_to]);

  // Fetch time analysis with polling
  useEffect(() => {
    if (!activeAccount) return;

    const fetchTimeAnalysis = () => {
      setIsLoadingTimeAnalysis(true);
      getTimeAnalysis({
        mt5_account_id: activeAccount.id,
        period: timePeriod,
      })
        .then(setTimeAnalysis)
        .catch((err) => {
          console.error('Error fetching time analysis:', err);
          setTimeAnalysis(null);
        })
        .finally(() => {
          setIsLoadingTimeAnalysis(false);
        });
    };

    // Initial fetch
    fetchTimeAnalysis();

    // Set up polling every 20 seconds (less frequent since it's aggregated data)
    const intervalId = setInterval(fetchTimeAnalysis, 20000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeAccount, timePeriod]);

  // Fetch signal analysis with polling
  useEffect(() => {
    if (!activeAccount) return;

    const fetchSignalAnalysis = () => {
      setIsLoadingSignalAnalysis(true);
      getSignalAnalysis({
        mt5_account_id: activeAccount.id,
        date_from: filters.date_from,
        date_to: filters.date_to,
      })
        .then(setSignalAnalysis)
        .catch((err) => {
          console.error('Error fetching signal analysis:', err);
          setSignalAnalysis(null);
        })
        .finally(() => {
          setIsLoadingSignalAnalysis(false);
        });
    };

    // Initial fetch
    fetchSignalAnalysis();

    // Set up polling every 15 seconds
    const intervalId = setInterval(fetchSignalAnalysis, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeAccount, filters.date_from, filters.date_to]);

  const handleFilterChange = (newFilters: TradeFilters) => {
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  if (!activeAccount) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12">
            <div className="text-center space-y-4">
              <AlertTriangle className="w-16 h-16 mx-auto text-yellow-600" />
              <h2 className="text-2xl font-bold">No Active MT5 Account</h2>
              <p className="text-muted-foreground">
                Please connect an MT5 account to view analytics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-2">
          View detailed performance metrics and trading analytics
        </p>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
          <TabsTrigger value="time-analysis">Time Analysis</TabsTrigger>
          <TabsTrigger value="trade-history">Trade History</TabsTrigger>
          <TabsTrigger value="signal-analysis">Signal Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Overall trading performance statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PerformanceMetricsCards metrics={metrics} isLoading={isLoadingMetrics} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time-analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Time-Based Analysis</CardTitle>
                  <CardDescription>
                    Performance by hour, day, and trading session
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={timePeriod === 'day' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimePeriod('day')}
                  >
                    Day
                  </Button>
                  <Button
                    variant={timePeriod === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimePeriod('week')}
                  >
                    Week
                  </Button>
                  <Button
                    variant={timePeriod === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimePeriod('month')}
                  >
                    Month
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TimeAnalysisCharts data={timeAnalysis} isLoading={isLoadingTimeAnalysis} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trade-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
              <CardDescription>
                Complete history of all trades with filters and export
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TradeHistoryTable
                trades={trades}
                isLoading={tradesLoading}
                pagination={pagination}
                onPageChange={goToPage}
                onFilterChange={handleFilterChange}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="signal-analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Signal Analysis</CardTitle>
              <CardDescription>
                Analysis of trading signals and approval rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SignalAnalysisCharts data={signalAnalysis} isLoading={isLoadingSignalAnalysis} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
