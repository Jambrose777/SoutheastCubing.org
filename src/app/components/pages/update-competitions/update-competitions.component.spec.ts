import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateCompetitionsComponent } from './update-competitions.component';

describe('UpdateCompetitionsComponent', () => {
  let component: UpdateCompetitionsComponent;
  let fixture: ComponentFixture<UpdateCompetitionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UpdateCompetitionsComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateCompetitionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
