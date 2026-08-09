-- Persistent per-user rate limits for costly server endpoints.
-- Run in the Supabase SQL Editor before deploying the matching application code.

create table if not exists public.api_rate_limits (
  user_id uuid not null,
  endpoint text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, endpoint, window_start)
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_endpoint text, p_limit integer, p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  current_window timestamptz;
  updated_count integer;
begin
  if caller_id is null then return false; end if;
  if p_endpoint not in ('ai', 'notify') then return false; end if;
  if p_limit < 1 or p_limit > 1000 then return false; end if;
  if p_window_seconds < 10 or p_window_seconds > 86400 then return false; end if;

  current_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits (user_id, endpoint, window_start, request_count)
  values (caller_id, p_endpoint, current_window, 1)
  on conflict (user_id, endpoint, window_start)
  do update set request_count = public.api_rate_limits.request_count + 1
  returning request_count into updated_count;

  return updated_count <= p_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to authenticated;

-- Periodically remove windows older than two days with Supabase Cron.
