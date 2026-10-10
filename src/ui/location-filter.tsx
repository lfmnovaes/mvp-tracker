import { MAP_LEVELS } from "../domain/map-levels";

export function LocationFilter({ locations, value, onChange }: { locations: string[]; value: string; onChange: (value: string) => void }) {
  return <select class="location-filter" aria-label="Filter location" value={value} onChange={e => onChange(e.currentTarget.value)}>
    <option value="">All locations</option>
    {locations.map(map => <option key={map} value={map}>{map} ({MAP_LEVELS[map]})</option>)}
  </select>;
}
