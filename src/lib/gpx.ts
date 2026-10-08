import { gpx, kml } from '@tmcw/togeojson';

/** Parse a GPX/KML file (exported from Map My Walk) into one MultiLineString. */
export async function fileToTrack(file: File): Promise<GeoJSON.MultiLineString> {
  const doc = new DOMParser().parseFromString(await file.text(), 'text/xml');
  const fc = file.name.toLowerCase().endsWith('.kml') ? kml(doc) : gpx(doc);
  const lines: number[][][] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (g?.type === 'LineString') lines.push(g.coordinates.map((c) => [c[0], c[1]]));
    if (g?.type === 'MultiLineString') g.coordinates.forEach((l) => lines.push(l.map((c) => [c[0], c[1]])));
  }
  if (!lines.length) throw new Error('No track found in file');
  return { type: 'MultiLineString', coordinates: lines };
}
