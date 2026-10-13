export default function AdminLoading() {
  return <div className="space-y-6" aria-label="Loading">
    <div className="h-24 animate-pulse rounded-lg border bg-white" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-lg border bg-white" />)}
    </div>
    <div className="h-96 animate-pulse rounded-lg border bg-white" />
  </div>;
}
