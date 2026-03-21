import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

function Probe() {
  const { preference, resolvedDark } = useTheme();
  return (
    <span data-testid="probe">
      {preference}:{resolvedDark ? 'dark' : 'light'}
    </span>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.removeItem('gnv-theme');
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('applique la classe dark sur html quand préférence = dark', async () => {
    localStorage.setItem('gnv-theme', 'dark');
    render(
      <LanguageProvider>
        <ThemeProvider>
          <Probe />
        </ThemeProvider>
      </LanguageProvider>
    );
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('ThemeToggle : un clic fait avancer le cycle de thème', () => {
    localStorage.setItem('gnv-theme', 'light');
    render(
      <LanguageProvider>
        <ThemeProvider>
          <ThemeToggle variant="light" />
          <Probe />
        </ThemeProvider>
      </LanguageProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('light:light');
    fireEvent.click(screen.getByRole('button', { name: /thème|theme/i }));
    expect(screen.getByTestId('probe').textContent).toMatch(/^dark:dark$/);
  });
});
