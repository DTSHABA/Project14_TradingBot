#!/bin/bash
# Trading Engine Startup Script
echo "Starting Trading Engine..."
cd "$(dirname "$0")"
python -m src.main

