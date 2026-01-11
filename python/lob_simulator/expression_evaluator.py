"""
Safe expression evaluator for custom trading strategy functions
Allows users to define mathematical transformations with safeguards
"""

import ast
import operator
import numpy as np
import re


class SafeExpressionEvaluator:
    """
    Safely evaluates user-defined mathematical expressions
    """
    
    # Allowed binary operations
    ALLOWED_OPS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.Mod: operator.mod,
    }
    
    # Allowed unary operations
    ALLOWED_UNARY_OPS = {
        ast.USub: operator.neg,
        ast.UAdd: operator.pos,
    }
    
    # Allowed built-in functions with their implementations
    # Add to ALLOWED_FUNCTIONS dictionary:
    ALLOWED_FUNCTIONS = {
        'SMA': 'simple_moving_average',
        'EMA': 'exponential_moving_average',
        'STD': 'standard_deviation',
        'MIN': 'minimum',
        'MAX': 'maximum',
        'ABS': 'absolute',
        'SQRT': 'square_root',
        'EXP': 'exponential',
        'LOG': 'logarithm',
        'MOMENTUM': 'momentum',
        'PERCENTILE': 'percentile',
        'SUM': 'summation',
        'MEAN': 'mean',
        'RSI': 'relative_strength_index',      # NEW
        'ATR': 'average_true_range',           # NEW
        'BBWIDTH': 'bollinger_band_width',     # NEW
    }
        
    # Allowed variable names
    ALLOWED_VARIABLES = ['mid', 'spread', 'best_bid', 'best_ask', 'volume', 'returns']
    
    # Maximum expression depth (prevent stack overflow)
    MAX_DEPTH = 15
    
    def __init__(self):
        self.depth = 0
    
    def validate_expression(self, expression):
        """
        Validate that expression is safe to evaluate
        
        Args:
            expression: str - mathematical expression
        
        Returns:
            (is_valid, error_message, suggestion)
        """
        if not expression or not expression.strip():
            return False, "Expression cannot be empty", None
        
        # Check for dangerous patterns
        dangerous_patterns = [
            '__', 'import', 'eval', 'exec', 'compile', 'open', 'file',
            'input', 'raw_input', '__builtins__', 'globals', 'locals',
            'vars', 'dir', 'help', 'quit', 'exit'
        ]
        
        expr_lower = expression.lower()
        for pattern in dangerous_patterns:
            if pattern in expr_lower:
                return False, f"Forbidden pattern detected: '{pattern}'", None
        
        try:
            # Parse the expression
            tree = ast.parse(expression, mode='eval')
            
            # Reset depth counter
            self.depth = 0
            
            # Validate the AST
            self._validate_node(tree.body)
            
            return True, None, None
            
        except SyntaxError as e:
            return False, f"Syntax error: {str(e)}", self._suggest_fix(expression, str(e))
        except ValueError as e:
            return False, str(e), self._suggest_fix(expression, str(e))
        except Exception as e:
            return False, f"Validation error: {str(e)}", None
    
    def _validate_node(self, node, depth=0):
        """Recursively validate AST nodes"""
        
        # Check depth
        if depth > self.MAX_DEPTH:
            raise ValueError(f"Expression too complex (max depth: {self.MAX_DEPTH})")
        
        if isinstance(node, ast.Constant):
            # Constants are safe (numbers, strings)
            if not isinstance(node.value, (int, float)):
                raise ValueError(f"Only numeric constants allowed, got {type(node.value).__name__}")
            return
        
        elif isinstance(node, ast.Num):  # Python 3.7 compatibility
            return
        
        elif isinstance(node, ast.Name):
            # Check if variable is allowed
            if node.id not in self.ALLOWED_VARIABLES:
                suggestion = self._find_similar_variable(node.id)
                if suggestion:
                    raise ValueError(f"Variable '{node.id}' not allowed. Did you mean '{suggestion}'?")
                else:
                    raise ValueError(f"Variable '{node.id}' not allowed. Available: {', '.join(self.ALLOWED_VARIABLES)}")
        
        elif isinstance(node, ast.BinOp):
            # Binary operation (e.g., a + b)
            if type(node.op) not in self.ALLOWED_OPS:
                raise ValueError(f"Operation '{type(node.op).__name__}' not allowed")
            self._validate_node(node.left, depth + 1)
            self._validate_node(node.right, depth + 1)
        
        elif isinstance(node, ast.UnaryOp):
            # Unary operation (e.g., -a)
            if type(node.op) not in self.ALLOWED_UNARY_OPS:
                raise ValueError(f"Operation '{type(node.op).__name__}' not allowed")
            self._validate_node(node.operand, depth + 1)
        
        elif isinstance(node, ast.Call):
            # Function call
            if not isinstance(node.func, ast.Name):
                raise ValueError("Complex function calls not allowed")
            
            func_name = node.func.id
            if func_name not in self.ALLOWED_FUNCTIONS:
                suggestion = self._find_similar_function(func_name)
                if suggestion:
                    raise ValueError(f"Function '{func_name}' not allowed. Did you mean '{suggestion}'?")
                else:
                    raise ValueError(f"Function '{func_name}' not allowed. Available: {', '.join(self.ALLOWED_FUNCTIONS.keys())}")
            
            # Validate arguments
            for arg in node.args:
                self._validate_node(arg, depth + 1)
            
            # Validate keyword arguments (if any)
            for keyword in node.keywords:
                self._validate_node(keyword.value, depth + 1)
        
        elif isinstance(node, ast.Compare):
            # Comparison (not needed in function definitions, but allowed)
            self._validate_node(node.left, depth + 1)
            for comparator in node.comparators:
                self._validate_node(comparator, depth + 1)
        
        else:
            raise ValueError(f"Expression type '{type(node).__name__}' not allowed")
    
    def _find_similar_variable(self, name):
        """Find similar variable name (fuzzy match)"""
        name_lower = name.lower()
        for var in self.ALLOWED_VARIABLES:
            if var.lower().startswith(name_lower[:3]):
                return var
        return None
    
    def _find_similar_function(self, name):
        """Find similar function name (fuzzy match)"""
        name_lower = name.lower()
        for func in self.ALLOWED_FUNCTIONS.keys():
            if func.lower().startswith(name_lower[:3]):
                return func
        return None
    
    def _suggest_fix(self, expression, error):
        """Generate helpful suggestions based on common errors"""
        # Common mistakes
        if 'price' in expression.lower():
            return "Use 'mid' instead of 'price'"
        if 'average' in expression.lower() or 'avg' in expression.lower():
            return "Use 'SMA(mid, window)' for moving average"
        if 'stddev' in expression.lower():
            return "Use 'STD(mid, window)' for standard deviation"
        
        return None

    def _rewrite_tree(self, node, variables):
        """
        Rewrite AST to convert variable names to strings inside function calls
        This allows functions to receive 'mid' as string for history lookup,
        while direct usage like "mid > 100" uses the current value
        """
        if isinstance(node, ast.Call):
            # This is a function call - check if it's one of our functions
            if isinstance(node.func, ast.Name) and node.func.id in self.ALLOWED_FUNCTIONS:
                # Rewrite arguments: if argument is a variable name, convert to string literal
                new_args = []
                for arg in node.args:
                    if isinstance(arg, ast.Name) and arg.id in self.ALLOWED_VARIABLES:
                        # Convert variable reference to string literal
                        new_arg = ast.Constant(value=arg.id)
                        ast.copy_location(new_arg, arg)
                        new_args.append(new_arg)
                    else:
                        # Recursively rewrite other arguments
                        new_args.append(self._rewrite_tree(arg, variables))
                
                new_node = ast.Call(
                    func=node.func,
                    args=new_args,
                    keywords=node.keywords
                )
                ast.copy_location(new_node, node)
                return new_node
        
        elif isinstance(node, ast.BinOp):
            new_node = ast.BinOp(
                left=self._rewrite_tree(node.left, variables),
                op=node.op,
                right=self._rewrite_tree(node.right, variables)
            )
            ast.copy_location(new_node, node)
            return new_node
        
        elif isinstance(node, ast.UnaryOp):
            new_node = ast.UnaryOp(
                op=node.op,
                operand=self._rewrite_tree(node.operand, variables)
            )
            ast.copy_location(new_node, node)
            return new_node
        
        # Return node unchanged for constants, names (outside function calls), etc.
        return node
    
    def evaluate(self, expression, variables, history):
        """
        Safely evaluate expression with given variables and history
        
        Args:
            expression: str - mathematical expression
            variables: dict - current values (mid, spread, etc.)
            history: dict - historical data arrays (e.g., history['mid'] = [...])
        
        Returns:
            float or None
        """
        # Validate first
        is_valid, error, _ = self.validate_expression(expression)
        if not is_valid:
            raise ValueError(f"Invalid expression: {error}")
        
        # Create safe evaluation context
        eval_context = ExpressionEvaluationContext(variables, history)
        
        # Parse the expression to identify function calls
        tree = ast.parse(expression, mode='eval')
        
        # Rewrite the tree: replace variable names in function arguments with strings
        rewritten = self._rewrite_tree(tree.body, variables)
        
        # Fix missing location information in rewritten tree
        ast.fix_missing_locations(rewritten)
        
        # Create namespace with current values for direct variable access
        namespace = {
            'mid': variables.get('mid'),
            'spread': variables.get('spread'),
            'best_bid': variables.get('best_bid'),
            'best_ask': variables.get('best_ask'),
            'volume': variables.get('volume', 0),
            'returns': variables.get('returns', 0),
            '__builtins__': {}
        }
        
        # Add functions
        namespace['SMA'] = lambda data, window: eval_context.sma(data, window)
        namespace['EMA'] = lambda data, window: eval_context.ema(data, window)
        namespace['STD'] = lambda data, window: eval_context.std(data, window)
        namespace['MIN'] = lambda data, window: eval_context.minimum(data, window)
        namespace['MAX'] = lambda data, window: eval_context.maximum(data, window)
        namespace['MOMENTUM'] = lambda data, window: eval_context.momentum(data, window)
        namespace['PERCENTILE'] = lambda data, window, pct: eval_context.percentile(data, window, pct)
        namespace['SUM'] = lambda data, window: eval_context.summation(data, window)
        namespace['MEAN'] = lambda data, window: eval_context.mean(data, window)
        # Add to namespace in evaluate() method:
        namespace['RSI'] = lambda data, window=14: eval_context.rsi(data, window)
        namespace['ATR'] = lambda h, l, c, window=14: eval_context.atr(h, l, c, window)
        namespace['BBWIDTH'] = lambda data, window=20, num_std=2: eval_context.bbwidth(data, window, num_std)


        # Math functions (handle both numeric and variable inputs)
        def safe_math_func(func, check_func=None):
            def wrapper(x):
                if isinstance(x, str):
                    x = variables.get(x, 0)
                if check_func and not check_func(x):
                    return None
                return func(x)
            return wrapper
        
        namespace['ABS'] = lambda x: abs(x) if not isinstance(x, str) else abs(variables.get(x, 0))
        namespace['SQRT'] = safe_math_func(np.sqrt, lambda x: x >= 0)
        namespace['EXP'] = safe_math_func(lambda x: np.exp(x) if x < 100 else None, lambda x: x < 100)
        namespace['LOG'] = safe_math_func(np.log, lambda x: x > 0)
        
        try:
            # Compile and evaluate the rewritten expression
            code = compile(ast.Expression(body=rewritten), '<string>', 'eval')
            result = eval(code, namespace)
            
            # Validate result
            if result is None:
                return None
            
            if isinstance(result, (int, float)) and np.isfinite(result):
                return float(result)
            else:
                return None
                
        except ZeroDivisionError:
            raise ValueError("Division by zero in expression")
        except OverflowError:
            raise ValueError("Numeric overflow in expression")
        except Exception as e:
            raise ValueError(f"Evaluation error: {str(e)}")





