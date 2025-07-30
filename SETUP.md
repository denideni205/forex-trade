# Forex Trading Bot - Setup Guide

## Overview
This is a Next.js-based forex trading bot application with AI-powered trading strategies, real-time market data, and comprehensive risk management.

## Features
- 🤖 AI-powered trading strategies (Scalping, DCA, Grid Trading)
- 📊 Real-time market data and analytics
- 🛡️ Comprehensive risk management
- 👤 User authentication with Clerk
- 🗄️ Database integration with Supabase
- 📱 Responsive dashboard interface

## Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (for database)
- Clerk account (for authentication)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env.local` file in the root directory with the following variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Trading API Keys (optional for demo)
NEXT_PUBLIC_TRADING_API_URL=https://api.trading.com
TRADING_API_KEY=your_trading_api_key_here
TRADING_API_SECRET=your_trading_api_secret_here

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Run Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Demo Mode
The application includes a demo mode that works without external APIs:
- Mock market data is generated automatically
- Bot operations are simulated
- No real trading occurs

## API Endpoints

### Health Check
- `GET /api/health` - Application health status

### Market Data
- `GET /api/market/data?symbol=EURUSD&timeframe=1h` - Get market data
- `POST /api/market/data` - Batch market data request

### Trading Bots
- `GET /api/bots` - List user's trading bots
- `POST /api/bots` - Create new trading bot
- `PUT /api/bots/:id` - Update bot configuration
- `DELETE /api/bots/:id` - Delete bot

## Database Schema (Supabase)

### Required Tables
```sql
-- Trading Bots
CREATE TABLE trading_bots (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  strategy_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  config JSONB,
  risk_config JSONB,
  description TEXT,
  status TEXT DEFAULT 'inactive',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bot Performance
CREATE TABLE bot_performance (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER REFERENCES trading_bots(id),
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_profit DECIMAL DEFAULT 0,
  total_loss DECIMAL DEFAULT 0,
  win_rate DECIMAL DEFAULT 0,
  profit_factor DECIMAL DEFAULT 0,
  max_drawdown DECIMAL DEFAULT 0,
  sharpe_ratio DECIMAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Market Data
CREATE TABLE market_data (
  id SERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  open DECIMAL,
  high DECIMAL,
  low DECIMAL,
  close DECIMAL,
  volume INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- System Logs
CREATE TABLE system_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Troubleshooting

### Common Issues

1. **Environment Variables Missing**
   - Ensure all required environment variables are set in `.env.local`
   - The app will work in demo mode without external APIs

2. **Database Connection Issues**
   - Check Supabase credentials
   - The app includes fallback mock data

3. **Authentication Issues**
   - Verify Clerk configuration
   - Check public routes in middleware.js

4. **Build Errors**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Check for dependency conflicts

### Development Commands
```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Security Notes
- Never commit `.env.local` to version control
- Use environment variables for all sensitive data
- Implement proper CORS policies for production
- Add rate limiting for API endpoints

## Production Deployment
1. Set up environment variables in your hosting platform
2. Configure Clerk and Supabase for production
3. Set up proper SSL certificates
4. Configure monitoring and logging

## Support
For issues or questions, check the application logs or create an issue in the repository.