'use client';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
type GeoJSONSource = maplibregl.GeoJSONSource; type MLMap = maplibregl.Map;

// Worker is served from /public (copied by scripts/copy-maplibre-worker.mjs before build)
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');

import { STATUS_COLORS, STATUS_LABELS } from '@/lib/status';
import { useI18n } from '@/lib/i18n/client';
export { STATUS_COLORS, STATUS_LABELS };

type FC = GeoJSON.FeatureCollection;
const empty: FC = { type: 'FeatureCollection', features: [] };

export default function SuburbMap({
  suburbs, coverage, selectedId, onSelect, fit = false, focus, className = '',
}: {
  suburbs: FC; coverage?: FC | null; selectedId?: number | null;
  onSelect?: (id: number | null) => void; fit?: boolean; className?: string;
  /** Features to zoom to (e.g. search result or a suburb opened by link). */
  focus?: FC | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current!,
      style: 'https://tiles.openfreemap.org/styles/positron', // free, commercial use OK, no key
      center: [144.96, -37.81], zoom: 9.5,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.GeolocateControl({}), 'top-right');
    m.on('error', (e) => console.error('map error', e?.error ?? e));
    m.once('style.load', () => {
      m.addSource('suburbs', { type: 'geojson', data: empty, promoteId: 'id' });
      m.addSource('coverage', { type: 'geojson', data: empty });
      const color: maplibregl.ExpressionSpecification =
        ['match', ['get', 'status'], ...Object.entries(STATUS_COLORS).flat(), '#22c55e'] as never;
      m.addLayer({ id: 'sub-fill', type: 'fill', source: 'suburbs',
        paint: { 'fill-color': color, 'fill-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.55, 0.3] } });
      m.addLayer({ id: 'sub-line', type: 'line', source: 'suburbs',
        paint: { 'line-color': ['case', ['boolean', ['feature-state', 'sel'], false], '#0f172a', '#475569'],
                 'line-width': ['case', ['boolean', ['feature-state', 'sel'], false], 2.5, 0.6] } });
      m.addLayer({ id: 'sub-label', type: 'symbol', source: 'suburbs', minzoom: 11,
        layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'] },
        paint: { 'text-color': '#0f172a', 'text-halo-color': '#fff', 'text-halo-width': 1.2 } });
      m.addLayer({ id: 'cov', type: 'line', source: 'coverage',
        paint: { 'line-color': '#dc2626', 'line-width': 4, 'line-opacity': 0.8 } });
      // Walk date along each walked route (spec: walked streets with date)
      m.addLayer({ id: 'cov-date', type: 'symbol', source: 'coverage', minzoom: 13,
        layout: { 'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'walked_on'], ''], 'text-size': 11,
                  'text-font': ['Noto Sans Regular'], 'symbol-spacing': 250 },
        paint: { 'text-color': '#991b1b', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } });
      m.on('click', 'sub-fill', (e) => onSelectRef.current?.(Number(e.features?.[0]?.id)));
      m.on('mouseenter', 'sub-fill', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'sub-fill', () => (m.getCanvas().style.cursor = ''));
      setReady(true);
    });
    map.current = m;
    return () => m.remove();
  }, []);

  // data updates
  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      (m.getSource('suburbs') as GeoJSONSource).setData(suburbs);
      if (fit && suburbs.features.length) {
        const b = new maplibregl.LngLatBounds();
        suburbs.features.forEach((f) => walk(f.geometry, (c) => b.extend(c as [number, number])));
        m.fitBounds(b, { padding: 40, maxZoom: 15 });
      }
    };
    if (ready) apply();
  }, [suburbs, fit, ready]);

  useEffect(() => {
    const m = map.current; if (!m || !ready || !focus?.features.length) return;
    const b = new maplibregl.LngLatBounds();
    focus.features.forEach((f) => walk(f.geometry, (c) => b.extend(c as [number, number])));
    m.fitBounds(b, { padding: 60, maxZoom: 14, duration: 600 });
  }, [focus, ready]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => (m.getSource('coverage') as GeoJSONSource).setData(coverage ?? empty);
    if (ready) apply();
  }, [coverage, ready]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const apply = () => {
      m.removeFeatureState({ source: 'suburbs' });
      if (selectedId != null) m.setFeatureState({ source: 'suburbs', id: selectedId }, { sel: true });
    };
    if (ready) apply();
  }, [selectedId, ready]);

  return <div ref={el} className={`h-full w-full ${className}`} />;
}

function walk(g: GeoJSON.Geometry, fn: (c: number[]) => void) {
  const rec = (a: unknown): void => {
    if (Array.isArray(a) && typeof a[0] === 'number') fn(a as number[]);
    else if (Array.isArray(a)) a.forEach(rec);
  };
  if ('coordinates' in g) rec(g.coordinates);
}

export function Legend() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {Object.keys(STATUS_LABELS).map((k) => (
        <span key={k} className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm" style={{ background: STATUS_COLORS[k] }} />{t(`status.${k}` as 'status.available')}
        </span>
      ))}
      <span className="flex items-center gap-1"><i className="inline-block h-1 w-4 bg-red-600" />{t('status.walked')}</span>
    </div>
  );
}
