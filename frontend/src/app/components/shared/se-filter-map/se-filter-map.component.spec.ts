import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeFilterMapComponent } from './se-filter-map.component';

describe('SeFilterMapComponent', () => {
  let component: SeFilterMapComponent;
  let fixture: ComponentFixture<SeFilterMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SeFilterMapComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeFilterMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
