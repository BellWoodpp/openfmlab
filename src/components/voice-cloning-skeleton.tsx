import { Skeleton } from "@/components/ui/skeleton";

export function VoiceCloningSkeleton() {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-background/40 p-6 space-y-4">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background/40 p-6 space-y-4">
          <Skeleton className="h-4 w-52" />
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={`clone-skel-${idx}`} className="rounded-2xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-10 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

