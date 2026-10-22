import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { KycPage } from './kyc-page';
import { KycView } from './kyc.service';

const base = `${environment.apiBaseUrl}/customer-portal/kyc`;
const view: KycView = {
  subjectName: 'Acme', status: 'PENDING', email: 'ops@acme.in', emailVerified: false, mobile: '9876543210', mobileVerified: true,
  requiredUploaded: 0, requiredTotal: 2, completedAt: null,
  documents: [
    { code: 'GST_CERTIFICATE', label: 'GST certificate', hint: 'GST registration', required: true, uploaded: null },
    { code: 'COMPANY_PAN', label: 'Company PAN card', hint: 'PAN', required: true, uploaded: null }
  ]
};

describe('KycPage', () => {
  let http: HttpTestingController;

  function create() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(KycPage);
    f.detectChanges();
    http.expectOne(base).flush({ success: true, data: view });
    f.detectChanges();
    return f;
  }

  it('lists the business documents and the verification steps with progress', () => {
    const f = create();
    const text = f.nativeElement.textContent as string;
    expect(text).toContain('GST certificate');
    expect(text).toContain('1 of 4 steps done');
    expect(text).toContain('KYC pending');
  });

  it('sends then verifies a code, and uploads a document as multipart', () => {
    const c = create().componentInstance;
    c.send('email');
    http.expectOne(`${base}/verify/email/send`).flush({ success: true, data: view });
    c.setCode('email', '12a3456');
    c.verify('email');
    const v = http.expectOne(`${base}/verify/email`);
    expect(v.request.body).toEqual({ code: '123456' });
    v.flush({ success: true, data: { ...view, emailVerified: true } });
    expect(c.view()!.emailVerified).toBe(true);

    c.pick(view.documents[0], { target: { files: [new File([new Uint8Array(4)], 'gst.pdf', { type: 'application/pdf' })], value: '' } } as unknown as Event);
    const up = http.expectOne(`${base}/documents`);
    expect((up.request.body as FormData).get('documentType')).toBe('GST_CERTIFICATE');
    up.flush({ success: true, data: view });
  });

  it('refuses a non-PDF/image file before uploading', () => {
    const c = create().componentInstance;
    c.pick(view.documents[0], { target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })], value: '' } } as unknown as Event);
    http.expectNone(`${base}/documents`);
  });
});
