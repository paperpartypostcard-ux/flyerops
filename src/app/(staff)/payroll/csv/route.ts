import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { resolvePeriod } from '@/lib/periods';

const cell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const period = resolvePeriod(sp);
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('payroll', { p_from: period.from, p_to: period.to });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });

  const head = ['Walker', 'Email', 'Status', 'Walks', 'Suburbs', 'Flyers', 'Hours', 'Earnings AUD', 'Period from', 'Period to'];
  const rows = (data ?? []).map((r: Record<string, unknown>) =>
    [r.full_name, r.email, r.status, r.walks, r.suburbs, r.flyers, r.hours, r.earnings, period.from, period.to].map(cell).join(','));
  const csv = '﻿' + [head.join(','), ...rows].join('\r\n');
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="payroll_${period.from}_${period.to}.csv"`,
    },
  });
}
