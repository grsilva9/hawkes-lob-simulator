"""
Strategy framework v2 - Binary position system
Strategies return TARGET position (-1, 0, +1) instead of incremental trades
"""

import numpy as np
from abc import ABC, abstractmethod


class BaseStrategyV2(ABC):
    """
    Base class for binary position strategies
    """
    def __init__(self, params=None):
        self.params = params or {}
        
    @abstractmethod
    def get_target_position(self, market_data):
        """
        Determine target position based on market state
        
        Args:
            market_data: dict with keys:
                - t: current time
                - mid: mid price
                - spread: bid-ask spread
                - best_bid: best bid price
                - best_ask: best ask price
                - history: dict of recent data (mid, spread, etc.)
        
        Returns:
            target_position: -1 (short), 0 (flat), or +1 (long)
        """
        pass


class SMAStrategyV2(BaseStrategyV2):
    """
    Simple Moving Average mean reversion strategy
    Returns binary position: +1 when below SMA, -1 when above, 0 near SMA
    """
    def __init__(self, params=None):
        super().__init__(params)
        self.window = self.params.get('window', 50)
        self.entry_threshold = self.params.get('entry_threshold', 0.002)  # 0.2%
        self.exit_threshold = self.params.get('exit_threshold', 0.001)    # 0.1%
    
    def get_target_position(self, market_data):
        history = market_data['history']['mid']
        
        if len(history) < self.window:
            return 0  # Not enough data, stay flat
        
        sma = np.mean(history[-self.window:])
        current_mid = market_data['mid']
        
        deviation = (current_mid - sma) / sma
        
        # Mean reversion logic
        if deviation < -self.entry_threshold:
            return 1   # Price below SMA → expect reversion UP → go LONG
        elif deviation > self.entry_threshold:
            return -1  # Price above SMA → expect reversion DOWN → go SHORT
        elif abs(deviation) < self.exit_threshold:
            return 0   # Price near SMA → exit position
        
        # If in-between thresholds, maintain current position (handled by backtest)
        return None  # Signal to maintain current position


class MomentumStrategyV2(BaseStrategyV2):
    """
    Momentum strategy - follow the trend
    Returns binary position: +1 for uptrend, -1 for downtrend, 0 for flat
    """
    def __init__(self, params=None):
        super().__init__(params)
        self.lookback = self.params.get('lookback', 30)
        self.entry_threshold = self.params.get('entry_threshold', 0.002)
        self.exit_threshold = self.params.get('exit_threshold', 0.0005)
    
    def get_target_position(self, market_data):
        history = market_data['history']['mid']
        
        if len(history) < self.lookback + 1:
            return 0
        
        # Calculate momentum
        momentum = (history[-1] - history[-self.lookback]) / history[-self.lookback]
        
        # Follow the trend
        if momentum > self.entry_threshold:
            return 1   # Positive momentum → go LONG
        elif momentum < -self.entry_threshold:
            return -1  # Negative momentum → go SHORT
        elif abs(momentum) < self.exit_threshold:
            return 0   # Weak momentum → go FLAT
        
        return None  # Maintain position


class TrendFollowingV2(BaseStrategyV2):
    """
    Simple trend following: compare short vs long moving average
    """
    def __init__(self, params=None):
        super().__init__(params)
        self.short_window = self.params.get('short_window', 20)
        self.long_window = self.params.get('long_window', 50)
    
    def get_target_position(self, market_data):
        history = market_data['history']['mid']
        
        if len(history) < self.long_window:
            return 0
        
        short_ma = np.mean(history[-self.short_window:])
        long_ma = np.mean(history[-self.long_window:])
        
        # Golden cross / death cross
        if short_ma > long_ma * 1.001:  # Short above long → uptrend
            return 1
        elif short_ma < long_ma * 0.999:  # Short below long → downtrend
            return -1
        else:
            return 0  # Flat when MAs are close



def get_strategy_v2(name, params=None):
    """Factory function"""
    if name not in STRATEGIES_V2:
        raise ValueError(f"Unknown strategy: {name}. Available: {list(STRATEGIES_V2.keys())}")
    return STRATEGIES_V2[name](params)



