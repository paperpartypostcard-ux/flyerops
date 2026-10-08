import { supabaseServer } from '@/lib/supabase/server';
import MapScreen from './MapScreen';

export default async function MapPage() {
  const sb = await supabaseServer();
  const [{ data: companies }, { data: walkers }] = await Promise.all([
    sb.from('companies').select('id, name, color').order('name'),
    sb.from('profiles').select('id, full_name, home_suburb_id').eq('role', 'walker').eq('status', 'active').order('full_name'),
  ]);
  return <MapScreen companies={companies ?? []} walkers={walkers ?? []} />;
}
