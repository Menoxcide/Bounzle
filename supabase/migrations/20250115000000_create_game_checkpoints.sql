-- Create game_checkpoints table for storing game state snapshots
create table game_checkpoints (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  session_id text not null,
  checkpoint_data jsonb not null,
  timestamp timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- Create index for faster lookups
create index idx_game_checkpoints_user_session on game_checkpoints(user_id, session_id);
create index idx_game_checkpoints_timestamp on game_checkpoints(timestamp);
create index idx_game_checkpoints_created_at on game_checkpoints(created_at);

-- Enable RLS
alter table game_checkpoints enable row level security;

-- Policy: Users can insert their own checkpoints
create policy "Users can insert own checkpoints"
  on game_checkpoints for insert
  with check (auth.uid() = user_id or user_id is null);

-- Policy: Users can read their own checkpoints
create policy "Users can read own checkpoints"
  on game_checkpoints for select
  using (auth.uid() = user_id or user_id is null);

-- Policy: Users can delete their own checkpoints
create policy "Users can delete own checkpoints"
  on game_checkpoints for delete
  using (auth.uid() = user_id or user_id is null);

-- Function to auto-cleanup old checkpoints (older than 1 hour)
create or replace function cleanup_old_checkpoints()
returns void
language plpgsql
as $$
begin
  delete from game_checkpoints
  where created_at < now() - interval '1 hour';
end;
$$;

-- Create a scheduled job to run cleanup (if pg_cron extension is available)
-- Note: This requires pg_cron extension to be enabled in Supabase
-- Uncomment if pg_cron is available:
-- select cron.schedule('cleanup-old-checkpoints', '0 * * * *', 'select cleanup_old_checkpoints()');

