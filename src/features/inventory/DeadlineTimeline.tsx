import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { daysLeft, deadlineLabel } from '../../domain/deadline.ts';
import { kinds, normalizedName, places, units, type Food } from '../../domain/food.ts';
import { FoodActions } from './FoodActions';
import type { InventoryActions } from './FoodGroupCard';
import { selectTimeline, type TimelineDay } from './selectTimeline';

const DAY_HEIGHT = 48;
const START_Y = 28;
type Range = 14 | 30 | 90;

type Props = InventoryActions & {
  items: Food[];
  today: string;
  listed: ReadonlySet<string>;
  onShowList: () => void;
};

function shortDate(date: string, today: string) {
  const [year, month, day] = date.split('-').map(Number);
  return `${year === Number(today.slice(0, 4)) ? '' : year + '/'}${month}/${day}`;
}

function dateAfter(today: string, offset: number) {
  return new Date(Date.parse(today + 'T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10);
}

function preview(day: TimelineDay) {
  return day.items.length === 1 ? day.items[0].name : `${day.items[0].name} ほか${day.items.length - 1}件`;
}

/** One marker and one compact tappable card per calendar date; detail actions open separately. */
export function DeadlineTimeline({ items, today, listed, onShowList, blocked, onEdit, onStatus, onRemove, onLowStock, onAddShopping }: Props) {
  const [range, setRange] = useState<Range>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { expired, visible, later } = selectTimeline(items, today, range);
  const selectedDay = [...expired, ...visible].find(day => day.deadline === selectedDate);
  const eventDays = new Set(visible.map(day => day.days));
  const weeks = Array.from({ length: Math.ceil(range / 7) }, (_, i) => i * 7);
  const ticks = Array.from({ length: Math.floor(range / 7) + 1 }, (_, i) => i * 7);

  useEffect(() => {
    if (selectedDate && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [selectedDate]);

  function dismiss() {
    dialogRef.current?.close();
    setSelectedDate(null);
  }

  function dayButton(day: TimelineDay, overdue: boolean) {
    const item = day.items[0];
    return <button key={day.deadline} type="button" onClick={() => setSelectedDate(day.deadline)}
      className={overdue ? 'timeline-overdue-button' : 'timeline-hit'}
      style={overdue ? undefined : { top: START_Y + day.days * DAY_HEIGHT - DAY_HEIGHT / 2 }}
      aria-label={`${shortDate(day.deadline, today)}、${preview(day)}、${day.items.length}件、${deadlineLabel(day.deadline, today)}。詳細を開く`}>
      <span className={`timeline-card ${day.days <= 3 ? 'timeline-card-urgent' : ''}`}>
        <span className="timeline-card-main">
          <span className="timeline-card-name">{preview(day)}</span>
          <span className="timeline-card-qty">{day.items.length === 1 ? `${item.quantity}${units[item.unit]}` : `${day.items.length}件`}</span>
        </span>
        <span className="timeline-card-days">{item.status === 'active' ? deadlineLabel(day.deadline, today) :
          day.items.every(entry => entry.status !== 'active') ? '完了' : deadlineLabel(day.deadline, today)}</span>
      </span>
    </button>;
  }

  return <div className="timeline-view">
    <div className="timeline-tools">
      <div className="timeline-range" role="group" aria-label="タイムラインの表示期間">
        {([14, 30, 90] as const).map(value => <Button key={value} type="button" variant="plain"
          aria-pressed={range === value} onClick={() => setRange(value)}>{value}日</Button>)}
      </div>
      <span className="timeline-scale">1日 = 同じ間隔</span>
    </div>
    {expired.length > 0 && <section className="timeline-overdue" aria-label="期限切れの食品">
      <h2>期限切れ <span>{expired.reduce((sum, day) => sum + day.items.length, 0)}件</span></h2>
      <div className="timeline-overdue-list">{expired.map(day =>
        <div className="timeline-overdue-row" key={day.deadline}>
          <time dateTime={day.deadline}>{shortDate(day.deadline, today)}</time>
          {dayButton(day, true)}
        </div>)}
      </div>
    </section>}
    <div className="timeline-stage" style={{ height: START_Y * 2 + range * DAY_HEIGHT }} aria-label={`今日から${range}日後までの期限タイムライン`}>
      {weeks.map((week, index) => <div className={`timeline-week ${index % 2 ? 'timeline-week-alt' : ''}`}
        key={week} style={{ top: START_Y + week * DAY_HEIGHT, height: Math.min(7, range - week) * DAY_HEIGHT }} />)}
      <div className="timeline-axis" style={{ top: START_Y, height: range * DAY_HEIGHT }} />
      {ticks.map(day => <div className="timeline-gridline" key={day} style={{ top: START_Y + day * DAY_HEIGHT }}>
        {!eventDays.has(day) && <time className="timeline-tick" dateTime={dateAfter(today, day)}>
          {day === 0 ? '今日' : shortDate(dateAfter(today, day), today)}
        </time>}
      </div>)}
      {visible.map(day => <div key={day.deadline}>
        <time className="timeline-date" dateTime={day.deadline} style={{ top: START_Y + day.days * DAY_HEIGHT }}>
          {shortDate(day.deadline, today)}
        </time>
        <span className={`timeline-dot ${day.days <= 3 ? 'timeline-dot-urgent' : ''}`}
          style={{ top: START_Y + day.days * DAY_HEIGHT }} aria-hidden="true" />
        <span className="timeline-connector" style={{ top: START_Y + day.days * DAY_HEIGHT }} aria-hidden="true" />
        {dayButton(day, false)}
      </div>)}
    </div>
    {later > 0 && <p className="timeline-later">{range}日より先の在庫が{later}件あります。
      <Button variant="plain" type="button" onClick={onShowList}>一覧で確認</Button>
    </p>}
    <dialog ref={dialogRef} className="timeline-dialog" aria-labelledby="timeline-dialog-title"
      onClose={() => setSelectedDate(null)}>
      {selectedDay && <>
        <div className="timeline-dialog-heading">
          <div>
            <h2 id="timeline-dialog-title">{shortDate(selectedDay.deadline, today)}の在庫</h2>
            <p>{deadlineLabel(selectedDay.deadline, today)} · {selectedDay.items.length}件</p>
          </div>
          <Button variant="secondary" type="button" onClick={dismiss} aria-label="閉じる">閉じる</Button>
        </div>
        <ul className="timeline-dialog-list">
          {selectedDay.items.map(item => <li key={item.id} className="timeline-dialog-item">
            <div className="timeline-dialog-item-head">
              <strong>{item.name}</strong>
              <span>{item.quantity}{units[item.unit]} · {places[item.place]}</span>
            </div>
            <div className="timeline-dialog-item-meta">
              <span>{kinds[item.kind]}</span>
              {item.status !== 'active' && <span>{item.status === 'used' ? '使い切り済み' : '廃棄済み'}</span>}
            </div>
            {item.status === 'active' && <div className="timeline-dialog-extras">
              <label><input type="checkbox" checked={item.lowStock} disabled={blocked}
                onChange={event => onLowStock(item, event.target.checked)} />残りわずか</label>
              {listed.has(normalizedName(item.name)) ? <span>買い物に追加済み</span> :
                <Button type="button" variant="secondary" disabled={blocked} onClick={() => void onAddShopping(item)}>買い物に追加</Button>}
            </div>}
            <FoodActions item={item} blocked={blocked}
              onEdit={() => { dismiss(); onEdit(item); }}
              onFinish={() => { dismiss(); onStatus(item, item.status === 'active' ? 'used' : 'active'); }}
              onDiscard={() => { dismiss(); onStatus(item, 'discarded'); }}
              onRemove={() => { dismiss(); onRemove(item); }} />
          </li>)}
        </ul>
      </>}
    </dialog>
  </div>;
}
