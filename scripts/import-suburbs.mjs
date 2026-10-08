// Imports Greater Melbourne suburbs (ABS Suburbs and Localities 2021) + private dwellings (Census 2021)
// into the `suburbs` table. Safe to re-run: upserts by SAL code, keeps manual fields (override, cycle, notes).
//
// Usage:   DATABASE_URL=postgres://... node scripts/import-suburbs.mjs
// Files are downloaded from abs.gov.au into ./data (or put them there yourself if the download fails):
//   SAL_2021_AUST_GDA2020_SHP.zip, GCCSA_2021_AUST_SHP_GDA2020.zip, 2021_GCP_SAL_for_VIC_short-header.zip
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import * as shapefile from 'shapefile';
import { parse } from 'csv-parse/sync';
import pg from 'pg';

const DATA = path.resolve('data');
const ASGS = 'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files';
const FILES = {
  sal: ['SAL_2021_AUST_GDA2020_SHP.zip', `${ASGS}/SAL_2021_AUST_GDA2020_SHP.zip`],
  gcc: ['GCCSA_2021_AUST_SHP_GDA2020.zip', `${ASGS}/GCCSA_2021_AUST_SHP_GDA2020.zip`],
  gcp: ['2021_GCP_SAL_for_VIC_short-header.zip',
        'https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_GCP_SAL_for_VIC_short-header.zip'],
};

async function ensure([name, url]) {
  const file = path.join(DATA, name);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(DATA, { recursive: true });
  console.log(`Downloading ${name} …`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Download failed (${res.status}). Download manually:\n  ${url}\n  → save as data/${name}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

async function* readShp(zipFile) {
  const zip = new AdmZip(zipFile);
  const pick = (ext) => zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(ext));
  const buf = (e) => { const b = e.getData(); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
  const src = await shapefile.open(buf(pick('.shp')), buf(pick('.dbf')), { encoding: 'utf-8' });
  for (let r = await src.read(); !r.done; r = await src.read()) yield r.value;
}

function readDwellings(zipFile) {
  const zip = new AdmZip(zipFile);
  // Look through the DataPack tables for the "total private dwellings" column.
  const candidates = [/^Total_PDs_Dwellings$/i, /^Total_Dwelings$/i, /^Tot_P_?Dwell/i, /Total.*Dwellings$/i];
  for (const re of candidates) {
    for (const e of zip.getEntries()) {
      if (!/\.csv$/i.test(e.entryName) || !/_SAL\.csv$/i.test(e.entryName)) continue;
      const text = e.getData().toString('utf8');
      const header = text.slice(0, text.indexOf('\n')).split(',').map((h) => h.trim());
      const col = header.find((h) => re.test(h));
      if (!col) continue;
      const rows = parse(text, { columns: true, skip_empty_lines: true });
      console.log(`Dwellings: using ${path.basename(e.entryName)} → column "${col}"`);
      return new Map(rows.map((r) => [r.SAL_CODE_2021.replace(/^SAL/, ''), Number(r[col])]));
    }
  }
  console.warn('⚠ Dwellings column not found in the DataPack — suburbs imported without dwellings.');
  return new Map();
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } });

const [salZip, gccZip, gcpZip] = [await ensure(FILES.sal), await ensure(FILES.gcc), await ensure(FILES.gcp)];
await db.connect();
await db.query('begin');

// Greater Melbourne boundary
await db.query('create temp table gmel (geom geometry) on commit drop');
for await (const f of readShp(gccZip)) {
  if (f.properties.GCC_CODE21 === '2GMEL' && f.geometry) {
    await db.query('insert into gmel values (st_setsrid(st_geomfromgeojson($1),4326))', [JSON.stringify(f.geometry)]);
  }
}

const dwellings = readDwellings(gcpZip);
let n = 0;
for await (const f of readShp(salZip)) {
  const p = f.properties;
  if (p.STE_CODE21 !== '2' || !f.geometry) continue;
  const res = await db.query(
    `insert into suburbs (sal_code, name, geom, dwellings_abs)
     select $1, $2, g, $4
     from (select st_multi(st_makevalid(st_setsrid(st_geomfromgeojson($3),4326))) g) x, gmel
     where st_within(st_pointonsurface(g), gmel.geom)
     on conflict (sal_code) do update set name = excluded.name, geom = excluded.geom, dwellings_abs = excluded.dwellings_abs`,
    [p.SAL_CODE21, p.SAL_NAME21.replace(/\s*\(Vic\.\)$/, ''), JSON.stringify(f.geometry), dwellings.get(p.SAL_CODE21) ?? null],
  );
  n += res.rowCount;
}
await db.query(`update suburbs set geom_simple = st_multi(st_simplifypreservetopology(geom, 0.0002))`);
await db.query('commit');
const { rows } = await db.query('select count(*)::int n, sum(dwellings_abs)::int d from suburbs');
console.log(`✓ Imported/updated ${n} suburbs. In table: ${rows[0].n} suburbs, ${rows[0].d ?? 0} dwellings.`);
await db.end();
