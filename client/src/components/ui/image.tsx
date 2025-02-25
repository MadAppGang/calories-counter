import React from 'react';
import { cn } from '../../utils/cn';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export default function Image({
  src,
  alt,
  width,
  height,
  className,
  ...props
}: ImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn(className)}
      style={{
        maxWidth: '100%',
        height: 'auto',
        objectFit: 'cover',
        ...props.style,
      }}
      {...props}
    />
  );
} 