-- Palpay Rail initial schema
-- Single-manager MVP scope: no multi-tenant auth tables.

create extension if not exists pgcrypto;

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  raw_instruction text not null,
  purpose text not null,
  vendor_allowlist text[] not null default '{}',
  max_amount numeric(12, 2) not null,
  currency text not null default 'USD',
  allow_recurring boolean not null default false,
  approval_triggers text[] not null default '{}', -- e.g. 'new_vendor', 'near_limit', 'ambiguous'
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions(id) on delete cascade,
  vendor text not null,
  item_description text not null,
  amount numeric(12, 2) not null,
  currency text not null,
  is_recurring boolean not null default false,
  decision text not null check (decision in ('ALLOWED', 'NEEDS_APPROVAL', 'BLOCKED')),
  matched_rules jsonb not null default '[]',
  failed_rules jsonb not null default '[]',
  explanation text,
  approval_status text check (approval_status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  paypal_order_id text,
  paypal_status text,
  created_at timestamptz not null default now()
);

create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  manager_id text not null default 'default-manager',
  fcm_token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists requests_mission_id_idx on requests(mission_id);
create index if not exists requests_created_at_idx on requests(created_at desc);
create index if not exists requests_approval_status_idx on requests(approval_status);
