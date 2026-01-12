import { HelpCircle, Mail, MessageCircle, BookOpen, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function Support() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Support Center</h1>
          <p className="text-muted-foreground mt-2">
            Get help with your trading bot and find answers to common questions.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Documentation
              </CardTitle>
              <CardDescription>
                Learn how to use the trading bot and configure your settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('https://docs.aura-trading.com', '_blank')}
              >
                View Documentation
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                FAQ
              </CardTitle>
              <CardDescription>
                Find answers to frequently asked questions about trading and bot configuration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open('https://docs.aura-trading.com/faq', '_blank')}
              >
                Browse FAQ
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Contact Support
              </CardTitle>
              <CardDescription>
                Reach out to our support team for assistance with your account or technical issues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.location.href = 'mailto:support@aura-trading.com?subject=Support Request'}
              >
                Contact Us
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Report Issue
              </CardTitle>
              <CardDescription>
                Report bugs, errors, or unexpected behavior with the trading bot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.location.href = 'mailto:support@aura-trading.com?subject=Bug Report'}
              >
                Report Bug
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5" />
              Quick Help
            </CardTitle>
            <CardDescription>
              Common issues and solutions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">MT5 Connection Issues</h3>
                <p className="text-sm text-muted-foreground">
                  Make sure MetaTrader 5 is running and your account credentials are correct. 
                  Check the connection status in your Dashboard.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Trading Bot Not Executing Trades</h3>
                <p className="text-sm text-muted-foreground">
                  Verify that your bot configuration is active and check for any circuit breaker 
                  halts in the Dashboard. Ensure you're within trading session hours.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Performance Questions</h3>
                <p className="text-sm text-muted-foreground">
                  Review your Analytics page for detailed performance metrics and trade history. 
                  Check the Dashboard for real-time status updates.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}









