import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { validateEmail, validatePassword, validateName } from '@/lib/utils/validation';

export async function POST(request) {
  try {
    const { email, password, firstName, lastName } = await request.json();

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

    if (!validateName(firstName)) {
      return NextResponse.json(
        { error: 'First name must be between 2-50 characters' },
        { status: 400 }
      );
    }

    if (!validateName(lastName)) {
      return NextResponse.json(
        { error: 'Last name must be between 2-50 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate verification token
    const verificationToken = uuidv4();

    // Create user in Supabase
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        verification_token: verificationToken,
        is_verified: false, // Set to true for development, false for production
        role: 'user',
        subscription_plan: 'free',
        subscription_is_active: true,
        subscription_start_date: new Date().toISOString(),
        
        // Default trading configuration
        max_drawdown: 0.10,
        max_daily_loss: 0.05,
        max_position_size: 0.02,
        default_lot_size: 0.01,
        risk_level: 'moderate',
        
        // Initialize stats
        total_trades: 0,
        winning_trades: 0,
        losing_trades: 0,
        total_profit: 0,
        total_loss: 0,
        win_rate: 0,
        profit_factor: 0,
        max_drawdown_reached: 0,
        
        // Default notification preferences
        email_notifications: {
          trades: true,
          profits: true,
          losses: true,
          systemAlerts: true
        },
        push_notifications: {
          trades: false,
          profits: false,
          losses: true,
          systemAlerts: true
        },
        
        login_count: 0
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Create Supabase Auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: false, // Set to true for auto-confirmation in development
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        user_id: newUser.id
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      
      // Cleanup: delete the user record if auth creation failed
      await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', newUser.id);
      
      return NextResponse.json(
        { error: 'Failed to create authentication account' },
        { status: 500 }
      );
    }

    // Update user with auth ID
    await supabaseAdmin
      .from('users')
      .update({ id: authUser.user.id })
      .eq('id', newUser.id);

    // TODO: Send verification email
    // await sendVerificationEmail(email, verificationToken);

    // Log system event
    await supabaseAdmin
      .from('system_logs')
      .insert({
        level: 'info',
        category: 'auth',
        message: 'New user registered',
        details: {
          user_id: authUser.user.id,
          email: email,
          ip_address: request.headers.get('x-forwarded-for') || 'unknown'
        }
      });

    // Prepare response data (exclude sensitive information)
    const userData = {
      id: authUser.user.id,
      email: newUser.email,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      fullName: `${newUser.first_name} ${newUser.last_name}`,
      role: newUser.role,
      isVerified: newUser.is_verified,
      subscription: {
        plan: newUser.subscription_plan,
        isActive: newUser.subscription_is_active
      }
    };

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Please check your email for verification.',
      user: userData,
      requiresVerification: !newUser.is_verified
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
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