"""
Backtesting engine v3 - Binary position system
"""

import numpy as np
import pandas as pd
from collections import deque


def calculate_advanced_metrics(strategy_returns, cumulative_returns, positions):
    """
    Calculate advanced performance metrics
    
    Args:
        strategy_returns: array of period returns
        cumulative_returns: array of cumulative returns (in percentage form, where 0 = no change)
        positions: array of positions over time
    
    Returns:
        dict of advanced metrics
    """
    # Convert cumulative_returns back to growth factor for internal calculations
    growth_factor = 1 + cumulative_returns / 100
    
    # Sortino Ratio (downside deviation)
    downside_returns = strategy_returns[strategy_returns < 0]
    if len(downside_returns) > 0:
        downside_std = np.std(downside_returns)
        sortino = np.mean(strategy_returns) / downside_std * np.sqrt(252) if downside_std > 0 else 0
    else:
        sortino = 0.0
    
    # Calmar Ratio (return / max drawdown)
    running_max = np.maximum.accumulate(growth_factor)
    drawdowns = (growth_factor - running_max) / running_max
    max_dd = abs(np.min(drawdowns))
    
    total_return = growth_factor[-1] - 1.0
    calmar = total_return / max_dd if max_dd > 0 else 0.0
    
    # Profit Factor (gross profit / gross loss)
    winning_returns = strategy_returns[strategy_returns > 0]
    losing_returns = strategy_returns[strategy_returns < 0]
    
    gross_profit = np.sum(winning_returns) if len(winning_returns) > 0 else 0
    gross_loss = abs(np.sum(losing_returns)) if len(losing_returns) > 0 else 0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0.0
    
    # Average win/loss
    avg_win = np.mean(winning_returns) if len(winning_returns) > 0 else 0
    avg_loss = np.mean(losing_returns) if len(losing_returns) > 0 else 0
    
    # Win/Loss ratio
    win_loss_ratio = abs(avg_win / avg_loss) if avg_loss != 0 else 0
    
    # Max consecutive wins/losses
    max_consecutive_wins = 0
    max_consecutive_losses = 0
    current_wins = 0
    current_losses = 0
    
    for ret in strategy_returns:
        if ret > 0:
            current_wins += 1
            current_losses = 0
            max_consecutive_wins = max(max_consecutive_wins, current_wins)
        elif ret < 0:
            current_losses += 1
            current_wins = 0
            max_consecutive_losses = max(max_consecutive_losses, current_losses)
    
    # Expectancy (average profit per trade)
    nonzero_returns = strategy_returns[strategy_returns != 0]
    expectancy = np.mean(nonzero_returns) if len(nonzero_returns) > 0 else 0
    
    # Ulcer Index (measure of downside volatility)
    ulcer = np.sqrt(np.mean(drawdowns ** 2))
    
    return {
        'sortino_ratio': float(sortino),
        'calmar_ratio': float(calmar),
        'profit_factor': float(profit_factor),
        'avg_win': float(avg_win * 100),  # as percentage
        'avg_loss': float(avg_loss * 100),  # as percentage
        'win_loss_ratio': float(win_loss_ratio),
        'max_consecutive_wins': int(max_consecutive_wins),
        'max_consecutive_losses': int(max_consecutive_losses),
        'expectancy': float(expectancy * 100),  # as percentage
        'ulcer_index': float(ulcer * 100)  # as percentage
    }

