import { TestBed } from '@angular/core/testing';

import { WcaService } from './wca.service';

describe('WcaService', () => {
  let service: WcaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WcaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
