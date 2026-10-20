// @ts-nocheck
import { Component, OnDestroy, ViewEncapsulation, afterNextRender } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ejecutarPagina, type Limpiador } from '../../../core/utils/navegacion';
import { irA, onGlobal } from '../../../core/utils/navegacion';
import { guardarSesionSegura } from '../../../core/utils/auth-storage';
import { api } from '../../../core/utils/api';
import { sincronizarCarritoAlIniciarSesion } from '../../../core/utils/carrito-store';
import { AgroUI } from '../../../core/utils/agro-ui';

@Component({
  selector: 'app-registro',
  imports: [RouterLink],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css', '../../../../styles/ui-enhancements.css'],
  // Estilos de la página sin encapsulación y respetando los espacios del HTML.
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: true,
  host: { style: 'display: contents' }
})
export class Registro implements OnDestroy {
  private limpiar: Limpiador | null = null;

  constructor() {
    // La lógica necesita que el HTML ya esté en el DOM, por eso corre después del primer render (solo navegador).
    afterNextRender(() => {
      this.limpiar = ejecutarPagina(() => {
        iniciarRegistro();
      });
    });
  }

  ngOnDestroy(): void {
    this.limpiar?.();
  }
}

// ==========================================================================
// LÓGICA DE LA PÁGINA
// ==========================================================================
function iniciarRegistro() {
const inputCorreo = document.getElementById('reg-correo');
const inputNombre = document.getElementById('reg-nombre');
const inputApellidos = document.getElementById('reg-apellidos');
const selectDocTipo = document.getElementById('reg-doc-tipo');
const inputDocNumero = document.getElementById('reg-doc-numero');
const ayudaDoc = document.getElementById('ayuda-doc');
const inputCelular = document.getElementById('reg-celular');
const inputPassword = document.getElementById('reg-password');
const btnTogglePassword = document.getElementById('btn-toggle-password');
const chkTerminos = document.getElementById('chk-terminos');
const chkPrivacidad = document.getElementById('chk-privacidad');
const btnRegistrar = document.getElementById('btn-registrar');
const formRegistro = document.getElementById('form-registro');

const reqLongitud = document.getElementById('req-longitud');
const reqNumero = document.getElementById('req-numero');
const reqMayuscula = document.getElementById('req-mayuscula');
const reqMinuscula = document.getElementById('req-minuscula');

function validarEmail(valor) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

function validarDocumento(tipo, valor) {
    const limpio = valor.trim();
    if (tipo === 'DNI') return /^\d{8}$/.test(limpio);
    return /^[a-zA-Z0-9]{6,12}$/.test(limpio);
}

function validarCelular(valor) {
    return /^9\d{8}$/.test(valor.trim());
}

function evaluarPassword(valor) {
    const estado = {
        longitud: valor.length >= 8,
        numero: /\d/.test(valor),
        mayuscula: /[A-Z]/.test(valor),
        minuscula: /[a-z]/.test(valor)
    };

    marcarRequisito(reqLongitud, estado.longitud);
    marcarRequisito(reqNumero, estado.numero);
    marcarRequisito(reqMayuscula, estado.mayuscula);
    marcarRequisito(reqMinuscula, estado.minuscula);

    return estado.longitud && estado.numero && estado.mayuscula && estado.minuscula;
}

function marcarRequisito(elemento, cumplido) {
    elemento.classList.toggle('cumplido', cumplido);
    elemento.querySelector('.req-check').textContent = cumplido ? '✓' : '○';
}

selectDocTipo.addEventListener('change', () => {
    if (selectDocTipo.value === 'DNI') {
        ayudaDoc.textContent = 'DNI: 8 dígitos';
        inputDocNumero.maxLength = 8;
    } else {
        ayudaDoc.textContent = 'Carné de Extranjería: 6 a 12 caracteres';
        inputDocNumero.maxLength = 12;
    }
    inputDocNumero.value = '';
    validarFormulario();
});

btnTogglePassword.addEventListener('click', () => {
    const esPassword = inputPassword.type === 'password';
    inputPassword.type = esPassword ? 'text' : 'password';
    btnTogglePassword.textContent = esPassword ? '🙈' : '👁';
});

function validarFormulario() {
    const correoValido = validarEmail(inputCorreo.value);
    const nombreValido = inputNombre.value.trim().length >= 2;
    const apellidosValido = inputApellidos.value.trim().length >= 2;
    const docValido = validarDocumento(selectDocTipo.value, inputDocNumero.value);
    const celularValido = validarCelular(inputCelular.value);
    const passwordValida = evaluarPassword(inputPassword.value);
    const terminosOk = chkTerminos.checked && chkPrivacidad.checked;

    document.getElementById('err-correo').textContent = (!correoValido && inputCorreo.value) ? 'Ingresa un correo válido.' : '';
    document.getElementById('err-nombre').textContent = (!nombreValido && inputNombre.value) ? 'Ingresa tu nombre.' : '';
    document.getElementById('err-apellidos').textContent = (!apellidosValido && inputApellidos.value) ? 'Ingresa tus apellidos.' : '';
    document.getElementById('err-doc').textContent = (!docValido && inputDocNumero.value) ? 'Número de documento inválido.' : '';
    document.getElementById('err-celular').textContent = (!celularValido && inputCelular.value) ? 'Celular inválido (9 dígitos, empieza con 9).' : '';

    [
        [inputCorreo, correoValido], [inputNombre, nombreValido], [inputApellidos, apellidosValido],
        [inputDocNumero, docValido], [inputCelular, celularValido], [inputPassword, passwordValida]
    ].forEach(([input, valido]) => {
        const mostrarEstado = input.value.trim().length > 0;
        input.classList.toggle('input-invalid', mostrarEstado && !valido);
        input.classList.toggle('input-valid', mostrarEstado && valido);
    });

    const todoValido = correoValido && nombreValido && apellidosValido && docValido && celularValido && passwordValida && terminosOk;
    btnRegistrar.disabled = !todoValido;
    return todoValido;
}

[inputCorreo, inputNombre, inputApellidos, inputDocNumero, inputCelular, inputPassword].forEach(input => {
    input.addEventListener('input', validarFormulario);
});
[chkTerminos, chkPrivacidad].forEach(chk => {
    chk.addEventListener('change', validarFormulario);
});

formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    const boton = formRegistro.querySelector('button[type="submit"]');
    const textoBoton = boton ? boton.textContent : '';
    if (boton) { boton.disabled = true; boton.textContent = 'Creando cuenta...'; }

    try {
        const { token, usuario } = await api.post('/auth/registro', {
            nombre: inputNombre.value.trim(),
            apellidos: inputApellidos.value.trim(),
            correo: inputCorreo.value.trim(),
            password: inputPassword.value,
            documentoTipo: selectDocTipo.value,
            documentoNumero: inputDocNumero.value.trim(),
            celular: inputCelular.value.trim()
        }, false);

        guardarSesionSegura({
            id: usuario.id,
            Nombre: usuario.Nombre,
            Apellidos: usuario.Apellidos,
            Correo: usuario.Correo,
            Rol: usuario.Rol,
            token
        });

        await sincronizarCarritoAlIniciarSesion();
        irA('/');
    } catch (err) {
        if (err.codigo === 'EMAIL_YA_REGISTRADO') {
            document.getElementById('err-correo').textContent = 'Este correo ya está registrado.';
            inputCorreo.classList.add('input-invalid');
        }
        AgroUI.toast(err.message, err.status === 409 ? 'warning' : 'error', 'No se pudo crear la cuenta');
        if (boton) { boton.disabled = false; boton.textContent = textoBoton; }
    }
});

