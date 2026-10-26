/**
 * The name to show for a player. Players with a private profile have an empty
 * name, which the league hides everywhere: show their shirt number instead.
 */
export function playerDisplayName(name: string | null | undefined, number?: string | null): string {
  if (name) return name;
  return number ? `Dorsal\u00a0${number}` : "Jugador";
}
