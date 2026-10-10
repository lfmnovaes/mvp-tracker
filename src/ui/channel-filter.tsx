export function ChannelFilter({ channels, value, onChange }: { channels: readonly number[]; value: number | ""; onChange: (value: number | "") => void }) {
  return <select aria-label="Filter channel" value={String(value)} onChange={e => onChange(e.currentTarget.value ? Number(e.currentTarget.value) : "")}><option value="">All channels</option>{channels.map(c => <option key={c} value={String(c)}>Ch {c}{c > 3 ? " · PvP" : ""}</option>)}</select>;
}
