import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

const nam = { id: 'n', fullName: 'Nam Trần', gender: 'male' as const };
const lan = { id: 'l', fullName: 'Lan Trần', gender: 'female' as const };
const anon = { id: 'x', fullName: 'Xa Trần' }; // no gender

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

describe('illustrated placeholders', () => {
  it('renders a gendered silhouette when illustrated + gender present', () => {
    render(<Avatar person={nam} size={64} placeholderStyle="illustrated" />);
    const svg = screen.getByTestId('silhouette');
    expect(svg).toHaveAttribute('data-gender', 'male');
    expect(screen.getByRole('img', { name: 'Nam Trần' })).toBeInTheDocument();
    expect(screen.queryByText('NT')).not.toBeInTheDocument();
  });

  it('female silhouette differs from male', () => {
    render(<Avatar person={lan} size={64} placeholderStyle="illustrated" />);
    expect(screen.getByTestId('silhouette')).toHaveAttribute('data-gender', 'female');
  });

  it('falls back to initials when gender is unspecified, even in illustrated mode', () => {
    render(<Avatar person={anon} size={64} placeholderStyle="illustrated" />);
    expect(screen.queryByTestId('silhouette')).not.toBeInTheDocument();
    expect(screen.getByText('XT')).toBeInTheDocument();
  });

  it('initials mode never shows a silhouette', () => {
    render(<Avatar person={nam} size={64} placeholderStyle="initials" />);
    expect(screen.queryByTestId('silhouette')).not.toBeInTheDocument();
  });

  it('square shape drops the rounded-full class on the image path', () => {
    render(<Avatar person={{ id: 'a', fullName: 'Ann', imageSrc: 'https://x.test/a.jpg' }} size={64} shape="square" />);
    expect(screen.getByRole('img', { name: 'Ann' })).not.toHaveClass('rounded-full');
  });
});
