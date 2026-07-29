import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom does not implement the Pointer Capture API; PanZoomViewport calls
// setPointerCapture/releasePointerCapture on every pointerdown/up, which would
// otherwise throw "not a function" whenever a test drives real pointer events
// (e.g. via userEvent.click) without its own local mock.
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

afterEach(() => {
  cleanup();
});
