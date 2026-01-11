import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import './BacktestCharts.css';

const BacktestCharts = ({ results, marketData }) => {
  const priceChartContainerRef = useRef(null);
  const cumulativeChartContainerRef = useRef(null);
  const positionChartContainerRef = useRef(null);
  
  const priceChartRef = useRef(null);
  const cumulativeChartRef = useRef(null);
  const positionChartRef = useRef(null);
  
  const priceSeriesRef = useRef(null);
  const cumulativeSeriesRef = useRef({});
  const positionSeriesRef = useRef({});
  
  const [selectedStrategyForTrades, setSelectedStrategyForTrades] = useState(null);

  // Strategy colors
  const STRATEGY_COLORS = {
    'Buy & Hold': '#FFD700',
    'SMA Mean Reversion': '#00D9FF',
    'Momentum': '#FF1493',
    'SMA': '#00D9FF',
    'Trend Following': '#9b59b6',
  };

  const getColor = (name, index) => {
    if (STRATEGY_COLORS[name]) {
      return STRATEGY_COLORS[name];
    }
    
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#D62828', '#F77F00'
    ];
    
    return colors[index % colors.length];
  };

  // Get strategy names safely
  const strategyNames = results ? Object.keys(results).filter(name => !results[name].error) : [];

  // Initialize charts ONCE on mount
  useEffect(() => {
    if (!priceChartContainerRef.current || !cumulativeChartContainerRef.current || !positionChartContainerRef.current) return;

    const chartOptions = {
      layout: {
        background: { color: 'transparent' },
        textColor: '#e8e8e8',
      },
      grid: {
        vertLines: { color: '#2a3150' },
        horzLines: { color: '#2a3150' },
      },
      timeScale: {
        borderColor: '#2a3150',
        timeVisible: false,
        tickMarkFormatter: (time) => {
          // Display as event index
          return String(time);
        },
      },
      rightPriceScale: {
        borderColor: '#2a3150',
      },
    };

    priceChartRef.current = createChart(priceChartContainerRef.current, {
      ...chartOptions,
      width: priceChartContainerRef.current.clientWidth,
      height: 300,
    });

    cumulativeChartRef.current = createChart(cumulativeChartContainerRef.current, {
      ...chartOptions,
      width: cumulativeChartContainerRef.current.clientWidth,
      height: 300,
    });

    positionChartRef.current = createChart(positionChartContainerRef.current, {
      ...chartOptions,
      width: positionChartContainerRef.current.clientWidth,
      height: 300,
    });

    priceSeriesRef.current = priceChartRef.current.addLineSeries({
      color: '#6c7a89',
      lineWidth: 2,
    });

    const handleResize = () => {
      if (priceChartContainerRef.current && priceChartRef.current) {
        priceChartRef.current.applyOptions({ width: priceChartContainerRef.current.clientWidth });
      }
      if (cumulativeChartContainerRef.current && cumulativeChartRef.current) {
        cumulativeChartRef.current.applyOptions({ width: cumulativeChartContainerRef.current.clientWidth });
      }
      if (positionChartContainerRef.current && positionChartRef.current) {
        positionChartRef.current.applyOptions({ width: positionChartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (priceChartRef.current) priceChartRef.current.remove();
      if (cumulativeChartRef.current) cumulativeChartRef.current.remove();
      if (positionChartRef.current) positionChartRef.current.remove();
    };
  }, []);

  // Update price chart data and trade markers
  useEffect(() => {
    if (!priceSeriesRef.current || !marketData) return;

    // Build valid price data with sequential indices
    // Filter out null/NaN and create mapping from simulation time to chart index
    const validPriceData = [];
    const timeToIndexMap = new Map();
    
    marketData.times.forEach((time, i) => {
      const mid = marketData.mids[i];
      if (mid !== null && mid !== undefined && !isNaN(mid)) {
        const chartIndex = validPriceData.length;
        timeToIndexMap.set(time, chartIndex);
        validPriceData.push({
          time: chartIndex,  // Use sequential index, NOT simulation time
          value: mid,
          simTime: time,     // Keep original for reference
        });
      }
    });

    // Set price data
    priceSeriesRef.current.setData(
      validPriceData.map(d => ({ time: d.time, value: d.value }))
    );
    
    // Update markers for selected strategy
    if (selectedStrategyForTrades && results && results[selectedStrategyForTrades]) {
      const stratData = results[selectedStrategyForTrades];
      const trades = stratData.trades || [];
      const stratTimes = stratData.times || [];
      const color = getColor(selectedStrategyForTrades, 0);

      // Build time-to-index map for strategy times
      // Strategy times are filtered (no NaN), so they should map 1:1 with indices
      const stratTimeToIndexMap = new Map();
      stratTimes.forEach((t, idx) => {
        stratTimeToIndexMap.set(t, idx);
      });

      const markers = [];
      let matchedCount = 0;
      let unmatchedCount = 0;
      
      // Debug logging
      console.log(`=== Trade Matching Debug ===`);
      console.log(`Strategy: "${selectedStrategyForTrades}"`);
      console.log(`Total trades: ${trades.length}`);
      console.log(`Valid price points: ${validPriceData.length}`);
      console.log(`Strategy time points: ${stratTimes.length}`);
      
      if (validPriceData.length > 0) {
        console.log(`Price data time range: ${validPriceData[0].simTime.toFixed(4)} - ${validPriceData[validPriceData.length-1].simTime.toFixed(4)}`);
      }
      if (trades.length > 0) {
        console.log(`Trade time range: ${trades[0].time.toFixed(4)} - ${trades[trades.length-1].time.toFixed(4)}`);
      }

      trades.forEach((trade, tradeIdx) => {
        // Method 1: Direct lookup in strategy times
        // Since strategy processes valid data points sequentially,
        // the index in stratTimes corresponds to the index in validPriceData
        let chartIndex = -1;
        
        // Find which index in strategy times this trade occurred at
        const stratIdx = stratTimeToIndexMap.get(trade.time);
        if (stratIdx !== undefined && stratIdx < validPriceData.length) {
          chartIndex = stratIdx;
        }
        
        // Method 2: Fallback - find closest time in valid price data
        if (chartIndex < 0) {
          // Binary search for closest time
          let bestIdx = -1;
          let bestDiff = Infinity;
          
          for (let i = 0; i < validPriceData.length; i++) {
            const diff = Math.abs(validPriceData[i].simTime - trade.time);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestIdx = i;
            }
            // Early exit if exact match
            if (diff < 0.0001) break;
          }
          
          // Accept if within reasonable tolerance
          if (bestDiff < 0.1) {
            chartIndex = bestIdx;
          }
        }
        
        if (chartIndex >= 0 && chartIndex < validPriceData.length) {
          matchedCount++;
          markers.push({
            time: chartIndex,
            position: trade.trade_size > 0 ? 'belowBar' : 'aboveBar',
            color: color,
            shape: trade.trade_size > 0 ? 'arrowUp' : 'arrowDown',
            text: trade.trade_size > 0 ? 'B' : 'S',
          });
        } else {
          unmatchedCount++;
          if (unmatchedCount <= 3) {
            console.warn(`Unmatched trade #${tradeIdx}: time=${trade.time.toFixed(4)}, size=${trade.trade_size}`);
          }
        }
      });
      
      console.log(`Result: ${matchedCount} matched, ${unmatchedCount} unmatched`);
      console.log(`========================`);
      
      // Sort markers by time (required by lightweight-charts)
      markers.sort((a, b) => a.time - b.time);
      
      priceSeriesRef.current.setMarkers(markers);
    } else {
      priceSeriesRef.current.setMarkers([]);
    }

    if (priceChartRef.current) {
      priceChartRef.current.timeScale().fitContent();
    }
  }, [marketData, selectedStrategyForTrades, results]);

  // Update cumulative returns chart
  useEffect(() => {
    if (!cumulativeChartRef.current || !results || strategyNames.length === 0) return;

    // Clear old series
    Object.keys(cumulativeSeriesRef.current).forEach(key => {
      try {
        if (cumulativeSeriesRef.current[key]) {
          cumulativeChartRef.current.removeSeries(cumulativeSeriesRef.current[key]);
        }
      } catch (e) {
        // Series already removed
      }
    });
    cumulativeSeriesRef.current = {};

    // Add new series for each strategy
    strategyNames.forEach((name, index) => {
      const stratData = results[name];
      if (!stratData || !stratData.cumulative_returns) return;
      
      const color = getColor(name, index);

      const series = cumulativeChartRef.current.addLineSeries({
        color: color,
        lineWidth: name === 'Buy & Hold' ? 2 : 3,
      });

      // Use sequential indices for time axis
      const data = stratData.cumulative_returns.map((value, i) => ({
        time: i,
        value: value,
      }));

      series.setData(data);
      cumulativeSeriesRef.current[name] = series;
    });

    cumulativeChartRef.current.timeScale().fitContent();
  }, [results, strategyNames.join(',')]);

  // Update positions chart
  useEffect(() => {
    if (!positionChartRef.current || !results || strategyNames.length === 0) return;

    // Clear old series
    Object.keys(positionSeriesRef.current).forEach(key => {
      try {
        if (positionSeriesRef.current[key]) {
          positionChartRef.current.removeSeries(positionSeriesRef.current[key]);
        }
      } catch (e) {
        // Series already removed
      }
    });
    positionSeriesRef.current = {};

    // Add new series (exclude Buy & Hold which is always position=1)
    strategyNames.filter(name => name !== 'Buy & Hold').forEach((name, index) => {
      const stratData = results[name];
      if (!stratData || !stratData.positions) return;
      
      const color = getColor(name, index);

      const series = positionChartRef.current.addLineSeries({
        color: color,
        lineWidth: 2,
      });

      // Use sequential indices for time axis
      const data = stratData.positions.map((value, i) => ({
        time: i,
        value: value,
      }));

      series.setData(data);
      positionSeriesRef.current[name] = series;
    });

    positionChartRef.current.timeScale().fitContent();
  }, [results, strategyNames.join(',')]);

  return (
    <>
      <div className="chart-section chart-large">
        <div className="chart-header">
          <h3>Market Price & Trading Activity</h3>
          <select
            value={selectedStrategyForTrades || ''}
            onChange={(e) => setSelectedStrategyForTrades(e.target.value || null)}
            className="strategy-selector"
          >
            <option value="">No trades</option>
            {strategyNames.filter(name => name !== 'Buy & Hold').map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div ref={priceChartContainerRef} className="chart-container"></div>
      </div>

      <div className="chart-section chart-large">
        <div className="chart-header">
          <h3>Cumulative Returns</h3>
        </div>
        <div ref={cumulativeChartContainerRef} className="chart-container"></div>
      </div>

      <div className="chart-section chart-large">
        <div className="chart-header">
          <h3>Strategy Positions</h3>
        </div>
        <div ref={positionChartContainerRef} className="chart-container"></div>
      </div>
    </>
  );
};

export default BacktestCharts;