import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DelegatesComponent } from './delegates.component';

describe('DelegatesComponent', () => {
  let component: DelegatesComponent;
  let fixture: ComponentFixture<DelegatesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DelegatesComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DelegatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
