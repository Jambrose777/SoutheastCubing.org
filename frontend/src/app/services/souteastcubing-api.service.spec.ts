import { TestBed } from '@angular/core/testing';

import { SouteastcubingApiService } from './souteastcubing-api.service';

describe('SouteastcubingApiService', () => {
  let service: SouteastcubingApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SouteastcubingApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
