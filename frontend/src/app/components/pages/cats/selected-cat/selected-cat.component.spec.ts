import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedCatComponent } from './selected-cat.component';

describe('SelectedCatComponent', () => {
  let component: SelectedCatComponent;
  let fixture: ComponentFixture<SelectedCatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectedCatComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectedCatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
