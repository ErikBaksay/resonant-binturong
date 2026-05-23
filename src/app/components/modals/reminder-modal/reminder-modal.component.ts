import { Component, input, output } from '@angular/core';
import { DueOccurrence } from '../../../models/mind-programming.models';

@Component({
  selector: 'app-reminder-modal',
  templateUrl: './reminder-modal.component.html',
  styleUrl: './reminder-modal.component.scss',
})
export class ReminderModalComponent {
  readonly reminder = input.required<DueOccurrence>();
  readonly formatRelativeReminder = input.required<(reminder: DueOccurrence) => string>();

  readonly start = output<DueOccurrence>();
}
