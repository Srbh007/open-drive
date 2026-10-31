export default function OfflinePage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-bg text-text">
      <h1 className="text-2xl font-bold">You are offline</h1>
      <p className="mt-2 text-text-muted">Please check your internet connection.</p>
    </div>
  );
}
