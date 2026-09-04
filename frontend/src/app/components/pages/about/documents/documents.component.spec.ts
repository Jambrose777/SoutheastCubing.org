import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DoucmentsComponent } from './documents.component';

describe('DoucmentsComponent', () => {
  let component: DoucmentsComponent;
  let fixture: ComponentFixture<DoucmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DoucmentsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DoucmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
