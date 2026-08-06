import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/pickem/program";
import { VerifyForm } from "./VerifyForm";

export default async function VerificarPage({
  params,
}: {
  params: Promise<{ programa: string }>;
}) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program) notFound();

  return (
    <div className="sg-screen">
      <div className="sg-pad">
        <div>
          <div className="sg-eyebrow">Último paso</div>
          <h1 className="sg-display" style={{ marginTop: 6 }}>
            Confirma
            <br />
            tu número
          </h1>
          <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
            Es una sola vez en toda la temporada. Las otras 17 jornadas entras directo.
          </p>
        </div>

        {/* useSearchParams needs a Suspense boundary or the whole route opts out
            of static rendering. */}
        <Suspense fallback={<div className="sg-foot">Cargando…</div>}>
          <VerifyForm slug={program.slug} openWeek={program.openWeek} />
        </Suspense>

        <p className="sg-foot" style={{ margin: 0 }}>
          Verificamos el número para que nadie más pueda jugar con el tuyo ni quedarse
          con tus puntos. Sin eso, el ranking no valdría nada.
        </p>
      </div>
    </div>
  );
}
