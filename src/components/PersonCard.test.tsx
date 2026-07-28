import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PersonCard } from './PersonCard';

const ann = { id: 'a', fullName: 'Ann Lee', imageSrc: 'https://x.test/a.jpg' };
const base = { person: ann, x: 0, y: 0, onToggle: () => {} };

describe('PersonCard', () => {
  it('photo mode collapsed: avatar only, no visible name text', () => {
    render(<PersonCard {...base} mode="photo" expanded={false} />);
    expect(screen.getByRole('img', { name: 'Ann Lee' })).toBeInTheDocument();
    expect(screen.queryByText('Ann Lee')).not.toBeInTheDocument();
  });

  it('name mode collapsed: name only, no avatar', () => {
    render(<PersonCard {...base} mode="name" expanded={false} />);
    expect(screen.getByText('Ann Lee')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Ann Lee' })).not.toBeInTheDocument();
  });

  it('expanded shows BOTH avatar and name in either mode', () => {
    for (const mode of ['photo', 'name'] as const) {
      const { unmount } = render(<PersonCard {...base} mode={mode} expanded={true} />);
      expect(screen.getByRole('img', { name: 'Ann Lee' })).toBeInTheDocument();
      expect(screen.getByText('Ann Lee')).toBeInTheDocument();
      unmount();
    }
  });

  it('click and keyboard Enter both call onToggle with the id', async () => {
    const onToggle = vi.fn();
    render(<PersonCard {...base} onToggle={onToggle} mode="photo" expanded={false} />);
    await userEvent.click(screen.getByRole('button'));
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenCalledWith('a');
  });

  it('marks expansion state via data attribute for e2e/css', () => {
    render(<PersonCard {...base} mode="photo" expanded={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-expanded', 'true');
  });
});
