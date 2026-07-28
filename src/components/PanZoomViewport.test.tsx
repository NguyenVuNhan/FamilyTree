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

  it('a clean click that started on a card does not call onBackgroundClick, even when pointer capture retargets pointerup to the container', () => {
    // Real browsers retarget pointerup to the capturing element (the container) once
    // setPointerCapture has been engaged in pointerdown — closest('.person-card') on
    // e.target would find nothing at pointerup time. The gesture must remember where
    // it STARTED, before any retargeting happens.
    const { onBackgroundClick, vp, card } = setupWithCard();
    fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 });
    fireEvent.pointerUp(vp, { clientX: 5, clientY: 5, pointerId: 1 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
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
});
