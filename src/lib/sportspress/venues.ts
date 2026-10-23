import type { Venue } from "./types";

// The API only exposes the venue name. Address and coordinates live in the HTML
// of each venue page on futbolempresas.es; we copied them here (October 2026).
// A new venue is shown with just its name.
const VENUES: Venue[] = [
  { id: 414, name: "AD La Fundación", address: "Calle de Braojos, 28035 Madrid", lat: 40.48165, lng: -3.73793 },
  { id: 330, name: "Arroyo Media Legua (Trece Rosas)", address: "Av. de las Trece Rosas, 800, 28017 Madrid", lat: 40.42232, lng: -3.64808 },
  { id: 714, name: "Centro Deportivo Palomeras", address: "Palomeras Sureste, Puente de Vallecas, Madrid", lat: 40.38408, lng: -3.6336 },
  { id: 662, name: "Club Deportivo Tejar de Somontes", address: "Carretera Madrid-El Pardo, km 3,400, 28048 Madrid", lat: 40.49207, lng: -3.75614 },
  { id: 673, name: "Colegio Alameda de Osuna", address: "Calle de La Rioja, 1-5, 28042 Madrid", lat: 40.4544, lng: -3.59285 },
  { id: 73, name: "Colegio El Recuerdo", address: "Plaza Duque de Pastrana, 5, 28036 Madrid", lat: 40.46912, lng: -3.67798 },
  { id: 111, name: "DAV Santa Ana", address: "Calle Hospitalet de Llobregat, 11, 28034 Madrid", lat: 40.49452, lng: -3.69467 },
  { id: 688, name: "E.D. Almudena", address: "Calle de Nicolás Salmerón, 28017 Madrid", lat: 40.41946, lng: -3.63016 },
  { id: 331, name: "EDM San Blas", address: "Av. de Guadalajara, 20, 28037 Madrid", lat: 40.42049, lng: -3.6172 },
  { id: 701, name: "Isla de Tabarca (IDM Arturo Ruiz)", address: "Calle Isla de Tabarca, 28035 Madrid", lat: 40.47684, lng: -3.72177 },
  { id: 110, name: "La Elipa", address: "Calle Alcalde Garrido Juaristi, 17, 28030 Madrid", lat: 40.41433, lng: -3.65598 },
  { id: 108, name: "La Masó", address: "Calle de la Masó, 80, 28034 Madrid", lat: 40.48408, lng: -3.71476 },
  { id: 109, name: "Luis Aragonés", address: "Calle de El Provencio, 20, 28043 Madrid", lat: 40.46557, lng: -3.62826 },
  { id: 653, name: "Montecarmelo", address: "Calle del Monasterio de El Paular, 138, 28034 Madrid", lat: 40.5, lng: -3.70097 },
  { id: 415, name: "Oña Sanchinarro", address: "Calle de Vicente Blasco Ibáñez, 18, 28050 Madrid", lat: 40.49017, lng: -3.65902 },
  { id: 112, name: "Ramón Gómez de la Serna", address: null, lat: null, lng: null },
  { id: 644, name: "RUPE Rodríguez Sahagún", address: "Calle Miramelindos, 5, 28029 Madrid", lat: 40.46918, lng: -3.70888 },
  { id: 665, name: "San José del Parque", address: "Ronda Abubilla, 3, 28043 Madrid", lat: 40.45209, lng: -3.63713 },
  { id: 107, name: "Trivema Naval", address: "Calle Velacho Alto, 3, 28033 Madrid", lat: 40.47231, lng: -3.65848 },
  { id: 652, name: "Valdeyeros", address: "Calle de Rosalía de Castro, 76, 28035 Madrid", lat: 40.48388, lng: -3.73071 },
  { id: 687, name: "Vicente del Bosque", address: "Av. de Monforte de Lemos, 13, 28029 Madrid", lat: 40.47895, lng: -3.6935 },
];

const BY_ID = new Map(VENUES.map((venue) => [venue.id, venue]));

/** Every known venue, sorted by name. */
export function getVenues(): Venue[] {
  return [...VENUES].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function getVenue(id: number | null): Venue | null {
  return id === null ? null : (BY_ID.get(id) ?? null);
}

export function mapsUrl(venue: Venue): string {
  const query = venue.address ? `${venue.name}, ${venue.address}` : `${venue.name}, Madrid`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
