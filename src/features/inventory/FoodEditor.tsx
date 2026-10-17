import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { applyFoodCandidate, previousFoods } from '../../domain/templates';
import { categories, initialFoodForm, inferConsumption, defaultVolumeTracking, consumptionLabels, units, places, kinds, type DeadlineKind, type Food, type FoodCategory, type FoodForm, type FoodTemplate, type QuantityUnit, type StoragePlace } from '../../domain/food';
import { parseDeadline } from '../../domain/deadline';
import { TemplateManager } from '../templates/TemplateManager';
import { DeadlineInput } from './DeadlineInput';
import { Icon } from '../../components/Icon';
import { foodFormFromShopping, type ShoppingItem } from '../../domain/shopping';

type Props = {
  item?: Food;
  purchase?: ShoppingItem;
  templatesOnly: boolean;
  items: Food[];
  templates: FoodTemplate[];
  blocked: boolean;
  canRefresh: boolean;
  onRefresh: () => Promise<void>;
  formError: string;
  setFormError: (message: string) => void;
  onClose: () => void;
  onSave: (form: FoodForm) => Promise<boolean>;
  onSaveTemplates: (templates: FoodTemplate[]) => Promise<boolean>;
};

export function FoodEditor({ item, purchase, templatesOnly, items, templates, blocked, canRefresh, onRefresh, formError, setFormError, onClose, onSave, onSaveTemplates }: Props) {
  const editingId = item?.id;
  const [form, setForm] = useState<FoodForm>(() => item ? {
    name: item.name, category: item.category, kind: item.kind, deadline: item.deadline,
    quantity: item.quantity, initialQuantity: item.initialQuantity, unit: item.unit, place: item.place, consumption: item.consumption, trackingMode: item.trackingMode,
  } : purchase ? foodFormFromShopping(purchase) : initialFoodForm());
  const [managingTemplates, setManagingTemplates] = useState(templatesOnly);
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const returnToFood = useRef(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const deadlineInput = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const previous = previousFoods(items);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    if (managingTemplates) dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    else if (purchase) deadlineInput.current?.focus();
    else nameInput.current?.focus();
    if (dialog.current) dialog.current.scrollTop = 0;
  }, [managingTemplates, purchase]);

  async function saveFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const deadline = parseDeadline(form.deadline);
    if (!deadline) {
      setFormError('期限の日付を8桁の数字またはYYYY-MM-DDで入力してください。実在する日付が必要です。');
      deadlineInput.current?.focus();
      return;
    }
    const full = form.initialQuantity ?? form.quantity;
    if (!Number.isInteger(full) || full < form.quantity || full > 999) {
      setFormError('バーの満量は、現在の数量以上の整数（最大999）で指定してください。');
      return;
    }
    if (await onSave({ ...form, deadline })) dialog.current?.close();
  }
  function openTemplates() {
    returnToFood.current = true;
    setFormError(''); setSelectedCandidate(null); setManagingTemplates(true);
  }
  function closeTemplates() {
    setFormError('');
    if (returnToFood.current) setManagingTemplates(false);
    else dialog.current?.close();
  }
  async function saveTemplates(next: FoodTemplate[]): Promise<boolean> {
    if (!await onSaveTemplates(next)) return false;
    setFormError('');
    return true;
  }
  function chooseCandidate(candidate: FoodTemplate | Food, source: 'template' | 'food') {
    setSelectedCandidate(`${source}:${candidate.id}`);
    setForm(current => { const next = applyFoodCandidate(current, candidate); return { ...next, initialQuantity: next.quantity }; });
    setFormError(''); setCandidatesOpen(false);
    deadlineInput.current?.focus();
  }

  return <dialog ref={dialog} className={`food-dialog m-auto max-h-[min(92dvh,820px)] w-[min(94vw,540px)] overflow-auto rounded-[18px] border
          border-border bg-white p-0 text-foreground shadow-[0_24px_90px_#212B3840] [scroll-padding-block:24px_104px]
          backdrop:bg-[#1F2937B3] mobile:max-h-[94dvh] mobile:w-[calc(100vw-24px)] mobile:rounded-2xl`} aria-labelledby="dialog-heading" onClose={onClose}
    onCancel={event => { if (managingTemplates && returnToFood.current) { event.preventDefault(); closeTemplates(); } }}>
    {managingTemplates ? <TemplateManager templates={templates} blocked={blocked} error={formError}
      onError={setFormError} onSave={saveTemplates} onDone={closeTemplates} returning={returnToFood.current} /> :
      <form onSubmit={saveFood} className={`food-form flex flex-col gap-[18px] p-6 [&_label]:flex [&_label]:min-w-0 [&_label]:scroll-mb-[104px]
          [&_label]:flex-col [&_label]:gap-[7px] [&_label]:text-[13px] [&_label]:font-[650] mobile:gap-3.5 mobile:px-4
          mobile:py-5`}>
        <div className="dialog-head flex items-center justify-between gap-3 [&_h2]:m-0 [&_h2]:text-[23px] [&_h2]:font-[750] [&_h2]:tracking-[-.03em] mobile:[&_h2]:text-[21px]">
          <h2 id="dialog-heading">{editingId ? '食品を編集' : '食品を登録'}</h2>
          <Button variant="ghost" size="icon" className="close icon-button size-11 shrink-0 rounded-lg hover:bg-[#EEF1F6]" type="button" onClick={() => dialog.current?.close()} aria-label="閉じる"><Icon name="x" /></Button>
        </div>
        {!editingId && templates.length > 0 && <div className="quick-candidates" aria-label="定番食品のクイック選択">
          <p className="mb-2 text-xs font-semibold text-muted">定番から選ぶ</p>
          <div className="candidate-list flex flex-wrap gap-[7px]">{templates.slice(0, 5).map(candidate =>
            <Button variant="candidate" key={candidate.id} type="button" className="candidate-button"
              aria-pressed={selectedCandidate === `template:${candidate.id}`} aria-label={`定番の${candidate.name}`}
              onClick={() => chooseCandidate(candidate, 'template')}>{candidate.name}</Button>)}</div>
        </div>}
        <label><span className="field-label">食品名 <span className="required ml-1 text-[11px] font-medium text-expired">必須</span></span>
          <Input ref={nameInput} required maxLength={80} placeholder="例：牛乳" value={form.name}
            onChange={event => { const name = event.target.value; setForm({ ...form, name, consumption: form.consumption === inferConsumption(form.name, form.category) ? inferConsumption(name, form.category) : form.consumption }); setSelectedCandidate(null); }} />
        </label>
        <DeadlineInput value={form.deadline} inputRef={deadlineInput} onChange={deadline => setForm({ ...form, deadline })} />
        {!editingId && <div>
          <Button variant="secondary" type="button" className="secondary candidate-toggle text-left whitespace-normal" aria-expanded={candidatesOpen}
            aria-controls="food-candidates" onClick={() => setCandidatesOpen(!candidatesOpen)}>定番・以前の登録から入力</Button>
          <div id="food-candidates" className="candidates mt-3 flex flex-col gap-4 border-b border-[#E2E7ED] pb-[18px] [&_h3]:mt-0 [&_h3]:mb-[9px] [&_h3]:text-[13px] [&_h3]:font-[650] [&_h3]:text-[#68798F]" hidden={!candidatesOpen}>
            <section aria-label="定番食品">
              <div className="candidate-heading mb-2 flex items-center justify-between gap-2.5 [&_h3]:m-0"><h3>定番食品</h3>
                <Button variant="plain" type="button" className="manage-link min-h-11 border-0 bg-transparent px-0 py-2 text-xs text-[#354F70] underline" onClick={openTemplates}>定番を編集</Button>
              </div>
              {templates.length === 0 && <p className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">よく買う食品を追加できます。</p>}
              <div className="candidate-list flex flex-wrap gap-[7px]">{templates.slice(5).map(candidate =>
                <Button variant="candidate" key={candidate.id} type="button" className="candidate-button"
                  aria-pressed={selectedCandidate === `template:${candidate.id}`} aria-label={`定番の${candidate.name}`}
                  onClick={() => chooseCandidate(candidate, 'template')}>{candidate.name}</Button>)}</div>
            </section>
            {previous.length > 0 && <section aria-label="前に登録した食品"><h3>前に登録した食品</h3>
              <div className="candidate-list flex flex-wrap gap-[7px]">{previous.map(candidate =>
                <Button variant="candidate" key={candidate.id} type="button" className="candidate-button"
                  aria-pressed={selectedCandidate === `food:${candidate.id}`} aria-label={`以前の${candidate.name}`}
                  onClick={() => chooseCandidate(candidate, 'food')}>{candidate.name}</Button>)}</div>
            </section>}
          </div>
        </div>}
        <label>期限の種類<NativeSelect value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as DeadlineKind })}>
          {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect></label>
        <p className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">期限は未開封・指定の保存方法が前提です。商品の表示を確認してください。</p>
        <div className="form-group grid grid-cols-2 gap-3 mobile:gap-2.5">
          <label>数量<Input type="number" required min="1" max="999" step="1" value={form.quantity || ''}
            onChange={event => {
              const quantity = Number(event.target.value);
              setForm({ ...form, quantity,
                ...(form.initialQuantity === undefined ? {} : { initialQuantity: Math.max(form.initialQuantity, quantity) }) });
            }} /></label>
          <label>数量の単位<NativeSelect value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value as QuantityUnit })}>
            {Object.entries(units).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect></label>
        </div>
        <label>{(form.trackingMode ?? (defaultVolumeTracking(form.name, form.unit) ? 'volume' : 'count')) === 'volume' ? '一覧バーの基準本数' : 'バーの満量'}<Input type="number" required min={Math.max(1,form.quantity)} max="999" step="1"
          value={(form.initialQuantity ?? form.quantity) || ''}
          onChange={event => setForm({ ...form, initialQuantity: Number(event.target.value) })} /></label>
        <p className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">
          分割バーの100%に相当する数量です。現在の数量は変わりません。
        </p>
        {form.unit === 'pack' && <p className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">納豆3個組は、個別に減らす場合「3パック」として登録します。</p>}
        <label>数量の管理方式<NativeSelect value={form.trackingMode ?? (defaultVolumeTracking(form.name, form.unit) ? 'volume' : 'count')}
          onChange={event => setForm({ ...form, trackingMode: event.target.value as 'count' | 'volume' })}>
          <option value="count">個数で管理</option><option value="volume">残量で管理（10%刻み）</option>
        </NativeSelect></label>
        {(form.trackingMode ?? (defaultVolumeTracking(form.name, form.unit) ? 'volume' : 'count')) === 'count' && <label>在庫を減らすときの表現<NativeSelect value={form.consumption} onChange={event => setForm({ ...form, consumption: event.target.value as FoodForm['consumption'] })}>
          {Object.entries(consumptionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect></label>}
        <div className="form-group grid grid-cols-2 gap-3 mobile:gap-2.5">
          <label>保存場所<NativeSelect value={form.place} onChange={event => setForm({ ...form, place: event.target.value as StoragePlace })}>
            {Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect></label>
          <label>食品カテゴリ<NativeSelect value={form.category} onChange={event => { const category = event.target.value as FoodCategory; setForm({ ...form, category, consumption: form.consumption === inferConsumption(form.name, form.category) ? inferConsumption(form.name, category) : form.consumption }); }}>
            {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </NativeSelect></label>
        </div>
        {formError && <p className="form-error m-0 rounded-lg bg-[#fff0ec] p-3 text-[13px] text-[#8e372b] wrap-anywhere" role="alert">{formError}</p>}
        <div className="dialog-actions mt-2 flex justify-end gap-2 sticky bottom-[-24px] z-2 mb-[-24px] border-t border-[#E2E7ED] bg-white pt-3.5 pb-6 mobile:bottom-[-20px] mobile:mb-[-20px] mobile:pb-5">
          <Button variant="secondary" type="button" className="secondary text-muted" onClick={() => dialog.current?.close()}>キャンセル</Button>
          <Button variant="default" type="submit" className="primary" disabled={blocked}>{editingId ? '変更を保存' : '登録する'}</Button>
        </div>
      </form>}
    {canRefresh && <div className="dialog-actions mt-2 flex justify-end gap-2"><Button variant="secondary" type="button" className="secondary" onClick={onRefresh}>クラウドを再取得</Button></div>}
  </dialog>;
}
