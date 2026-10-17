import { Button } from '@/components/ui/button';
import { tracksVolume, volumeLabel, units, type Food, type VolumePercent } from '../../domain/food';

const levels = [25, 50, 75, 100] as const;

/** A percentage describes exactly one open container; quantity counts the containers. */
export function VolumeControls({ item, blocked, onChange }: {
  item: Food; blocked: boolean; onChange: (item: Food, percent: VolumePercent | null) => void;
}) {
  if (item.status !== 'active') return null;
  const volume = tracksVolume(item);
  return <div className={`volume-controls flex flex-col gap-2 rounded-lg bg-[#F2F5F9] p-2.5 ${volume ? 'volume-controls-volume' : 'volume-controls-count'}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="font-semibold text-[#354F70]">{volume ? '開封中の容器の残量' : '数量の管理方法'}</span>
      <Button variant="plain" type="button" className="h-9 px-2 text-xs text-[#536780] underline"
        disabled={blocked} onClick={() => onChange(item, volume ? null : 100)}>
        {volume ? '個数管理にする' : '中身の残量も管理する'}
      </Button>
    </div>
    {volume && <>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={item.name.trim() + 'の残量'}>
        {levels.map(percent => <button key={percent} type="button" disabled={blocked}
          aria-pressed={(item.volumePercent ?? 100) === percent}
          aria-label={item.name.trim() + 'の残量を' + volumeLabel(percent) + 'にする'}
          onClick={() => onChange(item, percent)}
          className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-[#CCD6E3] bg-white px-1 py-1.5 text-xs text-[#354F70] aria-pressed:border-[#354F70] aria-pressed:bg-[#E2EAF4] aria-pressed:font-bold disabled:opacity-50">
          <span className="block h-1.5 w-full rounded-full bg-[#DFE6EF]"><span className="block h-full rounded-full bg-[#344B68]" style={{width: percent + '%'}} /></span>
          {volumeLabel(percent)}
        </button>)}
      </div>
      {item.quantity > 1 && <p className="m-0 text-[11px] text-muted">残り{item.quantity}{units[item.unit]}のうち1{units[item.unit]}の残量です。ほかは満量として計算します。</p>}
    </>}
  </div>;
}
