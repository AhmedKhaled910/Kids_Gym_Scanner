import Link from "next/link";

export default function NavBar({ active }: { active: "dashboard" | "sessions" }) {
  const item = (
    href: string,
    key: "dashboard" | "sessions",
    icon: string,
    label: string
  ) => (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium ${
        active === key ? "text-indigo-600" : "text-gray-400"
      }`}
    >
      <span className="text-xl leading-none mb-0.5">{icon}</span>
      {label}
    </Link>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-w-md mx-auto flex">
      {item("/dashboard", "dashboard", "📷", "Scanner")}
      {item("/active-sessions", "sessions", "👥", "Active")}
    </nav>
  );
}
