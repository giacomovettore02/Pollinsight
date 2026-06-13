create table if not exists public.demo_runs (
  id uuid primary key default gen_random_uuid(),
  boot_id text unique not null,
  status text not null default 'connecting'
    check (status in (
      'connecting',
      'reading_sensor',
      'classifying',
      'uploading',
      'complete',
      'error'
    )),
  progress_current integer not null default 0,
  progress_total integer not null default 20,
  total_bees integer,
  healthy_bees integer,
  infected_bees integer,
  temperature_c numeric(5,2),
  humidity_percent numeric(5,2),
  sensor_status text not null default 'pending'
    check (sensor_status in ('pending', 'online', 'offline', 'error')),
  device_status text not null default 'online'
    check (device_status in ('online', 'offline', 'error')),
  evidence jsonb not null default '[]'::jsonb,
  model_name text,
  processing_ms integer,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.update_demo_run_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists demo_runs_updated_at on public.demo_runs;
create trigger demo_runs_updated_at
before update on public.demo_runs
for each row
execute function public.update_demo_run_timestamp();

alter table public.demo_runs enable row level security;
alter table public.demo_runs replica identity full;

drop policy if exists "Dashboard can read demo runs" on public.demo_runs;
create policy "Dashboard can read demo runs"
on public.demo_runs
for select
to anon, authenticated
using (true);

grant select on public.demo_runs to anon, authenticated;
revoke insert, update, delete on public.demo_runs from anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'demo-evidence',
  'demo-evidence',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read demo evidence" on storage.objects;
create policy "Public can read demo evidence"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'demo-evidence');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'demo_runs'
  ) then
    alter publication supabase_realtime add table public.demo_runs;
  end if;
end
$$;
