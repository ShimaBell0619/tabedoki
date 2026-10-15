// Adapted from shadcn/ui (MIT). See LICENSE and README.md in this directory.
import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva('cursor-pointer disabled:cursor-not-allowed disabled:opacity-50', {
  variants: {
    variant: {
      default: 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-primary bg-primary px-[17px] py-2.5 text-sm font-bold whitespace-nowrap text-white hover:bg-[#0b554c] [&_.icon]:brightness-0 [&_.icon]:invert',
      secondary: 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-[#cbd8d3] bg-white px-[17px] py-2.5 text-sm font-bold whitespace-nowrap text-[#28574b] hover:bg-[#edf5f2]',
      ghost: 'inline-flex items-center justify-center border-0 bg-transparent',
      action: 'min-h-11 rounded-lg border border-[#d6e2db] bg-white px-[11px] py-2 text-[13px] font-[650] whitespace-nowrap text-[#365849] hover:bg-[#f0f6f2] mobile:px-2.5 mobile:text-xs',
      candidate: 'min-h-11 max-w-full rounded-lg border border-[#d4e2d9] bg-[#f4f8f5] px-3 py-2 text-left text-[13px] font-[650] text-[#2d5943] wrap-anywhere hover:bg-[#e9f2ec] aria-pressed:border-[#337d58] aria-pressed:bg-[#e0efe5] aria-pressed:shadow-[inset_0_0_0_1px_#337d58]',
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
