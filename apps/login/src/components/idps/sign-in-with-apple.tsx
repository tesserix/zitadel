"use client";

import { AuroraProviderMark } from "@tesserix/web";
import { forwardRef } from "react";
import { Translated } from "../translated";
import { BaseButton, SignInWithIdentityProviderProps } from "./base-button";

export const SignInWithApple = forwardRef<HTMLButtonElement, SignInWithIdentityProviderProps>(
  function SignInWithApple(props, ref) {
    const { children, name, ...restProps } = props;

    return (
      <BaseButton {...restProps} ref={ref}>
        <div className="flex h-12 w-12 items-center justify-center">
          <AuroraProviderMark provider="apple" size={24} />
        </div>
        {children ? (
          children
        ) : (
          <span className="ml-4">{name ? name : <Translated i18nKey="signInWithApple" namespace="idp" />}</span>
        )}
      </BaseButton>
    );
  },
);
