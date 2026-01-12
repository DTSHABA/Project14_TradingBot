import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileJson } from 'lucide-react';
import { exportTrades } from '@/lib/api/trading';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import type { Trade } from '@/types/trading';

interface ExportButtonsProps {
  dateFrom?: string;
  dateTo?: string;
  trades?: Trade[];
}

export function ExportButtons({ dateFrom, dateTo, trades }: ExportButtonsProps) {
  const { accounts } = useMT5Connection();
  const activeAccount = accounts.find((a) => a.is_active);

  const handleCSVExport = async () => {
    try {
      const blob = await exportTrades({
        mt5_account_id: activeAccount?.id,
        date_from: dateFrom,
        date_to: dateTo,
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trades_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export trades as CSV');
    }
  };

  const handleJSONExport = () => {
    if (!trades || trades.length === 0) {
      alert('No trades to export');
      return;
    }

    try {
      const json = JSON.stringify(trades, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trades_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export trades as JSON');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Trade Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Download your trade history in CSV or JSON format for further analysis
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleCSVExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export as CSV
          </Button>
          <Button onClick={handleJSONExport} variant="outline">
            <FileJson className="w-4 h-4 mr-2" />
            Export as JSON
          </Button>
        </div>
        {(dateFrom || dateTo) && (
          <p className="text-xs text-muted-foreground mt-2">
            {dateFrom && `From: ${new Date(dateFrom).toLocaleDateString()}`}
            {dateFrom && dateTo && ' • '}
            {dateTo && `To: ${new Date(dateTo).toLocaleDateString()}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

