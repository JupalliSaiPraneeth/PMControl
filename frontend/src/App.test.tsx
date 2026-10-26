import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from './App.js';

describe('OmniControl Frontend Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders login page when no authenticated user is present', () => {
    render(<App />);
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByText('OmniControl')).toBeInTheDocument();
  });

  it('allows logging in with developer demo account and renders Overview telemetry', async () => {
    render(<App />);

    const demoBtn = screen.getByText('Instant Developer Demo Account');
    fireEvent.click(demoBtn);

    expect(await screen.findByText('System Overview')).toBeInTheDocument();
    expect(screen.getByText('Enrolled Devices')).toBeInTheDocument();
    expect(screen.getByText('Consent Guard')).toBeInTheDocument();
  });

  it('navigates to Devices management page', async () => {
    render(<App />);

    // Log in
    const demoBtn = screen.getByText('Instant Developer Demo Account');
    fireEvent.click(demoBtn);

    // Click Devices nav
    const devicesNav = await screen.findByText('Devices');
    fireEvent.click(devicesNav);

    expect(await screen.findByText('Device Management')).toBeInTheDocument();
  });
});
