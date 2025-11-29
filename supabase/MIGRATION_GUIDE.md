# Supabase Migration Guide

## Applying Migrations

The migration file `migrations/20250101_create_scores.sql` needs to be applied to your Supabase database.

### Option 1: Using Supabase Dashboard (Recommended for Quick Setup)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `migrations/20250101_create_scores.sql`
5. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### What This Migration Creates

- `profiles` table: Stores user profile information (username, avatar)
- `scores` table: Stores game scores with user references
- Row Level Security (RLS) policies for the scores table

After applying the migration, the `/api/score` endpoint should work correctly.

