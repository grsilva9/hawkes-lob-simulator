import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import './CandlestickChart.css';

const CandlestickChart = ({ data, playbackMode }) => {
  const priceChartRef = useRef();
  const volumeChartRef = useRef();
  const priceChartInstanceRef = useRef();
  const volumeChartInstanceRef = useRef();
  const candlestickSeriesRef = useRef();
  const volumeSeriesRef = useRef();
  const syncingRef = useRef(false); // Prevent infinite sync loops

  useEffect(() => {
    if (!priceChartRef.current || !volumeChartRef.current) return;

    const timeUnit = data?.time_unit || 'seconds';

    // Price Chart (upper 70%)
    const priceChart = createChart(priceChartRef.current, {
      width: priceChartRef.current.clientWidth,
      height: priceChartRef.current.clientHeight,
      layout: {
        background: { color: '#1A2235' },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        visible: false, // Hide time on upper chart
        tickMarkFormatter: (time) => formatTimeLabel(time, timeUnit),
      },
    });

    // Volume Chart (lower 30%)
    const volumeChart = createChart(volumeChartRef.current, {
      width: volumeChartRef.current.clientWidth,
      height: volumeChartRef.current.clientHeight,
      layout: {
        background: { color: '#1A2235' },
        textColor: 'rgba(255, 255, 255, 0.7)',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time) => formatTimeLabel(time, timeUnit),
      },
    });

    const candlestickSeries = priceChart.addCandlestickSeries({
      upColor: '#00ff88',
      downColor: '#ff4466',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff4466',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff4466',
    });

    const volumeSeries = volumeChart.addHistogramSeries({
      color: '#5B8DEF',
      priceFormat: {
        type: 'volume',
      },
    });

    priceChartInstanceRef.current = priceChart;
    volumeChartInstanceRef.current = volumeChart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // SAFE TIME SCALE SYNC with protection against null ranges and infinite loops
    priceChart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
      if (!timeRange || syncingRef.current) return;
      
      try {
        syncingRef.current = true;
        const currentVolumeRange = volumeChart.timeScale().getVisibleRange();
        
        // Only update if ranges are significantly different
        if (!currentVolumeRange || 
            Math.abs(currentVolumeRange.from - timeRange.from) > 0.001 || 
            Math.abs(currentVolumeRange.to - timeRange.to) > 0.001) {
          volumeChart.timeScale().setVisibleRange(timeRange);
        }
      } catch (e) {
        // Silently ignore sync errors during initialization
        console.debug('Price chart sync skipped:', e.message);
      } finally {
        syncingRef.current = false;
      }
    });

    volumeChart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
      if (!timeRange || syncingRef.current) return;
      
      try {
        syncingRef.current = true;
        const currentPriceRange = priceChart.timeScale().getVisibleRange();
        
        // Only update if ranges are significantly different
        if (!currentPriceRange || 
            Math.abs(currentPriceRange.from - timeRange.from) > 0.001 || 
            Math.abs(currentPriceRange.to - timeRange.to) > 0.001) {
          priceChart.timeScale().setVisibleRange(timeRange);
        }
      } catch (e) {
        // Silently ignore sync errors during initialization
        console.debug('Volume chart sync skipped:', e.message);
      } finally {
        syncingRef.current = false;
      }
    });

    const handleResize = () => {
      if (priceChartRef.current && volumeChartRef.current) {
        priceChart.applyOptions({
          width: priceChartRef.current.clientWidth,
          height: priceChartRef.current.clientHeight,
        });
        volumeChart.applyOptions({
          width: volumeChartRef.current.clientWidth,
          height: volumeChartRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      priceChart.remove();
      volumeChart.remove();
    };
  }, []);

  useEffect(() => {
    if (!data || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const timeUnit = data.time_unit || 'seconds';

    // Update time formatters with current time unit
    if (priceChartInstanceRef.current) {
      priceChartInstanceRef.current.applyOptions({
        timeScale: {
          tickMarkFormatter: (time) => formatTimeLabel(time, timeUnit),
          visible: false,
        },
      });
    }

    if (volumeChartInstanceRef.current) {
      volumeChartInstanceRef.current.applyOptions({
        timeScale: {
          tickMarkFormatter: (time) => formatTimeLabel(time, timeUnit),
          timeVisible: true,
          secondsVisible: false,
        },
      });
    }

    // Clear existing data
    candlestickSeriesRef.current.setData([]);
    volumeSeriesRef.current.setData([]);

    // Convert simulation data
    const { candlestickData, volumeData } = convertToCandlesticksWithVolume(data);
    
    if (candlestickData.length > 0) {
      candlestickSeriesRef.current.setData(candlestickData);
      volumeSeriesRef.current.setData(volumeData);
      
      // Fit content after data is loaded
      setTimeout(() => {
        if (priceChartInstanceRef.current && volumeChartInstanceRef.current) {
          priceChartInstanceRef.current.timeScale().fitContent();
          volumeChartInstanceRef.current.timeScale().fitContent();
        }
      }, 0);
    }
  }, [data]);

  return (
    <div className="candlestick-chart-wrapper">
      <div className="chart-header">
        <h4>Price Chart</h4>
        {data && (
          <div className="chart-stats">
            <span className="stat">Events: {data.t.length}</span>
            <span className="stat">Time: {formatSimulationTime(data)}</span>
          </div>
        )}
      </div>
      
      {/* Price Chart (70%) */}
      <div ref={priceChartRef} className="price-chart-container" />
      
      {/* Volume Chart (30%) */}
      <div ref={volumeChartRef} className="volume-chart-container" />
      
      {!data && (
        <div className="chart-placeholder">
          <p>Run simulation to see price chart</p>
        </div>
      )}
    </div>
  );
};

// Format time labels on x-axis
function formatTimeLabel(time, timeUnit) {
  const unitMap = {
    'microseconds': 'μs',
    'milliseconds': 'ms',
    'seconds': 's',
    'minutes': 'min',
    'hours': 'h'
  };
  
  const unit = unitMap[timeUnit] || 's';
  let decimals = timeUnit === 'microseconds' ? 0 : 
                 timeUnit === 'milliseconds' ? 1 : 2;
  
  return `${time.toFixed(decimals)}${unit}`;
}

// Format total simulation time
function formatSimulationTime(data) {
  if (!data || !data.t || data.t.length === 0) return '0s';
  
  const totalTime = data.t[data.t.length - 1];
  const timeUnit = data.time_unit || 'seconds';
  
  const unitMap = {
    'microseconds': 'μs',
    'milliseconds': 'ms',
    'seconds': 's',
    'minutes': 'min',
    'hours': 'h'
  };
  
  return `${totalTime.toFixed(2)}${unitMap[timeUnit]}`;
}

// Convert to candlesticks WITH real volume from order book
function convertToCandlesticksWithVolume(data) {
  const { t, mid, event_types, quantities } = data;
  
  // Debug: Log what data we received from C++ backend
  console.log('📊 Data from C++ simulator:', { 
    hasEventTypes: !!event_types, 
    hasQuantities: !!quantities,
    eventTypesLength: event_types?.length,
    quantitiesLength: quantities?.length,
    dataKeys: Object.keys(data)
  });
  
  if (event_types && quantities) {
    // Sample first 10 events to verify data
    console.log('📊 Sample events (first 10):', 
      event_types.slice(0, 10).map((et, i) => `evt=${et} qty=${quantities[i]}`)
    );
  }

  if (!t || !mid || t.length === 0) return { candlestickData: [], volumeData: [] };

  // FIND PRICE JUMPS IN RAW DATA
  console.log('🔍 Checking for price jumps in raw data...');
  let foundJumps = false;
  for (let i = 1; i < mid.length; i++) {
    if (mid[i] !== null && mid[i-1] !== null && !isNaN(mid[i]) && !isNaN(mid[i-1])) {
      const jump = Math.abs(mid[i] - mid[i-1]);
      if (jump > 0.5) {
        console.log(`  ⚠️ JUMP at index ${i}: ${mid[i-1].toFixed(2)} → ${mid[i].toFixed(2)} (Δ${jump.toFixed(2)}) at time ${t[i].toFixed(3)}s`);
        foundJumps = true;
      }
    }
  }
  if (!foundJumps) {
    console.log('  ✅ No large jumps (>0.5) found in raw data');
  }

  // Use TIME-BASED windows instead of event-count windows
  const totalTime = t[t.length - 1] - t[0];
  const targetCandles = Math.min(100, Math.max(50, Math.floor(t.length / 10)));
  const timePerCandle = totalTime / targetCandles;
  
  const candlestickData = [];
  const volumeData = [];
  
  let eventIdx = 0;
  
  for (let candleIdx = 0; candleIdx < targetCandles; candleIdx++) {
    const windowStart = t[0] + candleIdx * timePerCandle;
    const windowEnd = windowStart + timePerCandle;
    
    const windowPrices = [];
    let windowVolume = 0;
    
    // Collect all events in this time window
    while (eventIdx < t.length && t[eventIdx] < windowEnd) {
      if (mid[eventIdx] !== null && !isNaN(mid[eventIdx])) {
        windowPrices.push(mid[eventIdx]);
      }
      
      // Calculate volume from real simulation data
      if (event_types && quantities && event_types.length > eventIdx && quantities.length > eventIdx) {
        const eventType = event_types[eventIdx];
        const qty = quantities[eventIdx] || 0;
        // Event types: 0=MB, 1=MS, 2=LB, 3=LS, 4=CB, 5=CS
        // Market orders (0, 1) consume liquidity - primary volume
        // Limit orders (2, 3) add liquidity - secondary volume indicator
        if (eventType === 0 || eventType === 1) {
          windowVolume += qty > 0 ? qty : 1;  // At least 1 for each market order
        } else if (eventType === 2 || eventType === 3) {
          windowVolume += qty > 0 ? qty * 0.5 : 0.5;  // Limit orders at half weight
        }
      } else {
        // Fallback only if no event_types/quantities arrays exist
        windowVolume += 10;
      }
      
      eventIdx++;
    }
    
    // Skip empty windows
    if (windowPrices.length === 0) continue;
    
    const open = windowPrices[0];
    const close = windowPrices[windowPrices.length - 1];
    const high = Math.max(...windowPrices);
    const low = Math.min(...windowPrices);
    
    windowVolume = Math.max(1, windowVolume);
    
    const volumeColor = close >= open 
      ? 'rgba(0, 255, 136, 0.5)' 
      : 'rgba(255, 68, 102, 0.5)';

    const candleTime = windowStart + timePerCandle / 2;  // Middle of time window

    candlestickData.push({
      time: candleTime,
      open: open,
      high: high,
      low: low,
      close: close,
    });
    
    volumeData.push({
      time: candleTime,
      value: windowVolume,
      color: volumeColor,
    });
  }

  console.log('Generated candles:', candlestickData.length);
  console.log('Volume range:', Math.min(...volumeData.map(v => v.value)), '-', Math.max(...volumeData.map(v => v.value)));

  // CHECK FOR PRICE DISCONTINUITIES IN CANDLES
  console.log('Price discontinuities in candles:');
  let gapsFound = false;
  candlestickData.forEach((candle, i) => {
    if (i > 0) {
      const prevClose = candlestickData[i-1].close;
      const currOpen = candle.open;
      const gap = Math.abs(currOpen - prevClose);
      if (gap > 0.5) {
        console.log(`  ⚠️ Gap at candle ${i} (time ${candle.time.toFixed(2)}): ${prevClose.toFixed(2)} → ${currOpen.toFixed(2)} (Δ${gap.toFixed(2)})`);
        gapsFound = true;
      }
    }
  });
  if (!gapsFound) {
    console.log('  ✅ No gaps found in candles');
  }

  return { candlestickData, volumeData };
}
export default CandlestickChart;