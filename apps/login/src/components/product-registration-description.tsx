"use client";

import { useProductLogin } from "./product-login-provider";
import { Translated } from "./translated";

export function ProductRegistrationDescription() {
  const product = useProductLogin();
  return product ? (
    <Translated i18nKey="productDescription" namespace="register" data={{ product: product.name }} />
  ) : (
    <Translated i18nKey="description" namespace="register" />
  );
}
