import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { MindProgrammingStore } from './mind-programming.store';

@Injectable({ providedIn: 'root' })
export class ReminderEngineService {
  private readonly store = inject(MindProgrammingStore);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly announcedKeys = new Set<string>();

  constructor() {
    this.store.tick();

    const intervalId = window.setInterval(() => this.store.tick(), 30000);
    const syncClock = () => this.store.tick();

    window.addEventListener('focus', syncClock);
    this.document.addEventListener('visibilitychange', syncClock);

    this.destroyRef.onDestroy(() => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncClock);
      this.document.removeEventListener('visibilitychange', syncClock);
    });

    effect(() => {
      const dueOccurrences = this.store.dueOccurrences();
      const notificationsEnabled = this.store.settings().notificationsEnabled;

      if (
        !notificationsEnabled ||
        typeof Notification === 'undefined' ||
        Notification.permission !== 'granted'
      ) {
        return;
      }

      if (this.document.visibilityState === 'visible') {
        return;
      }

      for (const occurrence of dueOccurrences) {
        if (this.announcedKeys.has(occurrence.key)) {
          continue;
        }

        this.announcedKeys.add(occurrence.key);
        new Notification('Mind programming reminder', {
          body: `${occurrence.title} is due now for ${occurrence.defaultRepetitions} repetitions.`,
          tag: occurrence.key,
        });
      }
    });
  }
}