class ExpressionEvaluationContext:
    """
    Context for evaluating expressions with access to market history
    """
    
    def __init__(self, variables, history):
        self.variables = variables
        self.history = history
        
    def _get_data(self, data_or_name, window):
        """
        Get data array from either variable name or direct data
        With better error handling
        """
        if isinstance(data_or_name, str):
            # It's a variable name, look up in history
            if data_or_name not in self.history:
                available = ', '.join(self.history.keys())
                raise ValueError(
                    f"No history available for '{data_or_name}'. "
                    f"Available variables: {available}"
                )
            data = self.history[data_or_name]
        else:
            # It's already an array/list
            data = data_or_name
        
        # Check if we have enough data
        if len(data) < window:
            raise ValueError(
                f"Insufficient data: need {window} points for window calculation, "
                f"but only {len(data)} available. Strategy may need more historical data."
            )
        
        return np.array(data[-window:])

    def sma(self, data, window):
        """Simple Moving Average"""
        arr = self._get_data(data, window)
        if arr is None:
            return None
        return float(np.mean(arr))
    
    def ema(self, data, window):
        """Exponential Moving Average"""
        if isinstance(data, str):
            if data not in self.history:
                return None
            data = self.history[data]
        
        if len(data) < window:
            return None
        
        alpha = 2 / (window + 1)
        ema = data[-window]
        for val in data[-window+1:]:
            ema = alpha * val + (1 - alpha) * ema
        return float(ema)
    
    def std(self, data, window):
        """Standard Deviation"""
        arr = self._get_data(data, window)
        if arr is None:
            return None
        return float(np.std(arr))
    
    def minimum(self, data, window):
        """Minimum over window"""
        arr = self._get_data(data, window)
        if arr is None:
            return None
        return float(np.min(arr))
    
    def maximum(self, data, window):
        """Maximum over window"""
        arr = self._get_data(data, window)
        if arr is None:
            return None
        return float(np.max(arr))
    
    def momentum(self, data, window):
        """Momentum (percentage change)"""
        if isinstance(data, str):
            if data not in self.history:
                return None
            data = self.history[data]
        
        if len(data) < window + 1:
            return None
        
        return float((data[-1] - data[-window]) / data[-window])
    
    def percentile(self, data, window, pct):
        """Percentile over window"""
        arr = self._get_data(data, window)
        if arr is None:
            return None
        return float(np.percentile(arr, pct * 100))
    
    def summation(self, data, window):
        """Sum over window"""
        arr = self._get_data(data, window)
        if arr is None:
            return None
        return float(np.sum(arr))
    
    def mean(self, data, window):
        """Mean (alias for SMA)"""
        return self.sma(data, window)

    def rsi(self, data, window=14):
        """
        Relative Strength Index
        Measures momentum, oscillates between 0-100
        """
        if isinstance(data, str):
            if data not in self.history:
                return None
            data = self.history[data]
        
        if len(data) < window + 1:
            return None
        
        # Calculate price changes
        prices = np.array(data[-window-1:])
        deltas = np.diff(prices)
        
        # Separate gains and losses
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        # Calculate average gains and losses
        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return float(rsi)

    def atr(self, high_data, low_data, close_data, window=14):
        """
        Average True Range
        Measures volatility
        
        For LOB data, we can approximate:
        high = best_ask, low = best_bid, close = mid
        """
        # For simplicity, use spread as proxy for true range
        # In real implementation, would need high/low/close
        if isinstance(high_data, str):
            # Simplified: just use current spread volatility
            if 'spread' in self.history:
                spread_data = self.history['spread']
                if len(spread_data) < window:
                    return None
                return float(np.mean(spread_data[-window:]))
        
        return None

    def bbwidth(self, data, window=20, num_std=2):
        """
        Bollinger Band Width
        Measures volatility via band width
        """
        if isinstance(data, str):
            if data not in self.history:
                return None
            data = self.history[data]
        
        if len(data) < window:
            return None
        
        arr = np.array(data[-window:])
        sma = np.mean(arr)
        std = np.std(arr)
        
        upper = sma + num_std * std
        lower = sma - num_std * std
        
        width = (upper - lower) / sma
        
        return float(width)


# Singleton instance
_evaluator = SafeExpressionEvaluator()


def validate_expression(expression):
    """
    Validate an expression
    Returns: (is_valid, error_message, suggestion)
    """
    return _evaluator.validate_expression(expression)


def evaluate_expression(expression, variables, history):
    """
    Evaluate an expression
    Returns: float or None
    """
    return _evaluator.evaluate(expression, variables, history)