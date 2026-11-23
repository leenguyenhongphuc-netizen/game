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
-- hợp tác xã theo Luật HTX 2023: vận động đủ 5 thành viên, góp vốn, nộp hồ sơ, được cấp giấy (HTX cũ coi như đã hoạt động)
alter table coops add column if not exists status text not null default 'hoat_dong';
alter table coops add column if not exists reg_no text;
alter table coops add column if not exists reg_due_at timestamptz;
alter table coops add column if not exists registered_at timestamptz;
alter table coop_members add column if not exists capital bigint not null default 0;
create table if not exists coop_invites (
  coop_id bigint not null references coops(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  invited_by bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coop_id, user_id)
);
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
alter table wholesale_buys add column if not exists moved boolean not null default false;
alter table npc_sales add column if not exists market_region text;
create index if not exists npc_sales_market_idx on npc_sales (market_region, specialty_id, created_at desc);
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
alter table users add column if not exists xp int not null default 0;
alter table users add column if not exists energy int not null default 100;
alter table users add column if not exists energy_at timestamptz not null default now();
alter table sight_visits add column if not exists stop_at jsonb not null default '{}';
alter table plots add column if not exists price_paid bigint;
alter table plots add column if not exists fees_paid bigint;
create table if not exists user_items (
  user_id bigint not null references users(id) on delete cascade,
  item_id text not null,
  qty int not null check (qty >= 0),
  primary key (user_id, item_id)
);
create table if not exists machines (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  level int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists machines_user_idx on machines (user_id, id);
alter table process_jobs add column if not exists machine_id bigint;
alter table super_shelves add column if not exists processed boolean not null default false;
alter table super_buys add column if not exists processed boolean not null default false;
alter table export_shipments add column if not exists processed boolean not null default false;
create table if not exists vehicles (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  energy numeric not null default 0,
  odo_km numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists vehicles_user_idx on vehicles (user_id, id);
alter table vehicles add column if not exists price_paid bigint not null default 0;
alter table users add column if not exists vehicle_id bigint;
create table if not exists user_licenses (
  user_id bigint not null references users(id) on delete cascade,
  cls text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, cls)
);
alter table user_licenses add column if not exists issued_at timestamptz not null default now();
alter table user_licenses add column if not exists expires_at timestamptz;
alter table user_licenses add column if not exists points int not null default 12;
alter table user_licenses add column if not exists points_at timestamptz;
alter table user_licenses add column if not exists suspended boolean not null default false;
create table if not exists license_exams (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  cls text not null,
  part text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int,
  passed boolean
);
create index if not exists license_exams_user_idx on license_exams (user_id, cls, part, finished_at desc);
create table if not exists user_goods (
  user_id bigint not null references users(id) on delete cascade,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table users add column if not exists equipped jsonb;
-- tiến trình nhân vật: sổ EXP, phần thưởng đã nhận, nâng cấp đất, giống lai, máy nhập khẩu, hộp quà, nhật ký dung hợp
create table if not exists xp_log (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  source text not null,
  xp int not null,
  created_at timestamptz not null default now()
);
create index if not exists xp_log_user_idx on xp_log (user_id, created_at);
create table if not exists progress_claims (
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table plots add column if not exists upgrades jsonb not null default '{}';
alter table plantings add column if not exists trait text;
alter table machines add column if not exists origin text;
create table if not exists machine_imports (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  import_id text not null,
  cost bigint not null,
  ordered_at timestamptz not null default now(),
  port_at timestamptz not null,
  cleared_at timestamptz not null,
  arrive_at timestamptz not null,
  installed_at timestamptz
);
create index if not exists machine_imports_user_idx on machine_imports (user_id, id);
create table if not exists user_seeds (
  user_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  trait text not null,
  qty int not null check (qty >= 0),
  primary key (user_id, specialty_id, trait)
);
create table if not exists gift_boxes (
  user_id bigint not null references users(id) on delete cascade,
  box_id text not null,
  qty int not null check (qty >= 0),
  value bigint not null,
  primary key (user_id, box_id)
);
create table if not exists fusion_log (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  recipe_id text not null,
  success boolean not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
-- nông trại quy mô lớn: cánh đồng theo khối 100 ô, máy nông nghiệp, lượt làm việc
create table if not exists fields (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  region_id text not null,
  blocks int not null check (blocks > 0),
  specialty_id text,
  step_index int not null default 0,
  step_ready_at timestamptz,
  late_count int not null default 0,
  planted_at timestamptz,
  price_paid bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists fields_user on fields (user_id);
create table if not exists farm_machines (
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  busy_until timestamptz,
  bought_at timestamptz not null default now(),
  primary key (user_id, kind)
);
create table if not exists field_jobs (
  id bigserial primary key,
  field_id bigint not null references fields(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  step_index int not null,
  kind text not null,
  method text not null,
  machine text,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  cost bigint not null default 0,
  late boolean not null default false,
  done boolean not null default false
);
create index if not exists field_jobs_open on field_jobs (user_id) where not done;
-- tự lái máy trên ruộng: các ô đã làm của bước đang lái dở (nhánh F4)
alter table fields add column if not exists drive_step int;
alter table fields add column if not exists drive_done int[] not null default '{}';
-- kinh tế mở rộng (server/src/economy.ts): lô xuất khẩu nhiều mặt hàng, hợp đồng công ty, tài sản thương mại
alter table export_shipments add column if not exists bundle_id text;
create index if not exists export_shipments_market_idx on export_shipments (market, specialty_id, created_at desc);
create table if not exists contract_deliveries (
  id bigserial primary key,
  contract_id text not null,
  company_id text not null,
  user_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  kg int not null check (kg > 0),
  paid bigint not null,
  ship_fee bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists contract_deliveries_idx on contract_deliveries (contract_id);
create table if not exists properties (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  province text not null,
  cost bigint not null,
  ready_at timestamptz not null,
  sold_at timestamptz,
  pending bigint not null default 0,
  earned_total bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, kind, province)
);
create index if not exists properties_province_idx on properties (province, kind);
create table if not exists property_shelves (
  id bigserial primary key,
  property_id bigint not null references properties(id) on delete cascade,
  seller_id bigint not null references users(id) on delete cascade,
  specialty_id text not null,
  quality text not null,
  processed boolean not null default false,
  kg int not null,
  sold_kg int not null default 0,
  price bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists property_shelves_prop_idx on property_shelves (property_id);
-- sổ địa chính, chuyển nhượng đất, giá tham chiếu đời thực (server/src/land.ts)
create table if not exists land_lots (
  id bigserial primary key,
  province text not null,
  use text not null,
  owner_id bigint references users(id) on delete set null,
  area_m2 int not null,
  price_paid bigint not null,
  cert_no text,
  property_id bigint references properties(id) on delete set null,
  field_id bigint,
  listing_price bigint,
  listed_at timestamptz,
  acquired_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists land_lots_prov_idx on land_lots (province, use);
create index if not exists land_lots_owner_idx on land_lots (owner_id);
create index if not exists land_lots_listing_idx on land_lots (province) where listing_price is not null;
create table if not exists land_transfers (
  id bigserial primary key,
  lot_id bigint not null references land_lots(id) on delete cascade,
  seller_id bigint references users(id) on delete set null,
  buyer_id bigint references users(id) on delete set null,
  price bigint not null,
  registration bigint not null,
  tax bigint not null,
  created_at timestamptz not null default now()
);
create table if not exists ref_prices (
  key text not null,
  value numeric not null,
  unit text not null,
  since date not null,
  source text not null,
  updated_at timestamptz not null default now(),
  primary key (key, since)
);
`;
