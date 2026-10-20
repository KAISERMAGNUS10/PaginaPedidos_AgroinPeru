import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Páginas de la tienda y del cliente. Por ahora solo contiene el <router-outlet>; cada página tiene su propio header. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css'
})
export class PublicLayout {}
