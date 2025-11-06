import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders lottery system title', () => {
  render(<App />);
  const titleElement = screen.getByText(/去中心化彩票系统/i);
  expect(titleElement).toBeInTheDocument();
});