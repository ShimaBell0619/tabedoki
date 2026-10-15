// Adapted from shadcn/ui (MIT); unused submenus, checkboxes and animation are omitted.
import type { ComponentProps } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from './utils';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} collisionPadding={8}
      className={cn('z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-[10px] border border-border bg-white p-1.5 text-foreground shadow-[0_8px_30px_#203d2926]', className)} {...props} />
  </DropdownMenuPrimitive.Portal>;
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item data-slot="dropdown-menu-item"
    className={cn('flex min-h-11 w-full cursor-pointer items-center rounded-lg border-0 bg-transparent p-2 text-left text-sm select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-[#edf3f1]', className)} {...props} />;
}
