import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };

const LoadingSpinner = ({ size = 'md', className }: LoadingSpinnerProps) => (
  <div className={cn('flex items-center justify-center', className)}>
    <div className={cn('border-2 border-muted border-t-primary rounded-full animate-spin', sizes[size])} />
  </div>
);

export default LoadingSpinner;
