// Adapted from shadcn/ui (MIT). See LICENSE and README.md in this directory.
import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva('cursor-pointer disabled:cursor-not-allowed disabled:opacity-50', {
  variants: {
    variant: {
      default: 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-action bg-action px-[17px] py-2.5 text-sm font-bold whitespace-nowrap text-on-action hover:bg-action-hover [&_.icon]:brightness-0 [&_.icon]:invert',
      secondary: 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-border bg-surface px-[17px] py-2.5 text-sm font-bold whitespace-nowrap text-primary hover:bg-control-hover',
      ghost: 'inline-flex items-center justify-center border-0 bg-transparent',
      action: 'min-h-11 rounded-lg border border-border bg-surface px-[11px] py-2 text-[13px] font-[650] whitespace-nowrap text-primary hover:bg-control-hover mobile:px-2.5 mobile:text-xs',
      candidate: 'min-h-11 max-w-full rounded-lg border border-border bg-surface-soft px-3 py-2 text-left text-[13px] font-[650] text-primary wrap-anywhere hover:bg-control aria-pressed:border-action aria-pressed:bg-panel aria-pressed:shadow-[inset_0_0_0_1px_#536F91]',
      plain: '',
    },
    size: {
      default: '',
      icon: 'inline-flex size-11 shrink-0 items-center justify-center rounded-[9px] p-0',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export function Button({ className, variant = 'default', size = 'default', asChild = false, ...props }:
  ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" data-variant={variant} data-size={size}
    className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
