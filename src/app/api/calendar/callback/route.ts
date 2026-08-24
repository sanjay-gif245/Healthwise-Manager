import { NextResponse } from 'next/server';
import { consumeOAuthState } from '@/db/repositories/calendar';
import { handleOAuthCallback } from '@/lib/googleCalendar';

// Google redirects the browser here after consent; we exchange the code,
// store tokens, then bounce the user back to their dashboard with a status
// flag the UI can toast. Any failure here degrades gracefully — the user
// simply isn't connected, appointments still work without calendar sync.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam || !code || !state) {
    return NextResponse.redirect(`${origin}/dashboard?calendar=error`);
  }
  const userId = consumeOAuthState(state);
  if (!userId) {
    return NextResponse.redirect(`${origin}/dashboard?calendar=error`);
  }
  const ok = await handleOAuthCallback(userId, code);
  return NextResponse.redirect(`${origin}/dashboard?calendar=${ok ? 'connected' : 'error'}`);
}
