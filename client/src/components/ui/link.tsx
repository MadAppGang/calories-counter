import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

export default function Link({
  href,
  children,
  className,
  ...props
}: LinkProps) {
  // If it's an external link (starts with http or https), use a regular anchor tag
  if (href.startsWith('http')) {
    return (
      <a 
        href={href} 
        className={cn(className)} 
        target="_blank" 
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  }
  
  // Otherwise, use React Router's Link component
  return (
    <RouterLink to={href} className={cn(className)} {...props}>
      {children}
    </RouterLink>
  );
} 