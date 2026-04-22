/**
 * CarQuery API — free, community-run spec lookup. Coverage is broader than
 * NHTSA in time (claims back to the 1940s) but data quality is uneven, and
 * the service has had reliability issues historically.
 *
 * Docs: https://www.carqueryapi.com/documentation/api/
 *
 * Known caveat: CarQuery was originally designed for JSONP and some browsers
 * may hit CORS issues on direct fetch. If that happens in production we can
 * proxy through a Cloud Function.
 */

import type { OemSpecs } from '@/types/vehicle';

const BASE_URL = 'https://www.carqueryapi.com/api/0.3/';

type CarQueryTrim = {
  model_id: string;
  model_make_id: string;
  model_make_display: string;
  model_name: string;
  model_trim: string;
  model_year: string;
  model_body: string;
  model_engine_cc: string;
  model_engine_cyl: string;
  model_engine_type: string;
  model_engine_fuel: string;
  model_engine_position: string;
  model_engine_valves_per_cyl: string;
  model_engine_power_ps: string;
  model_engine_power_hp: string;
  model_engine_torque_nm: string;
  model_engine_torque_lbft: string;
  model_transmission_type: string;
  model_drive: string;
  model_doors: string;
  model_seats: string;
};

export async function lookupCarQuery(
  year: number,
  make: string,
  model: string,
): Promise<Partial<OemSpecs> | null> {
  const params = new URLSearchParams({
    cmd: 'getTrims',
    year: String(year),
    make: make.trim().toLowerCase(),
    model: model.trim().toLowerCase(),
  });
  const url = `${BASE_URL}?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`CarQuery failed: ${res.status}`);

  // CarQuery sometimes wraps the payload in a JSONP callback — strip it if present.
  const text = await res.text();
  const payload = text.startsWith('?')
    ? text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))
    : text;

  let data: { Trims?: CarQueryTrim[] };
  try {
    data = JSON.parse(payload);
  } catch {
    throw new Error('CarQuery returned a payload that could not be parsed.');
  }

  const trims = data.Trims ?? [];
  if (!trims.length) return null;

  // Prefer a trim whose name/body is non-empty; otherwise fall back to the first.
  const t = trims.find((tr) => tr.model_body || tr.model_trim) ?? trims[0];

  const cc = num(t.model_engine_cc);
  const hp = num(t.model_engine_power_hp);
  const torqueLbFt = num(t.model_engine_torque_lbft);

  return {
    source: 'carquery',
    make: t.model_make_display || make,
    model: t.model_name || model,
    modelYear: num(t.model_year) ?? year,
    trim: t.model_trim || undefined,
    bodyClass: t.model_body || undefined,
    doors: num(t.model_doors),
    engineCylinders: num(t.model_engine_cyl),
    displacementCc: cc,
    displacementCi: cc ? Math.round(cc * 0.061024 * 10) / 10 : undefined,
    fuelType: t.model_engine_fuel || undefined,
    driveType: t.model_drive || undefined,
    transmissionStyle: t.model_transmission_type || undefined,
    raw: {
      ...t,
      derived: { hp, torqueLbFt },
    },
  };
}

function num(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}
