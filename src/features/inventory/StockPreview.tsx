import { tracksVolume, units, volumeLabel } from '../../domain/food';
import type { FoodGroup } from '../../domain/stock';

/** Compact preview of currently active lots; completion does not affect denominator within a lot. */
export function StockPreview({ group }: { group: FoodGroup }) {
  const active = group.items.filter(item => item.status === 'active');
  if (!active.length) return null;
  const baseline = active.reduce((sum, item) => sum + item.initialQuantity, 0);
  const remaining = active.reduce((sum, item) => sum + item.quantity -
    (tracksVolume(item) ? 1 - (item.volumePercent ?? 100) / 100 : 0), 0);
  const count = Math.min(12, baseline);
  const ratio = remaining / baseline;
  const partial = active.filter(item => tracksVolume(item) && (item.volumePercent ?? 100) < 100);
  const description = partial.length === 1
    ? '開封中 ' + volumeLabel(partial[0].volumePercent ?? 100)
    : partial.length > 1 ? '開封中 ' + partial.length + '件' : active.some(tracksVolume) ? '満量' : group.activeQuantity + '/' + baseline + units[group.unit];
  return <div className="stock-preview col-span-3 row-start-3 flex min-w-0 items-center gap-2" role="img"
    aria-label={`在庫の目安 ${description}、管理中${group.activeQuantity}${units[group.unit]}`}>
    <div className="flex h-2 min-w-0 flex-1 gap-[3px]" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const fraction = Math.max(0, Math.min(1, ratio * count - index));
        return <span key={index} className="min-w-0 flex-1 overflow-hidden rounded-[3px] bg-[#DFE6EF]">
          <span className={group.lowStock ? 'block h-full bg-[#C18443]' : 'block h-full bg-[#344B68]'}
            style={{ width: fraction * 100 + '%' }} />
        </span>;
      })}
    </div>
    <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-[#63788E]">{description}</span>
  </div>;
}
