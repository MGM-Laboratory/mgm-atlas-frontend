import { Skeleton } from '@/components/ui/skeleton';

export function ProjectCardSkeleton({ width = 320 }: { width?: number }) {
  return (
    <div className="shrink-0 snap-start" style={{ width }}>
      <Skeleton className="aspect-[16/9] w-full rounded-lg" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}
