const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const TradingEngine = require('./src/trading/TradingEngine');
const DatabaseManager = require('./src/database/DatabaseManager');
const RiskManager = require('./src/risk/RiskManager');
const MarketDataService = require('./src/services/MarketDataService');
const AuthController = require('./src/controllers/AuthController');
const BotController = require('./src/controllers/BotController');
const AnalyticsController = require('./src/controllers/AnalyticsController');

class ForexTradingBotServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: process.env.CLIENT_URL || "http://localhost:3000",
                methods: ["GET", "POST"]
            }
        });
        
        this.port = process.env.PORT || 5000;
        this.tradingEngine = null;
        this.dbManager = null;
        this.riskManager = null;
        this.marketDataService = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeServices();
        this.setupSocketHandlers();
    }
    
    setupMiddleware() {
        // Security middleware
        this.app.use(helmet());
        this.app.use(cors({
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            credentials: true
        }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP'
        });
        this.app.use('/api/', limiter);
        
        // Compression and parsing
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                services: {
                    tradingEngine: this.tradingEngine?.isRunning || false,
                    database: this.dbManager?.isConnected || false,
                    marketData: this.marketDataService?.isConnected || false
                }
            });
        });
        
        // API Routes
        this.app.use('/api/auth', AuthController);
        this.app.use('/api/bots', BotController);
        this.app.use('/api/analytics', AnalyticsController);
        
        // Trading Engine Routes
        this.app.get('/api/trading/status', (req, res) => {
            res.json({
                status: this.tradingEngine?.getStatus() || 'stopped',
                activeBots: this.tradingEngine?.getActiveBots() || [],
                totalTrades: this.tradingEngine?.getTotalTrades() || 0,
                performance: this.tradingEngine?.getPerformanceMetrics() || {}
            });
        });
        
        this.app.post('/api/trading/start', async (req, res) => {
            try {
                await this.tradingEngine.start();
                res.json({ success: true, message: 'Trading engine started' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.post('/api/trading/stop', async (req, res) => {
            try {
                await this.tradingEngine.stop();
                res.json({ success: true, message: 'Trading engine stopped' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Market Data Routes
        this.app.get('/api/market/symbols', (req, res) => {
            res.json(this.marketDataService?.getAvailableSymbols() || []);
        });
        
        this.app.get('/api/market/data/:symbol', (req, res) => {
            const { symbol } = req.params;
            const { timeframe = '1h', limit = 100 } = req.query;
            
            const data = this.marketDataService?.getHistoricalData(symbol, timeframe, limit);
            res.json(data || []);
        });
        
        // Error handling
        this.app.use((error, req, res, next) => {
            console.error('Server Error:', error);
            res.status(500).json({ 
                error: 'Internal Server Error',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        });
        
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route not found' });
        });
    }
    
    async initializeServices() {
        try {
            console.log('🚀 Initializing Forex Trading Bot Services...');
            
            // Initialize Database
            this.dbManager = new DatabaseManager();
            await this.dbManager.connect();
            console.log('✅ Database connected');
            
            // Initialize Risk Manager
            this.riskManager = new RiskManager({
                maxDrawdown: 0.10, // 10%
                maxDailyLoss: 0.05, // 5%
                maxPositionSize: 0.02, // 2% per trade
                stopLossRequired: true,
                takeProfitRequired: true
            });
            console.log('✅ Risk Manager initialized');
            
            // Initialize Market Data Service
            this.marketDataService = new MarketDataService();
            await this.marketDataService.connect();
            console.log('✅ Market Data Service connected');
            
            // Initialize Trading Engine
            this.tradingEngine = new TradingEngine({
                dbManager: this.dbManager,
                riskManager: this.riskManager,
                marketDataService: this.marketDataService,
                io: this.io
            });
            
            console.log('✅ Trading Engine initialized');
            console.log('🎯 All services ready!');
            
        } catch (error) {
            console.error('❌ Failed to initialize services:', error);
            process.exit(1);
        }
    }
    
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`👤 Client connected: ${socket.id}`);
            
            // Send initial data
            socket.emit('tradingStatus', {
                status: this.tradingEngine?.getStatus() || 'stopped',
                activeBots: this.tradingEngine?.getActiveBots() || []
            });
            
            // Handle bot creation
            socket.on('createBot', async (botConfig) => {
                try {
                    const bot = await this.tradingEngine.createBot(botConfig);
                    socket.emit('botCreated', bot);
                    this.io.emit('botsUpdated', this.tradingEngine.getActiveBots());
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            
            // Handle bot control
            socket.on('startBot', async (botId) => {
                try {
                    await this.tradingEngine.startBot(botId);
                    this.io.emit('botsUpdated', this.tradingEngine.getActiveBots());
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            
            socket.on('stopBot', async (botId) => {
                try {
                    await this.tradingEngine.stopBot(botId);
                    this.io.emit('botsUpdated', this.tradingEngine.getActiveBots());
                } catch (error) {
                    socket.emit('error', { message: error.message });
                }
            });
            
            // Handle market data subscriptions
            socket.on('subscribeMarketData', (symbols) => {
                this.marketDataService?.subscribe(symbols, (data) => {
                    socket.emit('marketData', data);
                });
            });
            
            socket.on('disconnect', () => {
                console.log(`👤 Client disconnected: ${socket.id}`);
            });
        });
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`
🤖 Forex Trading Bot Server Started
📡 Server running on port ${this.port}
🌐 WebSocket ready for real-time communication
📊 Trading Engine ready for deployment
            `);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('🛑 SIGTERM received, shutting down gracefully');
            this.server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });
        
        process.on('SIGINT', () => {
            console.log('🛑 SIGINT received, shutting down gracefully');
            this.server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });
    }
}

// Start the server
const server = new ForexTradingBotServer();
server.start();

module.exports = ForexTradingBotServer;