def run_backtest_v3(simulation_data, strategy, transaction_cost=0.0, history_length=100):
    """
    Run backtest with binary position system
    
    Strategy returns target position (-1, 0, +1), backtest handles transitions
    
    Returns cumulative_returns in PERCENTAGE format (0 = no change, 1.5 = +1.5% return)
    This ensures consistency with metrics.total_return_pct
    """
    # Extract data
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
    
    positions = []
    trades = []
    
    current_position = 0
    
    # Generate positions
    for i in range(len(times)):
        # Market data (only past)
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
        
        # Get target position from strategy
        target_position = strategy.get_target_position(market_data)
        
        # If None returned, maintain current position
        if target_position is None:
            target_position = current_position
        
        # Clip to binary range
        target_position = np.clip(target_position, -1, 1)
        
        # Record trade if position changed
        if target_position != current_position:
            position_change = target_position - current_position
            
            # Determine trade price (pay spread)
            if position_change > 0:  # Buying
                trade_price = best_asks[i]
            else:  # Selling
                trade_price = best_bids[i]
            
            trades.append({
                'time': times[i],
                'position_before': current_position,
                'position_after': target_position,
                'trade_size': position_change,
                'price': trade_price
            })
            
            current_position = target_position
        
        positions.append(current_position)
        
        # Update history
        mid_history.append(mids[i])
        spread_history.append(spreads[i])
    
    # Calculate returns
    positions = np.array(positions)
    
    # Price returns
    price_returns = np.diff(mids) / mids[:-1]
    
    # Strategy returns = position[t-1] * return[t]
    strategy_returns = np.zeros(len(mids))
    strategy_returns[1:] = positions[:-1] * price_returns
    
    # Apply transaction costs
    position_changes = np.diff(np.concatenate([[0], positions]))
    tc_costs = np.abs(position_changes) * transaction_cost
    strategy_returns[1:] -= tc_costs[1:]
    
    # Cumulative returns as growth factor (for internal calculations)
    cumulative_growth = np.cumprod(1 + strategy_returns)
    
    # CONVERT TO PERCENTAGE FORMAT for output
    # This ensures chart Y-axis matches the metrics table
    # 0% = no change, 1.5% = +1.5% return
    cumulative_returns_pct = (cumulative_growth - 1.0) * 100
    
    # Calculate metrics
    total_return = cumulative_growth[-1] - 1.0
    total_return_pct = total_return * 100
    
    # Sharpe ratio
    if len(strategy_returns) > 1 and np.std(strategy_returns) > 0:
        sharpe = np.mean(strategy_returns) / np.std(strategy_returns) * np.sqrt(252)
    else:
        sharpe = 0.0
    
    # Max drawdown (calculated from growth factor)
    running_max = np.maximum.accumulate(cumulative_growth)
    drawdowns = (cumulative_growth - running_max) / running_max
    max_drawdown = np.min(drawdowns) * 100
    
    # Win rate
    winning_returns = strategy_returns[strategy_returns > 0]
    total_nonzero_returns = np.sum(strategy_returns != 0)
    win_rate = len(winning_returns) / total_nonzero_returns * 100 if total_nonzero_returns > 0 else 0
    
    # Time in market
    time_long = np.sum(positions == 1) / len(positions) * 100
    time_short = np.sum(positions == -1) / len(positions) * 100
    time_flat = np.sum(positions == 0) / len(positions) * 100
    
    metrics = {
        'total_return_pct': float(total_return_pct),
        'sharpe_ratio': float(sharpe),
        'max_drawdown': float(max_drawdown),
        'num_trades': len(trades),
        'win_rate': float(win_rate),
        'time_long_pct': float(time_long),
        'time_short_pct': float(time_short),
        'time_flat_pct': float(time_flat),
        'avg_return_per_period': float(np.mean(strategy_returns)),
        'volatility': float(np.std(strategy_returns)),
        'final_position': int(current_position)
    }

    advanced_metrics = calculate_advanced_metrics(strategy_returns, cumulative_returns_pct, positions)
    metrics.update(advanced_metrics)
    
    results = {
        'times': times,
        'cumulative_returns': cumulative_returns_pct,  # NOW IN PERCENTAGE FORMAT
        'strategy_returns': strategy_returns,
        'positions': positions,
        'trades': trades,
        'metrics': metrics,
        'mids': mids
    }
    
    return results

def calculate_buy_hold_v3(simulation_data):
    """Buy and hold = constant position of +1
    
    Returns cumulative_returns in PERCENTAGE format (0 = no change, 1.5% = +1.5% return)
    """
    mids = np.array(simulation_data['mid'])
    times = np.array(simulation_data['t'])
    
    valid_mask = ~np.isnan(mids)
    mids = mids[valid_mask]
    times = times[valid_mask]
    
    if len(mids) < 2:
        return None
    
    # Position always = 1
    positions = np.ones(len(mids))
    
    # Returns
    returns = np.diff(mids) / mids[:-1]
    strategy_returns = np.concatenate([[0], returns])  # position=1 × returns
    
    # Cumulative returns as growth factor (for internal calculations)
    cumulative_growth = np.cumprod(1 + strategy_returns)
    
    # CONVERT TO PERCENTAGE FORMAT for output
    cumulative_returns_pct = (cumulative_growth - 1.0) * 100
    
    total_return_pct = (cumulative_growth[-1] - 1.0) * 100
    
    if len(returns) > 0 and np.std(returns) > 0:
        sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252)
    else:
        sharpe = 0.0
    
    # Max drawdown (calculated from growth factor)
    running_max = np.maximum.accumulate(cumulative_growth)
    drawdowns = (cumulative_growth - running_max) / running_max
    max_drawdown = np.min(drawdowns) * 100
    
    metrics = {
        'total_return_pct': float(total_return_pct),
        'sharpe_ratio': float(sharpe),
        'max_drawdown': float(max_drawdown),
        'num_trades': 1,
        'win_rate': 100.0 if total_return_pct > 0 else 0.0,
        'time_long_pct': 100.0,
        'time_short_pct': 0.0,
        'time_flat_pct': 0.0,
    }
    
    return {
        'times': times,
        'cumulative_returns': cumulative_returns_pct,  # NOW IN PERCENTAGE FORMAT
        'returns': strategy_returns,
        'positions': positions,
        'trades': [],
        'metrics': metrics,
        'mids': mids
    }