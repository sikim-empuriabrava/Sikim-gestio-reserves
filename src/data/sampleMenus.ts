import { MenuDefinido } from '@/types/reservation';

export const sampleMenus: MenuDefinido[] = [
  {
    id: 'menu-classic',
    nombre: 'Menú Clásico',
    primeros: [
      { id: 'ensalada-templada', nombre: 'Ensalada templada', descripcion: 'Verduras asadas con vinagreta de cítricos' },
      { id: 'carpaccio', nombre: 'Carpaccio de ternera', descripcion: 'Láminas finas con parmesano y rúcula' },
    ],
    segundos: [
      { id: 'entrecot', nombre: 'Entrecot a la brasa', descripcion: 'Carne madurada con patata trufada' },
      { id: 'bacalao', nombre: 'Bacalao confitado', descripcion: 'Pil pil de ajos tiernos' },
    ],
    postres: [
      { id: 'brownie', nombre: 'Brownie de chocolate', descripcion: 'Con helado de vainilla' },
      { id: 'tatin', nombre: 'Tarta tatin', descripcion: 'Manzana caramelizada y hojaldre' },
    ],
  },
  {
    id: 'menu-green',
    nombre: 'Menú Vegetariano',
    primeros: [
      { id: 'hummus', nombre: 'Hummus libanés', descripcion: 'Garbanzos, tahini y crudités' },
      { id: 'gazpacho-verde', nombre: 'Gazpacho verde', descripcion: 'Pepino, manzana verde y albahaca' },
    ],
    segundos: [
      { id: 'risotto-setas', nombre: 'Risotto de setas', descripcion: 'Boletus y parmesano' },
      { id: 'berenjena-miso', nombre: 'Berenjena al miso', descripcion: 'Glaseado dulce y miso rojo' },
    ],
    postres: [
      { id: 'cheesecake', nombre: 'Cheesecake de coco', descripcion: 'Base de dátiles y anacardos' },
      { id: 'sorbetes', nombre: 'Sorbete cítrico', descripcion: 'Lima, limón y hierbabuena' },
    ],
  },
  {
    id: 'menu-premium',
    nombre: 'Menú Premium',
    primeros: [
      { id: 'ostra', nombre: 'Ostra con ponzu', descripcion: 'Perlas de yuzu' },
      { id: 'foie', nombre: 'Micuit de foie', descripcion: 'Brioche tostado y chutney de mango' },
    ],
    segundos: [
      { id: 'solomillo', nombre: 'Solomillo al carbón', descripcion: 'Pure de apionabo y demi-glace' },
      { id: 'rodaballo', nombre: 'Rodaballo asado', descripcion: 'Hinojo confitado y salsa beurre blanc' },
    ],
    postres: [
      { id: 'souffle', nombre: 'Soufflé de avellanas', descripcion: 'Helado de café' },
      { id: 'texturas-choco', nombre: 'Texturas de chocolate', descripcion: 'Crujiente, cremoso y aireado' },
    ],
  },
];
