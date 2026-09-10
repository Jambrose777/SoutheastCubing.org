import {
  Component,
  input,
  output,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Shared search input used by the Competitions/Clubs list pages. Debounces
// its value before emitting, and accepts an initial value so a page can
// restore a search term already present (eg. in the URL).
@Component({
  selector: 'se-search-bar',
  templateUrl: './se-search-bar.component.html',
  styleUrls: ['./se-search-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatFormField, MatLabel, MatInput, MatSuffix],
})
export class SeSearchBarComponent implements OnInit, OnDestroy {
  initialValue = input<string>('');
  label = input<string>('Search');
  searchChange = output<string>();

  searchControl = new FormControl('');
  private subscription?: Subscription;

  ngOnInit(): void {
    // Seed from the page's current search term (e.g. restored from the URL
    // on load) without re-triggering a search of its own.
    this.searchControl.setValue(this.initialValue(), { emitEvent: false });

    this.subscription = this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe((value) => this.searchChange.emit(value ?? ''));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  // Resets the input's displayed value without emitting a searchChange of its
  // own, since callers needing filtering to react (e.g. a page's
  // clearFilters()) already update their own search-term state directly.
  clear(): void {
    this.searchControl.setValue('', { emitEvent: false });
  }
}
