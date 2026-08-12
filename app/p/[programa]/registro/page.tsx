import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgram } from "@/lib/pickem/program";
import { ChapaCharacter } from "../ChapaCharacter";
import { characterDir } from "../cast";
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
          <div className="pk-titlerow">
            <div>
              <span className="pk-tag">Entra a la quiniela</span>
              <h1 className="sg-display" style={{ marginTop: 10 }}>
                Ponte la
                <br />
                camiseta
              </h1>
              <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
                Tu apodo y tu WhatsApp. Con eso basta para entrar al juego — ni app que
                bajar, ni contraseña que recordar.
              </p>
            </div>
            <ChapaCharacter
              dir={characterDir(program.theme.logoUrl)}
              name="oso-registro"
              size={116}
            />
          </div>

          <div className="sg-foot">
            Jornada {program.openWeek} · Temporada {program.seasonYear}
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
