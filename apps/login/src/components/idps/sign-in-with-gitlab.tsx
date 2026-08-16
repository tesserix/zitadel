"use client";

import { AuroraProviderMark } from "@tesserix/web";
import { forwardRef } from "react";
import { Translated } from "../translated";
import { BaseButton, SignInWithIdentityProviderProps } from "./base-button";

export const SignInWithGitlab = forwardRef<HTMLButtonElement, SignInWithIdentityProviderProps>(
  function SignInWithGitlab(props, ref) {
    const { children, name, ...restProps } = props;

    return (
      <BaseButton {...restProps} ref={ref}>
        <div className="flex h-12 w-12 items-center justify-center">
          <AuroraProviderMark provider="gitlab" size={24} />
        </div>
        {children ? (
          children
        ) : (
          <span className="ml-4">{name ? name : <Translated i18nKey="signInWithGitlab" namespace="idp" />}</span>
        )}
      </BaseButton>
    );
  },
);
