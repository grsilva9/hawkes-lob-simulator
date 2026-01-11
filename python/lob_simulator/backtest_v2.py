"""
Return-based backtesting engine for LOB strategies
Calculates returns properly: signal[t-1] * return[t]
"""

import numpy as np
import pandas as pd
from collections import deque


def run_backtest_v2(simulation_data, strategy, history_length=100, transaction_cost=0.0):
    """
    Run a strategy backtest with proper return calculation
    
    Args:
        simulation_data: dict from lob_core.run_simulation() or run_regime_simulation()
        strategy: BaseStrategy instance
        history_length: how many past events to keep in history
        transaction_cost: cost per trade as fraction of price (e.g., 0.001 = 0.1%)
    
    Returns:
        dict with backtest results including proper returns
    """
    # Convert to arrays
    times = np.array(simulation_data['t'])
    mids = np.array(simulation_data['mid'])
    spreads = np.array(simulation_data['spread'])
    best_bids = np.array(simulation_data['best_bid'])
    best_asks = np.array(simulation_data['best_ask'])
    
    # Remove NaNs
    valid_mask = ~np.isnan(mids) & ~np.isnan(spreads)
    times = times[valid_mask]
    mids = mids[valid_mask]
    spreads = spreads[valid_mask]
    best_bids = best_bids[valid_mask]
    best_asks = best_asks[valid_mask]
    
    if len(mids) < 2:
        return None
    
    # Initialize
    mid_history = deque(maxlen=history_length)
    spread_history = deque(maxlen=history_length)
    
    positions = []  # Position at each time step
    signals = []    # Trading signals
    trades = []     # Trade records
    
    current_position = 0
    
    # Generate signals
    for i in range(len(times)):
        # Prepare market data (only past)
        market_data = {
            't': times[i],
            'mid': mids[i],
            'spread': spreads[i],
            'best_bid': best_bids[i],
            'best_ask': best_asks[i],
            'history': {
                'mid': list(mid_history),
                'spread': list(spread_history)
            }
        }
        
        # Get signal
        signal, quantity = strategy.on_update(market_data)
        
        # Determine target position based on signal
        if signal == 'buy':
            target_position = current_position + quantity
        elif signal == 'sell':
            target_position = current_position - quantity
        elif signal == 'close':
            target_position = 0
        else:
            target_position = current_position
        
        # Record trade if position changed
        if target_position != current_position:
            trade_size = target_position - current_position
            trade_price = best_asks[i] if trade_size > 0 else best_bids[i]
            
            trades.append({
                'time': times[i],
                'position_before': current_position,
                'position_after': target_position,
                'trade_size': trade_size,
                'price': trade_price
            })
            
            current_position = target_position
        
        positions.append(current_position)
        signals.append(signal)
        
        # Update history
        mid_history.append(mids[i])
        spread_history.append(spreads[i])
    
    # Calculate returns
    positions = np.array(positions)
    
    # Price returns (simple returns)
    price_returns = np.diff(mids) / mids[:-1]
    
    # Strategy returns = position[t-1] * return[t]
    # Pad with 0 for first return
    strategy_returns = np.zeros(len(mids))
    strategy_returns[1:] = positions[:-1] * price_returns
    
    # Apply transaction costs
    # Cost incurred when position changes
    position_changes = np.diff(np.concatenate([[0], positions]))
    tc_costs = np.abs(position_changes) * transaction_cost
    strategy_returns[1:] -= tc_costs[1:]
    
    # Cumulative returns (multiplicative)
    cumulative_returns = np.cumprod(1 + strategy_returns)
    
    # Calculate metrics
    total_return = cumulative_returns[-1] - 1.0
    total_return_pct = total_return * 100
    
    # Sharpe ratio (annualized)
    if len(strategy_returns) > 1 and np.std(strategy_returns) > 0:
        sharpe = np.mean(strategy_returns) / np.std(strategy_returns) * np.sqrt(252)
    else:
        sharpe = 0.0
    
    # Maximum drawdown
    running_max = np.maximum.accumulate(cumulative_returns)
    drawdowns = (cumulative_returns - running_max) / running_max
    max_drawdown = np.min(drawdowns) * 100
    
    # Win rate
    winning_returns = strategy_returns[strategy_returns > 0]
    total_nonzero_returns = np.sum(strategy_returns != 0)
    win_rate = len(winning_returns) / total_nonzero_returns * 100 if total_nonzero_returns > 0 else 0
    
    metrics = {
        'total_return_pct': float(total_return_pct),
        'sharpe_ratio': float(sharpe),
        'max_drawdown': float(max_drawdown),
        'num_trades': len(trades),
        'win_rate': float(win_rate),
        'avg_return_per_period': float(np.mean(strategy_returns)),
        'volatility': float(np.std(strategy_returns)),
        'final_position': int(current_position)
    }
    
    results = {
        'times': times,
        'cumulative_returns': cumulative_returns,
        'strategy_returns': strategy_returns,
        'positions': positions,
        'trades': trades,
        'metrics': metrics,
        'mids': mids
    }
    
    return results


def calculate_buy_hold_returns_v2(simulation_data):
    """
    Calculate buy-and-hold returns properly with metrics
    """
    mids = np.array(simulation_data['mid'])
    times = np.array(simulation_data['t'])
    
    # Remove NaNs
    valid_mask = ~np.isnan(mids)
    mids = mids[valid_mask]
    times = times[valid_mask]
    
    if len(mids) < 2:
        return None
    
    # Simple returns
    returns = np.diff(mids) / mids[:-1]
    
    # Cumulative returns (buy and hold 1 unit)
    cumulative_returns = np.cumprod(1 + np.concatenate([[0], returns]))
    
    total_return_pct = (cumulative_returns[-1] - 1.0) * 100
    
    # Sharpe ratio
    if len(returns) > 0 and np.std(returns) > 0:
        sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252)
    else:
        sharpe = 0.0
    
    # Max drawdown
    running_max = np.maximum.accumulate(cumulative_returns)
    drawdowns = (cumulative_returns - running_max) / running_max
    max_drawdown = np.min(drawdowns) * 100
    
    metrics = {
        'total_return_pct': float(total_return_pct),
        'sharpe_ratio': float(sharpe),
        'max_drawdown': float(max_drawdown),
        'num_trades': 1,
        'win_rate': 100.0 if total_return_pct > 0 else 0.0,
    }
    
    return {
        'times': times,
        'cumulative_returns': cumulative_returns,
        'returns': returns,
        'metrics': metrics,
        'mids': mids
    }