import { KNOWN_APPS } from "./apps-registry";
export const PROTECTED_PRODUCTS = ["onlypadel", "onlycars", "onlyerp"] as const;
export function assertProductMutable(slug: string) {
  if ((PROTECTED_PRODUCTS as readonly string[]).includes(slug)) throw new Error("Producto protegido: no se permiten operaciones sobre " + slug);
}
export function validateContainer(name: unknown, lines: unknown = 100) {
  if (typeof name !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(name)) throw new Error("Nombre de contenedor inválido");
  const count = Number(lines);
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error("La cantidad de líneas debe estar entre 1 y 1000");
  return { name, lines: count };
}
export function assertContainerMutable(name: string) {
  validateContainer(name);
  const owner = KNOWN_APPS.find(a => a.containerNames.some(n => n === name || name.startsWith(n + "-")));
  if (!owner) throw new Error("Contenedor fuera del inventario permitido");
  assertProductMutable(owner.slug);
  if(owner.slug==="nanolabshub")throw new Error("El Hub se actualiza desde Software mediante el worker independiente; el reinicio directo puede interrumpir backups o restores");
}
export function assertDeploymentAllowed(): never {
  throw new Error("Despliegue genérico deshabilitado: requiere un release con imagen, respaldo y composición efectiva verificados. Utilizá el procedimiento documentado.");
}
