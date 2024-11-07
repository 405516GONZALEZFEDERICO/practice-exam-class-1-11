import { Component, inject, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray, ReactiveFormsModule, ValidationErrors, AbstractControl, AsyncValidatorFn, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';
import { Product } from '../product';
import { CommonModule } from '@angular/common';
import { Observable, of, tap, map, catchError, timestamp } from 'rxjs';
import { Order } from '../order';

@Component({
  selector: 'app-create-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-order.component.html',
  styleUrl: './create-order.component.css'
})
export class CreateOrderComponent implements OnInit {
  // Formulario principal
  orderForm: FormGroup = new FormGroup({
    customerName: new FormControl('', [Validators.required, Validators.minLength(3)]),
    email: new FormControl('', [Validators.required, Validators.email],[this.emailOrderLimitValidator()]),

    // Iniciamos el array de productos vacío
    products: new FormArray([], [Validators.required, this.uniqueProductValidator, this.validateCantProd])
  });

  // Lista de productos disponibles
  products: Product[] = [];

  // Variables para calcular totales
  total = 0;
  hasDiscount = false;
  selectedProducts: Product[] = [];

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {

  }

  // Método que se ejecuta al iniciar el componente
  ngOnInit(): void {
    // Cargamos la lista de productos
    this.loadProducts();
    this.updateSelectedProducts();
  }


  // Validador asíncrono para el límite de pedidos por email
   emailOrderLimitValidator(): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!control.value) {
        return of(null);
      }

      return this.apiService.getOrderByEmail(control.value).pipe(
        tap((orders) => {
          console.log('Órdenes obtenidas:', orders);
        }),
        map(orders => {
          // Obtenemos la fecha actual
          const now = new Date();
          // Filtramos los pedidos de las últimas 24 horas
          const recentOrders = orders.filter(order => {
            const orderDate = order.timestamp ? new Date(order.timestamp) : new Date();
            const differenceInMilliseconds = now.getTime() - orderDate.getTime();
            console.log('Diferencia en milisegundos:', differenceInMilliseconds);
            // Convertimos la diferencia a horas diviendo por 1000 milisegundos, 
            //60 segundos y 60 minutos
            const differenceInHours = differenceInMilliseconds / (1000 * 60 * 60);
            console.log('Diferencia en horas:', differenceInHours);
            return differenceInHours <= 24;
          });

          // Si hay más de 3 pedidos en las últimas 24 horas, retornamos el error
          if (recentOrders.length >= 3) {
            console.log('Error al validar el límite de pedidos:', recentOrders);
            return { errorPedido: true };
          }

          return null;
        }),
        catchError((error) => {
          console.error('Error al validar el límite de pedidos:', error);
          return of(null);
        })
      );
    };
  }
  validateCantProd(control: FormArray): ValidationErrors | null {
    const array = control
    console.log(array.length);
    if (array.length > 3 || array.length < 1) {
      console.log('Error al validar la cantidad de productos');
      return { 'minProd': true }
    }

    else return null;
  }
  uniqueProductValidator(productsArray: FormArray): ValidationErrors | null {
    const selectedProductIds = productsArray.controls.map(control => control.get('productId')?.value as Number);
    const hasDuplicates = selectedProductIds.some((id, index) => selectedProductIds.indexOf(id) !== index);
    return hasDuplicates ? { duplicateProduct: true } : null;
  }
  // Getter para acceder fácilmente al array de productos en el template
  get productsArray(): FormArray {
    return this.orderForm.get('products') as FormArray;
  }

  // Carga la lista de productos desde la API
  private loadProducts(): void {
    this.apiService.getProducts().subscribe({
      next: (data) => {
        this.products = data;
      },
      error: () => {

      }
    });
  }

  // Agrega un nuevo producto al formulario
  addProduct(): void {
    // Crear un grupo de formulario para el nuevo producto
    const productForm: FormGroup = new FormGroup({
      price: new FormControl(0),
      productId: new FormControl(''),
      quantity: new FormControl(1),
      stock: new FormControl(0)
    });

    // Escuchar cambios en el producto seleccionado
    productForm.get('productId')?.valueChanges.subscribe(id => {
      const product = this.products.find(p => p.id === id);
      if (product) {
        // Actualizar el precio y el stock cuando se selecciona un producto
        productForm.patchValue({
          price: product.price,
          stock: product.stock
        });

        // Actualizar los validadores de cantidad con el valor del stock
        const quantityControl = productForm.get('quantity');
        quantityControl?.setValidators([Validators.required, Validators.min(1), Validators.max(product.stock)]);

        // Actualizar totales
        this.calculateTotal();
        this.updateSelectedProducts();
      }
    });

    // Escuchar cambios en la cantidad
    productForm.get('quantity')?.valueChanges.subscribe(() => {
      this.calculateTotal();
      this.updateSelectedProducts();
      console.log(productForm);
    });

    // Agregar el producto al array
    this.productsArray.push(productForm);
  }

  // Elimina un producto del formulario
  removeProduct(index: number): void {
    this.productsArray.removeAt(index);
    this.calculateTotal();
    this.updateSelectedProducts();
  }
  updateSelectedProducts() {
    const products = this.productsArray.controls;
    this.selectedProducts = products.map(control => {
      const productId = control.get('productId')?.value;
      const product = this.products.find(p => p.id.toString() === productId);
      return {
        id: product?.id || '',
        name: product?.name || '',
        quantity: control.get('quantity')?.value,
        price: control.get('price')?.value,
        stock: product?.stock
      };
    }) as Product[];
  }
  // Calcula el total del pedido y aplica descuento si corresponde
  calculateTotal(): void {
    let subtotal = 0;

    // Sumar el precio * cantidad de cada producto
    this.productsArray.controls.forEach(control => {
      const quantity = control.get('quantity')?.value || 0;
      const price = control.get('price')?.value || 0;
      subtotal += quantity * price;
    });

    // Aplicar descuento si el subtotal es mayor a 1000
    this.hasDiscount = subtotal > 1000;
    // le aplicamos el descuento del 10% al total
    this.total = this.hasDiscount ? subtotal * 0.9 : subtotal;
  }

  // Genera un código único para el pedido
  private generateOrderCode(name: string, email: string): string {
    // Obtiene la primera letra del nombre y la convierte a mayúscula
    const firstLetter = name.charAt(0).toUpperCase();

    // Obtiene los últimos 4 caracteres del email
    const emailSuffix = email.slice(-4);

    // Obtiene la fecha y hora actual en formato JSON (cadena de texto)
    const timestamp = new Date().toJSON();

    // Combina la primera letra del nombre, el sufijo del email y el timestamp para formar un código único
    return `${firstLetter}${emailSuffix}${timestamp}`;
  }

  // Maneja el envío del formulario
  onSubmit(): void {
    if (this.orderForm.valid) {
      const formValue = this.orderForm.value;

      // Crear objeto de orden
      const order: Order = {
        customerName: formValue.customerName,
        email: formValue.email,
        products: formValue.products,
        total: parseFloat(this.total.toFixed(2)),
        orderCode: this.generateOrderCode(formValue.customerName, formValue.email),
        timestamp: new Date().toISOString()
      };

      // Enviar orden a la API
      this.apiService.createOrder(order).subscribe({
        next: () => {
          this.router.navigate(['/orders']);
        },
        error: () => {
          alert('Error al crear la orden');
        }
      });
    } else this.orderForm.markAllAsTouched();
  }
}
