import AdminPanel from "./components/AdminPanel";
import { listChildrenForQr } from "./actions";
import NavBar from "@/app/components/NavBar";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const children = await listChildrenForQr();

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <h1 className="font-bold text-gray-800">⚙️ Admin</h1>
        </div>
      </header>
      <div className="max-w-md mx-auto px-4 mt-4">
        <AdminPanel initialChildren={children} />
      </div>
      <NavBar active="admin" />
    </main>
  );
}
