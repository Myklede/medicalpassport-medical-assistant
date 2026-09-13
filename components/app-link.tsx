import type { ComponentProps } from 'react';

// Use document navigation across workspaces. The current Vinext production
// router throws while importing its navigation/prefetch functions.
export default function AppLink({ children, ...props }: ComponentProps<'a'>) {
  return <a {...props}>{children}</a>;
}
