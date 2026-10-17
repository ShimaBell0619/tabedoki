import { tracksVolume, units, type Food } from '../../domain/food';

/** Ten segments for either remaining item count or the currently open container. */
export function StockProgress({ item }: { item: Food }) {
  if (item.status !== 'active') return null;
  const volume = tracksVolume(item);
  const percent = volume ? item.volumePercent ?? 100 : item.quantity / item.initialQuantity * 100;
  const label = volume ? `${percent}%` : `${item.quantity} / ${item.initialQuantity}${units[item.unit]}`;
  return <div className="stock-progress flex min-w-0 flex-1 flex-col gap-2" role="img"
    aria-label={volume
      ? `開封中の1${units[item.unit]}の残量 ${percent}%、在庫${item.quantity}${units[item.unit]}`
      : `残り${item.quantity} / 基準${item.initialQuantity}`}>
    <div className="flex items-baseline gap-2">
      <strong className="text-[19px] font-bold leading-[1.3] tracking-tight tabular-nums text-foreground">{label}</strong>
      {volume && <span className="text-xs text-muted">{item.quantity > 1 ? `開封中の1${units[item.unit]} · 全${item.quantity}${units[item.unit]}` : '開封中'}</span>}
    </div>
    <div aria-hidden="true" className="flex h-[7px] gap-[3px] overflow-hidden rounded-sm">
      {Array.from({ length: 10 }, (_, i) => {
        const fraction = Math.max(0, Math.min(1, percent / 10 - i));
        return <span key={i} className="min-w-0 flex-1 overflow-hidden rounded-sm bg-[#DFE6EF]">
          <span className="block h-full bg-[#344B68]" style={{ width: fraction * 100 + '%' }} />
        </span>;
      })}
    </div>
  </div>;
}
