export const TITLE_BLOCK_MM = 26;

export type FitResult =
  | { ok: true }
  | { ok: false; requiredWmm: number; requiredHmm: number; message: string };

/** Text never shrinks to fit — the format must grow instead. */
export function checkFit(
  contentWmm: number, contentHmm: number,
  size: { wMm: number; hMm: number }, marginMm: number,
): FitResult {
  const requiredWmm = contentWmm + 2 * marginMm;
  const requiredHmm = contentHmm + 2 * marginMm;
  if (requiredWmm <= size.wMm && requiredHmm <= size.hMm) return { ok: true };
  const cm = (mm: number) => Math.ceil(mm / 10);
  return {
    ok: false, requiredWmm, requiredHmm,
    message: `This tree needs at least ${cm(requiredWmm)}×${cm(requiredHmm)} cm at this text size — choose a larger format or custom size.`,
  };
}
