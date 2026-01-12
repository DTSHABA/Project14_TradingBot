import { useAuth } from '@/lib/auth-context';
import { useMT5Connection } from '@/hooks/useMT5Connection';
import { useMT5AccountInfo } from '@/hooks/useMT5AccountInfo';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Zap, Brain, DollarSign, BarChart3, Sparkles, Coins } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Home() {
  const { user } = useAuth();
  const { accounts } = useMT5Connection();
  const activeAccount = accounts.find((a) => a.is_active);
  
  const { 
    accountInfo: mt5AccountInfo, 
    isLoading: mt5Loading 
  } = useMT5AccountInfo({
    pollInterval: 30000,
    enabled: !!activeAccount
  });

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [chartData] = useState(() => {
    // Generate sample trading chart data
    const data = [];
    for (let i = 0; i < 50; i++) {
      data.push({
        x: i * 20,
        y: 200 + Math.sin(i * 0.3) * 100 + Math.random() * 50,
        high: 200 + Math.sin(i * 0.3) * 100 + Math.random() * 50 + 20,
        low: 200 + Math.sin(i * 0.3) * 100 + Math.random() * 50 - 20,
      });
    }
    return data;
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const balance = mt5AccountInfo?.balance || 0;
  const equity = mt5AccountInfo?.equity || 0;
  const profit = equity - balance;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/20 dark:from-slate-900 dark:via-emerald-900/20 dark:to-amber-900/10">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Money-themed Gradient Orbs */}
        <div 
          className="absolute w-96 h-96 bg-emerald-500/20 dark:bg-emerald-500/30 rounded-full blur-3xl animate-pulse"
          style={{
            left: `${mousePosition.x / 20}px`,
            top: `${mousePosition.y / 20}px`,
            transition: 'all 0.3s ease-out',
          }}
        />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-amber-500/20 dark:bg-amber-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-green-500/20 dark:bg-green-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-yellow-500/15 dark:bg-yellow-500/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
        
        {/* Grid Pattern - Theme Aware */}
        <div 
          className="absolute inset-0 opacity-10 dark:opacity-5"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
        
        {/* Trading Chart Lines - Multiple Layers */}
        <svg className="absolute inset-0 w-full h-full opacity-30 dark:opacity-20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="chartGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="chartGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="chartGradient3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#84cc16" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          
          {/* Main Price Line - Green (Bullish) */}
          <path
            d={`M ${chartData.map((p, i) => `${p.x},${p.y}`).join(' L ')}`}
            stroke="url(#chartGradient1)"
            strokeWidth="3"
            fill="none"
            className="animate-pulse"
          />
          
          {/* Secondary Trend Line - Gold */}
          <path
            d={`M ${chartData.map((p, i) => `${p.x},${p.y + 30}`).join(' L ')}`}
            stroke="url(#chartGradient2)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="5,5"
            className="animate-pulse"
            style={{ animationDelay: '0.5s' }}
          />
          
          {/* Support Line - Yellow */}
          <path
            d={`M ${chartData.map((p, i) => `${p.x},${p.y + 60}`).join(' L ')}`}
            stroke="url(#chartGradient3)"
            strokeWidth="2"
            fill="none"
            strokeDasharray="3,3"
            className="animate-pulse"
            style={{ animationDelay: '1s' }}
          />
          
          {/* Candlestick-like markers */}
          {chartData.filter((_, i) => i % 5 === 0).map((point, i) => (
            <g key={i}>
              <line
                x1={point.x}
                y1={point.low}
                x2={point.x}
                y2={point.high}
                stroke={point.y > 200 ? "#10b981" : "#ef4444"}
                strokeWidth="2"
                opacity="0.6"
              />
              <rect
                x={point.x - 3}
                y={point.y - 5}
                width="6"
                height="10"
                fill={point.y > 200 ? "#10b981" : "#ef4444"}
                opacity="0.8"
              />
            </g>
          ))}
        </svg>

        {/* AI Neural Network Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-15 dark:opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="neuralGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          {/* Neural network nodes */}
          {[...Array(20)].map((_, i) => (
            <circle
              key={i}
              cx={50 + (i % 5) * 200}
              cy={100 + Math.floor(i / 5) * 150}
              r="4"
              fill="url(#neuralGradient)"
              className="animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
          {/* Neural network connections */}
          <path
            d="M 50,100 Q 150,150 250,100 T 450,100 T 650,100"
            stroke="url(#neuralGradient)"
            strokeWidth="1"
            fill="none"
            className="animate-pulse"
          />
          <path
            d="M 50,250 Q 150,200 250,250 T 450,250 T 650,250"
            stroke="url(#neuralGradient)"
            strokeWidth="1"
            fill="none"
            className="animate-pulse"
            style={{ animationDelay: '0.5s' }}
          />
        </svg>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center space-y-8 mb-16">
          {/* Logo/Brand */}
          <div className="flex items-center justify-center gap-3 mb-8 animate-float">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/50 dark:bg-emerald-500/60 blur-xl rounded-full animate-pulse" />
              <Brain className="relative w-16 h-16 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            </div>
            <h1 className="text-6xl md:text-8xl font-black bg-gradient-to-r from-emerald-600 via-amber-500 to-green-600 dark:from-emerald-400 dark:via-amber-400 dark:to-green-400 bg-clip-text text-transparent animate-shimmer">
              AURA
            </h1>
            <Sparkles className="w-8 h-8 text-amber-500 dark:text-amber-400 animate-pulse" />
          </div>

          {/* Main Heading */}
          <div className="space-y-4">
            <h2 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white">
              AI-Powered Trading
              <span className="block mt-2 bg-gradient-to-r from-emerald-600 to-amber-500 dark:from-emerald-400 dark:to-amber-400 bg-clip-text text-transparent">
                Intelligence Platform
              </span>
            </h2>
            <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-300 max-w-3xl mx-auto">
              Harness the power of artificial intelligence to transform your trading strategy
              <span className="block mt-2 text-emerald-600 dark:text-emerald-400 font-semibold">into consistent profits</span>
            </p>
          </div>

          {/* Quick Stats */}
          {activeAccount && mt5AccountInfo && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
              <Card className="bg-white/80 dark:bg-white/5 backdrop-blur-xl border-emerald-200/50 dark:border-emerald-500/20 hover:border-emerald-400 dark:hover:border-emerald-400/50 transition-all shadow-lg hover:shadow-emerald-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Account Balance</p>
                      <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 blur-lg rounded-full" />
                      <DollarSign className="relative w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 dark:bg-white/5 backdrop-blur-xl border-amber-200/50 dark:border-amber-500/20 hover:border-amber-400 dark:hover:border-amber-400/50 transition-all shadow-lg hover:shadow-amber-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Equity</p>
                      <p className={`text-3xl font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-0 bg-amber-500/20 blur-lg rounded-full" />
                      <BarChart3 className="relative w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/80 dark:bg-white/5 backdrop-blur-xl border-green-200/50 dark:border-green-500/20 hover:border-green-400 dark:hover:border-green-400/50 transition-all shadow-lg hover:shadow-green-500/20">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Profit/Loss</p>
                      <p className={`text-3xl font-bold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {profit >= 0 ? '+' : ''}${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="relative">
                      <div className={`absolute inset-0 ${profit >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'} blur-lg rounded-full`} />
                      <TrendingUp className={`relative w-8 h-8 ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          {/* AI Intelligence */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 dark:from-emerald-500/20 dark:to-green-500/20 backdrop-blur-xl border-emerald-200/50 dark:border-emerald-500/20 hover:border-emerald-400 dark:hover:border-emerald-400/50 transition-all group shadow-lg">
            <CardContent className="p-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-emerald-500/20 dark:bg-emerald-500/30 blur-xl rounded-full group-hover:bg-emerald-500/30 dark:group-hover:bg-emerald-500/40 transition-all" />
                <Brain className="relative w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">AI Intelligence</h3>
              <p className="text-slate-700 dark:text-slate-300">
                Advanced machine learning algorithms analyze market patterns and execute trades with precision
              </p>
            </CardContent>
          </Card>

          {/* Real-Time Trading */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 dark:from-amber-500/20 dark:to-yellow-500/20 backdrop-blur-xl border-amber-200/50 dark:border-amber-500/20 hover:border-amber-400 dark:hover:border-amber-400/50 transition-all group shadow-lg">
            <CardContent className="p-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-amber-500/20 dark:bg-amber-500/30 blur-xl rounded-full group-hover:bg-amber-500/30 dark:group-hover:bg-amber-500/40 transition-all" />
                <Zap className="relative w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Real-Time Trading</h3>
              <p className="text-slate-700 dark:text-slate-300">
                Instant execution and monitoring of trades with live market data and performance tracking
              </p>
            </CardContent>
          </Card>

          {/* Profit Optimization */}
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 backdrop-blur-xl border-green-200/50 dark:border-green-500/20 hover:border-green-400 dark:hover:border-green-400/50 transition-all group shadow-lg">
            <CardContent className="p-8">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-green-500/20 dark:bg-green-500/30 blur-xl rounded-full group-hover:bg-green-500/30 dark:group-hover:bg-green-500/40 transition-all" />
                <Coins className="relative w-12 h-12 text-green-600 dark:text-green-400 mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Profit Optimization</h3>
              <p className="text-slate-700 dark:text-slate-300">
                Maximize returns with intelligent risk management and adaptive trading strategies
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Floating Elements - Money themed */}
        <div className="absolute top-20 left-10 w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-ping opacity-75" />
        <div className="absolute top-40 right-20 w-3 h-3 bg-amber-500 dark:bg-amber-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 right-1/3 w-3 h-3 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-20 w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-yellow-500 dark:bg-yellow-400 rounded-full animate-ping opacity-75" style={{ animationDelay: '2.5s' }} />

        {/* Money Symbol Decoration - Theme Aware */}
        <div className="absolute top-1/2 right-10 text-9xl font-black text-emerald-500/10 dark:text-emerald-400/10 select-none hidden lg:block">
          $
        </div>
        <div className="absolute bottom-10 left-10 text-9xl font-black text-amber-500/10 dark:text-amber-400/10 select-none hidden lg:block rotate-12">
          €
        </div>
        <div className="absolute top-1/4 left-1/4 text-7xl font-black text-green-500/10 dark:text-green-400/10 select-none hidden lg:block -rotate-12">
          £
        </div>
      </div>

      {/* Bottom Wave - Money themed */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg className="w-full h-32" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path
            d="M0,60 Q300,20 600,60 T1200,60 L1200,120 L0,120 Z"
            fill="url(#moneyWaveGradient)"
            className="opacity-20 dark:opacity-10"
          />
          <defs>
            <linearGradient id="moneyWaveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#84cc16" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
