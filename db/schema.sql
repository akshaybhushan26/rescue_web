-- Proposed PostgreSQL migration shape only. The MVP uses the local file store.
-- Apply through a migration tool after adding authenticated tenant-aware access.
create table tenants (id uuid primary key, name text not null);
create table order_cases (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  source_message_id text not null,
  revision integer not null default 0 check (revision >= 0),
  status text not null check (status in ('received','ready','review','approved','rejected')),
  email jsonb not null,
  intent jsonb,
  checks jsonb not null default '[]',
  proposal jsonb,
  customer_id text,
  purchase_order text,
  created_at timestamptz not null default now(),
  unique (tenant_id, source_message_id)
);
create unique index approved_customer_po on order_cases (tenant_id, customer_id, purchase_order)
  where status = 'approved' and proposal->>'operation' = 'CREATE_DRAFT_ORDER';
create table case_audit (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  case_id uuid not null references order_cases(id),
  actor_id uuid not null,
  event text not null,
  detail jsonb not null,
  created_at timestamptz not null default now()
);
-- Requires an application-specific authenticated tenant claim policy before use.
-- RLS enabled with no policies intentionally denies unprivileged access by default.
alter table order_cases enable row level security;
alter table case_audit enable row level security;
alter table tenants enable row level security;
-- Production review transaction: SELECT ... FOR UPDATE, compare revision,
-- validate proposal digest and ERP version, append audit, and insert outbox row.
-- ERP outbox worker, RLS policies, roles, and immutable-audit permissions are not implemented here.
