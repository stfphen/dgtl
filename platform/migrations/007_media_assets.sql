-- 007: Tenant media library (team-scoped media_assets).
-- Assets live here and are referenced from tenants.config by mediaId; config
-- never inlines bytes (see brain/20-Modules/2D-Portfolio-Media.md). Keeps the
-- DDL consistent with the inline bootstrap in lib/store.js ensureSchema.
-- Note: the brain doc sketched a composite gin (team_id, tags) index — that
-- needs the btree_gin extension, so we use a btree (team_id, created_at desc)
-- for listing plus a plain gin(tags) for tag search instead.

create table if not exists media_assets (
  id text primary key,
  team_id text not null default 'team_default',
  tenant_id text not null default '',
  kind text not null default 'image',           -- image | video | embed
  url text not null,
  storage_key text not null default '',
  mime text not null default '',
  bytes integer not null default 0,
  width integer not null default 0,
  height integer not null default 0,
  duration integer not null default 0,
  thumbnail_url text not null default '',
  title text not null default '',
  alt text not null default '',
  tags jsonb not null default '{"industry":[],"format":[]}',
  source text not null default 'upload',        -- upload | url | embed
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists media_assets_team_id_created_at_idx
  on media_assets (team_id, created_at desc);

create index if not exists media_assets_tags_idx
  on media_assets using gin (tags);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'media_assets_team_id_fkey')
     and exists (select 1 from information_schema.tables where table_name = 'teams')
  then
    alter table media_assets
      add constraint media_assets_team_id_fkey
      foreign key (team_id) references teams(id) on delete restrict;
  end if;
end $$;
