import { Pipe, PipeTransform } from '@angular/core';

/** How a payment mode reads on screen: Prepaid (from the wallet), To Pay (receiver pays the freight) or Cash on delivery. */
@Pipe({ name: 'paymentLabel' })
export class PaymentLabelPipe implements PipeTransform {
  transform(mode: string | null | undefined): string {
    return mode === 'COD' ? 'Cash on delivery' : mode === 'TOPAY' ? 'To Pay' : 'Prepaid';
  }
}

@Pipe({ name: 'paymentIcon' })
export class PaymentIconPipe implements PipeTransform {
  transform(mode: string | null | undefined): string {
    return mode === 'COD' ? 'payments' : mode === 'TOPAY' ? 'sell' : 'account_balance_wallet';
  }
}
