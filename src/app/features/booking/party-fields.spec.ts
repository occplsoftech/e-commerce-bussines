import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { PartyFields } from './party-fields';

describe('PartyFields pincode autofill', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  });
  afterEach(() => vi.useRealTimers());

  const info = (pincode: string, city: string, state: string) =>
    ({ pincode, known: true, area: null, city, district: city, state, serviceable: true, pickupAvailable: true, codAvailable: true, prepaidAvailable: true, odaApplicable: false });

  function setup() {
    const group = new FormGroup({
      name: new FormControl(''), phone: new FormControl(''), address: new FormControl(''),
      pincode: new FormControl(''), city: new FormControl(''), state: new FormControl('')
    });
    const fixture = TestBed.createComponent(PartyFields);
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('title', 'Pickup');
    fixture.componentRef.setInput('prefix', 'p');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const lookup = (pin: string, body: object) => {
      group.get('pincode')!.setValue(pin);
      vi.advanceTimersByTime(400);
      http.expectOne(`/api/v1/customer-portal/pincodes/${pin}`).flush({ data: body });
    };
    return { group, lookup };
  }

  it('fills the city and the state from the pincode', () => {
    const { group, lookup } = setup();
    lookup('413512', info('413512', 'Latur', 'Maharashtra'));
    expect(group.value.city).toBe('Latur');
    expect(group.value.state).toBe('Maharashtra');
  });

  it('replaces a value it filled itself when the pincode changes', () => {
    const { group, lookup } = setup();
    lookup('411016', info('411016', 'Pune City', 'Maharashtra'));
    lookup('110001', info('110001', 'New Delhi', 'Delhi'));
    expect(group.value.city).toBe('New Delhi');
    expect(group.value.state).toBe('Delhi');
  });

  it('keeps what the person typed', () => {
    const { group, lookup } = setup();
    lookup('411016', info('411016', 'Pune City', 'Maharashtra'));
    group.get('city')!.setValue('Pimpri');
    lookup('110001', info('110001', 'New Delhi', 'Delhi'));
    expect(group.value.city).toBe('Pimpri');
    expect(group.value.state).toBe('Delhi');
  });
});
