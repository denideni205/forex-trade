import axios from 'axios';
import { io } from 'socket.io-client';

class MarketDataService {
  constructor() {
    this.subscribers = new Map();
    this.connections = new Map();
    this.cache = new Map();
    this.providers = {
      oanda: {
        apiKey: process.env.OANDA_API_KEY,
        baseUrl: 'https://api-fxtrade.oanda.com'
      }
    };
  }

  // Real-time data streaming
  async connectToStream(symbol, callback) {
    try {
      // Connect to OANDA WebSocket for real-time data (dummy endpoint, replace with actual if available)
      const socket = io('wss://stream-fxtrade.oanda.com', {
        auth: {
          token: this.providers.oanda.apiKey
        }
      });
      socket.on('connect', () => {
        console.log('Connected to OANDA real-time data stream');
        socket.emit('subscribe', { symbol });
      });
      socket.on('price', (data) => {
        const marketData = this.processRealTimeData(data);
        callback(marketData);
        this.updateCache(symbol, marketData);
      });
      socket.on('disconnect', () => {
        console.log('Disconnected from OANDA real-time stream');
        setTimeout(() => this.connectToStream(symbol, callback), 5000);
      });
      this.connections.set(symbol, socket);
      return socket;
    } catch (error) {
      console.error('Failed to connect to OANDA real-time stream:', error);
      throw error;
    }
  }

  // Get historical data from OANDA only
  async getHistoricalData(symbol, timeframe, limit = 100) {
    try {
      const data = await this.fetchOandaHistorical(this.providers.oanda, symbol, timeframe, limit);
      if (data && data.length > 0) {
        return this.processHistoricalData(data, symbol, timeframe);
      }
      throw new Error('No OANDA historical data available');
    } catch (error) {
      console.error('Failed to get OANDA historical data:', error);
      throw error;
    }
  }

  async fetchOandaHistorical(config, symbol, timeframe, limit) {
    // Implement OANDA historical data fetch here (dummy for now)
    // Replace with actual OANDA endpoint and params
    const response = await axios.get(`${config.baseUrl}/v3/instruments/${symbol}/candles`, {
      params: {
        granularity: this.convertTimeframe(timeframe),
        count: limit
      },
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      timeout: 10000
    });
    if (!response.data.candles) {
      throw new Error('No data from OANDA');
    }
    return response.data.candles.map(candle => ({
      datetime: candle.time,
      open: candle.mid.o,
      high: candle.mid.h,
      low: candle.mid.l,
      close: candle.mid.c,
      volume: candle.volume
    }));
  }

  convertTimeframe(timeframe) {
    const conversions = {
      '1m': 'M1',
      '5m': 'M5',
      '15m': 'M15',
      '30m': 'M30',
      '1h': 'H1',
      '4h': 'H4',
      '1d': 'D'
    };
    return conversions[timeframe] || timeframe;
  }

  getTimeframeMs(timeframe) {
    const msMap = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return msMap[timeframe] || 60 * 1000;
  }

  processRealTimeData(data) {
    return {
      symbol: data.instrument,
      price: parseFloat(data.price),
      bid: parseFloat(data.bid),
      ask: parseFloat(data.ask),
      spread: parseFloat(data.ask) - parseFloat(data.bid),
      timestamp: new Date().toISOString(),
      volume: parseFloat(data.volume || 0),
      change: parseFloat(data.change || 0),
      changePercent: parseFloat(data.change_percent || 0)
    };
  }

  processHistoricalData(data, symbol, timeframe) {
    return data.map(candle => ({
      symbol,
      timeframe,
      timestamp: new Date(candle.datetime).toISOString(),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume || 0),
      spread: parseFloat(candle.spread || 0)
    }));
  }

  updateCache(symbol, data) {
    const key = `${symbol}_${data.timeframe || 'realtime'}`;
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  getCachedData(symbol, timeframe) {
    const key = `${symbol}_${timeframe}`;
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
      return cached.data;
    }
    
    return null;
  }

  disconnect(symbol) {
    const connection = this.connections.get(symbol);
    if (connection) {
      connection.disconnect();
      this.connections.delete(symbol);
    }
  }

  disconnectAll() {
    for (const [symbol, connection] of this.connections) {
      connection.disconnect();
    }
    this.connections.clear();
  }
}

export const marketDataService = new MarketDataService();