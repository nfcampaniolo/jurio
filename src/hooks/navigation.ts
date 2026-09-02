import type { NavigateFunction } from "react-router-dom";

export type NavItem =
  | { type: "route"; target: string }
  | { type: "scroll"; target: string };

export const navigateItem = (
  item: NavItem,
  navigate: NavigateFunction,
  closeMenu?: () => void
) => {
  closeMenu?.();

  if (item.type === "route") {
    navigate(item.target);
    return;
  }

  if (window.location.pathname !== "/") {
    navigate("/ricerca");
    setTimeout(() => {
      document
        .getElementById(item.target)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return;
  }

  document
    .getElementById(item.target)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};