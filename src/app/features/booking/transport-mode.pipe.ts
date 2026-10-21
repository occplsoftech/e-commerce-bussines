import { Pipe, PipeTransform } from '@angular/core';

/** SURFACE → Surface, AIR → Air. */
@Pipe({ name: 'titlecaseMode' })
export class TransportModePipe implements PipeTransform {
  transform(v: string | null): string {
    return v ? v.charAt(0) + v.slice(1).toLowerCase() : '';
  }
}
