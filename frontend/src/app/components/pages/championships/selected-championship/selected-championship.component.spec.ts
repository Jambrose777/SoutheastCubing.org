import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedChampionshipComponent } from './selected-championship.component';

describe('SelectedChampionshipComponent', () => {
  let component: SelectedChampionshipComponent;
  let fixture: ComponentFixture<SelectedChampionshipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SelectedChampionshipComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SelectedChampionshipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
