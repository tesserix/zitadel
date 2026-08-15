"use client";

import { Logo } from "@/components/logo";
import { auroraIntensity, brandColor } from "@/lib/aurora";
import { TenantLogin } from "@/lib/tenant-branding";
import { useResponsiveLayout } from "@/lib/theme-hooks";
import { AuroraAuthPanel } from "@tesserix/web";
import { BrandingSettings } from "@zitadel/proto/zitadel/settings/v2/branding_settings_pb";
import { useTheme } from "next-themes";
import React, { Children, ReactNode } from "react";
import { AuroraBackground } from "./aurora-background";
import { Card } from "./card";
import { ThemeWrapper } from "./theme-wrapper";

/**
 * DynamicTheme component handles layout switching between traditional top-to-bottom
 * and modern side-by-side layouts based on NEXT_PUBLIC_THEME_LAYOUT.
 *
 * For side-by-side layout:
 * - First child: Goes to left side (title, description, etc.)
 * - Second child: Goes to right side (forms, buttons, etc.)
 * - Single child: Falls back to right side for backward compatibility
 *
 * For top-to-bottom layout:
 * - All children rendered in traditional centered layout
 */
export function DynamicTheme({
  branding,
  tenant,
  children,
}: {
  children: ReactNode | ((isSideBySide: boolean) => ReactNode);
  branding?: BrandingSettings;
  tenant?: TenantLogin;
}) {
  const { isSideBySide } = useResponsiveLayout();
  const { resolvedTheme } = useTheme();
  // The palette is inline, so it cannot follow prefers-color-scheme on its own.
  const mode = resolvedTheme === "dark" ? "dark" : "light";

  // Resolve children immediately to avoid passing functions through React
  const actualChildren: ReactNode = React.useMemo(() => {
    if (typeof children === "function") {
      return (children as (isSideBySide: boolean) => ReactNode)(isSideBySide);
    }
    return children;
  }, [children, isSideBySide]);

  return (
    <ThemeWrapper branding={branding}>
      {isSideBySide
        ? // Side-by-side layout: first child goes left, second child goes right
          (() => {
            const childArray = Children.toArray(actualChildren);
            const leftContent = childArray[0] || null;
            const rightContent = childArray[1] || null;

            // If there's only one child, it's likely the old format - keep it on the right side
            const hasLeftRightStructure = childArray.length === 2;

            return (
              <div className="relative mx-auto w-full max-w-[1100px] px-4 py-4 md:px-8">
                <Card data-login-card>
                  {/* The layout only switches after hydration, so this branch is what a phone renders first. */}
                  <div className="flex flex-col md:min-h-[400px] md:flex-row">
                    {/* Left side: First child + branding */}
                    <div className="relative flex w-full flex-col justify-center overflow-hidden p-4 md:w-1/2 lg:p-8">
                      <AuroraBackground branding={branding} intensity={tenant?.auroraIntensity} />
                      <div className="relative z-10 mx-auto max-w-[440px] space-y-8">
                        {/* Logo and branding */}
                        {branding && (
                          <Logo
                            lightSrc={branding.lightTheme?.logoUrl}
                            darkSrc={branding.darkTheme?.logoUrl}
                            height={150}
                            width={150}
                          />
                        )}

                        {tenant?.tagline && (
                          <p data-tenant-tagline className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                            {tenant.tagline}
                          </p>
                        )}

                        {/* First child content (title, description) - only if we have left/right structure */}
                        {hasLeftRightStructure && (
                          <div className="flex flex-col items-start space-y-4 text-left">
                            {/* Apply larger styling to the content */}
                            <div className="space-y-6 [&_h1]:text-left [&_h1]:text-4xl [&_h1]:leading-tight [&_h1]:text-gray-900 [&_h1]:lg:text-4xl [&_h1]:dark:text-white [&_p]:text-left [&_p]:leading-relaxed [&_p]:text-gray-700 [&_p]:dark:text-gray-300">
                              {leftContent}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side: Second child (form) or single child if old format */}
                    <div className="flex w-full items-center justify-center p-4 md:w-1/2 lg:p-8">
                      <div className="w-full max-w-[440px]">
                        <div className="space-y-6">{hasLeftRightStructure ? rightContent : leftContent}</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })()
        : // Traditional top-to-bottom layout - center title/description, left-align forms
          (() => {
            const childArray = Children.toArray(actualChildren);
            const titleContent = childArray[0] || null;
            const formContent = childArray[1] || null;
            const hasMultipleChildren = childArray.length > 1;

            return (
              <AuroraAuthPanel
                data-login-card
                brandColor={brandColor(branding, mode)}
                mode={mode}
                intensity={auroraIntensity(tenant?.auroraIntensity)}
                tagline={tenant?.tagline}
                logo={
                  branding && (
                    <Logo
                      lightSrc={branding.lightTheme?.logoUrl}
                      darkSrc={branding.darkTheme?.logoUrl}
                      height={150}
                      width={150}
                    />
                  )
                }
                className="mx-auto min-h-0 rounded-[1.5rem] py-10"
              >
                {hasMultipleChildren ? (
                  <>
                    {/* Title and description - center aligned */}
                    <div className="mb-4 flex w-full flex-col items-center text-center">{titleContent}</div>

                    {/* Form content - left aligned */}
                    <div className="w-full">{formContent}</div>
                  </>
                ) : (
                  // Single child - use original behavior
                  <div className="w-full">{actualChildren}</div>
                )}
              </AuroraAuthPanel>
            );
          })()}
    </ThemeWrapper>
  );
}
