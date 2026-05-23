import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActiveSession, Statement } from '../../../models/mind-programming.models';

@Component({
  selector: 'app-active-session-modal',
  imports: [FormsModule],
  templateUrl: './active-session-modal.component.html',
  styleUrl: './active-session-modal.component.scss',
})
export class ActiveSessionModalComponent {
  readonly activeSession = input.required<ActiveSession>();
  readonly statement = input.required<Statement>();
  readonly feedback = input<string | null>(null);

  readonly updateEntry = output<string>();
  readonly submit = output<void>();
  readonly restart = output<void>();
  readonly dismiss = output<void>();
}
