import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { registrarRouter } from './core/utils/navegacion';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Frontend');

  constructor() {
    // Las páginas navegan con irA('/login'); necesita el Router de Angular.
    registrarRouter(inject(Router));
  }
}
