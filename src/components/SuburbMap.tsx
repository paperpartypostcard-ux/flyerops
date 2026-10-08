'use client';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
type GeoJSONSource = maplibregl.GeoJSONSource; type MLMap = maplibregl.Map;

export const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  planned: '#f59e0b',
  in_progress: '#3b82f6',
  covered: '#94a3b8',
  excluded: '#334155',
};
export const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  planned: 'Planned',
  in_progress: 'In progress',
  covered: 'Covered (cycle)',
  excluded: 'Excluded',
};

const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster', tileSize: 256, maxzoom: 19,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.6, 'raster-opacity': 0.9 } },
  ],
};

type FC = GeoJSON.FeatureCollection;
const empty: FC = { type: 'FeatureCollection', features: [] };

export default function SuburbMap({
  suburbs, coverage, selectedId, onSelect, fit = false, className = '',
}: {
  suburbs: FC; coverage?: FC | null; selectedId?: number | null;
  onSelect?: (id: number | null) => void; fit?: boolean; className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current!,
      style: BASE_STYLE,
      center: [144.96, -37.81], zoom: 9.5,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.GeolocateControl({}), 'top-right');
    m.on('load', () => {
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
        layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Open Sans Semibold'] },
        paint: { 'text-color': '#0f172a', 'text-halo-color': '#fff', 'text-halo-width': 1.2 } });
      m.addLayer({ id: 'cov', type: 'line', source: 'coverage',
        paint: { 'line-color': '#dc2626', 'line-width': 4, 'line-opacity': 0.8 } });
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
  return (
    <div className="flex flex-wrap gap-3 text-xs">
      {Object.entries(STATUS_LABELS).map(([k, v]) => (
        <span key={k} className="flex items-center gap-1">
          <i className="inline-block h-3 w-3 rounded-sm" style={{ background: STATUS_COLORS[k] }} />{v}
        </span>
      ))}
      <span className="flex items-center gap-1"><i className="inline-block h-1 w-4 bg-red-600" />Walked</span>
    </div>
  );
}
