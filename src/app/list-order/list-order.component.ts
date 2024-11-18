import { Component } from '@angular/core';
import { ApiService } from '../api.service';
import { Order } from '../order';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-list-order',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './list-order.component.html',
  styleUrl: './list-order.component.css'
})
export class ListOrderComponent {
  orders: Order[] = [];
  loading = false;
  error = '';
  searchTerm = new FormControl('');

  constructor(private apiService: ApiService) { }

  ngOnInit(): void {
    this.loadOrders();
    this.searchTerm.valueChanges.subscribe(() => {
      this.orders = this.filterOrders();
    });
  }
  loadOrders(): void {
    this.loading = true;
    this.apiService.getOrders().subscribe({
      next: (orders) => {
        this.orders = orders
      },
      error: (error) => {

      }
    });
  }

  filterOrders() {
    if (!this.searchTerm.value) {
      this.loadOrders();
    }

    return this.orders.filter(order =>
      order.customerName.toLowerCase().includes(this.searchTerm.value ?? '') ||
      order.email.toLowerCase().includes(this.searchTerm.value ?? '')
    );
  }


}
