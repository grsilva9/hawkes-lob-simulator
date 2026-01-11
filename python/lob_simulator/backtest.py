"""
Backtesting engine for LOB strategies
"""

import numpy as np
import pandas as pd
from collections import deque


def run_backtest(simulation_data, strategy, history_length=100):
    """
    Run a strategy backtest on simulation data
    
    Args:
        simulation_data: dict from lob_core.run_simulation() or run_regime_simulation()
        strategy: BaseStrategy instance
        history_length: how many past events to keep in history
    
    Returns:
        dict with backtest results
    """
    # Convert to arrays for easier indexing
    times = np.array(simulation_data['t'])
    mids = np.array(simulation_data['mid'])
    spreads = np.array(simulation_data['spread'])
    best_bids = np.array(simulation_data['best_bid'])
    best_asks = np.array(simulation_data['best_ask'])
    
    # Initialize history buffers
    mid_history = deque(maxlen=history_length)
    spread_history = deque(maxlen=history_length)
    
    # Run strategy on each event
    for i in range(len(times)):
        # Skip if NaN
        if np.isnan(mids[i]) or np.isnan(spreads[i]):
            continue
        
        # CRITICAL: Prepare market data using ONLY past data (not including current point)
        market_data = {
            't': times[i],
            'mid': mids[i],
            'spread': spreads[i],
            'best_bid': best_bids[i],
            'best_ask': best_asks[i],
            'history': {
                'mid': list(mid_history),      # Only past observations
                'spread': list(spread_history)  # Only past observations
            }
        }
        
        # Get strategy signal based on past data only
        signal, quantity = strategy.on_update(market_data)
        
        # Execute trade if signal generated
        if signal:
            # Use best ask for buys, best bid for sells
            price = best_asks[i] if signal == 'buy' else best_bids[i]
            if signal == 'close':
                price = mids[i]
            
            strategy.execute_trade(signal, quantity, price, times[i])
        
        # NOW append current observation to history (after decision made)
        mid_history.append(mids[i])
        spread_history.append(spreads[i])
        
        # Record PnL
        portfolio_value = strategy.get_portfolio_value(mids[i])
        strategy.pnl_history.append(portfolio_value)
    
    # Compile results
    metrics = strategy.get_metrics()
    
    # Normalize PnL curve to start at 1.0 (percentage returns)
    pnl_array = np.array(strategy.pnl_history)
    initial_value = pnl_array[0]
    normalized_pnl = pnl_array / initial_value
    
    results = {
        'metrics': metrics,
        'trades': strategy.trades,
        'pnl_curve': strategy.pnl_history,
        'normalized_pnl': normalized_pnl.tolist(),
        'final_position': strategy.position,
        'final_cash': strategy.cash
    }
    
    return results

def calculate_buy_hold_returns(simulation_data):
    """
    Calculate buy-and-hold benchmark returns
    
    Buy 1 unit at the first valid mid price, hold until the end
    """
    mids = np.array(simulation_data['mid'])
    times = np.array(simulation_data['t'])
    
    # Remove NaNs
    valid_mask = ~np.isnan(mids)
    mids_clean = mids[valid_mask]
    times_clean = times[valid_mask]
    
    if len(mids_clean) == 0:
        return [], []
    
    # Normalize to start at 1.0
    initial_price = mids_clean[0]
    normalized_prices = mids_clean / initial_price
    
    return times_clean, normalized_prices