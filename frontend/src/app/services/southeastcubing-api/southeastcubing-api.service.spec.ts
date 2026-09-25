import { TestBed } from '@angular/core/testing';

import { SoutheastcubingApiService } from './southeastcubing-api.service';

describe('SoutheastcubingApiService', () => {
  let service: SoutheastcubingApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SoutheastcubingApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
