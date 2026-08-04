import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { PanZoomViewport, type ViewportApi } from './PanZoomViewport';

beforeEach(() => {
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 1000, height: 800, x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 800, toJSON: () => ({}),
  }));
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function setup(onBackgroundClick = vi.fn()) {
  const api = createRef<ViewportApi | null>() as React.MutableRefObject<ViewportApi | null>;
  render(
    <PanZoomViewport contentSize={{ width: 500, height: 400 }} onBackgroundClick={onBackgroundClick} viewportRef={api}>
      <div>content</div>
    </PanZoomViewport>,
  );
  return { api, onBackgroundClick, transform: () => screen.getByTestId('viewport-transform').style.transform };
}

function setupWithCard(onBackgroundClick = vi.fn()) {
  render(
    <PanZoomViewport contentSize={{ width: 500, height: 400 }} onBackgroundClick={onBackgroundClick}>
      <button className="person-card">card</button>
    </PanZoomViewport>,
  );
  return { onBackgroundClick, vp: screen.getByTestId('viewport'), card: screen.getByRole('button') };
}

// Flow arrangement's PrintTreeCanvas nodes are `g.person-node`, not `.person-card` —
// they need the same "started on the node" protection (Finding 1 fix).
function setupWithFlowNode(onBackgroundClick = vi.fn()) {
  render(
    <PanZoomViewport contentSize={{ width: 500, height: 400 }} onBackgroundClick={onBackgroundClick}>
      <button className="person-node">node</button>
    </PanZoomViewport>,
  );
  return { onBackgroundClick, node: screen.getByRole('button') };
}

