import { tracksVolume, volumeLabel, type Food } from '../../domain/food';

/** Above 12 units, each segment represents a proportional share of the starting stock. */
export function StockProgress({ item }: { item: Food }) {
  if (item.status !== 'active') return null;
  const segments = Math.min(12, item.initialQuantity);
  const volume = tracksVolume(item);
  const ratio = volume ? (item.quantity - 1 + (item.volumePercent ?? 100) / 100) / item.initialQuantity : item.quantity / item.initialQuantity;
  const filled = Math.ceil(ratio * segments);
  return <div className="stock-progress flex flex-col gap-1.5" role="img"
    aria-label={volume ? `残り${item.quantity} / 基準${item.initialQuantity}、開封中${volumeLabel(item.volumePercent ?? 100)}` : `残り${item.quantity} / 基準${item.initialQuantity}`}>
    <div aria-hidden="true" className="flex h-2 gap-[3px] overflow-hidden rounded-sm">
      {Array.from({ length: segments }, (_, i) => <span key={i}
        className={i < filled ? 'bg-[#344B68]' : 'bg-[#DFE6EF]'}
        style={{ flex: 1, minWidth: 0, borderRadius: 2 }} />)}
    </div>
    <span className="text-[11px] text-muted">残り {item.quantity} / {item.initialQuantity}{volume && ` ・ 開封中${volumeLabel(item.volumePercent ?? 100)}`}</span>
  </div>;
}
