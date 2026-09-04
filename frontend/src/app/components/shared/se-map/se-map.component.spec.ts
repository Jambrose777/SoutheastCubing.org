import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeMapComponent } from './se-map.component';

describe('SeMapComponent', () => {
  let component: SeMapComponent;
  let fixture: ComponentFixture<SeMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SeMapComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
