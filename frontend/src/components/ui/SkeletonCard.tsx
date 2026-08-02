import { cn } from '../../lib/utils';

interface SkeletonProps { className?: string; }

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
);

export const ProductCardSkeleton = () => (
  <div className="bg-card rounded-xl border border-border overflow-hidden">
    <Skeleton className="h-64 rounded-none" />
    <div className="p-4 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 mt-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  </div>
);

export const ProductGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
  </div>
);

export default Skeleton;
