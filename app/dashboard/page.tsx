import { getStaffSession } from "@/lib/auth";
import CheckInDashboard from "./components/CheckInDashboard";
import NavBar from "@/app/components/NavBar";

export default async function DashboardPage() {
  const staffName = await getStaffSession();

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Signed in as</p>
            <p className="font-semibold text-gray-800">👤 {staffName}</p>
          </div>
          <span className="text-2xl">🧸</span>
        </div>
      </header>
      <CheckInDashboard />
      <NavBar active="dashboard" />
    </main>
  );
}
