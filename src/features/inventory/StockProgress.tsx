import { tracksVolume, units, type Food } from '../../domain/food';

/** Show one segment per item up to twelve; volume stays in ten-percent steps. */
export function StockProgress({ item }: { item: Food }) {
  if (item.status !== 'active') return null;
  const volume = tracksVolume(item);
  const percent = volume ? item.volumePercent ?? 100 : item.quantity / item.initialQuantity * 100;
  const segmented = volume || item.initialQuantity <= 12;
  const segmentCount = volume ? 10 : item.initialQuantity;
  const label = volume ? `${percent}%` : `${item.quantity} / ${item.initialQuantity}${units[item.unit]}`;
  return <div className="stock-progress flex min-w-0 flex-1 flex-col gap-2" role="img"
    aria-label={volume
      ? `開封中の1${units[item.unit]}の残量 ${percent}%、在庫${item.quantity}${units[item.unit]}`
      : `残り${item.quantity} / 基準${item.initialQuantity}`}>
    <div className="flex items-baseline gap-2">
      <strong className="text-[19px] font-bold leading-[1.3] tracking-tight tabular-nums text-foreground">{label}</strong>
      {volume && <span className="text-xs text-muted">{item.quantity > 1 ? `開封中の1${units[item.unit]} · 全${item.quantity}${units[item.unit]}` : '開封中'}</span>}
    </div>
    <div aria-hidden="true" className="flex h-[7px] gap-[3px] overflow-hidden rounded-sm bg-stock-progress-track">
      {segmented ? Array.from({ length: segmentCount }, (_, i) => {
        const fraction = Math.max(0, Math.min(1, percent / 100 * segmentCount - i));
        return <span key={i} className="min-w-0 flex-1 overflow-hidden rounded-sm bg-stock-progress-track">
          <span className="block h-full bg-stock-fill" style={{ width: fraction * 100 + '%' }} />
        </span>;
      }) : <span className="block h-full bg-stock-fill" style={{ width: percent + '%' }} />}
    </div>
  </div>;
}
