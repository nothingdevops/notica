import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent)] text-white hover:opacity-90',
        outline:
          'border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-2)] hover:text-[var(--text-1)]',
        ghost:
          'text-[var(--text-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-1)]',
        destructive:
          'bg-[var(--failure-bg)] text-[var(--failure)] border border-[var(--failure)] border-opacity-30 hover:opacity-90',
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm:      'h-7 px-2.5 py-1',
        lg:      'h-9 px-4',
        icon:    'h-7 w-7 p-0',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
