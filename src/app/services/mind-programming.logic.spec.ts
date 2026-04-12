import { describe, expect, it } from 'vitest';
import { AppSettings } from '../models/mind-programming.models';
import {
  buildDashboardStats,
  evaluateStatementAttempt,
  parseImportedAppData,
  recordCompletedSession,
} from './mind-programming.logic';

describe('evaluateStatementAttempt', () => {
  it('accepts a small typo on a longer statement', () => {
    const result = evaluateStatementAttempt(
      'I move through the day with focused calm',
      'I move through the day with focised calm',
    );

    expect(result.accepted).toBe(true);
  });

  it('rejects a substantially different attempt', () => {
    const result = evaluateStatementAttempt(
      'I move through the day with focused calm',
      'I stop thinking about this statement entirely',
    );

    expect(result.accepted).toBe(false);
  });

  it('keeps very short statements strict', () => {
    const result = evaluateStatementAttempt('I am', 'I an');

    expect(result.accepted).toBe(false);
  });
});

describe('buildDashboardStats', () => {
  const settings: AppSettings = {
    notificationsEnabled: false,
    completedSessions: 3,
    repetitionsWritten: 36,
    currentStreak: 3,
    lastCompletedOn: '2026-04-13',
    completedScheduleKeys: [],
  };

  it('returns aggregate stats from lightweight stored values', () => {
    const result = buildDashboardStats([], 2, settings, new Date('2026-04-13T12:00:00'));

    expect(result.currentStreak).toBe(3);
    expect(result.completedSessions).toBe(3);
    expect(result.repetitionsWritten).toBe(36);
    expect(result.dueNowCount).toBe(2);
  });

  it('shows a zero streak when the last completion is older than yesterday', () => {
    const result = buildDashboardStats(
      [],
      0,
      { ...settings, lastCompletedOn: '2026-04-11' },
      new Date('2026-04-13T12:00:00'),
    );

    expect(result.currentStreak).toBe(0);
  });
});

describe('recordCompletedSession', () => {
  const settings: AppSettings = {
    notificationsEnabled: false,
    completedSessions: 4,
    repetitionsWritten: 48,
    currentStreak: 2,
    lastCompletedOn: '2026-04-12',
    completedScheduleKeys: [],
  };

  it('increments aggregate stats and carries the streak forward', () => {
    const result = recordCompletedSession(
      settings,
      12,
      new Date('2026-04-13T08:00:00'),
      'statement-1::2026-04-13::07:30',
    );

    expect(result.completedSessions).toBe(5);
    expect(result.repetitionsWritten).toBe(60);
    expect(result.currentStreak).toBe(3);
    expect(result.lastCompletedOn).toBe('2026-04-13');
    expect(result.completedScheduleKeys).toContain('statement-1::2026-04-13::07:30');
  });
});

describe('parseImportedAppData', () => {
  it('migrates legacy session history into lightweight aggregate stats', () => {
    const result = parseImportedAppData(
      {
        categories: [
          {
            id: 'category-1',
            name: 'Core',
            description: '',
            createdAt: '2026-04-10T08:00:00.000Z',
          },
        ],
        statements: [
          {
            id: 'statement-1',
            categoryId: 'category-1',
            title: 'Focused calm',
            text: 'I move through the day with focused calm',
            defaultRepetitions: 12,
            schedule: {
              enabled: true,
              days: [1, 2, 3, 4, 5],
              times: ['07:30'],
            },
            createdAt: '2026-04-10T08:00:00.000Z',
            updatedAt: '2026-04-10T08:00:00.000Z',
          },
        ],
        sessions: [
          {
            id: 'session-1',
            statementId: 'statement-1',
            statementTitle: 'Focused calm',
            categoryId: 'category-1',
            mode: 'scheduled',
            repetitions: 12,
            startedAt: '2026-04-13T07:00:00.000Z',
            completedAt: '2026-04-13T07:05:00.000Z',
            durationSeconds: 300,
            matchedScheduleKey: 'statement-1::2026-04-13::07:30',
          },
          {
            id: 'session-2',
            statementId: 'statement-1',
            statementTitle: 'Focused calm',
            categoryId: 'category-1',
            mode: 'manual',
            repetitions: 12,
            startedAt: '2026-04-12T07:00:00.000Z',
            completedAt: '2026-04-12T07:05:00.000Z',
            durationSeconds: 300,
          },
        ],
        settings: {
          notificationsEnabled: true,
          lastCompletedOn: '2026-04-13',
        },
      },
      new Date('2026-04-13T12:00:00'),
    );

    expect(result.success).toBe(true);
    expect(result.data?.settings.completedSessions).toBe(2);
    expect(result.data?.settings.repetitionsWritten).toBe(24);
    expect(result.data?.settings.currentStreak).toBe(2);
    expect(result.data?.settings.completedScheduleKeys).toContain('statement-1::2026-04-13::07:30');
  });
});
