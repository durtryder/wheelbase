/**
 * NHTSA vPIC API — free, public VIN decoder and make/model lookup.
 * https://vpic.nhtsa.dot.gov/api/
 *
 * Used as the initial source of OEM specs. Richer paid sources (CarAPI,
 * Edmunds, etc.) can be layered on later behind the same service interface.
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

export async function decodeVin(vin: string) {
  const url = `${BASE_URL}/decodevin/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`vPIC decode failed: ${res.status}`);
  const data: VpicResponse = await res.json();
  return flatten(data.Results);
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

function flatten(results: VpicResult[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of results) {
    if (r.Value && r.Value !== 'Not Applicable') out[r.Variable] = r.Value;
  }
  return out;
}
