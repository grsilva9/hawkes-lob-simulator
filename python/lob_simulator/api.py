"""
Flask API for LOB Simulation Platform
Provides endpoints for regime-switching simulations and strategy backtesting
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
import traceback


# Get the directory containing this file
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '../..'))
python_dir = os.path.join(project_root, 'python')
build_dir = os.path.join(project_root, 'build')

# Add directories to path
sys.path.insert(0, python_dir)
sys.path.insert(0, build_dir)

print(f"Python dir: {python_dir}")
print(f"Build dir: {build_dir}")

try:
    import lob_core
    print("✓ lob_core imported successfully")
except ImportError as e:
    print(f"ERROR: Could not import lob_core: {e}")
    print(f"Make sure the C++ module is built in: {build_dir}")
    sys.exit(1)

try:
    from lob_simulator.strategies_v2 import get_strategy_v2, STRATEGIES_V2
    from lob_simulator.backtest_v3 import run_backtest_v3, calculate_buy_hold_v3
    from lob_simulator.expression_evaluator import validate_expression
    from lob_simulator.strategy_validator import (
        validate_strategy_definition, 
        estimate_strategy_requirements,
        get_strategy_summary
    )
    from lob_simulator.strategy_templates import (
        get_all_templates,
        get_template,
        get_templates_by_category,
        get_template_summary
    )
    print("✓ Strategy modules imported successfully")
except ImportError as e:
    print(f"ERROR: Could not import strategy modules: {e}")
    print(f"Python path: {sys.path}")
    traceback.print_exc()
    sys.exit(1)

import numpy as np

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Default regime configuration
DEFAULT_REGIME = {
    'num_events': 500,
    'seed': 42,
    'time_unit': 'seconds',
    'mu': [2.0, 2.0, 1.0, 1.0, 1.5, 1.5],
    'alpha': [
        [0.6, 0.1, 0.1, 0.0, 0.2, 0.0],
        [0.1, 0.6, 0.0, 0.1, 0.0, 0.2],
        [0.1, 0.0, 0.4, 0.1, 0.1, 0.0],
        [0.0, 0.1, 0.1, 0.4, 0.0, 0.1],
        [0.2, 0.0, 0.1, 0.0, 0.5, 0.1],
        [0.0, 0.2, 0.0, 0.1, 0.1, 0.5]
    ],
    'beta': [[1.5]*6 for _ in range(6)]
}

# Default strategy configurations
DEFAULT_STRATEGIES = {
    'sma': {
        'window': 50,
        'entry_threshold': 0.0003,
        'exit_threshold': 0.00015
    },
    'momentum': {
        'lookback': 30,
        'entry_threshold': 0.0002,
        'exit_threshold': 0.0001
    },
    'trend_following': {
        'short_window': 20,
        'long_window': 50
    }
}

@app.route('/available_strategies', methods=['GET'])
def available_strategies():
    """Return list of available strategies with their parameters"""
    return jsonify({
        'strategies': list(STRATEGIES_V2.keys()),
        'default_params': DEFAULT_STRATEGIES
    })


@app.route('/simulate_regimes', methods=['POST'])
def simulate_regimes():
    """
    Run regime-switching simulation
    
    Request body:
    {
        "regimes": [
            {
                "num_events": 500,
                "seed": 42,
                "time_unit": "seconds",
                "mu": [...],
                "alpha": [[...]],
                "beta": [[...]]
            },
            ...
        ],
        "price_center": 100.0,  // optional
        "tick_size": 0.1        // optional
    }
    
    Returns: Simulation data (times, mids, spreads, etc.)
    """
    try:
        data = request.get_json()
        
        if not data or 'regimes' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing "regimes" in request body'
            }), 400
        
        regimes = data['regimes']
        
        # Validate regimes
        if not isinstance(regimes, list) or len(regimes) == 0:
            return jsonify({
                'success': False,
                'error': 'regimes must be a non-empty list'
            }), 400
        
        # Get time_unit from first regime (assuming all regimes use same unit)
        time_unit = regimes[0].get('time_unit', 'seconds') if regimes else 'seconds'
        
        # Run simulation
        sim_data = lob_core.run_regime_simulation(regimes)
        
        # Convert numpy arrays to lists for JSON serialization
        # Convert numpy arrays to lists for JSON serialization
        response = {
            'success': True,
            'simulation': {
                't': [float(x) for x in sim_data['t']],
                'mid': [float(x) if not np.isnan(x) else None for x in sim_data['mid']],
                'spread': [float(x) if not np.isnan(x) else None for x in sim_data['spread']],
                'best_bid': [float(x) if not np.isnan(x) else None for x in sim_data['best_bid']],
                'best_ask': [float(x) if not np.isnan(x) else None for x in sim_data['best_ask']],
                'regime': [int(x) for x in sim_data['regime']],
                'event_types': [int(x) for x in sim_data['evt']],      # ADD THIS
                'quantities': [int(x) for x in sim_data['qty']],       # ADD THIS
                'time_unit': time_unit
            },
            'num_events': len(sim_data['t']),
            'num_regimes': len(regimes)
        }
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/backtest', methods=['POST'])
def backtest():
    """
    Run backtest with strategies on given regimes
    
    Request body:
    {
        "regimes": [...],           // Regime configurations
        "strategies": {             // Strategies to test
            "sma": { "window": 50, ... },
            "momentum": { ... }
        },
        "transaction_cost": 0.0001,  // optional
        "include_buy_hold": true     // optional, default true
    }
    
    Returns: Full backtest results with metrics for all strategies
    """
    try:
        data = request.get_json()
        
        if not data or 'regimes' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing "regimes" in request body'
            }), 400
        
        regimes = data['regimes']
        strategies_config = data.get('strategies', DEFAULT_STRATEGIES)
        transaction_cost = data.get('transaction_cost', 0.0001)
        include_buy_hold = data.get('include_buy_hold', True)
        
        # Get time_unit
        time_unit = regimes[0].get('time_unit', 'seconds') if regimes else 'seconds'
        
        # Run simulation
        sim_data = lob_core.run_regime_simulation(regimes)
        
        # Results storage
        results = {
            'simulation': {
                't': [float(x) for x in sim_data['t']],
                'mid': [float(x) if not np.isnan(x) else None for x in sim_data['mid']],
                'spread': [float(x) if not np.isnan(x) else None for x in sim_data['spread']],
                'time_unit': time_unit  # ADDED
            },
            'strategies': {}
        }
        
        # Add Buy & Hold
        if include_buy_hold:
            bh_results = calculate_buy_hold_v3(sim_data)
            results['strategies']['Buy & Hold'] = {
                'cumulative_returns': [float(x) for x in bh_results['cumulative_returns']],
                'positions': [int(x) for x in bh_results['positions']],
                'trades': [],
                'metrics': bh_results['metrics']
            }
        
        # Run each strategy
        for strat_name, params in strategies_config.items():
            try:
                strategy = get_strategy_v2(strat_name, params)
                strat_results = run_backtest_v3(sim_data, strategy, transaction_cost=transaction_cost)
                
                results['strategies'][strat_name] = {
                    'cumulative_returns': [float(x) for x in strat_results['cumulative_returns']],
                    'positions': [int(x) for x in strat_results['positions']],
                    'trades': [
                        {
                            'time': float(t['time']),
                            'position_before': int(t['position_before']),
                            'position_after': int(t['position_after']),
                            'trade_size': int(t['trade_size']),
                            'price': float(t['price'])
                        }
                        for t in strat_results['trades']
                    ],
                    'metrics': strat_results['metrics']
                }
                
            except Exception as e:
                results['strategies'][strat_name] = {
                    'error': str(e)
                }
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/monte_carlo', methods=['POST'])
def monte_carlo():
    """
    Run Monte Carlo simulation (multiple runs with different seeds)
    
    Request body:
    {
        "regimes": [...],           // Base regime config (seed will be varied)
        "strategies": {...},
        "num_runs": 100,            // Number of MC simulations
        "base_seed": 42,            // Starting seed
        "transaction_cost": 0.0001
    }
    
    Returns: Distribution of returns for each strategy
    """
    try:
        data = request.get_json()
        
        if not data or 'regimes' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing "regimes" in request body'
            }), 400
        
        base_regimes = data['regimes']
        strategies_config = data.get('strategies', DEFAULT_STRATEGIES)
        num_runs = data.get('num_runs', 100)
        base_seed = data.get('base_seed', 42)
        transaction_cost = data.get('transaction_cost', 0.0001)
        
        # Storage for results
        mc_results = {
            strat_name: {
                'returns': [],
                'sharpe_ratios': [],
                'max_drawdowns': [],
                'num_trades': []
            }
            for strat_name in strategies_config.keys()
        }
        
        mc_results['Buy & Hold'] = {
            'returns': [],
            'sharpe_ratios': [],
            'max_drawdowns': [],
            'num_trades': []
        }
        
        # Run Monte Carlo
        for run_idx in range(num_runs):
            # Vary seed for each run
            regimes = []
            for regime in base_regimes:
                regime_copy = regime.copy()
                regime_copy['seed'] = base_seed + run_idx * 100 + regimes.index(regime)
                regimes.append(regime_copy)
            
            # Run simulation
            sim_data = lob_core.run_regime_simulation(regimes)
            
            # Buy & Hold
            bh_results = calculate_buy_hold_v3(sim_data)
            mc_results['Buy & Hold']['returns'].append(bh_results['metrics']['total_return_pct'])
            mc_results['Buy & Hold']['sharpe_ratios'].append(bh_results['metrics']['sharpe_ratio'])
            mc_results['Buy & Hold']['max_drawdowns'].append(bh_results['metrics']['max_drawdown'])
            mc_results['Buy & Hold']['num_trades'].append(1)
            
            # Each strategy
            for strat_name, params in strategies_config.items():
                try:
                    strategy = get_strategy_v2(strat_name, params)
                    strat_results = run_backtest_v3(sim_data, strategy, transaction_cost=transaction_cost)
                    
                    mc_results[strat_name]['returns'].append(strat_results['metrics']['total_return_pct'])
                    mc_results[strat_name]['sharpe_ratios'].append(strat_results['metrics']['sharpe_ratio'])
                    mc_results[strat_name]['max_drawdowns'].append(strat_results['metrics']['max_drawdown'])
                    mc_results[strat_name]['num_trades'].append(strat_results['metrics']['num_trades'])
                    
                except Exception as e:
                    # Skip this run for this strategy
                    pass
        
        # Calculate statistics
        summary = {}
        for strat_name, data in mc_results.items():
            if len(data['returns']) > 0:
                summary[strat_name] = {
                    'mean_return': float(np.mean(data['returns'])),
                    'std_return': float(np.std(data['returns'])),
                    'min_return': float(np.min(data['returns'])),
                    'max_return': float(np.max(data['returns'])),
                    'median_return': float(np.median(data['returns'])),
                    'mean_sharpe': float(np.mean(data['sharpe_ratios'])),
                    'mean_max_dd': float(np.mean(data['max_drawdowns'])),
                    'mean_trades': float(np.mean(data['num_trades'])),
                    'win_rate': float(np.sum(np.array(data['returns']) > 0) / len(data['returns']) * 100),
                    'distributions': data  # Full distributions for plotting
                }
        
        return jsonify({
            'success': True,
            'num_runs': num_runs,
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/default_regimes', methods=['GET'])
def default_regimes():
    """Return example regime configurations"""
    examples = {
        'single_calm': [DEFAULT_REGIME],
        'calm_to_volatile': [
            DEFAULT_REGIME,
            {
                'num_events': 500,
                'seed': 123,
                'time_unit': 'seconds',
                'mu': [3.5, 3.5, 1.8, 1.8, 2.5, 2.5],
                'alpha': [[0.8, 0.2, 0.2, 0.0, 0.3, 0.0],
                          [0.2, 0.8, 0.0, 0.2, 0.0, 0.3],
                          [0.2, 0.0, 0.6, 0.2, 0.2, 0.0],
                          [0.0, 0.2, 0.2, 0.6, 0.0, 0.2],
                          [0.3, 0.0, 0.2, 0.0, 0.7, 0.2],
                          [0.0, 0.3, 0.0, 0.2, 0.2, 0.7]],
                'beta': [[2.0]*6 for _ in range(6)]
            }
        ]
    }
    
    return jsonify(examples)

@app.route('/api/validate_expression', methods=['POST'])
def validate_expression_endpoint():
    """
    Validate a user expression
    """
    try:
        data = request.json
        expression = data.get('expression', '')
        
        is_valid, error, suggestion = validate_expression(expression)
        
        return jsonify({
            'valid': is_valid,
            'error': error,
            'suggestion': suggestion
        })
    
    except Exception as e:
        return jsonify({
            'valid': False,
            'error': str(e),
            'suggestion': None
        }), 400

@app.route('/api/backtest', methods=['POST'])
def run_backtest():
    """
    Run backtest with custom strategies
    
    Request format:
    {
        "regimes": [...],  # Same as simulate endpoint
        "strategies": [
            {
                "name": "My Strategy",
                "type": "custom",  # or "sma", "momentum", etc.
                "params": {
                    "functions": [...],
                    "entry_rules": [...],
                    "exit_rules": [...]
                }
            }
        ],
        "transaction_cost": 0.0001
    }
    """
    try:
        data = request.json
        regimes = data.get('regimes', [])
        strategies_config = data.get('strategies', [])
        transaction_cost = data.get('transaction_cost', 0.0001)
        
        if not regimes:
            return jsonify({'success': False, 'error': 'No regimes provided'}), 400
        
        if not strategies_config:
            return jsonify({'success': False, 'error': 'No strategies provided'}), 400
        
        # Run simulation
        print(f"Running simulation with {len(regimes)} regime(s)...")
        sim_data = lob_core.run_regime_simulation(regimes)
        
        # Helper function to safely convert to JSON-serializable types
        def to_json_safe(obj):
            """Convert numpy types to Python native types"""
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, (np.int64, np.int32, np.int16, np.int8)):
                return int(obj)
            elif isinstance(obj, (np.float64, np.float32, np.float16)):
                return float(obj)
            elif isinstance(obj, dict):
                return {k: to_json_safe(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [to_json_safe(item) for item in obj]
            else:
                return obj
        
        # Run each strategy
        results = {}
        
        # Always include Buy & Hold
        print("Running Buy & Hold...")
        bh_results = calculate_buy_hold_v3(sim_data)
        results['Buy & Hold'] = {
            'metrics': to_json_safe(bh_results['metrics']),
            'times': to_json_safe(bh_results['times']),
            'cumulative_returns': to_json_safe(bh_results['cumulative_returns']),
            'positions': to_json_safe(bh_results['positions']),
            'trades': to_json_safe(bh_results['trades'])
        }
        
        # Run user strategies
        for strat_config in strategies_config:
            strat_name = strat_config.get('name', 'Unnamed Strategy')
            strat_type = strat_config.get('type', 'sma')
            strat_params = strat_config.get('params', {})
            
            print(f"Running strategy: {strat_name} (type: {strat_type})")
            
            try:
                strategy = get_strategy_v2(strat_type, strat_params)
                strat_results = run_backtest_v3(sim_data, strategy, transaction_cost=transaction_cost)
                
                if strat_results:
                    # Limit trades to first 100 for response size
                    trades = strat_results['trades'][:100] if len(strat_results['trades']) > 100 else strat_results['trades']
                    
                    results[strat_name] = {
                        'metrics': to_json_safe(strat_results['metrics']),
                        'times': to_json_safe(strat_results['times']),
                        'cumulative_returns': to_json_safe(strat_results['cumulative_returns']),
                        'positions': to_json_safe(strat_results['positions']),
                        'trades': to_json_safe(trades)
                    }
                else:
                    results[strat_name] = {
                        'error': 'Strategy execution failed'
                    }
            
            except Exception as e:
                print(f"Error running strategy {strat_name}: {str(e)}")
                traceback.print_exc()
                results[strat_name] = {
                    'error': str(e)
                }
        
        print(f"✓ Backtest complete. Returning {len(results)} strategy results.")
        
        return jsonify({
            'success': True,
            'results': results,
            'market_data': {
                'times': to_json_safe(sim_data['t']),
                'mids': to_json_safe(sim_data['mid']),
                'spreads': to_json_safe(sim_data['spread'])
            }
        })
    
    except Exception as e:
        print(f"Backtest error: {str(e)}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/validate_strategy', methods=['POST'])
def validate_strategy():
    """
    Validate a complete strategy definition
    
    Request format:
    {
        "strategy": {
            "name": "...",
            "functions": [...],
            "entry_rules": [...],
            "exit_rules": [...]
        }
    }
    
    Response:
    {
        "valid": true/false,
        "errors": [...],
        "warnings": [...],
        "requirements": {
            "min_data_points": 60,
            "variables_used": ["mid", "spread"],
            "max_window": 50
        },
        "summary": {...}
    }
    """
    try:
        data = request.json
        strategy_config = data.get('strategy', {})
        
        if not strategy_config:
            return jsonify({
                'valid': False,
                'errors': ['No strategy provided'],
                'warnings': []
            }), 400
        
        # Validate strategy
        is_valid, errors, warnings = validate_strategy_definition(strategy_config)
        
        # Get requirements
        requirements = estimate_strategy_requirements(strategy_config)
        
        # Get summary
        summary = get_strategy_summary(strategy_config)
        
        return jsonify({
            'valid': is_valid,
            'errors': errors,
            'warnings': warnings,
            'requirements': requirements,
            'summary': summary
        })
    
    except Exception as e:
        print(f"Strategy validation error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'valid': False,
            'errors': [str(e)],
            'warnings': []
        }), 500


@app.route('/api/strategy_templates', methods=['GET'])
def get_strategy_templates():
    """
    Get all strategy templates
    
    Optional query params:
    - category: filter by category
    - summary: if true, return summary only
    
    Response:
    {
        "templates": [...],
        "categories": ["Mean Reversion", "Momentum", ...]
    }
    """
    try:
        # Check if summary requested
        summary_only = request.args.get('summary', 'false').lower() == 'true'
        category_filter = request.args.get('category', None)
        
        if summary_only:
            templates = get_template_summary()
            
            # Filter by category if specified
            if category_filter:
                templates = [t for t in templates if t['category'] == category_filter]
            
            # Get unique categories
            categories = list(set(t['category'] for t in templates))
            
            return jsonify({
                'success': True,
                'templates': templates,
                'categories': sorted(categories)
            })
        else:
            # Return full templates organized by category
            templates_by_category = get_templates_by_category()
            all_templates = get_all_templates()
            
            return jsonify({
                'success': True,
                'templates': all_templates,
                'by_category': templates_by_category,
                'categories': sorted(templates_by_category.keys())
            })
    
    except Exception as e:
        print(f"Template fetch error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/strategy_templates/<template_id>', methods=['GET'])
def get_strategy_template(template_id):
    """
    Get a specific strategy template by ID
    
    Response:
    {
        "success": true,
        "template": {...}
    }
    """
    try:
        template = get_template(template_id)
        
        if not template:
            return jsonify({
                'success': False,
                'error': f"Template '{template_id}' not found"
            }), 404
        
        return jsonify({
            'success': True,
            'template': template
        })
    
    except Exception as e:
        print(f"Template fetch error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/explain_expression', methods=['POST'])
def explain_expression():
    """
    Provide human-readable explanation of an expression
    
    Request:
    {
        "expression": "mid / SMA(mid, 50)"
    }
    
    Response:
    {
        "expression": "mid / SMA(mid, 50)",
        "explanation": "Current mid price divided by 50-period simple moving average",
        "variables_used": ["mid"],
        "functions_used": ["SMA"],
        "estimated_min_data": 50
    }
    """
    try:
        data = request.json
        expression = data.get('expression', '')
        
        if not expression:
            return jsonify({
                'success': False,
                'error': 'No expression provided'
            }), 400
        
        # Validate first
        is_valid, error, suggestion = validate_expression(expression)
        
        if not is_valid:
            return jsonify({
                'success': False,
                'error': error,
                'suggestion': suggestion
            }), 400
        
        # Parse expression to extract info
        import re
        
        variables_used = []
        for var in ['mid', 'spread', 'best_bid', 'best_ask', 'volume', 'returns']:
            if var in expression:
                variables_used.append(var)
        
        functions_used = []
        function_names = ['SMA', 'EMA', 'STD', 'MIN', 'MAX', 'MOMENTUM', 'RSI', 'ATR', 'BBWIDTH']
        for func in function_names:
            if func in expression:
                functions_used.append(func)
        
        # Extract window sizes
        window_pattern = r'\b(?:SMA|EMA|STD|MIN|MAX|MOMENTUM|RSI)\s*\(\s*\w+\s*,\s*(\d+)\s*\)'
        matches = re.findall(window_pattern, expression)
        max_window = max([int(w) for w in matches]) if matches else 0
        
        # Generate explanation
        explanation = _generate_explanation(expression, variables_used, functions_used)
        
        return jsonify({
            'success': True,
            'expression': expression,
            'explanation': explanation,
            'variables_used': variables_used,
            'functions_used': functions_used,
            'estimated_min_data': max_window + 10
        })
    
    except Exception as e:
        print(f"Expression explanation error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def _generate_explanation(expression, variables, functions):
    """
    Generate human-readable explanation of expression
    """
    # Simple heuristics for common patterns
    explanations = {
        'mid / SMA(mid': 'Current price relative to moving average',
        'MOMENTUM(mid': 'Price momentum over',
        'STD(mid': 'Price volatility over',
        'spread /': 'Spread relative to',
        'EMA(mid': 'Exponentially weighted price over',
        'RSI(mid': 'Relative strength index over',
    }
    
    for pattern, desc in explanations.items():
        if pattern in expression:
            return desc
    
    # Fallback: generic description
    if functions:
        func_str = ', '.join(functions)
        var_str = ', '.join(variables)
        return f"Calculation using {func_str} on {var_str}"
    
    return "Custom calculation based on market data"

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    Returns system status and available features
    """
    try:
        return jsonify({
            'status': 'healthy',
            'version': '1.0.0',
            'features': {
                'simulation': True,
                'backtesting': True,
                'custom_strategies': True,
                'strategy_templates': True,
                'expression_validation': True
            },
            'available_functions': list(validate_expression.__globals__.get('_evaluator', None).ALLOWED_FUNCTIONS.keys()) if '_evaluator' in validate_expression.__globals__ else [],
            'available_templates': len(get_all_templates())
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


if __name__ == '__main__':
    print("="*60)
    print("LOB Simulator API Starting...")
    print("="*60)
    print(f"✓ lob_core module loaded")
    print(f"✓ Available strategies: {list(STRATEGIES_V2.keys())}")
    print(f"✓ Endpoints:")
    print(f"  - GET  /health")
    print(f"  - GET  /available_strategies")
    print(f"  - POST /simulate_regimes")
    print(f"  - POST /backtest")
    print(f"  - POST /monte_carlo")
    print(f"  - GET  /default_regimes")
    print("="*60)
    app.run(host='0.0.0.0', port=5000, debug=True)