/**
 * Unified OEM spec lookup. Cascades through sources in priority order:
 *
 *   1. NHTSA vPIC  (authoritative for 17-char VINs, 1981+)
 *   2. Wikidata    (structured data; broad time coverage, thin per-item)
 *   3. CarQuery    (community spec API; uneven quality, historically flaky)
 *
 * Each source is best-effort; if one fails or returns nothing useful we fall
 * through to the next. The final result carries the `source` that won so the
 * UI can tell the user where the data came from.
 */

import { lookupCarQuery } from './carquery';
import { decodeVin } from './vpic';
import { lookupWikidata } from './wikidata';

import type { OemSpecs } from '@/types/vehicle';

export type LookupInput = {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
};

export type LookupResult =
  | { ok: true; source: OemSpecs['source']; specs: OemSpecs; tried: string[] }
  | { ok: false; tried: string[]; errors: string[] };

const USEFUL_VPIC_FIELDS = [
  'Make',
  'Model',
  'Model Year',
  'Body Class',
  'Engine Number of Cylinders',
  'Displacement (CC)',
  'Manufacturer Name',
];

export async function fetchOemSpecs(input: LookupInput): Promise<LookupResult> {
  const tried: string[] = [];
  const errors: string[] = [];

  const vin = input.vin?.trim();
  const hasIdentity =
    !!input.year && !!input.make?.trim() && !!input.model?.trim();

  // 1) NHTSA vPIC
  if (vin && vin.length === 17) {
    tried.push('NHTSA');
    try {
      const decoded = await decodeVin(vin);
      if (decoded.error) {
        errors.push(`NHTSA: ${decoded.error.text || decoded.error.code}`);
      } else if (hasUsefulVpicFields(decoded.fields)) {
        return {
          ok: true,
          source: 'vpic',
          specs: mapVpicToSpecs(decoded.fields),
          tried,
        };
      } else {
        errors.push('NHTSA: no useful fields returned');
      }
    } catch (e) {
      errors.push(`NHTSA: ${errMsg(e)}`);
    }
  }

  // 2) Wikidata
  if (hasIdentity) {
    tried.push('Wikidata');
    try {
      const specs = await lookupWikidata(input.year, input.make!, input.model!);
      if (specs) {
        return {
          ok: true,
          source: 'wikidata',
          specs: ensureSource(specs, 'wikidata'),
          tried,
        };
      }
      errors.push('Wikidata: no match');
    } catch (e) {
      errors.push(`Wikidata: ${errMsg(e)}`);
    }
  }

  // 3) CarQuery
  if (hasIdentity) {
    tried.push('CarQuery');
    try {
      const specs = await lookupCarQuery(
        input.year!,
        input.make!,
        input.model!,
      );
      if (specs) {
        return {
          ok: true,
          source: 'carquery',
          specs: ensureSource(specs, 'carquery'),
          tried,
        };
      }
      errors.push('CarQuery: no match');
    } catch (e) {
      errors.push(`CarQuery: ${errMsg(e)}`);
    }
  }

  return { ok: false, tried, errors };
}

function hasUsefulVpicFields(fields: Record<string, string>) {
  return USEFUL_VPIC_FIELDS.some((k) => !!fields[k]);
}

function mapVpicToSpecs(fields: Record<string, string>): OemSpecs {
  return {
    source: 'vpic',
    make: fields['Make'],
    model: fields['Model'],
    modelYear: parseIntSafe(fields['Model Year']),
    trim: fields['Trim'],
    series: fields['Series'],
    bodyClass: fields['Body Class'],
    doors: parseIntSafe(fields['Doors']),
    engineCylinders: parseIntSafe(fields['Engine Number of Cylinders']),
    displacementCc: parseFloatSafe(fields['Displacement (CC)']),
    displacementCi: parseFloatSafe(fields['Displacement (CI)']),
    fuelType: fields['Fuel Type - Primary'],
    driveType: fields['Drive Type'],
    transmissionStyle: fields['Transmission Style'],
    transmissionSpeeds: parseIntSafe(fields['Transmission Speeds']),
    plantCity: fields['Plant City'],
    plantState: fields['Plant State'],
    plantCountry: fields['Plant Country'],
    manufacturer: fields['Manufacturer Name'],
    vehicleType: fields['Vehicle Type'],
    raw: fields,
  };
}

function ensureSource(
  specs: Partial<OemSpecs>,
  source: OemSpecs['source'],
): OemSpecs {
  return { ...specs, source } as OemSpecs;
}

function parseIntSafe(s: string | undefined) {
  if (!s) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseFloatSafe(s: string | undefined) {
  if (!s) return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : 'unreachable';
}
