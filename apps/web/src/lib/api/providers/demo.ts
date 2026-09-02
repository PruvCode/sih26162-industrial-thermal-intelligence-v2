/**
 * DEMO PROVIDER.
 *
 * Serves the seeded dataset through the same contract the live backend will
 * implement. The seeded data and every derived view already existed in
 * `src/data/`; this file does not reimplement any of it, it only adapts it.
 */

import { getDataset } from '@/data/dataset';
import {
  applyExplorerFilters,
  buildIntelligenceReport,
  getAnalyticsView,
  getEventDetail,
  getPersistentSources,
  getRegionalDensity,
  getWatchtowerDigest,
} from '@/data/derive';
import type { DataProvider } from '../provider';

export const demoProvider: DataProvider = {
  source: 'demo',

  async listEvents(filters = {}) {
    return applyExplorerFilters(getDataset().events, filters);
  },

  async getEvent(eventId) {
    return getEventDetail(eventId);
  },

  async getEvidence(eventId) {
    return getEventDetail(eventId)?.evidence ?? null;
  },

  async getHistory(eventId) {
    return getEventDetail(eventId)?.history ?? [];
  },

  async getAnalytics() {
    return getAnalyticsView();
  },

  async getPersistentSources(limit = 12) {
    return getPersistentSources(limit);
  },

  async getWatchtower() {
    return getWatchtowerDigest();
  },

  async getDensity() {
    return getRegionalDensity();
  },

  async getReport(eventId) {
    return buildIntelligenceReport(eventId);
  },
};
