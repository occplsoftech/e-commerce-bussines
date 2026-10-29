import { code128B } from './code128';

/** The bars as ones (dark) and zeros (light), one per module, to compare with a known-good encoder's output. */
function modules(text: string): string {
  const { bars, width } = code128B(text);
  const out = Array<string>(width).fill('0');
  bars.forEach((b) => out.fill('1', b.x, b.x + b.w));
  return out.join('');
}

describe('code128B', () => {
  // expected strings produced by the JsBarcode library (CODE128B)
  const known: [string, string][] = [
  ["PU-20261029-0001", '1101001000011101110110110111011101001101110011001110010100111011001100111001011001110100100111001101001110110011001110010111001011001001101110010011101100100111011001001110110010011100110100001100101100011101011'],
  ["Hello 128!", '1101001000011000101000101100100001100101000011001010000100011110101101100110010011100110110011100101110100110011001101100110001011101100011101011'],
  ["~ A~", '1101001000010001011110110110011001010001100010001011110111010001101100011101011']
  ];

  it.each(known)('encodes %s exactly as the reference encoder does', (text, expected) => {
    expect(modules(text)).toBe(expected);
  });

  it('starts with the Start B symbol and ends with the stop pattern', () => {
    const m = modules('A');
    expect(m.startsWith('11010010000')).toBe(true);
    expect(m.endsWith('1100011101011')).toBe(true);
  });
});
