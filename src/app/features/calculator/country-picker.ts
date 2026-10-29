import { ChangeDetectionStrategy, Component, ElementRef, computed, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon } from '@shared/components/icon';
import { InternationalCountry } from '@core/models/portal.model';

/** sKart sends names in mixed case ("ALBANIA", "Afghanistan"): show them as "Albania". */
export function countryLabel(name: string): string {
  return name.toLowerCase().replace(/(^|[\s(\-/.'])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Countries matching the text: names that start with it first, then names or codes that contain it. */
export function matchCountries(list: readonly InternationalCountry[], text: string, limit = 50): InternationalCountry[] {
  const q = text.trim().toLowerCase();
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  if (!q) return sorted.slice(0, limit);
  const starts = sorted.filter((c) => c.name.toLowerCase().startsWith(q) || c.code.toLowerCase() === q);
  const contains = sorted.filter((c) => !starts.includes(c) && c.name.toLowerCase().includes(q));
  return [...starts, ...contains].slice(0, limit);
}

/**
 * Destination country search box: type a few letters, pick from the list with the mouse or the arrow keys and Enter.
 * The form value is the country's name exactly as sKart sends it.
 */
@Component({
  selector: 'ecb-country-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CountryPicker), multi: true }],
  host: { '(focusout)': 'onFocusOut($event)' },
  template: `
    <div class="box" [class.box--open]="open()">
      <ecb-icon name="flight" class="box__icon" />
      <input #field [id]="inputId()" type="text" role="combobox" autocomplete="off" spellcheck="false"
        [placeholder]="placeholder()" [value]="text()" [disabled]="disabled()"
        aria-autocomplete="list" [attr.aria-expanded]="open()" [attr.aria-controls]="inputId() + '-list'"
        [attr.aria-activedescendant]="open() && active() >= 0 ? inputId() + '-opt-' + active() : null"
        (input)="onInput(field.value)" (focus)="openList()" (click)="openList()" (keydown)="onKey($event)" />
      @if (text() && !disabled()) {
        <button type="button" class="box__clear" aria-label="Clear country" (mousedown)="$event.preventDefault()" (click)="clear()">×</button>
      }
    </div>
    @if (open()) {
      <ul class="list" role="listbox" [id]="inputId() + '-list'">
        @for (c of matches(); track c.id; let i = $index) {
          <li role="option" [id]="inputId() + '-opt-' + i" [class.active]="i === active()" [attr.aria-selected]="c.name === value()"
            (mousedown)="$event.preventDefault()" (click)="pick(c)" (mouseenter)="active.set(i)">
            <span class="code">{{ c.code }}</span>
            <span class="name">@for (part of highlight(c); track $index) {<span [class.hit]="part.hit">{{ part.text }}</span>}</span>
            @if (c.region?.trim()) { <span class="region">{{ c.region!.trim() }}</span> }
          </li>
        } @empty {
          <li class="none">No country matches “{{ text() }}”</li>
        }
      </ul>
    }
  `,
  styles: [`
    :host { position:relative; display:block; }
    .box { position:relative; display:flex; align-items:center; }
    .box__icon { position:absolute; left:14px; color:var(--content-muted); font-size:1.15rem; pointer-events:none; }
    .box input { width:100%; min-height:3.25rem; padding:0 40px 0 42px; border:2px solid var(--surface-border); border-radius:14px; font:800 1.05rem var(--font-sans); background:var(--occpl-color-surface); color:var(--content-fg); }
    .box input:focus-visible { outline:none; border-color:var(--occpl-color-accent); box-shadow:0 0 0 4px var(--occpl-color-info-surface); }
    .box--open input { border-color:var(--occpl-color-accent); }
    .box__clear { position:absolute; right:8px; width:28px; height:28px; border:0; border-radius:50%; background:transparent; color:var(--content-muted); font-size:1.3rem; line-height:1; cursor:pointer; }
    .box__clear:hover { background:var(--surface-border); color:var(--content-fg); }
    .list { position:absolute; z-index:20; top:calc(100% + 6px); left:0; right:0; max-height:18rem; overflow-y:auto; margin:0; padding:6px; list-style:none; background:var(--occpl-color-surface); border:1px solid var(--surface-border); border-radius:16px; box-shadow:var(--occpl-shadow-md); }
    .list li { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; cursor:pointer; color:var(--content-fg); }
    .list li.active { background:var(--occpl-color-info-surface); }
    .list li[aria-selected="true"] .name { color:var(--occpl-color-primary); }
    .code { flex:none; min-width:2.2rem; padding:2px 6px; border-radius:6px; background:var(--surface-border); font:800 .7rem var(--font-sans); letter-spacing:.06em; text-align:center; color:var(--content-muted); }
    .name { flex:1; min-width:0; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .name .hit { color:var(--occpl-color-accent); font-weight:800; }
    .region { flex:none; font-size:.8rem; color:var(--content-muted); }
    .list li.none { cursor:default; color:var(--content-muted); justify-content:center; }
    @media (max-width: 40rem) { .region { display:none; } }
  `]
})
export class CountryPicker implements ControlValueAccessor {
  readonly countries = input<readonly InternationalCountry[]>([]);
  readonly inputId = input('country');
  readonly placeholder = input('Type to search');

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  /** The chosen country's sKart name, or '' while nothing is picked. */
  readonly value = signal('');
  /** What the box shows: the picked country's label, or what the user is typing. */
  readonly text = signal('');
  readonly open = signal(false);
  readonly active = signal(-1);
  readonly disabled = signal(false);

  readonly matches = computed(() => {
    const picked = this.countries().find((c) => c.name === this.value());
    // Just focused on a picked country: show the whole list rather than only that one.
    const q = picked && this.text() === countryLabel(picked.name) ? '' : this.text();
    return matchCountries(this.countries(), q);
  });

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    const name = v ?? '';
    const c = this.find(name);
    this.value.set(c?.name ?? name);
    this.text.set(c ? countryLabel(c.name) : name);
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  openList(): void {
    if (this.disabled()) return;
    this.open.set(true);
    const i = this.matches().findIndex((c) => c.name === this.value());
    this.active.set(i >= 0 ? i : 0);
    this.scrollActive();
  }

  onInput(t: string): void {
    this.text.set(t);
    // Typing a full name picks it; anything else clears the choice until one is picked.
    const exact = this.find(t);
    this.commit(exact?.name ?? '');
    this.open.set(true);
    this.active.set(this.matches().length ? 0 : -1);
  }

  onKey(e: KeyboardEvent): void {
    const n = this.matches().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open()) { this.openList(); return; }
        this.active.set(n ? (this.active() + 1) % n : -1); this.scrollActive(); break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open()) { this.openList(); return; }
        this.active.set(n ? (this.active() - 1 + n) % n : -1); this.scrollActive(); break;
      case 'Enter': {
        const c = this.open() ? this.matches()[this.active()] : undefined;
        if (c) { e.preventDefault(); this.pick(c); }
        break;
      }
      case 'Escape':
        if (this.open()) { e.preventDefault(); this.close(); }
        break;
      case 'Tab':
        if (this.open() && this.text().trim() && !this.value() && this.matches()[this.active()]) this.pick(this.matches()[this.active()]);
        break;
    }
  }

  pick(c: InternationalCountry): void {
    this.commit(c.name);
    this.text.set(countryLabel(c.name));
    this.open.set(false);
  }

  clear(): void {
    this.commit('');
    this.text.set('');
    this.field().nativeElement.focus();
    this.openList();
  }

  onFocusOut(e: FocusEvent): void {
    const host = e.currentTarget as HTMLElement;
    if (e.relatedTarget instanceof Node && host.contains(e.relatedTarget)) return;
    this.close();
  }

  /** Parts of the label for bold-highlighting the typed text. */
  highlight(c: InternationalCountry): { text: string; hit: boolean }[] {
    const label = countryLabel(c.name);
    const q = this.text().trim().toLowerCase();
    const at = q ? label.toLowerCase().indexOf(q) : -1;
    if (at < 0 || label === this.text()) return [{ text: label, hit: false }];
    return [
      { text: label.slice(0, at), hit: false },
      { text: label.slice(at, at + q.length), hit: true },
      { text: label.slice(at + q.length), hit: false }
    ].filter((p) => p.text);
  }

  private close(): void {
    this.open.set(false);
    // Leave a half-typed box showing the picked country, or empty when nothing was picked.
    const c = this.find(this.value());
    this.text.set(c ? countryLabel(c.name) : this.text().trim() && !this.value() ? this.text() : '');
    this.onTouched();
  }

  private commit(name: string): void {
    if (name === this.value()) return;
    this.value.set(name);
    this.onChange(name);
  }

  private find(name: string): InternationalCountry | undefined {
    const q = name.trim().toLowerCase();
    return q ? this.countries().find((c) => c.name.toLowerCase() === q) : undefined;
  }

  private scrollActive(): void {
    queueMicrotask(() => document.getElementById(`${this.inputId()}-opt-${this.active()}`)?.scrollIntoView?.({ block: 'nearest' }));
  }
}
