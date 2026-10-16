// Adapted from shadcn/ui (MIT). See LICENSE and README.md in this directory.
import type { ComponentProps } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva('cursor-pointer disabled:cursor-not-allowed disabled:opacity-50', {
  variants: {
    variant: {
      default: 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-primary bg-primary px-[17px] py-2.5 text-sm font-bold whitespace-nowrap text-white hover:bg-[#293F5C] [&_.icon]:brightness-0 [&_.icon]:invert',
      secondary: 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] border border-[#D0D9E4] bg-white px-[17px] py-2.5 text-sm font-bold whitespace-nowrap text-[#354F70] hover:bg-[#F1F4F8]',
      ghost: 'inline-flex items-center justify-center border-0 bg-transparent',
      action: 'min-h-11 rounded-lg border border-[#D9E1EB] bg-white px-[11px] py-2 text-[13px] font-[650] whitespace-nowrap text-[#354F70] hover:bg-[#F3F5F9] mobile:px-2.5 mobile:text-xs',
      candidate: 'min-h-11 max-w-full rounded-lg border border-[#DAE1EB] bg-[#F5F7FA] px-3 py-2 text-left text-[13px] font-[650] text-[#354F70] wrap-anywhere hover:bg-[#EAF0F6] aria-pressed:border-[#536F91] aria-pressed:bg-[#E4ECF7] aria-pressed:shadow-[inset_0_0_0_1px_#536F91]',
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
