-- Initialize development database for Firemní Asistent
-- This script runs when the PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table with all required fields
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger to automatically update updated_at on user updates
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert development test users (passwords are hashed version of 'Password123!')
-- These are for testing purposes only - never use in production!
INSERT INTO users (
    id, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    is_active, 
    email_verified
) VALUES 
(
    uuid_generate_v4(),
    'admin@test.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLFZjXH8ze8NsXW', -- Password123!
    'Admin',
    'User',
    'admin',
    true,
    true
),
(
    uuid_generate_v4(),
    'user@test.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLFZjXH8ze8NsXW', -- Password123!
    'Test',
    'User',
    'user',
    true,
    true
),
(
    uuid_generate_v4(),
    'manager@test.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeRLFZjXH8ze8NsXW', -- Password123!
    'Manager',
    'User',
    'manager',
    true,
    false
)
ON CONFLICT (email) DO NOTHING;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dev_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO dev_user;

-- Display setup completion message
DO $$
BEGIN
    RAISE NOTICE 'Development database initialized successfully!';
    RAISE NOTICE 'Test users created:';
    RAISE NOTICE '  admin@test.com (admin role) - Password: Password123!';
    RAISE NOTICE '  user@test.com (user role) - Password: Password123!';
    RAISE NOTICE '  manager@test.com (manager role) - Password: Password123!';
END $$;