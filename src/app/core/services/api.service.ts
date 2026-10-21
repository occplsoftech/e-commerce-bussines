import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { ApiResponse } from '../models/api-response.model';

/** The single HTTP seam: unwraps the backend's ApiResponse envelope in one place (same as courier-web). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  get<T>(path: string, query?: Record<string, unknown>): Observable<T> {
    return this.http.get<ApiResponse<T>>(this.base + path, { params: toParams(query) }).pipe(map((r) => r.data));
  }

  post<T>(path: string, body: unknown, headers?: Record<string, string>): Observable<T> {
    return this.http.post<ApiResponse<T>>(this.base + path, body, { headers: headers ? new HttpHeaders(headers) : undefined })
      .pipe(map((r) => r.data));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<ApiResponse<T>>(this.base + path, body).pipe(map((r) => r.data));
  }

  delete(path: string): Observable<void> {
    return this.http.delete<void>(this.base + path);
  }

  /** A file download (e.g. a label PDF); not wrapped in ApiResponse. */
  blob(path: string): Observable<Blob> {
    return this.http.get(this.base + path, { responseType: 'blob' });
  }
}

function toParams(query?: Record<string, unknown>): HttpParams {
  let params = new HttpParams();
  if (!query) return params;
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}
