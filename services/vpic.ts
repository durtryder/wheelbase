/**
 * NHTSA vPIC API — free, public VIN decoder and make/model lookup.
 * https://vpic.nhtsa.dot.gov/api/
 *
 * Used as the initial source of OEM specs. Only supports standardized
 * 17-character VINs from 1981 onward; pre-1981 vehicles (vintage Porsches,
 * classic Fords, etc.) are not in the database.
 */

const BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

type VpicResult = {
  Variable: string;
  VariableId: number;
  Value: string | null;
  ValueId: string | null;
};

type VpicResponse = {
  Count: number;
  Message: string;
  Results: VpicResult[];
};

export type DecodedVin = {
  fields: Record<string, string>;
  error: { code: string; text: string } | null;
};

export async function decodeVin(vin: string): Promise<DecodedVin> {
  const url = `${BASE_URL}/decodevin/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`vPIC decode failed: ${res.status}`);
  const data: VpicResponse = await res.json();

  const errorCodeRaw = findValue(data.Results, 'Error Code');
  const errorTextRaw = findValue(data.Results, 'Error Text');
  // Error Code is a comma-separated list; "0" means success.
  const codes = (errorCodeRaw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const hasError = codes.some((c) => c !== '0');

  return {
    fields: flatten(data.Results),
    error: hasError ? { code: errorCodeRaw ?? '', text: errorTextRaw ?? '' } : null,
  };
}

export async function getMakes() {
  const url = `${BASE_URL}/GetAllMakes?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`vPIC makes failed: ${res.status}`);
  const data = await res.json();
  return data.Results as { Make_ID: number; Make_Name: string }[];
}

export async function getModelsForMakeYear(make: string, year: number) {
  const url = `${BASE_URL}/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`vPIC models failed: ${res.status}`);
  const data = await res.json();
  return data.Results as { Make_Name: string; Model_Name: string }[];
}

function findValue(results: VpicResult[], variable: string): string | null {
  return results.find((r) => r.Variable === variable)?.Value ?? null;
}

function flatten(results: VpicResult[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of results) {
    if (r.Value && r.Value !== 'Not Applicable') out[r.Variable] = r.Value;
  }
  return out;
}
