import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonCard } from './PersonCard';
import { DEFAULT_SETTINGS, type LayoutSettings } from '../settings/settings';

const ann = { id: 'a', fullName: 'Ann Lee', imageSrc: 'https://x.test/a.jpg' };
const s = (over: Partial<LayoutSettings> = {}): LayoutSettings => ({ ...DEFAULT_SETTINGS, ...over });
const base = { person: ann, x: 0, y: 0, onToggle: () => {} };

describe('PersonCard content modes (classic)', () => {
  it('avatar mode collapsed: avatar only, no visible name text', () => {
    render(<PersonCard {...base} settings={s({ contentMode: 'avatar' })} expanded={false} />);
    expect(screen.getByRole('img', { name: 'Ann Lee' })).toBeInTheDocument();
    expect(screen.queryByText('Ann Lee')).not.toBeInTheDocument();
  });

  it('name mode collapsed: name only, no avatar', () => {
    render(<PersonCard {...base} settings={s({ contentMode: 'name' })} expanded={false} />);
    expect(screen.getByText('Ann Lee')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Ann Lee' })).not.toBeInTheDocument();
  });

  it('full mode collapsed: avatar AND name', () => {
    render(<PersonCard {...base} settings={s({ contentMode: 'full' })} expanded={false} />);
    expect(document.querySelector('img, .avatar-fallback, [data-testid="silhouette"]')).not.toBeNull();
    expect(screen.getByText('Ann Lee')).toBeInTheDocument();
  });

  it('expanded shows BOTH regardless of content mode', () => {
    for (const contentMode of ['full', 'name', 'avatar'] as const) {
      const { unmount } = render(<PersonCard {...base} settings={s({ contentMode })} expanded={true} />);
      expect(document.querySelector('img, .avatar-fallback, [data-testid="silhouette"]')).not.toBeNull();
      expect(screen.getByText('Ann Lee')).toBeInTheDocument();
      unmount();
    }
  });

  it('full mode: button accessible name is the bare full name (avatar decorative)', () => {
    render(<PersonCard {...base} settings={s({ contentMode: 'full' })} expanded={false} />);
    expect(screen.getByRole('button', { name: 'Ann Lee' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull(); // decorative → out of the a11y tree
    expect(document.querySelector('img, .avatar-fallback, [data-testid="silhouette"]')).not.toBeNull(); // still drawn
  });

  it('avatar mode: avatar keeps its accessible label (it IS the name)', () => {
    render(<PersonCard {...base} settings={s({ contentMode: 'avatar' })} expanded={false} />);
    expect(screen.getByRole('img', { name: 'Ann Lee' })).toBeInTheDocument();
  });
});

describe('card styles', () => {
  it.each([['classic'], ['circle'], ['photoLeft'], ['archCard']] as const)(
    '%s style sets its style- class',
    (cardStyle) => {
      render(<PersonCard {...base} settings={s({ cardStyle, contentMode: 'full' })} expanded={false} />);
      expect(screen.getByRole('button')).toHaveClass(`style-${cardStyle}`);
    },
  );

  it('name-only mode renders as classic for every style (matrix fallback)', () => {
    render(<PersonCard {...base} settings={s({ cardStyle: 'circle', contentMode: 'name' })} expanded={false} />);
    expect(screen.getByRole('button')).toHaveClass('style-classic');
  });

  it('namePosition top puts the name before the avatar in DOM order', () => {
    render(<PersonCard {...base} settings={s({ contentMode: 'full', namePosition: 'top' })} expanded={false} />);
    const children = [...screen.getByRole('button').children];
    expect(children.findIndex((el) => el.textContent === 'Ann Lee'))
      .toBeLessThan(children.findIndex((el) => el.tagName === 'IMG'));
  });

  it('photoLeft ignores namePosition (photo stays first)', () => {
    render(<PersonCard {...base} settings={s({ cardStyle: 'photoLeft', contentMode: 'full', namePosition: 'top' })} expanded={false} />);
    const children = [...screen.getByRole('button').children];
    expect(children.findIndex((el) => el.tagName === 'IMG'))
      .toBeLessThan(children.findIndex((el) => el.textContent === 'Ann Lee'));
  });

  it('name text carries a title tooltip for long names', () => {
    render(<PersonCard {...base} settings={s({ contentMode: 'name' })} expanded={false} />);
    expect(screen.getByText('Ann Lee')).toHaveAttribute('title', 'Ann Lee');
  });
});

describe('interaction contract (unchanged from before)', () => {
  it('click and keyboard Enter both call onToggle with the id', async () => {
    const onToggle = vi.fn();
    render(<PersonCard {...base} onToggle={onToggle} settings={s()} expanded={false} />);
    await userEvent.click(screen.getByRole('button'));
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('keeps data-person-id, data-expanded, and expanded class', () => {
    const { rerender } = render(<PersonCard {...base} settings={s()} expanded={false} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('data-person-id', 'a');
    expect(button).toHaveAttribute('data-expanded', 'false');
    expect(button).toHaveClass('person-card');
    rerender(<PersonCard {...base} settings={s()} expanded={true} />);
    expect(screen.getByRole('button')).toHaveClass('person-card', 'expanded');
  });
});
