// Adapted from shadcn/ui (MIT); the native arrow and option UI are retained.
import type { ComponentProps } from 'react';
import { cn } from './utils';

export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="native-select" className={cn(
    'min-h-[46px] w-full min-w-0 max-w-full rounded-[9px] border border-input bg-white px-3 py-2.5 text-base text-foreground aria-invalid:border-expired mobile:px-2',
    className,
  )} {...props} />;
}