class CustomStrategyV2(BaseStrategyV2):
    """
    Custom strategy defined by user expressions and rules
    """
    def __init__(self, params=None):
        super().__init__(params)
        self.name = self.params.get('name', 'Custom Strategy')
        self.functions = self.params.get('functions', [])
        self.entry_rules = self.params.get('entry_rules', [])
        self.exit_rules = self.params.get('exit_rules', [])
        
        # Import expression evaluator
        from lob_simulator.expression_evaluator import evaluate_expression
        self.evaluate_expression = evaluate_expression
        
        # Cache for function values
        self.function_cache = {}
    
    def get_target_position(self, market_data):
        """
        Evaluate custom rules to determine target position
        """
        current_position = market_data.get('current_position', 0)
        
        # Evaluate all custom functions first
        self._evaluate_functions(market_data)
        
        # Check entry rules (only if not already in position)
        for rule in self.entry_rules:
            if self._evaluate_rule(rule, market_data):
                action = rule.get('action', 'HOLD')
                return self._action_to_position(action)
        
        # Check exit rules (only if in a position)
        if current_position != 0:
            for rule in self.exit_rules:
                if self._evaluate_rule(rule, market_data):
                    action = rule.get('action', 'FLAT')
                    return self._action_to_position(action)
        
        # No rule matched - maintain current position
        return None
    
    def _evaluate_functions(self, market_data):
        """
        Evaluate all custom function definitions and cache results
        """
        self.function_cache = {}
        self.function_errors = {}  # NEW: Track errors
        
        variables = {
            'mid': market_data['mid'],
            'spread': market_data['spread'],
            'best_bid': market_data['best_bid'],
            'best_ask': market_data['best_ask'],
            'volume': market_data.get('volume', 0),
            'returns': market_data.get('returns', 0)
        }
        
        history = market_data['history']
        
        for func_def in self.functions:
            func_id = func_def['id']
            func_name = func_def.get('name', func_id)
            expression = func_def['expression']
            
            try:
                value = self.evaluate_expression(expression, variables, history)
                self.function_cache[func_id] = value
                
                # Clear any previous errors
                if func_id in self.function_errors:
                    del self.function_errors[func_id]
                    
            except Exception as e:
                # Store error details
                error_msg = f"Function '{func_name}' failed: {str(e)}"
                self.function_errors[func_id] = error_msg
                self.function_cache[func_id] = None
                
                # Log warning (only once per function)
                if not hasattr(self, '_logged_errors'):
                    self._logged_errors = set()
                
                if func_id not in self._logged_errors:
                    print(f"⚠️  {error_msg}")
                    self._logged_errors.add(func_id)


    def _evaluate_rule(self, rule, market_data):
        """
        Evaluate a rule (set of conditions with logic)
        
        Returns True if rule conditions are met
        """
        conditions = rule.get('conditions', [])
        logic = rule.get('logic', 'AND')
        
        if not conditions:
            return False
        
        results = []
        for condition in conditions:
            result = self._evaluate_condition(condition, market_data)
            results.append(result)
        
        if logic == 'AND':
            return all(results)
        elif logic == 'OR':
            return any(results)
        else:
            return False
    
    def _evaluate_condition(self, condition, market_data):
        """
        Evaluate a single condition
        
        Condition format:
        {
            'function_id': 'func1',
            'operator': '>',
            'threshold': 1.02
        }
        """
        func_id = condition.get('function_id')
        operator = condition.get('operator', '>')
        threshold = condition.get('threshold', 0)
        
        # Get function value from cache
        value = self.function_cache.get(func_id)
        
        if value is None:
            return False
        
        # Compare using operator
        return self._compare(value, operator, threshold)
    
    def _compare(self, value, operator, threshold):
        """
        Compare value with threshold using operator
        """
        if operator == '>':
            return value > threshold
        elif operator == '<':
            return value < threshold
        elif operator == '>=':
            return value >= threshold
        elif operator == '<=':
            return value <= threshold
        elif operator == '==':
            return abs(value - threshold) < 1e-9
        elif operator == '!=':
            return abs(value - threshold) >= 1e-9
        else:
            return False
    
    def _action_to_position(self, action):
        """
        Convert action string to position
        """
        if action == 'BUY':
            return 1
        elif action == 'SELL':
            return -1
        elif action == 'FLAT':
            return 0
        elif action == 'HOLD':
            return None
        else:
            return None


# Registry
STRATEGIES_V2 = {
    'sma': SMAStrategyV2,
    'momentum': MomentumStrategyV2,
    'trend_following': TrendFollowingV2,
    'custom': CustomStrategyV2  
}