import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface AchievementInput {
  achievement_id?: string;
  id?: string;
  achievement_type?: string;
  type?: string;
  name: string;
  description: string;
  unlocked?: boolean;
  unlocked_at?: string;
  progress?: number;
  target?: number;
}

interface UnlockInput {
  unlock_id?: string;
  id?: string;
  unlock_type?: string;
  type?: string;
  name: string;
  description: string;
  unlocked?: boolean;
  unlocked_at?: string;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: achievements, error: achievementsError } = await supabase
      .from('achievements')
      .select('*')
      .eq('user_id', session.user.id)
      .order('unlocked_at', { ascending: false, nullsFirst: false });

    if (achievementsError) {
      console.error('Error fetching achievements:', achievementsError);
      return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
    }

    const { data: unlocks, error: unlocksError } = await supabase
      .from('unlocks')
      .select('*')
      .eq('user_id', session.user.id)
      .order('unlocked_at', { ascending: false, nullsFirst: false });

    if (unlocksError) {
      console.error('Error fetching unlocks:', unlocksError);
      return NextResponse.json({ error: 'Failed to fetch unlocks' }, { status: 500 });
    }

    return NextResponse.json({
      achievements: achievements || [],
      unlocks: unlocks || [],
    });
  } catch (error) {
    console.error('Error in GET /api/achievements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { achievements, unlocks } = body;

    if (!achievements || !unlocks) {
      return NextResponse.json({ error: 'Missing achievements or unlocks data' }, { status: 400 });
    }

    if (Array.isArray(achievements) && achievements.length > 0) {
      const achievementsToInsert = achievements.map((ach: AchievementInput) => ({
        id: `${session.user.id}_${ach.achievement_id}`,
        user_id: session.user.id,
        achievement_id: ach.achievement_id || ach.id,
        achievement_type: ach.achievement_type || ach.type,
        name: ach.name,
        description: ach.description,
        unlocked: ach.unlocked || false,
        unlocked_at: ach.unlocked_at ? new Date(ach.unlocked_at).toISOString() : null,
        progress: ach.progress || 0,
        target: ach.target || 1,
      }));

      const { error: achievementsError } = await supabase
        .from('achievements')
        .upsert(achievementsToInsert, { onConflict: 'id' });

      if (achievementsError) {
        console.error('Error upserting achievements:', achievementsError);
        return NextResponse.json({ error: 'Failed to save achievements' }, { status: 500 });
      }
    }

    if (Array.isArray(unlocks) && unlocks.length > 0) {
      const unlocksToInsert = unlocks.map((unlock: UnlockInput) => ({
        id: `${session.user.id}_${unlock.unlock_id}`,
        user_id: session.user.id,
        unlock_id: unlock.unlock_id || unlock.id,
        unlock_type: unlock.unlock_type || unlock.type,
        name: unlock.name,
        description: unlock.description,
        unlocked: unlock.unlocked || false,
        unlocked_at: unlock.unlocked_at ? new Date(unlock.unlocked_at).toISOString() : null,
      }));

      const { error: unlocksError } = await supabase
        .from('unlocks')
        .upsert(unlocksToInsert, { onConflict: 'id' });

      if (unlocksError) {
        console.error('Error upserting unlocks:', unlocksError);
        return NextResponse.json({ error: 'Failed to save unlocks' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/achievements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

