"""
Strategy framework for LOB backtesting
"""

import numpy as np
from abc import ABC, abstractmethod

"""
Strategy framework for LOB backtesting
"""

import numpy as np
from abc import ABC, abstractmethod


class BaseStrategy(ABC):
    """
    Base class for all trading strategies
    """
    def __init__(self, params=None):
        self.params = params or {}
        self.position = 0  # Current position (positive = long, negative = short)
        self.cash = 100000.0  # Starting capital
        self.trades = []  # History of trades
        self.pnl_history = []  # PnL over time
        
    @abstractmethod
    def on_update(self, market_data):
        """
        Called on every market event
        
        Args:
            market_data: dict with keys:
                - t: current time
                - mid: mid price
                - spread: bid-ask spread
                - best_bid: best bid price
                - best_ask: best ask price
                - history: dict of recent data (mid, spread, etc.)
        
        Returns:
            (signal, quantity) where signal is 'buy', 'sell', 'close', or None
        """
        pass
    
    def execute_trade(self, signal, quantity, price, time):
        """
        Execute a trade and update position/cash
        Allows both long and short positions
        """
        if signal == 'buy':
            cost = quantity * price
            # Allow buying regardless of cash (margin/shorting model)
            self.position += quantity
            self.cash -= cost
            self.trades.append({
                'time': time,
                'type': 'buy',
                'quantity': quantity,
                'price': price,
                'position': self.position
            })
        
        elif signal == 'sell':
            # Allow selling regardless of position (shorting allowed)
            self.position -= quantity
            self.cash += quantity * price
            self.trades.append({
                'time': time,
                'type': 'sell',
                'quantity': quantity,
                'price': price,
                'position': self.position
            })
        
        elif signal == 'close' and self.position != 0:
            # Close entire position
            if self.position > 0:
                # Close long position
                self.cash += self.position * price
                quantity = self.position
                self.position = 0
            else:
                # Close short position
                self.cash -= abs(self.position) * price
                quantity = abs(self.position)
                self.position = 0
            
            self.trades.append({
                'time': time,
                'type': 'close',
                'quantity': quantity,
                'price': price,
                'position': 0
            })
    
    def get_portfolio_value(self, current_mid):
        """Calculate current portfolio value (cash + position marked-to-market)"""
        return self.cash + self.position * current_mid
    
    def get_metrics(self):
        """Calculate strategy performance metrics"""
        if len(self.pnl_history) < 2:
            return {}
        
        pnl_array = np.array(self.pnl_history)
        
        # Calculate returns properly
        initial_value = pnl_array[0]
        final_value = pnl_array[-1]
        
        total_pnl = final_value - initial_value
        total_return_pct = (final_value / initial_value - 1.0) * 100
        
        # Calculate returns series for Sharpe
        returns = np.diff(pnl_array) / (pnl_array[:-1] + 1e-10)
        
        # Sharpe ratio (annualized, assuming ~252 trading periods in the time span)
        if len(returns) > 0 and np.std(returns) > 0:
            sharpe = np.mean(returns) / np.std(returns) * np.sqrt(min(252, len(returns)))
        else:
            sharpe = 0.0
        
        max_dd = self._max_drawdown(pnl_array)
        
        return {
            'total_pnl': float(total_pnl),
            'total_return_pct': float(total_return_pct),
            'sharpe_ratio': float(sharpe),
            'max_drawdown': float(max_dd),
            'num_trades': len(self.trades),
            'final_position': self.position,
            'initial_value': float(initial_value),
            'final_value': float(final_value)
        }
    
    def _max_drawdown(self, pnl_curve):
        """Calculate maximum drawdown"""
        running_max = np.maximum.accumulate(pnl_curve)
        drawdown = (pnl_curve - running_max) / (running_max + 1e-10)
        return float(np.min(drawdown) * 100)



class SMAStrategy(BaseStrategy):
    """
    Simple Moving Average mean reversion strategy
    """
    def __init__(self, params=None):
        super().__init__(params)
        self.window = self.params.get('window', 50)
        self.threshold = self.params.get('threshold', 0.002)  # 0.2%
        self.max_position = self.params.get('max_position', 10)
    
    def on_update(self, market_data):
        history = market_data['history']['mid']
        
        if len(history) < self.window:
            return None, 0
        
        sma = np.mean(history[-self.window:])
        current_mid = market_data['mid']
        
        deviation = (current_mid - sma) / sma
        
        # Mean reversion logic
        if deviation < -self.threshold and self.position < self.max_position:
            return 'buy', 1
        elif deviation > self.threshold and self.position > -self.max_position:
            return 'sell', 1
        elif abs(deviation) < self.threshold * 0.3 and self.position != 0:
            # Close when back near SMA
            return 'close', 0
        
        return None, 0


class MomentumStrategy(BaseStrategy):
    """
    Momentum strategy - trade in direction of recent returns
    """
    def __init__(self, params=None):
        super().__init__(params)
        self.lookback = self.params.get('lookback', 20)
        self.threshold = self.params.get('threshold', 0.001)
        self.max_position = self.params.get('max_position', 10)
    
    def on_update(self, market_data):
        history = market_data['history']['mid']
        
        if len(history) < self.lookback + 1:
            return None, 0
        
        # Calculate momentum
        momentum = (history[-1] - history[-self.lookback]) / history[-self.lookback]
        
        # Trade in direction of momentum
        if momentum > self.threshold and self.position < self.max_position:
            return 'buy', 1
        elif momentum < -self.threshold and self.position > -self.max_position:
            return 'sell', 1
        elif abs(momentum) < self.threshold * 0.5 and self.position != 0:
            return 'close', 0
        
        return None, 0


class SpreadStrategy(BaseStrategy):
    """
    Market making strategy based on spread
    """
    def __init__(self, params=None):
        super().__init__(params)
        self.min_spread = self.params.get('min_spread', 0.15)
        self.max_position = self.params.get('max_position', 5)
    
    def on_update(self, market_data):
        spread = market_data['spread']
        
        # Only provide liquidity when spread is wide enough
        if spread > self.min_spread:
            if abs(self.position) < self.max_position:
                # Alternate between buying and selling
                if self.position <= 0:
                    return 'buy', 1
                else:
                    return 'sell', 1
        
        return None, 0


# Registry of available strategies
STRATEGIES = {
    'sma': SMAStrategy,
    'momentum': MomentumStrategy,
    'spread': SpreadStrategy
}


def get_strategy(name, params=None):
    """Factory function to create strategies"""
    if name not in STRATEGIES:
        raise ValueError(f"Unknown strategy: {name}. Available: {list(STRATEGIES.keys())}")
    return STRATEGIES[name](params)