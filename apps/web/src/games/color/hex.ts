import { hsbToRgb, type Hsb } from '@nocap/games';

export const toHex = (c: Hsb): string =>
  '#' +
  hsbToRgb(c)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
