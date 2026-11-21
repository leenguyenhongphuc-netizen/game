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
