import { cn } from '../../lib/utils';

interface SkeletonProps { className?: string; }

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
);

export const ProductCardSkeleton = () => (
  <div className="flex h-full flex-col bg-card rounded-xl border border-border overflow-hidden">
    <Skeleton className="aspect-[4/3] rounded-none shrink-0" />
    <div className="flex flex-1 flex-col p-4">
      <Skeleton className="h-3 w-1/3 mb-2" />
      <Skeleton className="h-4 w-3/4 mb-1" />
      <Skeleton className="h-4 w-1/2 mb-3" />
      <div className="mt-auto flex gap-2">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-9" />
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
