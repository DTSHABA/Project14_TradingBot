# Trading Engine - High-Frequency Gold Scalping Bot

A standalone Python-based high-frequency trading engine for gold (XAUUSD) scalping during London/NY sessions.

## Features

- **Technical Analysis**: EMA, RSI, ATR, swing point identification
- **Signal Generation**: Structure Break Momentum algorithm
- **Risk Management**: Position sizing, circuit breakers, multi-layered exits
- **Execution**: Sub-2-second latency via MetaTrader 5 API
- **Session Management**: Time-based trading windows (GMT)
- **Analytics**: SQLite database for trade history and performance tracking

## Requirements

- Python 3.8+
- MetaTrader 5 account
- MetaTrader 5 terminal installed

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Copy `.env.example` to `.env` and configure:
```
MT5_LOGIN=your_account_number
MT5_PASSWORD=your_password
MT5_SERVER=your_broker_server
MT5_SYMBOL=XAUUSD
ENVIRONMENT=development
```

3. Review and adjust `config/config.yaml` for your risk parameters and trading sessions.

## Usage

Run the trading engine:
```bash
python -m src.main
```

The engine runs in 30-second cycles, monitoring the market, generating signals, and executing trades according to the configured strategy.

## Configuration

Key configuration files:
- `config/config.yaml`: Risk parameters, trading sessions, circuit breaker thresholds
- `.env`: MT5 credentials and environment settings

## Project Structure

```
trading-engine/
├── config/           # Configuration files
├── src/
│   ├── main.py       # Entry point and execution loop
│   ├── market_data/  # MT5 connector, indicators
│   ├── signals/      # Signal generation
│   ├── risk/         # Risk management
│   ├── execution/    # Order execution
│   ├── position/     # Position management
│   ├── session/      # Session and volatility filtering
│   ├── analytics/    # Database and performance tracking
│   └── utils/        # Types and logging
└── requirements.txt
```

## Performance Targets

- **Win Rate**: 65%+
- **Stop Loss**: 0.25-0.40% (preferred 0.30%)
- **Risk-Reward**: 1:1.2 (preferred)
- **Trades/Day**: 15-30 during London/NY sessions
- **Execution Latency**: <2 seconds

## Safety Features

- Circuit breakers for consecutive losses and drawdowns
- Time-based position exits (15-minute maximum)
- Breakeven protection
- Partial exit strategy
- Session-based risk multipliers

## Logging

Logs are stored in `logs/` directory with daily rotation and 30-day retention.

## Database

SQLite database (`trading_engine.db`) stores:
- Signals
- Trades (entry/exit)
- Sessions
- Circuit breaker events

## Disclaimer

This is a trading system for educational purposes. Trading involves risk of loss. Always test thoroughly in a demo environment before using with real funds.













