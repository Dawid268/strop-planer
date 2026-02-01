import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  private readonly defaultHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
  });

  /**
   * Wykonuje żądanie GET
   */
  public get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, {
      headers: this.defaultHeaders,
    });
  }

  /**
   * Wykonuje żądanie POST z body
   */
  public post<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, {
      headers: this.defaultHeaders,
    });
  }

  /**
   * Wykonuje żądanie PUT z body
   */
  public put<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body, {
      headers: this.defaultHeaders,
    });
  }

  /**
   * Wykonuje żądanie DELETE
   */
  public delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`, {
      headers: this.defaultHeaders,
    });
  }

  /**
   * Wysyła plik
   */
  public uploadFile<T>(
    endpoint: string,
    file: File,
    fieldName = 'file',
  ): Observable<T> {
    const formData = new FormData();
    formData.append(fieldName, file);

    return this.http.post<T>(`${this.baseUrl}${endpoint}`, formData);
  }
}
