import { useEffect, useRef, useState, type FormEvent } from 'react';
import { applyFoodCandidate, previousFoods } from '../../domain/templates';
import { categories, initialFoodForm, units, places, kinds, type DeadlineKind, type Food, type FoodCategory, type FoodForm, type FoodTemplate, type QuantityUnit, type StoragePlace } from '../../domain/food';
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
    quantity: item.quantity, unit: item.unit, place: item.place,
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
    setForm(current => applyFoodCandidate(current, candidate));
    setFormError(''); setCandidatesOpen(false);
    deadlineInput.current?.focus();
  }

  return <dialog ref={dialog} className="food-dialog" aria-labelledby="dialog-heading" onClose={onClose}
    onCancel={event => { if (managingTemplates && returnToFood.current) { event.preventDefault(); closeTemplates(); } }}>
    {managingTemplates ? <TemplateManager templates={templates} blocked={blocked} error={formError}
      onError={setFormError} onSave={saveTemplates} onDone={closeTemplates} returning={returnToFood.current} /> :
      <form onSubmit={saveFood} className="food-form">
        <div className="dialog-head">
          <h2 id="dialog-heading">{editingId ? '食品を編集' : '食品を登録'}</h2>
          <button className="close icon-button" type="button" onClick={() => dialog.current?.close()} aria-label="閉じる"><Icon name="x" /></button>
        </div>
        <label>食品名 <span className="required">必須</span>
          <input ref={nameInput} required maxLength={80} placeholder="例：牛乳" value={form.name}
            onChange={event => { setForm({ ...form, name: event.target.value }); setSelectedCandidate(null); }} />
        </label>
        <DeadlineInput value={form.deadline} inputRef={deadlineInput} onChange={deadline => setForm({ ...form, deadline })} />
        {!editingId && <div>
          <button type="button" className="secondary candidate-toggle" aria-expanded={candidatesOpen}
            aria-controls="food-candidates" onClick={() => setCandidatesOpen(!candidatesOpen)}>定番・以前の登録から入力</button>
          <div id="food-candidates" className="candidates" hidden={!candidatesOpen}>
            <section aria-label="定番食品">
              <div className="candidate-heading"><h3>定番食品</h3>
                <button type="button" className="manage-link" onClick={openTemplates}>定番を編集</button>
              </div>
              {templates.length === 0 && <p className="form-help">よく買う食品を追加できます。</p>}
              <div className="candidate-list">{templates.map(candidate =>
                <button key={candidate.id} type="button" className="candidate-button"
                  aria-pressed={selectedCandidate === `template:${candidate.id}`} aria-label={`定番の${candidate.name}`}
                  onClick={() => chooseCandidate(candidate, 'template')}>{candidate.name}</button>)}</div>
            </section>
            {previous.length > 0 && <section aria-label="前に登録した食品"><h3>前に登録した食品</h3>
              <div className="candidate-list">{previous.map(candidate =>
                <button key={candidate.id} type="button" className="candidate-button"
                  aria-pressed={selectedCandidate === `food:${candidate.id}`} aria-label={`以前の${candidate.name}`}
                  onClick={() => chooseCandidate(candidate, 'food')}>{candidate.name}</button>)}</div>
            </section>}
          </div>
        </div>}
        <label>期限の種類<select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as DeadlineKind })}>
          {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <p className="form-help">期限は未開封・指定の保存方法が前提です。商品の表示を確認してください。</p>
        <div className="form-group">
          <label>数量<input type="number" required min="1" max="999" step="1" value={form.quantity || ''}
            onChange={event => setForm({ ...form, quantity: Number(event.target.value) })} /></label>
          <label>数量の単位<select value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value as QuantityUnit })}>
            {Object.entries(units).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        {form.unit === 'pack' && <p className="form-help">3個組の納豆なら1パック。個別に数える場合は「個」に変更してください。</p>}
        <div className="form-group">
          <label>保存場所<select value={form.place} onChange={event => setForm({ ...form, place: event.target.value as StoragePlace })}>
            {Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label>食品カテゴリ<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value as FoodCategory })}>
            {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary outline" onClick={() => dialog.current?.close()}>キャンセル</button>
          <button type="submit" className="primary" disabled={blocked}>{editingId ? '変更を保存' : '登録する'}</button>
        </div>
      </form>}
    {canRefresh && <div className="dialog-actions"><button type="button" className="secondary" onClick={onRefresh}>クラウドを再取得</button></div>}
  </dialog>;
}
