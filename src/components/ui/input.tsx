// Adapted from shadcn/ui (MIT).
import type { ComponentProps } from 'react';
import { cn } from './utils';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(
    'min-h-[46px] w-full min-w-0 max-w-full rounded-[9px] border border-input bg-surface px-3 py-2.5 text-base text-foreground aria-invalid:border-expired mobile:px-2',
    className,
  )} {...props} />;
}
