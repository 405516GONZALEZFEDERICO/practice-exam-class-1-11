import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Order } from './order';
import { Product } from './product';

@Injectable({
  providedIn: 'root'  
})
export class ApiService {

  private apiUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}
  getProductInfo(productId: number) {
    return this.http.get<Product>(`${this.apiUrl}/products/${productId}`);
  }
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products`);
  }

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/orders`);
  }
  getOrderByEmail(email: string): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/orders?email=${email}`);
  }

  createOrder(order: Order): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/orders`, order);
  }
}
