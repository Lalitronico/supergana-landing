import Link from "next/link";

export default function NotFound() {
  return (
    <main className="quiniela-game min-h-[100dvh] grid place-items-center px-6">
      <div className="q-loader-card max-w-md text-center">
        <span className="q-sticker-label">404</span>
        <h1>Quiniela perdida</h1>
        <p>Esta ruta no está activa o el enlace está mal escrito.</p>
        <Link href="/" className="q-primary-button">
          Ir a Supergana
        </Link>
      </div>
    </main>
  );
}
