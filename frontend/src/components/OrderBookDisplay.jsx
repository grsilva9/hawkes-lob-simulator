import React, { useState, useEffect } from 'react';
import './OrderBookDisplay.css';

const OrderBookDisplay = ({ data }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [orderBook, setOrderBook] = useState(null);

  // Show the final order book state
  useEffect(() => {
    if (!data) return;
    
    // Show final state
    const finalIndex = data.t.length - 1;
    setCurrentIndex(finalIndex);
    updateOrderBook(finalIndex);
  }, [data]);

  const updateOrderBook = (index) => {
    if (!data || index < 0 || index >= data.t.length) return;

    // Get current market state
    const bestBid = data.best_bid[index];
    const bestAsk = data.best_ask[index];
    const mid = data.mid[index];
    const spread = data.spread[index];

    // Generate synthetic order book around best bid/ask
    // In a real implementation, you'd get this from the simulation
    const bidLevels = generateBidLevels(bestBid, 10);
    const askLevels = generateAskLevels(bestAsk, 10);

    setOrderBook({
      time: data.t[index],
      mid: mid,
      spread: spread,
      bids: bidLevels,
      asks: askLevels,
    });
  };

  // Generate synthetic bid levels for visualization
  const generateBidLevels = (bestBid, numLevels) => {
    if (!bestBid || isNaN(bestBid)) return [];
    
    const levels = [];
    const tickSize = 0.01;
    
    for (let i = 0; i < numLevels; i++) {
      const price = bestBid - (i * tickSize);
      const size = Math.floor(100 + Math.random() * 400); // Random size 100-500
      levels.push({ price, size });
    }
    
    return levels;
  };

  // Generate synthetic ask levels for visualization
  const generateAskLevels = (bestAsk, numLevels) => {
    if (!bestAsk || isNaN(bestAsk)) return [];
    
    const levels = [];
    const tickSize = 0.01;
    
    for (let i = 0; i < numLevels; i++) {
      const price = bestAsk + (i * tickSize);
      const size = Math.floor(100 + Math.random() * 400); // Random size 100-500
      levels.push({ price, size });
    }
    
    return levels;
  };

  // Calculate max size for bar visualization
  const getMaxSize = () => {
    if (!orderBook) return 1;
    const allSizes = [
      ...orderBook.bids.map(b => b.size),
      ...orderBook.asks.map(a => a.size)
    ];
    return Math.max(...allSizes, 1);
  };

  if (!data) {
    return (
      <div className="orderbook-wrapper">
        <div className="orderbook-header">
          <h4>Order Book</h4>
        </div>
        <div className="orderbook-placeholder">
        </div>
      </div>
    );
  }

  if (!orderBook) {
    return (
      <div className="orderbook-wrapper">
        <div className="orderbook-header">
          <h4>Order Book</h4>
        </div>
        <div className="orderbook-placeholder">
        </div>
      </div>
    );
  }

  const maxSize = getMaxSize();
  const timeUnit = data.time_unit || 'seconds';
  const unitMap = {
    'microseconds': 'μs',
    'milliseconds': 'ms',
    'seconds': 's',
    'minutes': 'min',
    'hours': 'h'
  };

  return (
    <div className="orderbook-wrapper">
      <div className="orderbook-header">
        <h4>Order Book</h4>
        <div className="orderbook-stats">
          <span className="stat">Mid: {orderBook.mid?.toFixed(2) || 'N/A'}</span>
          <span className="stat">Spread: {orderBook.spread?.toFixed(4) || 'N/A'}</span>
          <span className="stat">Time: {orderBook.time?.toFixed(2)}{unitMap[timeUnit]}</span>
        </div>
      </div>

      <div className="orderbook-content">
        {/* Column Headers */}
        <div className="orderbook-headers">
          <span className="header-price">Price</span>
          <span className="header-size">Size</span>
          <span className="header-total">Total</span>
        </div>

        {/* Ask Side (reversed order - best ask at bottom) */}
        <div className="orderbook-side asks-side">
          {[...orderBook.asks].reverse().map((level, idx) => {
            const barWidth = (level.size / maxSize) * 100;
            return (
              <div key={`ask-${idx}`} className="orderbook-row ask-row">
                <span className="row-price ask-price">{level.price.toFixed(2)}</span>
                <span className="row-size">{level.size}</span>
                <span className="row-total">{level.size}</span>
                <div className="size-bar ask-bar" style={{ width: `${barWidth}%` }} />
              </div>
            );
          })}
        </div>

        {/* Spread Display */}
        <div className="orderbook-spread">
          <span className="spread-label">SPREAD</span>
          <span className="spread-value">{orderBook.spread?.toFixed(4) || 'N/A'}</span>
        </div>

        {/* Bid Side */}
        <div className="orderbook-side bids-side">
          {orderBook.bids.map((level, idx) => {
            const barWidth = (level.size / maxSize) * 100;
            return (
              <div key={`bid-${idx}`} className="orderbook-row bid-row">
                <span className="row-price bid-price">{level.price.toFixed(2)}</span>
                <span className="row-size">{level.size}</span>
                <span className="row-total">{level.size}</span>
                <div className="size-bar bid-bar" style={{ width: `${barWidth}%` }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrderBookDisplay;