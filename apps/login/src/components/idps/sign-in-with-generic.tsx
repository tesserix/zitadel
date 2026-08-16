"use client";

import { AuroraProviderMark } from "@tesserix/web";
import { forwardRef } from "react";
import { BaseButton, SignInWithIdentityProviderProps } from "./base-button";

export const SignInWithGeneric = forwardRef<HTMLButtonElement, SignInWithIdentityProviderProps>(
  function SignInWithGeneric(props, ref) {
    const { children, name = "", className = "h-[50px]", ...restProps } = props;
    return (
      <BaseButton {...restProps} ref={ref} className={className}>
        <div className="flex h-12 w-12 items-center justify-center">
          <AuroraProviderMark provider={name} size={24} />
        </div>
        {children ? children : <span className="w-full text-center">{name}</span>}
      </BaseButton>
    );
  },
);
