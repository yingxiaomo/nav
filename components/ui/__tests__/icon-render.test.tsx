import React from 'react';
import { render, screen } from '@testing-library/react';
import { IconRender } from '../../nav/settings/shared';

describe('IconRender Component', () => {
  test('renders Lucide icon correctly (SVG with aria-hidden)', () => {
    const { container } = render(<IconRender name="Home" className="w-6 h-6" />);
    const svg = container.querySelector('svg.lucide');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  test('renders custom icon correctly', () => {
    const customIconUrl = 'https://example.com/icon.png';
    render(<IconRender name={customIconUrl} className="w-6 h-6" />);
    const imgElement = screen.getByRole('img');
    expect(imgElement).toBeInTheDocument();
    // Next.js Image rewrites src for optimization; check URL is encoded inside
    expect(imgElement).toHaveAttribute('src', expect.stringContaining(encodeURIComponent(customIconUrl)));
  });

  test('renders default LinkIcon SVG when name is empty', () => {
    const { container } = render(<IconRender name="" className="w-6 h-6" />);
    const svg = container.querySelector('svg.lucide');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass('lucide-link');
  });
});
