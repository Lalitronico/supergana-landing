import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/pickem/program";
import { ChapaCharacter } from "../ChapaCharacter";
import { characterDir } from "../cast";
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
    <>
    <div className="sg-screen">
      <div className="sg-pad">
        <div className="pk-titlerow">
          <div>
            <span className="pk-tag">Segunda jugada</span>
            <h1 className="sg-display" style={{ marginTop: 10 }}>
              Confirma
              <br />
              tu número
            </h1>
            <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
              Una sola vez por temporada. Después entras directo.
            </p>
          </div>
          <ChapaCharacter
            dir={characterDir(program.theme.logoUrl)}
            name="lince-verificacion"
            size={112}
          />
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

        {/* The form already offers "Cambiar el número", which goes to the same
            place and says why. This is the plain way out for somebody who is
            not changing anything, at the end of the scroll. */}
        <Link className="sg-btn ghost sm" href={`/p/${program.slug}/registro/`}>
          Volver
        </Link>
      </div>
    </div>
    </>
  );
}
