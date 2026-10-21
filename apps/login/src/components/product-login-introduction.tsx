"use client";

import { ReactNode } from "react";
import { useProductLogin } from "./product-login-provider";

export function ProductLoginIntroduction({ children }: { children: ReactNode }) {
  const product = useProductLogin();
  return product ? (
    <div className="flex flex-col space-y-4">
      <h1>{product.title}</h1>
      <p className="ztdl-p">{product.tagline}</p>
    </div>
  ) : (
    children
  );
}
