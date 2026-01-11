/**
 * Regime Presets for LOB Simulation
 * Based on common market microstructure patterns
 */

export const REGIME_PRESETS = {
  calm_market: {
    name: "Calm Market",
    description: "Low activity, tight spread, minimal clustering",
    num_events: 500,
    seed: 42,
    time_unit: 'seconds',
    mu: [2.0, 2.0, 1.0, 1.0, 1.5, 1.5],
    alpha: [
      [0.6, 0.1, 0.1, 0.0, 0.2, 0.0],
      [0.1, 0.6, 0.0, 0.1, 0.0, 0.2],
      [0.1, 0.0, 0.4, 0.1, 0.1, 0.0],
      [0.0, 0.1, 0.1, 0.4, 0.0, 0.1],
      [0.2, 0.0, 0.1, 0.0, 0.5, 0.1],
      [0.0, 0.2, 0.0, 0.1, 0.1, 0.5]
    ],
    beta: [
      [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
      [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
      [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
      [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
      [1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
      [1.5, 1.5, 1.5, 1.5, 1.5, 1.5]
    ]
  },

  volatile_market: {
    name: "Volatile Market",
    description: "High activity, strong clustering, rapid price changes",
    num_events: 500,
    seed: 42,
    time_unit: 'seconds',
    mu: [4.0, 4.0, 2.5, 2.5, 3.0, 3.0],
    alpha: [
      [0.8, 0.2, 0.2, 0.0, 0.3, 0.0],
      [0.2, 0.8, 0.0, 0.2, 0.0, 0.3],
      [0.2, 0.0, 0.7, 0.2, 0.2, 0.0],
      [0.0, 0.2, 0.2, 0.7, 0.0, 0.2],
      [0.3, 0.0, 0.2, 0.0, 0.8, 0.2],
      [0.0, 0.3, 0.0, 0.2, 0.2, 0.8]
    ],
    beta: [
      [2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
      [2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
      [2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
      [2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
      [2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
      [2.5, 2.5, 2.5, 2.5, 2.5, 2.5]
    ]
  },

  trending_up: {
    name: "Trending Up",
    description: "Bullish pressure, more buys than sells, upward drift",
    num_events: 500,
    seed: 42,
    time_unit: 'seconds',
    mu: [3.0, 1.5, 1.2, 0.8, 2.0, 1.0],  // More market buys
    alpha: [
      [0.7, 0.1, 0.15, 0.0, 0.25, 0.0],
      [0.1, 0.5, 0.0, 0.1, 0.0, 0.15],
      [0.15, 0.0, 0.5, 0.1, 0.15, 0.0],
      [0.0, 0.1, 0.1, 0.4, 0.0, 0.1],
      [0.25, 0.0, 0.15, 0.0, 0.6, 0.1],
      [0.0, 0.15, 0.0, 0.1, 0.1, 0.5]
    ],
    beta: [
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8]
    ]
  },

  trending_down: {
    name: "Trending Down",
    description: "Bearish pressure, more sells than buys, downward drift",
    num_events: 500,
    seed: 42,
    time_unit: 'seconds',
    mu: [1.5, 3.0, 0.8, 1.2, 1.0, 2.0],  // More market sells
    alpha: [
      [0.5, 0.1, 0.15, 0.0, 0.15, 0.0],
      [0.1, 0.7, 0.0, 0.15, 0.0, 0.25],
      [0.15, 0.0, 0.4, 0.1, 0.1, 0.0],
      [0.0, 0.15, 0.1, 0.5, 0.0, 0.15],
      [0.15, 0.0, 0.1, 0.0, 0.5, 0.1],
      [0.0, 0.25, 0.0, 0.15, 0.1, 0.6]
    ],
    beta: [
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8],
      [1.8, 1.8, 1.8, 1.8, 1.8, 1.8]
    ]
  },

  mean_reverting: {
    name: "Mean Reverting",
    description: "Strong cancellation clustering, tight around mid price",
    num_events: 500,
    seed: 42,
    time_unit: 'seconds',
    mu: [2.0, 2.0, 2.5, 2.5, 1.0, 1.0],  // High cancellations
    alpha: [
      [0.5, 0.1, 0.3, 0.0, 0.1, 0.0],
      [0.1, 0.5, 0.0, 0.3, 0.0, 0.1],
      [0.3, 0.0, 0.7, 0.2, 0.2, 0.0],  // Strong cancel clustering
      [0.0, 0.3, 0.2, 0.7, 0.0, 0.2],
      [0.1, 0.0, 0.2, 0.0, 0.4, 0.1],
      [0.0, 0.1, 0.0, 0.2, 0.1, 0.4]
    ],
    beta: [
      [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
      [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
      [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
      [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
      [2.0, 2.0, 2.0, 2.0, 2.0, 2.0],
      [2.0, 2.0, 2.0, 2.0, 2.0, 2.0]
    ]
  },

  flash_crash: {
    name: "Flash Crash",
    description: "Extreme sell pressure, liquidity drain, rapid price drop",
    num_events: 500,
    seed: 42,
    time_unit: 'seconds',
    mu: [0.5, 5.0, 0.3, 3.0, 0.5, 4.0],  // Extreme sell clustering
    alpha: [
      [0.3, 0.1, 0.1, 0.0, 0.1, 0.0],
      [0.1, 0.9, 0.0, 0.3, 0.0, 0.4],  // Very high sell clustering
      [0.1, 0.0, 0.2, 0.1, 0.1, 0.0],
      [0.0, 0.3, 0.1, 0.8, 0.0, 0.3],
      [0.1, 0.0, 0.1, 0.0, 0.3, 0.1],
      [0.0, 0.4, 0.0, 0.3, 0.1, 0.9]
    ],
    beta: [
      [3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
      [3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
      [3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
      [3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
      [3.0, 3.0, 3.0, 3.0, 3.0, 3.0],
      [3.0, 3.0, 3.0, 3.0, 3.0, 3.0]
    ]
  }
};

// Helper to get list of preset names
export const getPresetNames = () => Object.keys(REGIME_PRESETS);

// Helper to get a preset by key
export const getPreset = (key) => REGIME_PRESETS[key];

// Helper to create a custom regime from a preset
export const createRegimeFromPreset = (presetKey, overrides = {}) => {
  const preset = getPreset(presetKey);
  if (!preset) return null;
  
  return {
    ...preset,
    ...overrides
  };
};