// frontend/src/utils/colors.js
export const COLORS = {
  // Background Layers (4 levels - this is key!)
  bg: {
    page: '#0B0F1A',           // Darkest - main page background
    panel: '#121825',          // Dark - main panels/sections
    card: '#1A2235',           // Medium - cards within panels
    elevated: '#222B3F',       // Lighter - nested cards, hover states
  },

  // Borders (subtle, not harsh)
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',    // Very faint
    default: 'rgba(255, 255, 255, 0.10)',   // Normal
    strong: 'rgba(255, 255, 255, 0.15)',    // Emphasized
  },

  // Text Hierarchy (opacity-based for consistency)
  text: {
    primary: 'rgba(255, 255, 255, 0.95)',   // Main content
    secondary: 'rgba(255, 255, 255, 0.70)', // Supporting text
    tertiary: 'rgba(255, 255, 255, 0.50)',  // Muted text
    disabled: 'rgba(255, 255, 255, 0.30)',  // Disabled state
  },

  // Brand/Accent Colors (vibrant but not neon)
  brand: {
    primary: '#5B8DEF',        // Soft blue (not harsh cyan)
    primaryHover: '#6B9DF5',
    primaryActive: '#4B7DDF',
    
    secondary: '#E879F9',      // Soft purple/pink
    secondaryHover: '#F08FFF',
    
    accent: '#38BDF8',         // Light cyan
    accentHover: '#48CDFF',
  },

  // Semantic Colors (muted, professional)
  semantic: {
    success: '#4ADE80',
    successBg: 'rgba(74, 222, 128, 0.10)',
    
    warning: '#FBBF24',
    warningBg: 'rgba(251, 191, 36, 0.10)',
    
    error: '#F87171',
    errorBg: 'rgba(248, 113, 113, 0.10)',
    
    info: '#60A5FA',
    infoBg: 'rgba(96, 165, 250, 0.10)',
  },

  // Strategy Colors (distinct, harmonious palette)
  strategy: {
    buyHold: '#FBBF24',        // Amber
    sma: '#5B8DEF',            // Blue
    momentum: '#E879F9',       // Purple
    trendFollowing: '#38BDF8', // Cyan
    custom1: '#34D399',        // Green
    custom2: '#FB923C',        // Orange
  },
};

// Helper function
export const getStrategyColor = (strategyName) => {
  const normalized = strategyName.toLowerCase().replace(/[^a-z]/g, '');
  const colorMap = {
    'buyhold': COLORS.strategy.buyHold,
    'sma': COLORS.strategy.sma,
    'momentum': COLORS.strategy.momentum,
    'trendfollowing': COLORS.strategy.trendFollowing,
  };
  return colorMap[normalized] || COLORS.strategy.custom1;
};