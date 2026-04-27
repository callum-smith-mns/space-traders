import type { Survey } from '../services/api';
import * as surveyCache from '../utils/surveyCache';

function makeSurvey(signature: string, expiration: string, waypoint = 'WP-1'): Survey {
  return {
    signature,
    symbol: waypoint,
    deposits: [{ symbol: 'IRON_ORE' }],
    expiration,
    size: 'MODERATE',
  };
}

const FUTURE = new Date(Date.now() + 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

describe('surveyCache', () => {
  beforeEach(() => {
    // Clear cache state between tests by setting empty for known waypoints
    surveyCache.setSurveys('WP-1', []);
    surveyCache.setSurveys('WP-2', []);
  });

  describe('getSurveys', () => {
    it('returns empty array for unknown waypoint', () => {
      expect(surveyCache.getSurveys('UNKNOWN')).toEqual([]);
    });

    it('returns stored surveys', () => {
      const s = makeSurvey('sig-1', FUTURE);
      surveyCache.setSurveys('WP-1', [s]);
      expect(surveyCache.getSurveys('WP-1')).toEqual([s]);
    });

    it('prunes expired surveys on get', () => {
      const active = makeSurvey('active', FUTURE);
      const expired = makeSurvey('expired', PAST);
      surveyCache.setSurveys('WP-1', [active, expired]);
      const result = surveyCache.getSurveys('WP-1');
      expect(result).toEqual([active]);
    });

    it('deletes cache entry when all surveys expired', () => {
      const expired = makeSurvey('expired', PAST);
      surveyCache.setSurveys('WP-1', [expired]);
      // Force the expired one into cache by manipulating timings
      // getSurveys should prune it and return empty
      expect(surveyCache.getSurveys('WP-1')).toEqual([]);
    });
  });

  describe('setSurveys', () => {
    it('stores active surveys', () => {
      const s = makeSurvey('sig-1', FUTURE);
      surveyCache.setSurveys('WP-1', [s]);
      expect(surveyCache.getSurveys('WP-1')).toEqual([s]);
    });

    it('filters out expired surveys before storing', () => {
      const active = makeSurvey('active', FUTURE);
      const expired = makeSurvey('expired', PAST);
      surveyCache.setSurveys('WP-1', [active, expired]);
      expect(surveyCache.getSurveys('WP-1')).toEqual([active]);
    });

    it('deletes entry when setting empty array', () => {
      surveyCache.setSurveys('WP-1', [makeSurvey('s', FUTURE)]);
      surveyCache.setSurveys('WP-1', []);
      expect(surveyCache.getSurveys('WP-1')).toEqual([]);
    });
  });

  describe('addSurveys', () => {
    it('adds new surveys to existing cache', () => {
      const s1 = makeSurvey('sig-1', FUTURE);
      const s2 = makeSurvey('sig-2', FUTURE);
      surveyCache.setSurveys('WP-1', [s1]);
      const result = surveyCache.addSurveys('WP-1', [s2]);
      expect(result).toEqual([s1, s2]);
    });

    it('adds to empty cache', () => {
      const s = makeSurvey('sig-1', FUTURE);
      const result = surveyCache.addSurveys('WP-1', [s]);
      expect(result).toEqual([s]);
    });

    it('prunes expired surveys during add', () => {
      const existing = makeSurvey('existing', PAST);
      const fresh = makeSurvey('fresh', FUTURE);
      surveyCache.setSurveys('WP-1', [existing]);
      // existing was stored but is expired by now; addSurveys prunes it
      const result = surveyCache.addSurveys('WP-1', [fresh]);
      expect(result).toEqual([fresh]);
    });
  });

  describe('removeSurvey', () => {
    it('removes a survey by signature', () => {
      const s1 = makeSurvey('sig-1', FUTURE);
      const s2 = makeSurvey('sig-2', FUTURE);
      surveyCache.setSurveys('WP-1', [s1, s2]);
      const remaining = surveyCache.removeSurvey('WP-1', 'sig-1');
      expect(remaining).toEqual([s2]);
    });

    it('returns empty array when removing last survey', () => {
      const s = makeSurvey('sig-1', FUTURE);
      surveyCache.setSurveys('WP-1', [s]);
      const remaining = surveyCache.removeSurvey('WP-1', 'sig-1');
      expect(remaining).toEqual([]);
    });

    it('handles removing non-existent signature', () => {
      const s = makeSurvey('sig-1', FUTURE);
      surveyCache.setSurveys('WP-1', [s]);
      const remaining = surveyCache.removeSurvey('WP-1', 'no-such-sig');
      expect(remaining).toEqual([s]);
    });
  });

  describe('isolation between waypoints', () => {
    it('stores surveys per waypoint independently', () => {
      const s1 = makeSurvey('wp1-sig', FUTURE, 'WP-1');
      const s2 = makeSurvey('wp2-sig', FUTURE, 'WP-2');
      surveyCache.setSurveys('WP-1', [s1]);
      surveyCache.setSurveys('WP-2', [s2]);
      expect(surveyCache.getSurveys('WP-1')).toEqual([s1]);
      expect(surveyCache.getSurveys('WP-2')).toEqual([s2]);
    });
  });
});
