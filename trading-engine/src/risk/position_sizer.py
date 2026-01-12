"""
Position sizing based on risk percentage and stop distance.
"""
from typing import Dict, Any, Optional
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class PositionSizer:
    """Calculates lot size based on risk percentage."""
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize position sizer.
        
        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.risk_config = config.get('risk', {})
        self.min_lot_size = self.risk_config.get('min_lot_size', 0.01)
        self.max_lot_size = self.risk_config.get('max_lot_size', 0.30)
        self.preferred_stop_percent = self.risk_config.get('stop_loss_range', {}).get('preferred', 0.30)
    
    def calculate_lot_size(self, equity: float, risk_percent: float, 
                          stop_distance_points: float, symbol: str = "XAUUSD") -> float:
        """
        Calculate position size based on risk percentage.
        
        Formula: lots = (equity × risk_percent) / (stop_distance_points × point_value_per_lot)
        
        Args:
            equity: Account equity
            risk_percent: Risk percentage per trade (e.g., 0.5 for 0.5%)
            stop_distance_points: Stop loss distance in points
            symbol: Trading symbol (default: XAUUSD)
        
        Returns:
            Lot size (rounded to 0.01)
        """
        if equity <= 0 or risk_percent <= 0 or stop_distance_points <= 0:
            logger.warning("Invalid parameters for lot size calculation")
            return self.min_lot_size
        
        # Calculate risk amount in account currency
        risk_amount = equity * (risk_percent / 100.0)
        
        # CRITICAL FIX: For XAUUSD:
        # - 1 lot = 100 oz
        # - 1 point = $1 move in price
        # - Point value = $100 per lot (not $1!)
        # - For 0.01 lot, 1 point move = $1.00
        point_value_per_lot = 100.0  # FIXED: $100 per point per lot for XAUUSD
        
        # Calculate lot size
        if stop_distance_points * point_value_per_lot == 0:
            logger.warning("Stop distance too small, using minimum lot size")
            return self.min_lot_size
        
        lots = risk_amount / (stop_distance_points * point_value_per_lot)
        
        # SAFETY CONTROL 1: Hard cap at 0.10 lot maximum
        HARD_MAX_LOT = 0.10
        if lots > HARD_MAX_LOT:
            logger.warning(f"Calculated lot size {lots:.2f} exceeds HARD_MAX_LOT {HARD_MAX_LOT}, capping")
            lots = HARD_MAX_LOT
        
        # Apply configured constraints FIRST (before rounding)
        lots = max(self.min_lot_size, min(lots, self.max_lot_size))
        
        # Round based on minimum lot size precision
        # If min_lot_size supports micro lots (0.001), round to 3 decimals
        # Otherwise round to 2 decimals (0.01)
        if self.min_lot_size < 0.01:
            # Micro lots: round to 3 decimals (0.001 precision)
            lots = round(lots, 3)
        else:
            # Standard lots: round to 2 decimals (0.01 precision)
            lots = round(lots, 2)
        
        # Final safety check: ensure we never go below minimum
        lots = max(self.min_lot_size, lots)
        
        # SAFETY CONTROL 2: Verify actual risk doesn't exceed 2%
        actual_risk_amount = lots * stop_distance_points * point_value_per_lot
        actual_risk_percent = (actual_risk_amount / equity) * 100.0
        
        # SAFETY CONTROL 3: Log expected vs actual risk
        # Use appropriate precision for lot size display
        lot_precision = 3 if self.min_lot_size < 0.01 else 2
        logger.info(f"[RISK CHECK] Lot Size: {lots:.{lot_precision}f} | Equity: ${equity:.2f} | "
                   f"Stop Distance: {stop_distance_points:.1f}pts | "
                   f"Risk Target: {risk_percent:.2f}% (${risk_amount:.2f}) | "
                   f"Risk Actual: {actual_risk_percent:.2f}% (${actual_risk_amount:.2f})")
        
        # SAFETY CONTROL 4: Assert max risk <= 2%
        MAX_RISK_PERCENT = 2.0
        if actual_risk_percent > MAX_RISK_PERCENT:
            logger.error(f"[SAFETY VIOLATION] Actual risk {actual_risk_percent:.2f}% exceeds MAX {MAX_RISK_PERCENT}%!")
            logger.error(f"[SAFETY VIOLATION] Reducing lot size to meet safety limit")
            # Recalculate lot size to meet max risk
            max_risk_amount = equity * (MAX_RISK_PERCENT / 100.0)
            lots = max_risk_amount / (stop_distance_points * point_value_per_lot)
            lots = max(self.min_lot_size, min(lots, self.max_lot_size))
            # Round with appropriate precision
            if self.min_lot_size < 0.01:
                lots = round(lots, 3)
            else:
                lots = round(lots, 2)
            lots = max(self.min_lot_size, lots)
            
            # Recalculate actual risk after adjustment
            actual_risk_amount = lots * stop_distance_points * point_value_per_lot
            actual_risk_percent = (actual_risk_amount / equity) * 100.0
            
            logger.warning(f"[SAFETY VIOLATION] Adjusted lot size to {lots:.2f} (risk now {actual_risk_percent:.2f}%)")
        
        return lots
    
    def calculate_stop_distance(self, entry_price: float, stop_percent: float) -> float:
        """
        Convert stop loss percentage to points.
        
        CRITICAL FIX: For XAUUSD scalping, config value 0.30 means 30 POINTS, not 0.30% of price.
        The config comment says "percentage" but the value is actually in points (multiply by 100).
        Example: stop_percent=0.30 → 30 points (not 0.30% of 2453.90 = 736 points!)
        
        Args:
            entry_price: Entry price (used for logging only)
            stop_percent: Stop loss value from config (e.g., 0.30 means 30 points)
        
        Returns:
            Stop distance in points (with 3-point safety buffer)
        """
        # CRITICAL FIX: Config value 0.30 is meant to be 30 points, not 0.30% of price
        # Multiply by 100 to convert: 0.30 → 30 points
        stop_distance_points = stop_percent * 100.0
        
        # Add 3-point safety buffer
        stop_distance_points += 3.0
        
        logger.debug(f"Stop distance: {stop_distance_points:.1f} points (from config: {stop_percent:.2f} → {stop_percent * 100:.0f} points)")
        
        return stop_distance_points
    
    def calculate_stop_distance_from_percent(self, entry_price: float, 
                                            stop_percent: Optional[float] = None) -> float:
        """
        Calculate stop distance using preferred stop percent from config.
        
        Args:
            entry_price: Entry price
            stop_percent: Optional override stop percent
        
        Returns:
            Stop distance in points
        """
        if stop_percent is None:
            stop_percent = self.preferred_stop_percent
        
        return self.calculate_stop_distance(entry_price, stop_percent)