const btnVerLegal = document.getElementById('btn-ver-legal');
const legalModal = document.getElementById('legal-modal');
const legalModalOverlay = document.getElementById('legal-modal-overlay');
const legalModalClose = document.getElementById('legal-modal-close');
const btnLegalEntendido = document.getElementById('btn-legal-entendido');
const legalTabs = document.querySelectorAll('[data-legal-tab]');
const legalPanels = document.querySelectorAll('[data-legal-panel]');

function abrirLegal(tab = 'terminos') {
    activarLegalTab(tab);
    legalModal.classList.add('active');
    legalModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    legalModalClose.focus();
}

function cerrarLegal() {
    legalModal.classList.remove('active');
    legalModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    btnVerLegal.focus();
}

function activarLegalTab(tab) {
    legalTabs.forEach(boton => {
        const activo = boton.dataset.legalTab === tab;
        boton.classList.toggle('active', activo);
        boton.setAttribute('aria-selected', activo ? 'true' : 'false');
    });

    legalPanels.forEach(panel => {
        panel.classList.toggle('active', panel.dataset.legalPanel === tab);
    });
}

btnVerLegal.addEventListener('click', () => abrirLegal('terminos'));
legalModalClose.addEventListener('click', cerrarLegal);
legalModalOverlay.addEventListener('click', cerrarLegal);
btnLegalEntendido.addEventListener('click', cerrarLegal);

legalTabs.forEach(boton => {
    boton.addEventListener('click', () => activarLegalTab(boton.dataset.legalTab));
});

onGlobal(document, 'keydown', e => {
    if (e.key === 'Escape' && legalModal.classList.contains('active')) cerrarLegal();
});

}
