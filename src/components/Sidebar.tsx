"use client";

import { HUB_NAV_ITEMS } from "./HubShell";

export const NAV_GROUPS = [
  {
    title: "NanoLabs Hub",
    items: HUB_NAV_ITEMS.map((item) => ({
      name: item.nombre,
      href: item.ruta,
      icon: item.Icono,
      description: item.descripcion,
    })),
  },
];

export function Sidebar() {
  return null;
}
