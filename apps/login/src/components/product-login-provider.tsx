"use client";

import { ProductLogin } from "@/lib/product-login";
import { createContext, ReactNode, useContext } from "react";

const ProductContext = createContext<ProductLogin | undefined>(undefined);

export function ProductLoginProvider({ product, children }: { product?: ProductLogin; children: ReactNode }) {
  return <ProductContext.Provider value={product}>{children}</ProductContext.Provider>;
}

export const useProductLogin = () => useContext(ProductContext);
