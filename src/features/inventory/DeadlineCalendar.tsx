import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { deadlineLabel } from '../../domain/deadline.ts';
import { kinds, normalizedName, places, units, type Food } from '../../domain/food.ts';
import { FoodIcon } from '../../components/FoodIcon';
import type { InventoryActions } from './FoodGroupCard';
import { selectTimeline } from './selectTimeline';

type Range = 14 | 30 | 90;
type Props = InventoryActions & {
  items: Food[];
  today: string;
  listed: ReadonlySet<string>;
  onShowList: () => void;
};
const weekday = ['日', '月', '火', '水', '木', '金', '土'];
function dateAfter(today: string, offset: number) {
  return new Date(Date.parse(today + 'T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10);
}
function shortDate(date: string, today: string) {
  const [year, month, day] = date.split('-').map(Number);
  return `${year === Number(today.slice(0, 4)) ? '' : year + '/'}${month}/${day}`;
}
function fullDate(date: string) {
  const value = new Date(date + 'T00:00:00Z');
  return `${value.getUTCMonth() + 1}月${value.getUTCDate()}日（${weekday[value.getUTCDay()]}）`;
}
/** Select the expiration date first; the existing per-lot detail actions remain available. */
export function DeadlineCalendar({ items, today, listed, onShowList, blocked, onEdit, onStatus, onRemove, onLowStock, onAddShopping }: Props) {
  const [range, setRange] = useState<Range>(30);
  const [calendarDate, setCalendarDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const { expired, visible, later } = selectTimeline(items, today, range);
  const selectedDay = [...expired, ...visible].find(day => day.deadline === selectedDate);
  const current = visible.find(day => day.deadline === calendarDate);
  const dates = Array.from({ length: range + 1 }, (_, i) => dateAfter(today, i));
  const count = new Map(visible.map(day => [day.deadline, day.items.length]));
  const overdueCount = expired.reduce((sum, day) => sum + day.items.length, 0);

  useEffect(() => { setCalendarDate(today); }, [today]);
  useEffect(() => {
    if (selectedDate && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal();
  }, [selectedDate]);
  function jumpTo(date: string) {
    setCalendarDate(date);
    railRef.current?.querySelector<HTMLElement>(`[data-date="${date}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  function nextDate() {
    const next = visible.find(day => day.deadline > calendarDate) ?? visible[0];
    if (next) jumpTo(next.deadline);
  }
  function dismiss() {
    dialogRef.current?.close();
    setSelectedDate(null);
  }
  return <div className="deadline-calendar">
    <div className="calendar-top">
      <div><h1 id="calendar-heading">期限カレンダー</h1><p>{Number(calendarDate.slice(0,4))}年{Number(calendarDate.slice(5,7))}月</p></div>
      <Button variant="secondary" type="button" onClick={() => jumpTo(today)}>今日へ</Button>
    </div>
    <div className="calendar-range" role="group" aria-label="カレンダーの表示期間">
      {([14,30,90] as const).map(value => <Button key={value} variant="plain" type="button" aria-pressed={range === value}
        onClick={() => { setRange(value); setCalendarDate(today); }}>{value}日</Button>)}
    </div>
    <div ref={railRef} className="calendar-rail" role="group" aria-label="期限の日付を選択">
      {dates.map(date => {
        const dayCount = count.get(date) ?? 0;
        const [year, month, day] = date.split('-').map(Number);
        const dayOfWeek = weekday[new Date(Date.UTC(year,month-1,day)).getUTCDay()];
        return <button className="calendar-day" key={date} data-date={date} type="button"
          aria-label={`${fullDate(date)}、${dayCount}件${date === today ? '、今日' : ''}`}
          aria-pressed={calendarDate === date} onClick={() => jumpTo(date)}>
          <span className="calendar-day-week">{dayOfWeek}</span>
          <span className="calendar-day-number">{day}</span>
          <span className={`calendar-day-dot ${dayCount ? dayCount >= 3 ? 'calendar-day-dot-multiple' : 'calendar-day-dot-active' : ''}`}
            aria-hidden="true" />
        </button>;
      })}
    </div>
    <div className="calendar-selected">
      <div><h2>{fullDate(calendarDate)}</h2><p>この日に期限を迎える食品</p></div>
      <span className="calendar-count">{current?.items.length ?? 0}件</span>
    </div>
    {current ? <ul className="calendar-food-list">{current.items.map(item => <li key={item.id}>
      <button type="button" className="calendar-food" onClick={() => setSelectedDate(item.deadline)}
        aria-label={`${item.name}、${item.quantity}${units[item.unit]}、${places[item.place]}、詳細を開く`}>
        <span className="food-icon"><FoodIcon name={item.name} category={item.category} /></span>
        <span className="calendar-food-name"><strong>{item.name}</strong><small>{places[item.place]} · {item.quantity}{units[item.unit]}</small></span>
        <span className="calendar-food-label">{deadlineLabel(item.deadline,today)}</span>
      </button>
    </li>)}</ul> : <div className="calendar-empty">この日に期限を迎える食品はありません</div>}
    <div className="calendar-footer">
      <Button variant="secondary" type="button" disabled={!visible.length} onClick={nextDate}>次の期限へ</Button>
      {later > 0 && <p>{range}日より先の在庫が{later}件あります。
        <Button variant="plain" type="button" onClick={onShowList}>一覧で確認</Button></p>}
    </div>
    {overdueCount > 0 && <section className="calendar-overdue" aria-label="期限切れの食品">
      <h2>期限切れ <span>{overdueCount}件</span></h2>
      {expired.map(day => <button type="button" key={day.deadline} className="calendar-overdue-item"
        onClick={() => setSelectedDate(day.deadline)}><time dateTime={day.deadline}>{shortDate(day.deadline, today)}</time>
        <span>{day.items.length === 1 ? day.items[0].name : `${day.items[0].name} ほか${day.items.length-1}件`}</span>
        <span>{day.items.length}件</span></button>)}
    </section>}
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
            <div className="timeline-dialog-actions">
              <Button variant="secondary" type="button" disabled={blocked} aria-label={`${item.name}を編集`}
                onClick={() => { dismiss(); onEdit(item); }}>編集</Button>
              <Button variant="default" type="button" disabled={blocked}
                aria-label={item.status === 'active' ? `${item.name}を使い切り` : `${item.name}を管理中に戻す`}
                onClick={() => { dismiss(); onStatus(item, item.status === 'active' ? 'used' : 'active'); }}>
                {item.status === 'active' ? '使い切り' : '戻す'}
              </Button>
              <details className="timeline-more">
                <summary>その他の操作</summary>
                <div className="timeline-more-buttons">
                  {item.status === 'active' && <Button variant="secondary" type="button" disabled={blocked}
                    onClick={() => { dismiss(); onStatus(item, 'discarded'); }}>廃棄として記録</Button>}
                  <Button variant="secondary" type="button" disabled={blocked}
                    onClick={() => { dismiss(); onRemove(item); }}>削除</Button>
                </div>
              </details>
            </div>
          </li>)}
        </ul>
      </>}
    </dialog>
  </div>;
}
