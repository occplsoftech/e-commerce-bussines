import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CountryPicker, countryLabel, matchCountries } from './country-picker';

const countries = [
  { id: 12, code: 'AU', name: 'AUSTRALIA', region: 'South West Pacific', postcodeRequired: true },
  { id: 13, code: 'AT', name: 'AUSTRIA', region: 'Europe', postcodeRequired: true },
  { id: 2, code: 'AL', name: 'ALBANIA', region: 'Europe', postcodeRequired: false },
  { id: 225, code: 'US', name: 'UNITED STATES', region: 'Americas', postcodeRequired: true },
  { id: 224, code: 'GB', name: 'United Kingdom', region: 'Europe', postcodeRequired: true }
];

@Component({
  imports: [CountryPicker, ReactiveFormsModule],
  template: `<ecb-country-picker inputId="t" [formControl]="ctrl" [countries]="list" />`
})
class Host {
  readonly ctrl = new FormControl('', { nonNullable: true });
  readonly list = countries;
}

describe('countryLabel / matchCountries', () => {
  it('shows names in title case', () => {
    expect(countryLabel('UNITED STATES')).toBe('United States');
    expect(countryLabel('BOSNIA-HERZEGOVINA')).toBe('Bosnia-Herzegovina');
  });

  it('puts names that start with the text first, then ones that contain it', () => {
    expect(matchCountries(countries, 'au').map((c) => c.code)).toEqual(['AU', 'AT']);
    expect(matchCountries(countries, 'stra').map((c) => c.code)).toEqual(['AU']);
    expect(matchCountries(countries, 'united').map((c) => c.code)).toEqual(['GB', 'US']);
    expect(matchCountries(countries, 'us').map((c) => c.code)).toEqual(['US', 'AU', 'AT']);
    expect(matchCountries(countries, '').map((c) => c.code)).toEqual(['AL', 'AU', 'AT', 'GB', 'US']);
  });
});

describe('CountryPicker', () => {
  function create() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const type = (t: string) => { input.value = t; input.dispatchEvent(new Event('input')); fixture.detectChanges(); };
    const key = (k: string) => { input.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true })); fixture.detectChanges(); };
    const options = () => [...fixture.nativeElement.querySelectorAll('li[role=option]')] as HTMLElement[];
    return { fixture, input, type, key, options, ctrl: fixture.componentInstance.ctrl };
  }

  it('lists matching countries as you type and picks one with a click', () => {
    const { fixture, type, options, ctrl, input } = create();
    type('austral');
    expect(options().length).toBe(1);
    const part = (sel: string) => options()[0].querySelector(sel)!.textContent!.trim();
    expect([part('.code'), part('.name'), part('.region'), part('.hit')]).toEqual(['AU', 'Australia', 'South West Pacific', 'Austral']);
    expect(ctrl.value).toBe('');
    options()[0].click();
    fixture.detectChanges();
    expect(ctrl.value).toBe('AUSTRALIA');
    expect(input.value).toBe('Australia');
    expect(options().length).toBe(0);
  });

  it('picks with the arrow keys and Enter, and closes on Escape', () => {
    const { type, key, options, ctrl, input } = create();
    type('united');
    key('ArrowDown');
    expect(options()[1].classList).toContain('active');
    expect(input.getAttribute('aria-activedescendant')).toBe('t-opt-1');
    key('Enter');
    expect(ctrl.value).toBe('UNITED STATES');
    type('alb');
    key('Escape');
    expect(options().length).toBe(0);
  });

  it('accepts a fully typed name, and says when nothing matches', () => {
    const { fixture, type, ctrl } = create();
    type('austria');
    expect(ctrl.value).toBe('AUSTRIA');
    type('narnia');
    expect(ctrl.value).toBe('');
    expect(fixture.nativeElement.querySelector('li.none').textContent).toContain('No country matches');
  });

  it('shows the label for a value set by the form, and clears with ×', () => {
    const { fixture, input, ctrl } = create();
    ctrl.setValue('UNITED STATES');
    fixture.detectChanges();
    expect(input.value).toBe('United States');
    (fixture.nativeElement.querySelector('.box__clear') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(ctrl.value).toBe('');
    expect(input.value).toBe('');
  });
});
