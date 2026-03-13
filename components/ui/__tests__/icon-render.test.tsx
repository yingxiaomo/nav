import React from 'react';
import { render, screen } from '@testing-library/react';
import { IconRender } from '../../nav/settings/shared';

describe('IconRender Component', () => {
  test('renders Lucide icon correctly', () => {
    render(<IconRender name="Home" className="w-6 h-6" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  test('renders custom icon correctly', () => {
    const customIconUrl = 'https://example.com/icon.png';
    render(<IconRender name={customIconUrl} className="w-6 h-6" />);
    const imgElement = screen.getByRole('img');
    expect(imgElement).toBeInTheDocument();
    expect(imgElement).toHaveAttribute('src', customIconUrl);
  });

  test('renders default icon when name is not provided', () => {
    render(<IconRender name="" className="w-6 h-6" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });
});