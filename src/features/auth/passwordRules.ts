/** Requisiti password condivisi da registrazione e reimpostazione. */
export const PASSWORD_REQUIREMENTS = [
  { regex: /[A-Z]/, message: "Almeno una lettera maiuscola" },
  { regex: /[a-z]/, message: "Almeno una lettera minuscola" },
  { regex: /\d/, message: "Almeno un numero" },
  { regex: /[!@#$%^&*(),.?":{}|<>]/, message: "Almeno un carattere speciale" },
  { regex: /^.{8,20}$/, message: "Lunghezza tra 8 e 20 caratteri" },
];

/** Restituisce i requisiti non soddisfatti (array vuoto = password valida). */
export function getPasswordFailures(password: string): string[] {
  return PASSWORD_REQUIREMENTS.filter((req) => !req.regex.test(password)).map((req) => req.message);
}
