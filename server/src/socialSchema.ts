// Lược đồ cho hiện diện người chơi và cư dân ảo (server/src/social.ts); chạy lại nhiều lần vẫn an toàn.
export const SOCIAL_SCHEMA = `
-- hiện diện người chơi: bảng không ghi nhật ký (unlogged) vì chỉ giữ vị trí vài giây gần nhất, mất khi máy CSDL khởi động lại cũng không sao
create unlogged table if not exists presence (
  user_id bigint primary key references users(id) on delete cascade,
  scene text not null,
  scene_key text not null,
  x real, z real, yaw real, speed real,
  extra jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists presence_scene_idx on presence (scene, scene_key, updated_at);
-- cư dân ảo
alter table users add column if not exists is_bot boolean not null default false;
alter table users add column if not exists bot_at timestamptz;
create index if not exists users_bot_idx on users (bot_at) where is_bot;
create table if not exists bot_state (id int primary key, enabled boolean not null default true, last_tick timestamptz);
insert into bot_state (id) values (1) on conflict do nothing;
`;
