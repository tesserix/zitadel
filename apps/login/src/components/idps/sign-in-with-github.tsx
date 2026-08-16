"use client";

import { AuroraProviderMark } from "@tesserix/web";
import { forwardRef } from "react";
import { Translated } from "../translated";
import { BaseButton, SignInWithIdentityProviderProps } from "./base-button";

export const SignInWithGithub = forwardRef<HTMLButtonElement, SignInWithIdentityProviderProps>(
  function SignInWithGithub(props, ref) {
    const { children, name, ...restProps } = props;

    return (
      <BaseButton {...restProps} ref={ref}>
        <div className="flex h-12 w-12 items-center justify-center">
          <AuroraProviderMark provider="github" size={24} />
        </div>
        {children ? (
          children
        ) : (
          <span className="ml-4">{name ? name : <Translated i18nKey="signInWithGithub" namespace="idp" />}</span>
        )}
      </BaseButton>
    );
  },
);
