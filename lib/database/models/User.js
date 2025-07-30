import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'premium'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  
  // Trading Configuration
  tradingConfig: {
    maxDrawdown: {
      type: Number,
      default: 0.10 // 10%
    },
    maxDailyLoss: {
      type: Number,
      default: 0.05 // 5%
    },
    maxPositionSize: {
      type: Number,
      default: 0.02 // 2%
    },
    defaultLotSize: {
      type: Number,
      default: 0.01
    },
    riskLevel: {
      type: String,
      enum: ['conservative', 'moderate', 'aggressive'],
      default: 'moderate'
    }
  },
  
  // Account Statistics
  stats: {
    totalTrades: {
      type: Number,
      default: 0
    },
    winningTrades: {
      type: Number,
      default: 0
    },
    losingTrades: {
      type: Number,
      default: 0
    },
    totalProfit: {
      type: Number,
      default: 0
    },
    totalLoss: {
      type: Number,
      default: 0
    },
    winRate: {
      type: Number,
      default: 0
    },
    profitFactor: {
      type: Number,
      default: 0
    },
    maxDrawdownReached: {
      type: Number,
      default: 0
    }
  },
  
  // Subscription Info
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    isActive: {
      type: Boolean,
      default: true
    }
  },
  
  // Broker Connections
  brokerConnections: [{
    brokerId: String,
    brokerName: String,
    accountId: String,
    isDemo: {
      type: Boolean,
      default: true
    },
    balance: Number,
    equity: Number,
    margin: Number,
    freeMargin: Number,
    isConnected: {
      type: Boolean,
      default: false
    },
    lastSync: Date,
    credentials: {
      login: String,
      password: String, // encrypted
      server: String
    }
  }],
  
  // Notification Preferences
  notifications: {
    email: {
      trades: {
        type: Boolean,
        default: true
      },
      profits: {
        type: Boolean,
        default: true
      },
      losses: {
        type: Boolean,
        default: true
      },
      systemAlerts: {
        type: Boolean,
        default: true
      }
    },
    push: {
      trades: {
        type: Boolean,
        default: false
      },
      profits: {
        type: Boolean,
        default: false
      },
      losses: {
        type: Boolean,
        default: true
      },
      systemAlerts: {
        type: Boolean,
        default: true
      }
    }
  },
  
  lastLogin: Date,
  loginCount: {
    type: Number,
    default: 0
  },
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for win rate calculation
userSchema.virtual('calculatedWinRate').get(function() {
  if (this.stats.totalTrades === 0) return 0;
  return (this.stats.winningTrades / this.stats.totalTrades) * 100;
});

// Virtual for profit factor calculation
userSchema.virtual('calculatedProfitFactor').get(function() {
  if (this.stats.totalLoss === 0) return this.stats.totalProfit > 0 ? Infinity : 0;
  return this.stats.totalProfit / Math.abs(this.stats.totalLoss);
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to update trading statistics
userSchema.methods.updateTradingStats = function(trade) {
  this.stats.totalTrades += 1;
  
  if (trade.profit > 0) {
    this.stats.winningTrades += 1;
    this.stats.totalProfit += trade.profit;
  } else {
    this.stats.losingTrades += 1;
    this.stats.totalLoss += Math.abs(trade.profit);
  }
  
  // Recalculate win rate and profit factor
  this.stats.winRate = (this.stats.winningTrades / this.stats.totalTrades) * 100;
  this.stats.profitFactor = this.stats.totalLoss === 0 ? 
    (this.stats.totalProfit > 0 ? Infinity : 0) : 
    this.stats.totalProfit / this.stats.totalLoss;
  
  return this.save();
};

// Method to check if user can create more bots
userSchema.methods.canCreateBot = function() {
  const limits = {
    free: 1,
    basic: 3,
    premium: 10,
    enterprise: Infinity
  };
  
  return this.bots?.length < limits[this.subscription.plan];
};

// Method to get active broker connection
userSchema.methods.getActiveBrokerConnection = function() {
  return this.brokerConnections.find(conn => conn.isConnected);
};

// Index for performance
userSchema.index({ email: 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;