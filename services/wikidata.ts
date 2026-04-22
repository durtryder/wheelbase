/**
 * Wikidata lookup — free, CORS-friendly structured data. Coverage is broader
 * in time (classics, prewar) than NHTSA but spottier and less consistent in
 * detail. We extract the narrow set of fields we can reliably pull from the
 * entity's claims; richer spec data is usually absent.
 */

import type { OemSpecs } from '@/types/vehicle';

const SEARCH_URL = 'https://www.wikidata.org/w/api.php';
const ENTITY_URL = 'https://www.wikidata.org/wiki/Special:EntityData';

type SearchHit = {
  id: string;
  label: string;
  description?: string;
};

export async function lookupWikidata(
  year: number | undefined,
  make: string,
  model: string,
): Promise<Partial<OemSpecs> | null> {
  const query = `${make.trim()} ${model.trim()}`.trim();
  if (!query) return null;

  const hit = await searchForVehicle(query);
  if (!hit) return null;

  const entity = await fetchEntity(hit.id);
  if (!entity) return null;

  const manufacturer = await resolveLabel(getClaimId(entity, 'P176'));
  const bodyStyle = await resolveLabel(getClaimId(entity, 'P2161'));

  return {
    source: 'wikidata',
    make,
    model,
    modelYear: year,
    manufacturer: manufacturer ?? undefined,
    bodyClass: bodyStyle ?? undefined,
    raw: {
      wikidataId: hit.id,
      wikidataLabel: hit.label,
      wikidataDescription: hit.description,
      wikidataUrl: `https://www.wikidata.org/wiki/${hit.id}`,
    },
  };
}

async function searchForVehicle(query: string): Promise<SearchHit | null> {
  const url = `${SEARCH_URL}?action=wbsearchentities&search=${encodeURIComponent(
    query,
  )}&language=en&format=json&origin=*&type=item&limit=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikidata search failed: ${res.status}`);
  const data = (await res.json()) as { search?: SearchHit[] };
  if (!data.search?.length) return null;

  // Prefer hits whose description looks vehicle-flavored.
  const preferred = data.search.find((h) =>
    /\b(car|automobile|vehicle|model|sedan|coupe|convertible|sports car|roadster)\b/i.test(
      h.description ?? '',
    ),
  );
  return preferred ?? data.search[0];
}

async function fetchEntity(id: string): Promise<any | null> {
  const url = `${ENTITY_URL}/${id}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.entities?.[id] ?? null;
}

function getClaimId(entity: any, property: string): string | null {
  const claims = entity?.claims?.[property];
  if (!Array.isArray(claims) || claims.length === 0) return null;
  const first = claims[0];
  const value = first?.mainsnak?.datavalue?.value;
  if (value && typeof value === 'object' && 'id' in value) return value.id as string;
  return null;
}

async function resolveLabel(id: string | null): Promise<string | null> {
  if (!id) return null;
  const url = `${ENTITY_URL}/${id}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const entity = data.entities?.[id];
  return entity?.labels?.en?.value ?? null;
}
