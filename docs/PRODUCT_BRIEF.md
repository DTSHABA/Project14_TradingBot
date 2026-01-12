# XAUUSD True Scalper Bot - Product Brief

## Project Overview

A high-frequency automated trading bot for MetaTrader 5 that executes gold (XAUUSD) scalping trades with 2-8 minute hold times. The bot targets 15-30 trades per day during prime London/NY trading sessions, aiming for a 65%+ win rate using tight 0.25-0.40% stop losses and 1:1.2 risk-reward ratios.

**Core Philosophy:** Speed over precision - fast execution with 60-65% accuracy beats slow execution with 80% accuracy in scalping. The system prioritizes rapid market structure identification and immediate execution over complex multi-agent analysis.

## Target Audience

- Retail forex/gold traders seeking automated scalping solutions
- Traders with MetaTrader 5 accounts looking for high-frequency trading automation
- Users comfortable with Python-based trading systems
- Traders targeting 1-3% daily gains through frequent, small-profit trades

## Primary Benefits / Features

### Trading Performance
- **Target Win Rate:** 65-70%
- **Risk Management:** 0.5% risk per trade with circuit breaker protection
- **Fast Execution:** Sub-2-second order placement from signal to execution
- **Time-Limited Trades:** Maximum 15-minute hold time with automatic force-close

### Risk Management
- Multi-layered circuit breaker system (halts after 3 consecutive losses or 5 losses in 7 trades)
- Graduated risk adjustment based on performance
- Breakeven protection and partial profit-taking strategies
- Daily loss limit of 3% equity (circuit breaker)

### Market Intelligence
- Session-based trading windows (prioritizes London/NY overlap)
- Volatility gating using ATR filters
- Spread validation for scalping profitability
- Momentum-based entry/exit logic using M5 structure and M1 confirmation

### Operational Features
- Single-threaded execution pipeline (no multi-agent complexity)
- Real-time position management with multiple exit strategies
- Performance tracking and optimization feedback
- Optional AI signal validation (DeepSeek API) - system works fully without AI

## High-Level Tech/Architecture

### Technology Stack
- **Language:** Python 3.11+
- **Trading Platform:** MetaTrader 5
- **Library:** MetaTrader5 (pip install MetaTrader5)
- **Optional AI:** DeepSeek API (for signal validation only, not generation)

### Architecture Components
1. **Price Action Engine:** Pure technical analysis using RSI, EMA, support/resistance (NO AI for signal generation)
2. **Execution Engine:** Sub-2-second order placement with latency requirements (<500ms market data, <800ms signal generation, <200ms risk validation, <500ms execution)
3. **Risk Manager:** Pre-trade validation + active position monitoring with hard rules
4. **Session Manager:** Time-based filtering + volatility gating (ATR-based)
5. **Performance Tracker:** Trade analytics + optimization feedback

### Data Flow
```
MT5 Market Data → Price Action Engine → Risk Validation → Immediate Execution
                         ↓
                  Performance Tracker
                         ↓
                  Parameter Optimizer
```

### Key Design Principles
- **No Multi-Agent Complexity:** Single-threaded execution pipeline
- **Traditional Indicators:** RSI, EMA, support/resistance generate signals
- **Hard Rules:** Risk manager uses deterministic validation (no AI interpretation)
- **Immediate Execution:** Trades execute immediately on valid signal

### Timeframes
- **M5:** Market structure identification (support/resistance, order blocks, trend)
- **M1:** Entry timing and momentum validation
- **No H1 or M15:** Too slow for scalping requirements

