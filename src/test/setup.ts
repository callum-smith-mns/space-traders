import '@testing-library/jest-dom/vitest';

// Stub CSS/image imports
vi.mock('../assets/ships/generic.png', () => ({ default: 'ship.png' }));

// Stub all faction logo imports
vi.mock('../assets/factions/aegis-collective.png', () => ({ default: 'aegis.png' }));
vi.mock('../assets/factions/ancient-guardians.png', () => ({ default: 'ancients.png' }));
vi.mock('../assets/factions/astro-salvage-alliance.png', () => ({ default: 'astro.png' }));
vi.mock('../assets/factions/cobalt-trading.png', () => ({ default: 'cobalt.png' }));
vi.mock('../assets/factions/corsairs.png', () => ({ default: 'corsairs.png' }));
vi.mock('../assets/factions/cosmic-engineers.png', () => ({ default: 'cosmic.png' }));
vi.mock('../assets/factions/dominion.png', () => ({ default: 'dominion.png' }));
vi.mock('../assets/factions/echo-of-the-void.png', () => ({ default: 'echo.png' }));
vi.mock('../assets/factions/ethereal-enclave.png', () => ({ default: 'ethereal.png' }));
vi.mock('../assets/factions/galactic-alliance.png', () => ({ default: 'galactic.png' }));
vi.mock('../assets/factions/lords-of-the-void.png', () => ({ default: 'lords.png' }));
vi.mock('../assets/factions/obsidian-order.png', () => ({ default: 'obsidian.png' }));
vi.mock('../assets/factions/omega-corp.png', () => ({ default: 'omega.png' }));
vi.mock('../assets/factions/quantum-federation.png', () => ({ default: 'quantum.png' }));
vi.mock('../assets/factions/shadow-syndicate.png', () => ({ default: 'shadow.png' }));
vi.mock('../assets/factions/solitary-wanderers.png', () => ({ default: 'solitary.png' }));
vi.mock('../assets/factions/united-colonies.png', () => ({ default: 'united.png' }));
vi.mock('../assets/factions/voidfarers.png', () => ({ default: 'voidfarers.png' }));

// Mock the Web Crypto API for tokenStorage tests
if (!globalThis.crypto?.subtle) {
  // Tests that need crypto will mock it specifically
}
