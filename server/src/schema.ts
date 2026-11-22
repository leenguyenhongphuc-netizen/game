// Lược đồ cơ sở dữ liệu; chạy lại nhiều lần vẫn an toàn.
export const SCHEMA = `
create table if not exists users (
  id bigserial primary key,
  username text not null unique,
  display_name text not null,
  pass_hash text not null,
  cash bigint not null check (cash >= 0),
  home_region_id text,
  created_at timestamptz not null default now()
);
create table if not exists sessions (
  token_hash text primary key,
  user_id bigint not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists plots (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  region_id text not null,
  cell_lat double precision not null,
  cell_lng double precision not null,
  is_home boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, region_id)
);
create index if not exists plots_region_idx on plots (region_id);
create table if not exists plantings (
  id bigserial primary key,
  plot_id bigint not null references plots(id) on delete cascade,
  tile int not null,
  specialty_id text not null,
  step_index int not null,
  step_ready_at timestamptz not null,
  late_count int not null default 0,
  planted_at timestamptz not null default now(),
  unique (plot_id, tile)
);
create table if not exists inventory (
  user_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  quality text not null check (quality in ('A','B','C')),
  kg int not null check (kg >= 0),
  primary key (user_id, specialty_id, quality)
);
create table if not exists listings (
  id bigserial primary key,
  seller_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  quality text not null check (quality in ('A','B','C')),
  kg int not null check (kg >= 0),
  price bigint not null check (price > 0),
  status text not null default 'open' check (status in ('open','sold','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists listings_open_idx on listings (specialty_id, price) where status = 'open';
create table if not exists price_ticks (
  id bigserial primary key,
  specialty_id text not null,
  price bigint not null check (price > 0),
  source text not null,
  observed_at timestamptz not null default now()
);
create index if not exists price_ticks_idx on price_ticks (specialty_id, observed_at desc, id desc);
create table if not exists ledger (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  delta bigint not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists ledger_user_idx on ledger (user_id, id desc);
create table if not exists friendships (
  user_a bigint not null references users(id) on delete cascade,
  user_b bigint not null references users(id) on delete cascade,
  requested_by bigint not null references users(id) on delete cascade,
  status text not null check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_b_idx on friendships (user_b);
alter table plots add column if not exists kind text not null default 'ground';
create table if not exists npc_sales (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  kg int not null check (kg > 0),
  created_at timestamptz not null default now()
);
create index if not exists npc_sales_specialty_idx on npc_sales (specialty_id, created_at desc);
create index if not exists npc_sales_user_idx on npc_sales (user_id, created_at desc);
create table if not exists coops (
  id bigserial primary key,
  name text not null unique,
  region_id text not null,
  owner_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists coops_region_idx on coops (region_id);
create table if not exists coop_members (
  coop_id bigint not null references coops(id) on delete cascade,
  user_id bigint not null unique references users(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists coop_members_coop_idx on coop_members (coop_id, joined_at);
create table if not exists visits (
  user_id bigint not null references users(id) on delete cascade,
  region_id text not null,
  first_at timestamptz not null default now(),
  primary key (user_id, region_id)
);
create table if not exists collection (
  user_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  first_at timestamptz not null default now(),
  primary key (user_id, specialty_id)
);
create table if not exists collection_rewards (
  user_id bigint not null references users(id) on delete cascade,
  region_id text not null,
  primary key (user_id, region_id)
);
create table if not exists gifts (
  id bigserial primary key,
  from_id bigint not null references users(id) on delete cascade,
  to_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  quality text not null check (quality in ('A','B','C')),
  kg int not null check (kg > 0),
  message text not null default '',
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gifts_to_idx on gifts (to_id, id desc);
create index if not exists gifts_from_idx on gifts (from_id, created_at desc);
alter table plots add column if not exists ward_name text;
alter table plots add column if not exists ward_province text;
alter table users add column if not exists role text not null default 'nong_dan';
alter table listings add column if not exists walkin_at timestamptz;
create table if not exists process_jobs (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  kg_in int not null check (kg_in > 0),
  kg_out int not null check (kg_out > 0),
  ready_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists process_jobs_user_idx on process_jobs (user_id, id);
create table if not exists products (
  user_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  kg int not null check (kg >= 0),
  primary key (user_id, specialty_id)
);
create table if not exists coop_orders (
  id bigserial primary key,
  coop_id bigint not null references coops(id) on delete cascade,
  specialty_id text not null,
  npc_id text not null,
  kg_target int not null check (kg_target > 0),
  kg_filled int not null default 0,
  status text not null default 'open' check (status in ('open','done','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists coop_orders_coop_idx on coop_orders (coop_id, id desc);
create table if not exists coop_contribs (
  order_id bigint not null references coop_orders(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  kg int not null,
  value bigint not null,
  primary key (order_id, user_id)
);
create table if not exists order_done (
  user_id bigint not null references users(id) on delete cascade,
  day date not null,
  slot int not null,
  primary key (user_id, day, slot)
);
alter table users alter column role drop not null;
alter table users alter column role drop default;
alter table users add column if not exists role_assigned_at timestamptz;
alter table users add column if not exists last_seen_at timestamptz;
alter table users add column if not exists truck_region text;
alter table users add column if not exists avatar jsonb;
alter table plots add column if not exists style jsonb;
alter table plots add column if not exists decor jsonb;
update users set role = 'thuong_lai' where role = 'chu_sap';
update users set role = null where role_assigned_at is null and role is not null;
create index if not exists users_region_seen_idx on users (home_region_id, last_seen_at);
create table if not exists trips (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  from_region text not null,
  to_region text not null,
  min_seconds int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists trips_user_idx on trips (user_id, id desc);
alter table users add column if not exists harvests int not null default 0;
alter table users add column if not exists is_tester boolean not null default false;
alter table users add column if not exists fuel_l numeric not null default 30;
alter table users add column if not exists etc bigint not null default 0;
alter table users add column if not exists cargo_used int not null default 0;
alter table users add column if not exists cargo_day date;
create table if not exists wholesale_buys (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  region_id text not null,
  specialty_id text not null,
  kg int not null check (kg > 0),
  unit_price bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists wholesale_buys_day_idx on wholesale_buys (region_id, specialty_id, created_at);
create table if not exists export_shipments (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  quality text not null,
  kg int not null check (kg > 0),
  arrive_kg int not null,
  mode text not null,
  market text not null,
  gateway_id text not null,
  freight bigint not null,
  payout bigint not null,
  created_at timestamptz not null default now(),
  arrives_at timestamptz not null,
  paid_at timestamptz
);
create index if not exists export_shipments_user_idx on export_shipments (user_id, id desc);
alter table coop_orders add column if not exists export_mode text;
alter table coop_orders add column if not exists market text;
alter table users add column if not exists tour_region text;
alter table users add column if not exists super_earned bigint not null default 0;
create table if not exists sight_visits (
  user_id bigint not null references users(id) on delete cascade,
  sight_id text not null,
  visits int not null default 0,
  stops jsonb not null default '[]',
  is_open boolean not null default false,
  done_at timestamptz,
  primary key (user_id, sight_id)
);
create table if not exists super_shelves (
  id bigserial primary key,
  province text not null,
  seller_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  quality text not null,
  kg int not null check (kg >= 0),
  price bigint not null check (price > 0),
  created_at timestamptz not null default now()
);
create index if not exists super_shelves_province_idx on super_shelves (province, price) where kg > 0;
create table if not exists super_buys (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  province text not null,
  seller_id bigint,
  specialty_id text not null,
  kg int not null check (kg > 0),
  price bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists super_buys_day_idx on super_buys (province, created_at);
`;
