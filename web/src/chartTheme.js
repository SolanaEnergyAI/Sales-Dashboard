// Theme-aware colours for the recharts components.
export function chartColors(dark) {
  return dark
    ? { grid: '#2a2f3d', axis: '#8b93a6', tipBg: '#1b1e27', tipBorder: '#2a2e3a', tipText: '#e9ebf5' }
    : { grid: '#eeefe9', axis: '#9b9c95', tipBg: '#ffffff', tipBorder: '#e7e6df', tipText: '#1e1e2b' };
}
