import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 px-6 py-16 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Skeleton className="h-5 w-64" />
        </div>

        <Skeleton className="h-10 w-[28rem] max-w-full" />
        <Skeleton className="mt-4 h-4 w-[34rem] max-w-full" />
        <Skeleton className="mt-2 h-4 w-[30rem] max-w-full" />

        <div className="mt-10 space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

