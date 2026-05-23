import { Component, input, output } from '@angular/core';
import { Category, Statement } from '../../models/mind-programming.models';

@Component({
  selector: 'app-library-view',
  templateUrl: './library-view.component.html',
  styleUrl: './library-view.component.scss',
})
export class LibraryViewComponent {
  readonly categories = input.required<Category[]>();
  readonly filteredStatements = input.required<Statement[]>();
  readonly selectedCategoryId = input.required<string>();
  readonly selectedCategoryLabel = input.required<string>();
  readonly totalStatements = input.required<number>();
  readonly dueCount = input.required<number>();
  readonly dueByStatement = input.required<Map<string, number>>();
  readonly categoryName = input.required<(statement: Statement) => string>();
  readonly statementSummary = input.required<(statement: Statement) => string>();

  readonly selectCategory = output<string>();
  readonly startStatement = output<Statement>();
  readonly startCustomStatement = output<Statement>();
}
