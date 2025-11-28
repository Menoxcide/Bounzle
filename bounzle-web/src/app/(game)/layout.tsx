import InstallPrompt from '@/components/InstallPrompt';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <main>{children}</main>
      <InstallPrompt />
    </div>
  );
}