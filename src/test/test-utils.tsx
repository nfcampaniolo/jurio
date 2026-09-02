/* eslint-disable react-refresh/only-export-components */

import React from "react";
import { render as rtlRender } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "@dr.pogodin/react-helmet";

export * from "@testing-library/react";

type Options = {
  route?: string;
};

export function render(
  ui: React.ReactElement,
  { route = "/" }: Options = {}
) {
  return rtlRender(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </HelmetProvider>
  );
}