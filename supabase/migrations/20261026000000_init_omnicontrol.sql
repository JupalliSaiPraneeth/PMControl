-- OmniControl Supabase Schema Migration
-- 20261026000000_init_omnicontrol.sql

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT 'User',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger to handle updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Devices Table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'android',
    app_version TEXT NOT NULL DEFAULT '1.0.0',
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    revoked_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_owner_id ON public.devices(owner_id);
CREATE INDEX IF NOT EXISTS idx_devices_revoked ON public.devices(revoked_at);

-- 3. Pairing Requests Table
CREATE TABLE IF NOT EXISTS public.pairing_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pairing_code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pairing_owner ON public.pairing_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_pairing_expires ON public.pairing_requests(expires_at);

-- 4. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    controller_type TEXT NOT NULL DEFAULT 'web',
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'rejected', 'ended')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_at TIMESTAMPTZ DEFAULT NULL,
    started_at TIMESTAMPTZ DEFAULT NULL,
    ended_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_owner ON public.sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON public.sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);

-- 5. Session Events Table
CREATE TABLE IF NOT EXISTS public.session_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_session_events_session ON public.session_events(session_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Devices Policies
CREATE POLICY "Users can view their own active devices"
    ON public.devices FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert devices they own"
    ON public.devices FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own devices"
    ON public.devices FOR UPDATE
    USING (auth.uid() = owner_id);

-- Pairing Requests Policies
CREATE POLICY "Users can view their own pairing requests"
    ON public.pairing_requests FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own pairing requests"
    ON public.pairing_requests FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own pairing requests"
    ON public.pairing_requests FOR UPDATE
    USING (auth.uid() = owner_id);

-- Sessions Policies
CREATE POLICY "Users can view their own sessions"
    ON public.sessions FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own sessions"
    ON public.sessions FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own sessions"
    ON public.sessions FOR UPDATE
    USING (auth.uid() = owner_id);

-- Session Events Policies
CREATE POLICY "Users can view events for their sessions"
    ON public.session_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_events.session_id AND s.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert events for their sessions"
    ON public.session_events FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sessions s
            WHERE s.id = session_events.session_id AND s.owner_id = auth.uid()
        )
    );
