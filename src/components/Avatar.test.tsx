import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('renders an img when imageSrc is set', () => {
    render(<Avatar person={{ id: 'a', fullName: 'Ann Lee', imageSrc: 'https://x.test/a.jpg' }} size={52} />);
    expect(screen.getByRole('img', { name: 'Ann Lee' })).toHaveAttribute('src', 'https://x.test/a.jpg');
  });

  it('renders initials when no image', () => {
    render(<Avatar person={{ id: 'a', fullName: 'Ann Lee' }} size={52} />);
    expect(screen.getByRole('img', { name: 'Ann Lee' })).toHaveTextContent('AL');
  });

  it('falls back to initials when the image errors', () => {
    render(<Avatar person={{ id: 'a', fullName: 'Ann Lee', imageSrc: 'https://x.test/broken.jpg' }} size={52} />);
    fireEvent.error(screen.getByRole('img', { name: 'Ann Lee' }));
    expect(screen.getByRole('img', { name: 'Ann Lee' })).toHaveTextContent('AL');
  });

  it('resets broken state when imageSrc changes', () => {
    const { rerender } = render(<Avatar person={{ id: 'a', fullName: 'Ann Lee', imageSrc: 'https://x.test/broken.jpg' }} size={52} />);
    fireEvent.error(screen.getByRole('img', { name: 'Ann Lee' }));
    expect(screen.getByRole('img', { name: 'Ann Lee' })).toHaveTextContent('AL');
    rerender(<Avatar person={{ id: 'b', fullName: 'Bob Smith', imageSrc: 'https://x.test/valid.jpg' }} size={52} />);
    expect(screen.getByRole('img', { name: 'Bob Smith' })).toHaveAttribute('src', 'https://x.test/valid.jpg');
  });
});
