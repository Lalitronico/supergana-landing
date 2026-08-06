import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/pickem/program";
import { RegisterForm } from "./RegisterForm";

export default async function RegistroPage({
  params,
}: {
  params: Promise<{ programa: string }>;
}) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program) notFound();

  return (
    <>
      <div className="sg-screen">
        <div className="sg-pad">
          <div>
            <div className="sg-eyebrow">Jornada {program.openWeek} · Temporada {program.seasonYear}</div>
            <h1 className="sg-display" style={{ marginTop: 6 }}>
              Entra al
              <br />
              juego
            </h1>
            <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
              Nombre y WhatsApp. Nada más — ni app que bajar, ni contraseña que recordar.
            </p>
          </div>

          <RegisterForm slug={program.slug} />
        </div>
      </div>

      <div className="sg-dock">
        <Link className="sg-btn ghost sm" href={`/p/${program.slug}/`}>
          Volver
        </Link>
      </div>
    </>
  );
}
