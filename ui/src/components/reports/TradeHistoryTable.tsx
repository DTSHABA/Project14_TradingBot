import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import type { Trade } from '@/types/trading';

interface TradeHistoryTableProps {
  trades: Trade[];
  isLoading?: boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    total: number;
  };
  onPageChange?: (page: number) => void;
  onFilterChange?: (filters: TradeFilters) => void;
}

export interface TradeFilters {
  date_from?: string;
  date_to?: string;
  direction?: 'BUY' | 'SELL';
  outcome?: 'win' | 'loss';
}

export function TradeHistoryTable({ 
  trades, 
  isLoading, 
  pagination,
  onPageChange,
  onFilterChange 
}: TradeHistoryTableProps) {
  const [filters, setFilters] = useState<TradeFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = (key: keyof TradeFilters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
  };

  const applyFilters = () => {
    onFilterChange?.(filters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilterChange?.({});
  };

  const formatPnL = (pnl: string | null) => {
    if (!pnl) return '-';
    const value = parseFloat(pnl);
    const isPositive = value >= 0;
    return (
      <span className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}${value.toFixed(2)}
      </span>
    );
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-secondary animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trade History</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters Section */}
        {showFilters && (
          <div className="p-4 bg-secondary/30 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_from">From Date</Label>
                <Input
                  id="date_from"
                  type="date"
                  value={filters.date_from || ''}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_to">To Date</Label>
                <Input
                  id="date_to"
                  type="date"
                  value={filters.date_to || ''}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direction">Direction</Label>
                <select
                  id="direction"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={filters.direction || ''}
                  onChange={(e) => handleFilterChange('direction', e.target.value)}
                >
                  <option value="">All</option>
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome</Label>
                <select
                  id="outcome"
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={filters.outcome || ''}
                  onChange={(e) => handleFilterChange('outcome', e.target.value)}
                >
                  <option value="">All</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={applyFilters}>Apply Filters</Button>
              <Button variant="outline" onClick={clearFilters}>Clear</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold">Entry Time</th>
                <th className="text-left p-3 font-semibold">Direction</th>
                <th className="text-right p-3 font-semibold">Entry Price</th>
                <th className="text-right p-3 font-semibold">Exit Price</th>
                <th className="text-left p-3 font-semibold">Exit Time</th>
                <th className="text-left p-3 font-semibold">Exit Reason</th>
                <th className="text-right p-3 font-semibold">Lot Size</th>
                <th className="text-right p-3 font-semibold">Duration</th>
                <th className="text-right p-3 font-semibold">P&L</th>
                <th className="text-center p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center p-12 text-muted-foreground">
                    <div className="space-y-2">
                      <p className="font-medium">No trades found matching the filters</p>
                      {(filters.date_from || filters.date_to || filters.direction || filters.outcome) && (
                        <p className="text-sm">
                          Try clearing filters or adjusting the date range to see more trades.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                trades.map((trade) => {
                  const pnlValue = trade.pnl ? parseFloat(trade.pnl) : 0;
                  const isWin = pnlValue > 0;
                  const isClosed = !!trade.exit_time;

                  return (
                    <tr key={trade.id} className="border-b hover:bg-secondary/30 transition-colors">
                      <td className="p-3">
                        <div className="text-sm">
                          <div className="font-medium">
                            {new Date(trade.entry_time).toLocaleDateString()}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(trade.entry_time).toLocaleTimeString()}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            trade.direction === 'BUY'
                              ? 'bg-green-500/10 text-green-600 border-green-500/20'
                              : 'bg-red-500/10 text-red-600 border-red-500/20'
                          }
                        >
                          {trade.direction === 'BUY' ? (
                            <TrendingUp className="w-3 h-3 mr-1" />
                          ) : (
                            <TrendingDown className="w-3 h-3 mr-1" />
                          )}
                          {trade.direction}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        ${parseFloat(trade.entry_price).toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        {trade.exit_price 
                          ? `$${parseFloat(trade.exit_price).toFixed(2)}`
                          : '-'
                        }
                      </td>
                      <td className="p-3 text-sm">
                        {trade.exit_time ? (
                          <div>
                            <div className="font-medium">
                              {new Date(trade.exit_time).toLocaleDateString()}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {new Date(trade.exit_time).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-sm">
                        {trade.exit_reason ? (
                          <Badge variant="outline" className="text-xs">
                            {trade.exit_reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        {parseFloat(trade.lot_size).toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-sm">
                        {formatDuration(trade.hold_time_seconds)}
                      </td>
                      <td className="p-3 text-right">
                        {formatPnL(trade.pnl)}
                      </td>
                      <td className="p-3 text-center">
                        {isClosed ? (
                          <Badge variant={isWin ? 'default' : 'secondary'}>
                            {isWin ? 'Win' : 'Loss'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-blue-500 text-blue-600">
                            Open
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Page {pagination.currentPage} of {pagination.totalPages} ({pagination.total} total trades)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange?.(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

