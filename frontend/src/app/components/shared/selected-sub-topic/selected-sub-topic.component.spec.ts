import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectedSubTopicComponent } from './selected-sub-topic.component';

describe('SelectedSubTopicComponent', () => {
  let component: SelectedSubTopicComponent;
  let fixture: ComponentFixture<SelectedSubTopicComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectedSubTopicComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectedSubTopicComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
