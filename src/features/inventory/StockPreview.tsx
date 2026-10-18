import { tracksVolume, units, volumeLabel } from '../../domain/food';
import type { FoodGroup } from '../../domain/stock';

/** Keep the existing weighted stock calculation; only the visual presentation becomes a bottom-edge line. */
export function StockPreview({ group }: { group: FoodGroup }) {
  const active = group.items.filter(item => item.status === 'active');
  if (!active.length) return null;
  const baseline = active.reduce((sum, item) => sum + item.initialQuantity, 0);
  const remaining = active.reduce((sum, item) => sum + item.quantity -
    (tracksVolume(item) ? 1 - (item.volumePercent ?? 100) / 100 : 0), 0);
  const ratio = Math.max(0, Math.min(1, remaining / baseline));
  const partial = active.filter(item => tracksVolume(item) && (item.volumePercent ?? 100) < 100);
  const description = partial.length === 1
    ? '開封中 ' + volumeLabel(partial[0].volumePercent ?? 100)
    : partial.length > 1 ? '開封中 ' + partial.length + '件' : active.some(tracksVolume) ? '満量' : group.activeQuantity + '/' + baseline + units[group.unit];

  return <div className="stock-preview pointer-events-none absolute inset-x-0 bottom-0 h-[3px] mobile:h-[2px] overflow-hidden bg-stock-track mobile:bg-stock-track-mobile" role="img"
    aria-label={`在庫の目安 ${description}、管理中${group.activeQuantity}${units[group.unit]}`}>
    <span className={group.lowStock ? 'block h-full bg-stock-low mobile:bg-stock-low-mobile' : 'block h-full bg-stock-fill mobile:bg-stock-fill-mobile'}
      style={{ width: ratio * 100 + '%' }} />
  </div>;
}
