import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          
          // Variants
          variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
          variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
          variant === 'outline' && 'border border-input hover:bg-accent hover:text-accent-foreground',
          variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
          variant === 'link' && 'underline-offset-4 hover:underline text-primary',
          
          // Sizes
          size === 'default' && 'h-10 py-2 px-4',
          size === 'sm' && 'h-9 px-3 rounded-md',
          size === 'lg' && 'h-11 px-8 rounded-md',
          size === 'icon' && 'h-10 w-10',
          
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button }; 