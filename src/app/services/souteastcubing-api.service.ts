import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { EmailRequestBody } from '../models/EmailRequestBody';

@Injectable({
  providedIn: 'root'
})
export class SouteastcubingApiService {

  constructor(private http: HttpClient) { }

  contactSubmission(body: EmailRequestBody) {
    return this.http.post(`${environment.southeastCubingApi}/email`, body)
  }
}
