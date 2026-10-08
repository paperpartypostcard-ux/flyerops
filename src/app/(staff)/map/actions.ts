'use server';
import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

type R = { error?: string };
const done = (error?: { message: string } | null): R => {
  revalidatePath('/map');
  return error ? { error: error.message } : {};
};

export async function assignSuburb(suburbId: number, walkerId: string, companyId: string, plannedStart: string | null): Promise<R> {
  const sb = await supabaseServer();
  const { error } = await sb.from('assignments').insert({
    suburb_id: suburbId, walker_id: walkerId, company_id: companyId, planned_start: plannedStart || null,
  });
  return done(error);
}

/** Hand over an open assignment to another walker (walked streets stay on the map). */
export async function reassign(assignmentId: string, walkerId: string): Promise<R> {
  const sb = await supabaseServer();
  const { error } = await sb.from('assignments').update({ walker_id: walkerId }).eq('id', assignmentId);
  return done(error);
}

export async function setAssignmentStatus(assignmentId: string, status: 'completed' | 'cancelled'): Promise<R> {
  const sb = await supabaseServer();
  const { error } = await sb.from('assignments').update({
    status, completed_on: status === 'completed' ? new Date().toISOString().slice(0, 10) : null,
  }).eq('id', assignmentId);
  return done(error);
}

export async function updateSuburb(id: number, patch: {
  cycle_months?: number; dwellings_override?: number | null; excluded?: boolean; notes?: string | null;
}): Promise<R> {
  const sb = await supabaseServer();
  const { error } = await sb.from('suburbs').update(patch).eq('id', id);
  return done(error);
}
