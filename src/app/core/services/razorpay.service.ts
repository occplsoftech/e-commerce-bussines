import { Injectable } from '@angular/core';

/** What Razorpay Checkout hands back to the success handler. */
export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/** The server-issued order Checkout opens for. Nothing here is chosen by the browser. */
export interface CheckoutOrder {
  publicKey: string;
  amountMinor: number;
  currency: string;
  orderId: string;
  walletNumber: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  theme?: { color?: string };
  handler: (r: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}
interface RazorpayInstance { open(): void; on(event: string, cb: (e: unknown) => void): void; }
type RazorpayCtor = new (opts: RazorpayOptions) => RazorpayInstance;

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Rejection value when the customer closes Checkout without paying. */
export const CHECKOUT_DISMISSED = 'DISMISSED';

/**
 * Thin wrapper over Razorpay Checkout, same contract as courier-web's. The script is loaded on first use (never at start-up, never
 * bundled), so the portal does not depend on Razorpay being reachable until a customer actually pays. {@link checkout} resolves with the
 * signed payload for the server to verify; the server, not this payload, decides what is credited.
 */
@Injectable({ providedIn: 'root' })
export class RazorpayService {
  private loading?: Promise<void>;

  get ready(): boolean { return typeof (window as unknown as { Razorpay?: unknown }).Razorpay === 'function'; }

  checkout(order: CheckoutOrder, appName: string): Promise<RazorpaySuccess> {
    return this.load().then(() => new Promise<RazorpaySuccess>((resolve, reject) => {
      const Ctor = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (!Ctor) { reject(new Error('Razorpay checkout is unavailable.')); return; }
      const rzp = new Ctor({
        key: order.publicKey,
        amount: order.amountMinor,
        currency: order.currency,
        name: appName,
        description: `Wallet recharge — ${order.walletNumber}`,
        order_id: order.orderId,
        theme: { color: '#e11d48' },
        handler: (r) => resolve(r),
        modal: { ondismiss: () => reject(new Error(CHECKOUT_DISMISSED)) }
      });
      rzp.on('payment.failed', (e: unknown) => reject(e instanceof Error ? e : new Error(failureText(e))));
      rzp.open();
    }));
  }

  private load(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = CHECKOUT_SRC;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => { this.loading = undefined; reject(new Error('Could not load the payment window. Check your connection and try again.')); };
      document.head.appendChild(el);
    });
    return this.loading;
  }
}

function failureText(e: unknown): string {
  const description = (e as { error?: { description?: unknown } } | null)?.error?.description;
  return typeof description === 'string' && description ? description : 'The payment failed.';
}
