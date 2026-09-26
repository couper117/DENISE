import { cn } from '../../lib/utils';

interface SkeletonProps { className?: string; }

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
);

export const ProductCardSkeleton = () => (
  <div className="flex h-full flex-col">
    <Skeleton className="aspect-[4/5] rounded-2xl" />
    <Skeleton className="mt-3 h-3 w-1/3" />
    <Skeleton className="mt-2 h-4 w-3/4" />
    <Skeleton className="mt-2 h-4 w-1/3" />
  </div>
);

export const ProductGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4">
    {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
  </div>
);

export default Skeleton;
