// FDI / ISO 3950 tooth notation (D-013).
// Permanent teeth: 11-18, 21-28, 31-38, 41-48.

export function isValidFdiTooth(n: number): boolean {
  const quadrant = Math.floor(n / 10);
  const position = n % 10;
  return quadrant >= 1 && quadrant <= 4 && position >= 1 && position <= 8;
}

export function validateFdiTeeth(teeth: number[]): boolean {
  return teeth.every(isValidFdiTooth);
}
