import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import bcrypt from 'bcryptjs';
import { validateEmail, validatePassword } from '@/lib/utils/validation';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    // Validation
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!validatePassword(password)) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Find user in Supabase
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if account is verified
    if (!user.is_verified) {
      return NextResponse.json(
        { error: 'Please verify your email before logging in' },
        { status: 401 }
      );
    }

    // Update login stats
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        last_login: new Date().toISOString(),
        login_count: user.login_count + 1,
        ip_address: ip,
        user_agent: request.headers.get('user-agent') || 'unknown'
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating login stats:', updateError);
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      );
    }

    // Prepare user data (exclude sensitive information)
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`,
      role: user.role,
      subscription: {
        plan: user.subscription_plan,
        isActive: user.subscription_is_active,
        startDate: user.subscription_start_date,
        endDate: user.subscription_end_date
      },
      tradingConfig: {
        maxDrawdown: user.max_drawdown,
        maxDailyLoss: user.max_daily_loss,
        maxPositionSize: user.max_position_size,
        defaultLotSize: user.default_lot_size,
        riskLevel: user.risk_level
      },
      stats: {
        totalTrades: user.total_trades,
        winningTrades: user.winning_trades,
        losingTrades: user.losing_trades,
        totalProfit: user.total_profit,
        totalLoss: user.total_loss,
        winRate: user.win_rate,
        profitFactor: user.profit_factor,
        maxDrawdownReached: user.max_drawdown_reached
      },
      lastLogin: user.last_login,
      loginCount: user.login_count + 1
    };

    return NextResponse.json({
      success: true,
      message: 'Login successful',
      user: userData,
      accessToken: authData.properties?.access_token,
      refreshToken: authData.properties?.refresh_token
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}