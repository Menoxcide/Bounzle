-- Create achievements table
create table achievements (
  id text primary key,
  user_id uuid references auth.users not null,
  achievement_id text not null,
  achievement_type text not null,
  name text not null,
  description text not null,
  unlocked boolean default false,
  unlocked_at timestamp with time zone,
  progress integer default 0,
  target integer not null,
  created_at timestamp with time zone default now(),
  unique(user_id, achievement_id)
);

-- Create unlocks table
create table unlocks (
  id text primary key,
  user_id uuid references auth.users not null,
  unlock_id text not null,
  unlock_type text not null,
  name text not null,
  description text not null,
  unlocked boolean default false,
  unlocked_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  unique(user_id, unlock_id)
);

-- Create indexes for faster queries
create index idx_achievements_user_id on achievements(user_id);
create index idx_achievements_unlocked on achievements(user_id, unlocked);
create index idx_unlocks_user_id on unlocks(user_id);
create index idx_unlocks_unlocked on unlocks(user_id, unlocked);

-- RLS Policies
alter table achievements enable row level security;
alter table unlocks enable row level security;

-- Users can read their own achievements
create policy "Users can read own achievements"
  on achievements for select
  using (auth.uid() = user_id);

-- Users can insert their own achievements
create policy "Users can insert own achievements"
  on achievements for insert
  with check (auth.uid() = user_id);

-- Users can update their own achievements
create policy "Users can update own achievements"
  on achievements for update
  using (auth.uid() = user_id);

-- Users can read their own unlocks
create policy "Users can read own unlocks"
  on unlocks for select
  using (auth.uid() = user_id);

-- Users can insert their own unlocks
create policy "Users can insert own unlocks"
  on unlocks for insert
  with check (auth.uid() = user_id);

-- Users can update their own unlocks
create policy "Users can update own unlocks"
  on unlocks for update
  using (auth.uid() = user_id);

