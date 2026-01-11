import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const getAvailableStrategies = async () => {
  const response = await api.get('/available_strategies');
  return response.data;
};

export const runBacktest = async (regimes, strategies, transactionCost = 0.0001) => {
  const response = await api.post('/backtest', {
    regimes,
    strategies,
    transaction_cost: transactionCost,
    include_buy_hold: true,
  });
  return response.data;
};

export const runMonteCarlo = async (regimes, strategies, numRuns = 100, baseSeed = 42) => {
  const response = await api.post('/monte_carlo', {
    regimes,
    strategies,
    num_runs: numRuns,
    base_seed: baseSeed,
    transaction_cost: 0.0001,
  });
  return response.data;
};

export const getDefaultRegimes = async () => {
  const response = await api.get('/default_regimes');
  return response.data;
};

export default api;