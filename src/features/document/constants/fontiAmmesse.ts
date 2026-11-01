export const fontiAmmesse = [
  "https://www.cortecostituzionale.it/",
] as const;

export const isFonteAmmessa = (fonte?: string | null): boolean => {
  if (typeof fonte !== "string") return false;
  return fontiAmmesse.includes(fonte as (typeof fontiAmmesse)[number]);
};
