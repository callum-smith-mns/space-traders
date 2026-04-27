import factionLogos from '../utils/factionLogos';

describe('factionLogos', () => {
  const EXPECTED_FACTIONS = [
    'COSMIC', 'VOID', 'GALACTIC', 'QUANTUM', 'DOMINION',
    'ASTRO', 'CORSAIRS', 'OBSIDIAN', 'AEGIS', 'UNITED',
    'SOLITARY', 'COBALT', 'OMEGA', 'ECHO', 'LORDS',
    'CULT', 'ANCIENTS', 'SHADOW', 'ETHEREAL',
  ];

  it('exports a Record with all 19 faction symbols', () => {
    expect(Object.keys(factionLogos)).toHaveLength(19);
  });

  it.each(EXPECTED_FACTIONS)('contains %s faction logo', (faction) => {
    expect(factionLogos[faction]).toBeDefined();
    expect(typeof factionLogos[faction]).toBe('string');
  });

  it('returns undefined for unknown factions', () => {
    expect(factionLogos['UNKNOWN']).toBeUndefined();
  });
});
