import { Component, input, output } from '@angular/core';
import { DashboardStats, DueOccurrence } from '../../models/mind-programming.models';

@Component({
  selector: 'app-stats-view',
  templateUrl: './stats-view.component.html',
  styleUrl: './stats-view.component.scss',
})
export class StatsViewComponent {
  readonly stats = input.required<DashboardStats>();
  readonly categoriesCount = input.required<number>();
  readonly dueOccurrences = input.required<DueOccurrence[]>();
  readonly notificationCopy = input.required<string>();
  readonly notificationStatus = input.required<NotificationPermission | 'unsupported'>();
  readonly notificationsEnabled = input.required<boolean>();
  readonly formatCompletedDate = input.required<(value: string | null) => string>();
  readonly formatRelativeReminder = input.required<(reminder: DueOccurrence) => string>();

  readonly exportData = output<void>();
  readonly enableNotifications = output<void>();
  readonly importData = output<Event>();
}