describe('PanZoomViewport', () => {
  it('mounts fitted and centered (scale 1, centered translate)', () => {
    const { transform } = setup();
    expect(transform()).toBe('translate(250px, 200px) scale(1)');
  });

  it('drag pans the canvas', () => {
    const { transform } = setup();
    const vp = screen.getByTestId('viewport');
    fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(vp, { clientX: 160, clientY: 130, pointerId: 1 });
    fireEvent.pointerUp(vp, { clientX: 160, clientY: 130, pointerId: 1 });
    expect(transform()).toBe('translate(310px, 230px) scale(1)');
  });

  it('a clean background click (no drag) calls onBackgroundClick; a drag does not', () => {
    const { onBackgroundClick } = setup();
    const vp = screen.getByTestId('viewport');
    fireEvent.pointerDown(vp, { clientX: 5, clientY: 5, pointerId: 1, button: 0 });
    fireEvent.pointerUp(vp, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(vp, { clientX: 5, clientY: 5, pointerId: 1, button: 0 });
    fireEvent.pointerMove(vp, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(vp, { clientX: 50, clientY: 50, pointerId: 1 });
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it('a clean click that started on a card does not call onBackgroundClick, even when pointerup targets the card itself', () => {
    const { onBackgroundClick, card } = setupWithCard();
    fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 });
    fireEvent.pointerUp(card, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });

  it('a clean click that started on a card does not call onBackgroundClick, even when pointerup is (re)targeted at the container', () => {
    // With deferred capture, a no-move gesture never engages setPointerCapture, so this
    // isn't exercising real browser retargeting — it's proving the gesture remembers
    // where it STARTED (startedOnCard, captured at pointerdown) rather than trusting
    // e.target at pointerup time, which is what protects against the case where capture
    // *is* engaged (a real drag) and retargeting genuinely happens.
    const { onBackgroundClick, vp, card } = setupWithCard();
    fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 });
    fireEvent.pointerUp(vp, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });

  it('a clean click that started on a flow node (.person-node) does not call onBackgroundClick', () => {
    const { onBackgroundClick, node } = setupWithFlowNode();
    fireEvent.pointerDown(node, { clientX: 5, clientY: 5, pointerId: 1, button: 0 });
    fireEvent.pointerUp(node, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });

  it('a plain click (no movement past the drag threshold) never engages setPointerCapture', () => {
    // This pins the deferred-capture fix: capture must only be engaged once a real drag
    // is detected, otherwise the resulting click gets retargeted to the container and a
    // card's own onClick (expand/collapse) can never fire in a real browser. A regression
    // back to "capture on every pointerdown" would pass every other test in this file but
    // would call setPointerCapture here — that's exactly what this test catches.
    const { vp } = setupWithCard();
    fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerUp(vp, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(Element.prototype.setPointerCapture).not.toHaveBeenCalled();
  });

  it('a drag past the threshold engages capture exactly once and releases it exactly once on pointerup', () => {
    const { vp } = setupWithCard();
    fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(vp, { clientX: 160, clientY: 130, pointerId: 1 }); // hypot(60,30) > 5px threshold
    expect(Element.prototype.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(1);
    expect(Element.prototype.releasePointerCapture).not.toHaveBeenCalled();
    fireEvent.pointerUp(vp, { clientX: 160, clientY: 130, pointerId: 1 });
    expect(Element.prototype.setPointerCapture).toHaveBeenCalledTimes(1); // still just the once
    expect(Element.prototype.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(Element.prototype.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('wheel zooms and the api reports scalePct / zoomIn / zoomOut / fit', () => {
    const { api, transform } = setup();
    fireEvent.wheel(screen.getByTestId('viewport'), { deltaY: -100, clientX: 500, clientY: 400 });
    expect(api.current!.scalePct).toBe(110);
    api.current!.zoomOut();
    api.current!.fit();
    expect(transform()).toBe('translate(250px, 200px) scale(1)');
    api.current!.zoomIn();
    expect(api.current!.scalePct).toBe(110);
  });

  it('two-pointer pinch zooms anchored at the midpoint of the two touches', () => {
    const { transform } = setup();
    const vp = screen.getByTestId('viewport');
    fireEvent.pointerDown(vp, { clientX: 400, clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerDown(vp, { clientX: 600, clientY: 400, pointerId: 2, button: 0 });
    // distance 200 -> 400 (2x factor), anchored at midpoint (600, 400):
    // scale 1->2; x = 600 - (600-250)*2 = -100; y = 400 - (400-200)*2 = 0
    fireEvent.pointerMove(vp, { clientX: 800, clientY: 400, pointerId: 2 });
    expect(transform()).toBe('translate(-100px, 0px) scale(2)');
  });

  it('pinch suppresses background click and does not pan', () => {
    const { onBackgroundClick } = setup();
    const vp = screen.getByTestId('viewport');
    fireEvent.pointerDown(vp, { clientX: 400, clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerDown(vp, { clientX: 600, clientY: 400, pointerId: 2, button: 0 });
    fireEvent.pointerMove(vp, { clientX: 800, clientY: 400, pointerId: 2 });
    fireEvent.pointerUp(vp, { clientX: 800, clientY: 400, pointerId: 2 });
    fireEvent.pointerUp(vp, { clientX: 400, clientY: 400, pointerId: 1 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });

  it('pinch does not call onBackgroundClick even when it starts on a card', () => {
    const { onBackgroundClick, card } = setupWithCard();
    fireEvent.pointerDown(card, { clientX: 400, clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerDown(card, { clientX: 600, clientY: 400, pointerId: 2, button: 0 });
    fireEvent.pointerMove(card, { clientX: 800, clientY: 400, pointerId: 2 });
    fireEvent.pointerUp(card, { clientX: 800, clientY: 400, pointerId: 2 });
    fireEvent.pointerUp(card, { clientX: 400, clientY: 400, pointerId: 1 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });

  it('pointercancel clears the gesture and the pinch pointer map (next single-pointer drag behaves fresh)', () => {
    const { transform } = setup();
    const vp = screen.getByTestId('viewport');
    fireEvent.pointerDown(vp, { clientX: 400, clientY: 400, pointerId: 1, button: 0 });
    fireEvent.pointerDown(vp, { clientX: 600, clientY: 400, pointerId: 2, button: 0 });
    fireEvent.pointerCancel(vp, { pointerId: 2 });
    fireEvent.pointerCancel(vp, { pointerId: 1 });
    // a fresh single-pointer drag afterwards behaves normally (no leftover pinch state)
    fireEvent.pointerDown(vp, { clientX: 100, clientY: 100, pointerId: 3, button: 0 });
    fireEvent.pointerMove(vp, { clientX: 160, clientY: 130, pointerId: 3 });
    fireEvent.pointerUp(vp, { clientX: 160, clientY: 130, pointerId: 3 });
    expect(transform()).toBe('translate(310px, 230px) scale(1)');
  });

  it('calls onScaleChange whenever the scale changes, including on mount', () => {
    const onScaleChange = vi.fn();
    const api = createRef<ViewportApi | null>() as React.MutableRefObject<ViewportApi | null>;
    render(
      <PanZoomViewport
        contentSize={{ width: 500, height: 400 }}
        onBackgroundClick={vi.fn()}
        viewportRef={api}
        onScaleChange={onScaleChange}
      >
        <div>content</div>
      </PanZoomViewport>,
    );
    expect(onScaleChange).toHaveBeenCalledWith(100);
    onScaleChange.mockClear();

    fireEvent.wheel(screen.getByTestId('viewport'), { deltaY: -100, clientX: 500, clientY: 400 });
    expect(onScaleChange).toHaveBeenCalledWith(110);

    onScaleChange.mockClear();
    api.current!.zoomOut();
    expect(onScaleChange).toHaveBeenCalledWith(100);
  });
});
