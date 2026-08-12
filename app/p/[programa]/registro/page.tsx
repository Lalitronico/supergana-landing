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
              <span className="pk-tag">Una sola puerta</span>
              {/* "Ponte la camiseta" was the new-player greeting, and it was on
                  the only entrance the module has — so a player coming back in
                  jornada 7 was told to join a game they were already in. The
                  title now says what the screen does, and the copy says the one
                  thing that matters: the same number gets you in either way.

                  It stops short of saying which one you are. `start` cannot
                  tell the browser whether a number is registered — that would
                  make this form a way to find out who plays — so the promise is
                  written for both readers and kept for both. */}
              <h1 className="sg-display" style={{ marginTop: 10 }}>
                Entra con tu
                <br />
                WhatsApp
              </h1>
              <p className="sg-body" style={{ marginTop: 8, marginBottom: 0 }}>
                Tu número y ya. Da igual si es tu primera jornada o si llevas media
                temporada — se entra por aquí, sin app que bajar ni contraseña que
                recordar.
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

          {/* The way back to the portada, which is the one screen the tabs do
              not name. At the end of the scroll rather than in a dock of its
              own: a return is not worth a permanent strip. */}
          <Link className="sg-btn ghost sm" href={`/p/${program.slug}/`}>
            Volver
          </Link>
        </div>
      </div>
    </>
  );
}
