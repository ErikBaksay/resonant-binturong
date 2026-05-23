import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface PrivateSessionState {
  text: string;
  targetRepetitions: number;
  completedRepetitions: number;
  currentEntry: string;
}

@Component({
  selector: 'app-private-session-modal',
  imports: [FormsModule],
  templateUrl: './private-session-modal.component.html',
  styleUrl: './private-session-modal.component.scss',
})
export class PrivateSessionModalComponent {
  readonly session = input.required<PrivateSessionState>();
  readonly feedback = input<string | null>(null);

  readonly updateEntry = output<string>();
  readonly submit = output<void>();
  readonly discard = output<void>();
}
