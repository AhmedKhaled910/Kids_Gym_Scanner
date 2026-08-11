import { loginWithPin } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🧸</div>
          <h1 className="text-xl font-bold text-gray-800">Kids Area Staff Login</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your PIN to access the scanner</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 text-center">
            ❌ Incorrect PIN. Please try again.
          </div>
        )}

        <form action={loginWithPin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Staff Name
            </label>
            <input
              name="staffName"
              type="text"
              required
              placeholder="e.g. Ahmed Khaled"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PIN
            </label>
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              required
              placeholder="••••"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-3.5 text-base shadow-md transition"
          >
            🔓 Unlock Scanner
          </button>
        </form>
      </div>
    </main>
  );
}
