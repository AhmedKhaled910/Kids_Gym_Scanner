import { getActiveSessions } from "@/app/dashboard/actions";
import ActiveSessionsList from "./components/ActiveSessionsList";
import NavBar from "@/app/components/NavBar";

export const dynamic = "force-dynamic"; // always show fresh check-in state

export default async function ActiveSessionsPage() {
  const sessions = await getActiveSessions();

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <h1 className="font-bold text-gray-800">👥 Currently Checked-In</h1>
          <p className="text-xs text-gray-400">{sessions.length} child(ren) in the nursery</p>
        </div>
      </header>
      <div className="max-w-md mx-auto px-4">
        <ActiveSessionsList sessions={sessions as any} />
      </div>
      <NavBar active="sessions" />
    </main>
  );
}
