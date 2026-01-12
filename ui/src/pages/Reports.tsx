import { useState, useEffect } from 'react';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import { useMT5AccountInfo } from '@/hooks/useMT5AccountInfo';
import { useTradeHistory } from '@/hooks/useTradeHistory';
import { useAllTrades } from '@/hooks/useAllTrades';
import { getPerformanceMetrics } from '@/lib/api/analytics';
import { TradeHistoryTable, type TradeFilters } from '@/components/reports/TradeHistoryTable';
import { MetricsCards } from '@/components/reports/MetricsCards';
import { AccountPerformanceSummary } from '@/components/reports/AccountPerformanceSummary';
import { PnLChart } from '@/components/reports/PnLChart';
import { WinRateChart } from '@/components/reports/WinRateChart';
import { EquityCurveChart } from '@/components/reports/EquityCurveChart';
import { TradeDistributionChart } from '@/components/reports/TradeDistributionChart';
import { HoldTimeChart } from '@/components/reports/HoldTimeChart';
import { ExportButtons } from '@/components/reports/ExportButtons';
import { MT5AccountInfoCard } from '@/components/mt5/MT5AccountInfoCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { PerformanceMetrics } from '@/types/trading';

export function Reports() {
  const { accounts } = useMT5Connection();
  const activeAccount = accounts.find((a) => a.is_active);

  const [filters, setFilters] = useState<TradeFilters>({});
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

  // Fetch live MT5 account info
  const { 
    accountInfo: mt5AccountInfo, 
    isLoading: mt5Loading, 
    error: mt5Error 
  } = useMT5AccountInfo({
    pollInterval: 15000, // Poll every 15 seconds (less frequent than dashboard)
    enabled: !!activeAccount
  });

  const {
    trades,
    pagination,
    isLoading: tradesLoading,
    error: tradesError,
    goToPage,
    applyFilters,
    refetch: refetchTrades,
  } = useTradeHistory({
    limit: 20,
    mt5_account_id: activeAccount?.id,
    enabled: !!activeAccount,
    pollInterval: 10000, // Poll every 10 seconds for new trades
  });

  // Fetch all trades for charts (not paginated)
  const {
    trades: allTrades,
    isLoading: allTradesLoading,
  } = useAllTrades({
    mt5_account_id: activeAccount?.id,
    date_from: filters.date_from,
    date_to: filters.date_to,
    enabled: !!activeAccount,
    pollInterval: 15000, // Poll every 15 seconds for chart data
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
                Please connect an MT5 account to view reports.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Trading Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Comprehensive analysis of your trading performance and MT5 account status
        </p>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trades">Trade History</TabsTrigger>
          <TabsTrigger value="charts">Charts & Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* MT5 Account Info & Account Performance */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* MT5 Live Account Info */}
            <div className="lg:col-span-1">
              <MT5AccountInfoCard 
                accountInfo={mt5AccountInfo}
                isLoading={mt5Loading}
                error={mt5Error}
              />
            </div>

            {/* Account Performance Summary */}
            <div className="lg:col-span-2">
              <AccountPerformanceSummary 
                accountInfo={mt5AccountInfo}
                metrics={metrics}
                isLoading={mt5Loading || isLoadingMetrics}
              />
            </div>
          </div>

          {/* Performance Metrics Cards */}
          <MetricsCards metrics={metrics} isLoading={isLoadingMetrics} />

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <PnLChart trades={allTrades} isLoading={allTradesLoading} />
            <WinRateChart trades={allTrades} isLoading={allTradesLoading} />
          </div>

          {/* Export Section */}
          <ExportButtons 
            dateFrom={filters.date_from}
            dateTo={filters.date_to}
            trades={trades}
          />
        </TabsContent>

        {/* Trade History Tab */}
        <TabsContent value="trades" className="space-y-6">
          {/* MT5 Account Status */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <MT5AccountInfoCard 
                accountInfo={mt5AccountInfo}
                isLoading={mt5Loading}
                error={mt5Error}
              />
            </div>
            <div className="md:col-span-2">
              <AccountPerformanceSummary 
                accountInfo={mt5AccountInfo}
                metrics={metrics}
                isLoading={mt5Loading || isLoadingMetrics}
              />
            </div>
          </div>

          {/* Error Message */}
          {tradesError && (
            <Card className="border-destructive">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Error loading trades</p>
                    <p className="text-sm text-muted-foreground">{tradesError.message}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => refetchTrades()} className="ml-auto">
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <TradeHistoryTable
            trades={trades}
            isLoading={tradesLoading}
            pagination={pagination}
            onPageChange={goToPage}
            onFilterChange={handleFilterChange}
          />

          {/* Quick Stats Summary */}
          {!tradesLoading && (
            <Card>
              <CardContent className="p-6">
                {pagination.total > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Displayed Trades</p>
                      <p className="text-2xl font-bold">{trades.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Trades</p>
                      <p className="text-2xl font-bold">{pagination.total}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Wins</p>
                      <p className="text-2xl font-bold text-green-600">
                        {trades.filter(t => t.pnl && parseFloat(t.pnl) > 0).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Losses</p>
                      <p className="text-2xl font-bold text-red-600">
                        {trades.filter(t => t.pnl && parseFloat(t.pnl) < 0).length}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">
                      {Object.keys(filters).length > 0 
                        ? 'No trades found matching the current filters. Try adjusting your filters or clearing them to see all trades.'
                        : 'No trades found for this account. Start trading to see your trade history here.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <ExportButtons 
            dateFrom={filters.date_from}
            dateTo={filters.date_to}
            trades={trades}
          />
        </TabsContent>

        {/* Charts & Trends Tab */}
        <TabsContent value="charts" className="space-y-6">
          {/* MT5 Account Overview */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1">
              <MT5AccountInfoCard 
                accountInfo={mt5AccountInfo}
                isLoading={mt5Loading}
                error={mt5Error}
              />
            </div>
            <div className="md:col-span-2">
              <AccountPerformanceSummary 
                accountInfo={mt5AccountInfo}
                metrics={metrics}
                isLoading={mt5Loading || isLoadingMetrics}
              />
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            <EquityCurveChart trades={allTrades} isLoading={allTradesLoading} />
            <PnLChart trades={allTrades} isLoading={allTradesLoading} />
            <WinRateChart trades={allTrades} isLoading={allTradesLoading} />
            <TradeDistributionChart trades={allTrades} isLoading={allTradesLoading} />
            <HoldTimeChart trades={allTrades} isLoading={allTradesLoading} />
          </div>

          {/* Additional Insights Card */}
          {metrics && !isLoadingMetrics && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Performance Insights</h3>
                <div className="space-y-3 text-sm">
                  {metrics.win_rate >= 60 && (
                    <div className="flex items-start gap-2 text-green-600">
                      <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5" />
                      <p>Excellent win rate of {metrics.win_rate.toFixed(1)}% - Above target threshold</p>
                    </div>
                  )}
                  {metrics.profit_factor > 1.5 && (
                    <div className="flex items-start gap-2 text-green-600">
                      <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5" />
                      <p>Strong profit factor of {metrics.profit_factor.toFixed(2)} - Wins outweigh losses significantly</p>
                    </div>
                  )}
                  {metrics.sharpe_ratio > 1 && (
                    <div className="flex items-start gap-2 text-green-600">
                      <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5" />
                      <p>Good risk-adjusted returns (Sharpe: {metrics.sharpe_ratio.toFixed(2)})</p>
                    </div>
                  )}
                  {metrics.max_drawdown > 0.15 && (
                    <div className="flex items-start gap-2 text-yellow-600">
                      <div className="w-2 h-2 rounded-full bg-yellow-600 mt-1.5" />
                      <p>Maximum drawdown of {(metrics.max_drawdown * 100).toFixed(1)}% - Consider risk management</p>
                    </div>
                  )}
                  {metrics.win_rate < 50 && (
                    <div className="flex items-start gap-2 text-yellow-600">
                      <div className="w-2 h-2 rounded-full bg-yellow-600 mt-1.5" />
                      <p>Win rate below 50% - Focus on improving trade selection or risk:reward ratio</p>
                    </div>
                  )}
                  {metrics.total_trades < 30 && (
                    <div className="flex items-start gap-2 text-blue-600">
                      <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
                      <p>Limited trade history ({metrics.total_trades} trades) - Continue trading to build statistical significance</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

