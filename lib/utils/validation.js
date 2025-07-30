// Email validation
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation
export function validatePassword(password) {
  return password && password.length >= 6;
}

// Name validation
export function validateName(name) {
  return name && name.trim().length >= 2 && name.trim().length <= 50;
}

// Trading configuration validation
export function validateTradingConfig(config) {
  const errors = {};

  if (config.maxDrawdown !== undefined) {
    if (typeof config.maxDrawdown !== 'number' || config.maxDrawdown < 0 || config.maxDrawdown > 1) {
      errors.maxDrawdown = 'Max drawdown must be a number between 0 and 1';
    }
  }

  if (config.maxDailyLoss !== undefined) {
    if (typeof config.maxDailyLoss !== 'number' || config.maxDailyLoss < 0 || config.maxDailyLoss > 1) {
      errors.maxDailyLoss = 'Max daily loss must be a number between 0 and 1';
    }
  }

  if (config.maxPositionSize !== undefined) {
    if (typeof config.maxPositionSize !== 'number' || config.maxPositionSize < 0 || config.maxPositionSize > 1) {
      errors.maxPositionSize = 'Max position size must be a number between 0 and 1';
    }
  }

  if (config.defaultLotSize !== undefined) {
    if (typeof config.defaultLotSize !== 'number' || config.defaultLotSize <= 0) {
      errors.defaultLotSize = 'Default lot size must be a positive number';
    }
  }

  if (config.riskLevel !== undefined) {
    const validRiskLevels = ['conservative', 'moderate', 'aggressive'];
    if (!validRiskLevels.includes(config.riskLevel)) {
      errors.riskLevel = 'Risk level must be one of: conservative, moderate, aggressive';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Bot configuration validation
export function validateBotConfig(config) {
  const errors = {};

  if (!config.name || config.name.trim().length < 3) {
    errors.name = 'Bot name must be at least 3 characters long';
  }

  if (!config.strategy) {
    errors.strategy = 'Strategy is required';
  }

  if (!config.symbol) {
    errors.symbol = 'Trading symbol is required';
  }

  if (config.lotSize !== undefined) {
    if (typeof config.lotSize !== 'number' || config.lotSize <= 0) {
      errors.lotSize = 'Lot size must be a positive number';
    }
  }

  if (config.stopLoss !== undefined) {
    if (typeof config.stopLoss !== 'number' || config.stopLoss <= 0) {
      errors.stopLoss = 'Stop loss must be a positive number';
    }
  }

  if (config.takeProfit !== undefined) {
    if (typeof config.takeProfit !== 'number' || config.takeProfit <= 0) {
      errors.takeProfit = 'Take profit must be a positive number';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Sanitize user input
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 1000); // Limit length
}

// Validate trade parameters
export function validateTradeParams(params) {
  const errors = {};

  if (!params.symbol) {
    errors.symbol = 'Symbol is required';
  }

  if (!params.action || !['buy', 'sell'].includes(params.action.toLowerCase())) {
    errors.action = 'Action must be either "buy" or "sell"';
  }

  if (typeof params.volume !== 'number' || params.volume <= 0) {
    errors.volume = 'Volume must be a positive number';
  }

  if (params.stopLoss !== undefined && (typeof params.stopLoss !== 'number' || params.stopLoss <= 0)) {
    errors.stopLoss = 'Stop loss must be a positive number';
  }

  if (params.takeProfit !== undefined && (typeof params.takeProfit !== 'number' || params.takeProfit <= 0)) {
    errors.takeProfit = 'Take profit must be a positive number';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// Validate market data request
export function validateMarketDataRequest(params) {
  const errors = {};

  if (!params.symbol) {
    errors.symbol = 'Symbol is required';
  }

  if (params.timeframe) {
    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M'];
    if (!validTimeframes.includes(params.timeframe)) {
      errors.timeframe = `Timeframe must be one of: ${validTimeframes.join(', ')}`;
    }
  }

  if (params.limit !== undefined) {
    if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 5000) {
      errors.limit = 'Limit must be an integer between 1 and 5000';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}