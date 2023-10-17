import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedDelegateComponent } from './selected-delegate.component';

describe('SelectedDelegateComponent', () => {
  let component: SelectedDelegateComponent;
  let fixture: ComponentFixture<SelectedDelegateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SelectedDelegateComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SelectedDelegateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
