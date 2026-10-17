import { tracksVolume, volumeLabel, type Food } from '../../domain/food';

/** Above 12 units, each segment represents a proportional share of the starting stock. */
export function StockProgress({ item }: { item: Food }) {
  if (item.status !== 'active') return null;
  const segments = Math.min(12, item.initialQuantity);
  const volume = tracksVolume(item);
  const ratio = volume ? (item.quantity - 1 + (item.volumePercent ?? 100) / 100) / item.initialQuantity : item.quantity / item.initialQuantity;
  return <div className="stock-progress flex flex-col gap-1.5" role="img"
    aria-label={volume ? `残り${item.quantity} / 基準${item.initialQuantity}、開封中${volumeLabel(item.volumePercent ?? 100)}` : `残り${item.quantity} / 基準${item.initialQuantity}`}>
    <div aria-hidden="true" className="flex h-2 gap-[3px] overflow-hidden rounded-sm">
      {Array.from({ length: segments }, (_, i) => {
        const fraction = Math.max(0, Math.min(1, ratio * segments - i));
        return <span key={i} className="min-w-0 flex-1 overflow-hidden rounded-sm bg-[#DFE6EF]">
          <span className="block h-full bg-[#344B68]" style={{ width: fraction * 100 + '%' }} />
        </span>;
      })}
    </div>
    <span className="text-[11px] text-muted">残り {item.quantity} / {item.initialQuantity}{volume && ` ・ 開封中${volumeLabel(item.volumePercent ?? 100)}`}</span>
  </div>;
}
