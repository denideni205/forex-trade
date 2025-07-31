import axios from 'axios';
import { io } from 'socket.io-client';

class BrokerIntegration {
  constructor() {
    this.connections = new Map();
    this.accounts = new Map();
    this.brokers = {
      oanda: {
        name: 'OANDA',
        baseUrl: 'https://api-fxtrade.oanda.com',
        streamUrl: 'https://stream-fxtrade.oanda.com',
        demoUrl: 'https://api-fxpractice.oanda.com',
        demoStreamUrl: 'https://stream-fxpractice.oanda.com'
      }
    };
  }

  async connectToBroker(brokerId, credentials, isDemo = true) {
    if (brokerId !== 'oanda') throw new Error('Only OANDA is supported');
    try {
      const broker = this.brokers[brokerId];
      if (!broker) {
        throw new Error(`Unsupported broker: ${brokerId}`);
      }

      const connection = {
        brokerId,
        isDemo,
        baseUrl: isDemo ? broker.demoUrl || broker.baseUrl : broker.liveUrl || broker.baseUrl,
        streamUrl: isDemo ? broker.demoStreamUrl || broker.streamUrl : broker.liveStreamUrl || broker.streamUrl,
        credentials,
        connected: false,
        account: null,
        positions: new Map(),
        orders: new Map()
      };

      // Authenticate with broker
      await this.authenticate(connection);
      
      // Get account information
      await this.getAccountInfo(connection);
      
      // Connect to real-time stream
      await this.connectToStream(connection);
      
      this.connections.set(brokerId, connection);
      return connection;

    } catch (error) {
      console.error(`Failed to connect to ${brokerId}:`, error);
      throw error;
    }
  }

  async authenticate(connection) {
    await this.authenticateOanda(connection);
  }

  async authenticateOanda(connection) {
    const { baseUrl, credentials } = connection;
    
    const response = await axios.get(`${baseUrl}/v3/accounts`, {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.status !== 200) {
      throw new Error('OANDA authentication failed');
    }

    connection.account = response.data.accounts[0];
    connection.connected = true;
  }

  async getAccountInfo(connection) {
    await this.getOandaAccountInfo(connection);
  }

  async getOandaAccountInfo(connection) {
    const { baseUrl, account } = connection;
    
    const response = await axios.get(`${baseUrl}/v3/accounts/${account.id}`, {
      headers: {
        'Authorization': `Bearer ${connection.credentials.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    connection.accountInfo = response.data;
  }

  async connectToStream(connection) {
    await this.connectOandaStream(connection);
  }

  async connectOandaStream(connection) {
    const { streamUrl, account, credentials } = connection;
    
    const socket = io(streamUrl, {
      auth: {
        token: credentials.apiKey
      }
    });

    socket.on('connect', () => {
      console.log('Connected to OANDA stream');
      socket.emit('subscribe', {
        accountID: account.id,
        instruments: ['EUR_USD', 'GBP_USD', 'USD_JPY']
      });
    });

    socket.on('pricing', (data) => {
      this.handlePriceUpdate(connection, data);
    });

    socket.on('transaction', (data) => {
      this.handleTransactionUpdate(connection, data);
    });

    connection.stream = socket;
  }

  handlePriceUpdate(connection, data) {
    // Update real-time prices
    const symbol = data.instrument || data.symbol;
    connection.positions.forEach((position, positionId) => {
      if (position.symbol === symbol) {
        position.currentPrice = data.price;
        position.unrealizedPnL = this.calculateUnrealizedPnL(position, data.price);
      }
    });
  }

  handleTransactionUpdate(connection, data) {
    // Update positions and orders based on transaction data
    if (data.type === 'ORDER_FILL') {
      this.updatePosition(connection, data);
    } else if (data.type === 'ORDER_CANCEL') {
      this.cancelOrder(connection, data);
    }
  }

  async placeOrder(connection, orderParams) {
    return await this.placeOandaOrder(connection, orderParams);
  }

  async placeOandaOrder(connection, orderParams) {
    const { baseUrl, account, credentials } = connection;
    const { symbol, side, units, type = 'MARKET', price, stopLoss, takeProfit } = orderParams;
    
    const orderData = {
      order: {
        type: type,
        instrument: symbol,
        units: side === 'BUY' ? units : -units,
        timeInForce: 'FOK',
        positionFill: 'DEFAULT'
      }
    };

    if (type === 'LIMIT' && price) {
      orderData.order.price = price;
    }

    if (stopLoss) {
      orderData.order.stopLossOnFill = {
        price: stopLoss
      };
    }

    if (takeProfit) {
      orderData.order.takeProfitOnFill = {
        price: takeProfit
      };
    }

    const response = await axios.post(
      `${baseUrl}/v3/accounts/${account.id}/orders`,
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  }

  async getPositions(connection) {
    return await this.getOandaPositions(connection);
  }

  async getOandaPositions(connection) {
    const { baseUrl, account, credentials } = connection;
    
    const response = await axios.get(
      `${baseUrl}/v3/accounts/${account.id}/positions`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.positions;
  }

  calculateUnrealizedPnL(position, currentPrice) {
    const { side, units, averagePrice } = position;
    
    if (side === 'BUY') {
      return (currentPrice - averagePrice) * units;
    } else {
      return (averagePrice - currentPrice) * units;
    }
  }

  updatePosition(connection, transactionData) {
    // Update position based on transaction data
    const positionId = transactionData.positionId;
    const position = connection.positions.get(positionId);
    
    if (position) {
      Object.assign(position, transactionData);
      connection.positions.set(positionId, position);
    }
  }

  cancelOrder(connection, transactionData) {
    // Remove cancelled order
    const orderId = transactionData.orderId;
    connection.orders.delete(orderId);
  }

  disconnect(brokerId) {
    const connection = this.connections.get(brokerId);
    if (connection) {
      if (connection.stream) {
        connection.stream.disconnect();
      }
      this.connections.delete(brokerId);
    }
  }

  disconnectAll() {
    for (const [brokerId, connection] of this.connections) {
      this.disconnect(brokerId);
    }
  }
}

export const brokerIntegration = new BrokerIntegration();