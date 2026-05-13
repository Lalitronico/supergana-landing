"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { CSSProperties, FormEvent, forwardRef, useReducer, useRef, useState } from "react";
import { submitQuiniela } from "@/lib/quinielas/submit";
import type {
  AnswerValue,
  AnswersMap,
  ChoiceOption,
  PlayerRegistration,
  ProvisionalLeaderboardRow,
  Question,
  QuinielaContent,
  SubmissionSuccess,
} from "@/lib/quinielas/schema";
import "./quiniela.css";

type Stage = "intro" | "playing" | "register" | "submitting" | "success" | "ranking";

interface State {
  stage: Stage;
  questionIndex: number;
  answers: AnswersMap;
  player: PlayerRegistration;
  submitError: string | null;
  success: SubmissionSuccess | null;
}

type Action =
  | { type: "START" }
  | { type: "ANSWER"; questionId: string; value: AnswerValue }
  | { type: "NEXT"; total: number }
  | { type: "BACK" }
  | { type: "REGISTER" }
  | { type: "PLAYER"; player: PlayerRegistration }
  | { type: "SUBMITTING" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SUBMIT_SUCCESS"; data: SubmissionSuccess }
  | { type: "RANKING" }
  | { type: "SUCCESS" }
  | { type: "RESET_ERROR" };

const emptyPlayer: PlayerRegistration = { nickname: "", email: "" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START":
      return { ...state, stage: "playing", questionIndex: 0, submitError: null };
    case "ANSWER":
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.value },
        submitError: null,
      };
    case "NEXT": {
      const next = state.questionIndex + 1;
      if (next >= action.total) return { ...state, stage: "register" };
      return { ...state, questionIndex: next };
    }
    case "BACK":
      if (state.stage === "register") return { ...state, stage: "playing" };
      if (state.stage === "ranking") return { ...state, stage: "success" };
      if (state.stage === "success") return state;
      if (state.questionIndex === 0) return { ...state, stage: "intro" };
      return { ...state, questionIndex: state.questionIndex - 1 };
    case "REGISTER":
      return { ...state, stage: "register", submitError: null };
    case "PLAYER":
      return { ...state, player: action.player, submitError: null };
    case "SUBMITTING":
      return { ...state, stage: "submitting", submitError: null };
    case "SUBMIT_ERROR":
      return { ...state, stage: "register", submitError: action.message };
    case "SUBMIT_SUCCESS":
      return { ...state, stage: "success", success: action.data, submitError: null };
    case "RANKING":
      return { ...state, stage: "ranking" };
    case "SUCCESS":
      return { ...state, stage: "success" };
    case "RESET_ERROR":
      return { ...state, submitError: null };
    default:
      return state;
  }
}

export function QuinielaClient({ quiniela }: { quiniela: QuinielaContent }) {
  const reducedMotion = useReducedMotion();
  const [state, dispatch] = useReducer(reducer, {
    stage: "intro",
    questionIndex: 0,
    answers: {},
    player: emptyPlayer,
    submitError: null,
    success: null,
  });

  const currentQuestion = quiniela.questions[state.questionIndex];
  const isClosed = quiniela.status !== "open";
  const answeredCount = quiniela.questions.filter((q) => isAnswered(q, state.answers[q.id])).length;
  const canGoNext = currentQuestion ? isAnswered(currentQuestion, state.answers[currentQuestion.id]) : false;
  const previewScore = calculateAnsweredPoints(quiniela.questions, state.answers);

  const handleSubmit = async (player: PlayerRegistration) => {
    dispatch({ type: "PLAYER", player });
    dispatch({ type: "SUBMITTING" });
    const result = await submitQuiniela(quiniela.slug, player, state.answers);
    if (result.ok) dispatch({ type: "SUBMIT_SUCCESS", data: result.data });
    else dispatch({ type: "SUBMIT_ERROR", message: result.message });
  };

  return (
    <main className="quiniela-game min-h-[100dvh] overflow-hidden">
      <GameAtmosphere quiniela={quiniela} />
      <GameTopbar
        quiniela={quiniela}
        stage={state.stage}
        answeredCount={answeredCount}
        total={quiniela.questions.length}
      />

      <AnimatePresence mode="wait">
        {state.stage === "intro" && (
          <IntroPoster
            key="intro"
            quiniela={quiniela}
            isClosed={isClosed}
            onStart={() => dispatch({ type: "START" })}
            reducedMotion={Boolean(reducedMotion)}
          />
        )}

        {state.stage === "playing" && currentQuestion && (
          <QuestionScreen
            key={currentQuestion.id}
            quiniela={quiniela}
            question={currentQuestion}
            questionIndex={state.questionIndex}
            answers={state.answers}
            previewScore={previewScore}
            onAnswer={(value) =>
              dispatch({ type: "ANSWER", questionId: currentQuestion.id, value })
            }
            onBack={() => dispatch({ type: "BACK" })}
            onNext={() => dispatch({ type: "NEXT", total: quiniela.questions.length })}
            canGoNext={canGoNext}
          />
        )}

        {state.stage === "register" && (
          <RegistrationGate
            key="register"
            quiniela={quiniela}
            player={state.player}
            answers={state.answers}
            previewScore={previewScore}
            error={state.submitError}
            onBack={() => dispatch({ type: "BACK" })}
            onSubmit={handleSubmit}
          />
        )}

        {state.stage === "submitting" && (
          <SubmittingScreen key="submitting" quiniela={quiniela} />
        )}

        {state.stage === "success" && state.success && (
          <SuccessScreen
            key="success"
            quiniela={quiniela}
            answers={state.answers}
            player={state.player}
            success={state.success}
            onRanking={() => dispatch({ type: "RANKING" })}
          />
        )}

        {state.stage === "ranking" && state.success && (
          <RankingScreen
            key="ranking"
            quiniela={quiniela}
            rows={state.success.leaderboard}
            currentRank={state.success.provisionalRank}
            currentScore={state.success.provisionalScore}
            onBack={() => dispatch({ type: "SUCCESS" })}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function GameAtmosphere({ quiniela }: { quiniela: QuinielaContent }) {
  return (
    <div className="q-atmosphere" aria-hidden="true">
      <div className="q-paper" />
      <div className="q-stadium-glow" />
      <Image
        src={quiniela.theme.assets.confetti}
        alt=""
        width={1200}
        height={400}
        className="q-confetti-strip"
        priority
      />
      <div className="q-doodle q-doodle-a" />
      <div className="q-doodle q-doodle-b" />
      <div className="q-doodle q-doodle-c" />
    </div>
  );
}

function GameTopbar({
  quiniela,
  stage,
  answeredCount,
  total,
}: {
  quiniela: QuinielaContent;
  stage: Stage;
  answeredCount: number;
  total: number;
}) {
  return (
    <header className="q-topbar">
      <Link href="/" className="q-brand" aria-label="Supergana inicio">
        Supergana<span>.</span>
      </Link>
      <div className="q-topbar-center">
        <span>{quiniela.theme.teams.home.shortLabel}</span>
        <strong>VS</strong>
        <span>{quiniela.theme.teams.away.shortLabel}</span>
      </div>
      <div className="q-topbar-chip">
        {stage === "playing" ? `${answeredCount}/${total}` : "Final"}
      </div>
    </header>
  );
}

function IntroPoster({
  quiniela,
  isClosed,
  onStart,
  reducedMotion,
}: {
  quiniela: QuinielaContent;
  isClosed: boolean;
  onStart: () => void;
  reducedMotion: boolean;
}) {
  return (
    <motion.section
      className="q-intro"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ type: "spring", stiffness: 90, damping: 18 }}
    >
      <div className="q-intro-poster">
        <div className="q-poster-bg">
          <Image src={quiniela.theme.assets.poster} alt="" fill priority className="object-cover" />
        </div>
        <div className="q-poster-content">
          <div className="q-poster-copy">
            <span className="q-sticker-label">Quiniela especial</span>
            <h1>
              Final
              <span>Champions</span>
            </h1>
            <div className="q-versus-title">
              <Image
                src={quiniela.theme.teams.home.crestAsset}
                alt="PSG"
                width={112}
                height={112}
              />
              <em>VS</em>
              <Image
                src={quiniela.theme.teams.away.crestAsset}
                alt="Arsenal"
                width={112}
                height={112}
              />
            </div>
            <p>
              Llena tu boleto para Budapest: marcador, héroes inesperados, tensión de
              banca y ese momento absurdo que todos van a comentar.
            </p>
          </div>

          <div className="q-poster-stage">
            <motion.div
              className="q-mascot q-mascot-left"
              animate={reducedMotion ? undefined : { y: [0, -10, 0], rotate: [-2, 2, -2] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src={quiniela.theme.teams.home.mascotAsset}
                alt=""
                width={402}
                height={456}
                priority
              />
            </motion.div>
            <motion.div
              className="q-trophy"
              animate={reducedMotion ? undefined : { scale: [1, 1.04, 1], rotate: [0, -2, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src={quiniela.theme.assets.trophy}
                alt=""
                width={800}
                height={800}
                priority
              />
            </motion.div>
            <motion.div
              className="q-mascot q-mascot-right"
              animate={reducedMotion ? undefined : { y: [0, 12, 0], rotate: [2, -2, 2] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src={quiniela.theme.teams.away.mascotAsset}
                alt=""
                width={402}
                height={456}
                priority
              />
            </motion.div>
          </div>
        </div>

        <div className="q-intro-bottom">
          <InfoTicket label="Cierre" value="30 mayo - 11:00 CDMX" />
          <InfoTicket label="Partido" value="Puskás Aréna" />
          <InfoTicket label="Preguntas" value="14 rondas" />
          <button className="q-primary-button" type="button" onClick={onStart} disabled={isClosed}>
            {isClosed ? "Quiniela cerrada" : "Comenzar quiniela"}
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function InfoTicket({ label, value }: { label: string; value: string }) {
  return (
    <div className="q-ticket">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuestionScreen({
  quiniela,
  question,
  questionIndex,
  answers,
  previewScore,
  onAnswer,
  onBack,
  onNext,
  canGoNext,
}: {
  quiniela: QuinielaContent;
  question: Question;
  questionIndex: number;
  answers: AnswersMap;
  previewScore: number;
  onAnswer: (value: AnswerValue) => void;
  onBack: () => void;
  onNext: () => void;
  canGoNext: boolean;
}) {
  const progress = ((questionIndex + 1) / quiniela.questions.length) * 100;
  const selected = answers[question.id];

  return (
    <motion.section
      className="q-question-wrap"
      initial={{ opacity: 0, x: 34, rotate: 0.6 }}
      animate={{ opacity: 1, x: 0, rotate: 0 }}
      exit={{ opacity: 0, x: -34, rotate: -0.6 }}
      transition={{ type: "spring", stiffness: 110, damping: 18 }}
    >
      <div className="q-game-card">
        <div className="q-progress-row">
          <span>
            Pregunta {questionIndex + 1} de {quiniela.questions.length}
          </span>
          <strong>{previewScore} pts</strong>
        </div>
        <div className="q-progress-track">
          <motion.div
            className="q-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>

        <div className="q-question-stage">
          <div className="q-question-head">
            <div>
              <span className={`q-category q-category-${question.category}`}>{question.kicker}</span>
              <h2>{question.prompt}</h2>
              {question.helper && <p>{question.helper}</p>}
            </div>
            <Badge points={question.points} badge={question.badge} />
          </div>
          <QuestionScene question={question} />
        </div>

        <AnswerControls
          quiniela={quiniela}
          question={question}
          value={selected}
          onChange={onAnswer}
        />

        <QuestionSidekick question={question} />

        <div className="q-nav-row">
          <button className="q-secondary-button" type="button" onClick={onBack}>
            Atrás
          </button>
          <button className="q-primary-button" type="button" onClick={onNext} disabled={!canGoNext}>
            {questionIndex === quiniela.questions.length - 1 ? "Guardar datos" : "Siguiente"}
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function Badge({ points, badge }: { points: number; badge?: Question["badge"] }) {
  const label =
    badge === "legendaria"
      ? "Legendaria"
      : badge === "bonus"
        ? "Bonus"
        : badge === "multiplicador"
          ? "Multiplicador"
          : points === 0
            ? "Desempate"
            : `+${points} pts`;

  return <div className={`q-badge ${badge ? `q-badge-${badge}` : ""}`}>{label}</div>;
}

function QuestionScene({ question }: { question: Question }) {
  if (!question.sceneAsset) return null;
  return (
    <div className="q-question-scene" aria-hidden="true">
      <Image src={question.sceneAsset} alt="" width={360} height={240} />
    </div>
  );
}

function QuestionSidekick({ question }: { question: Question }) {
  if (!question.sidekickAsset || !question.sidekickText) return null;
  return (
    <div className="q-mobile-mascot" aria-hidden="true">
      <Image src={question.sidekickAsset} alt="" width={220} height={220} />
      <span>{question.sidekickText}</span>
    </div>
  );
}

function AnswerControls({
  quiniela,
  question,
  value,
  onChange,
}: {
  quiniela: QuinielaContent;
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  if (question.type === "team-duel") {
    const teams = [quiniela.theme.teams.home, quiniela.theme.teams.away];
    return (
      <div className="q-team-grid">
        {teams.map((team) => (
          <OptionButton
            key={team.id}
            selected={value === team.id}
            color={team.color}
            onClick={() => onChange(team.id)}
            className="q-team-option"
          >
            <div className="q-team-visual" aria-hidden="true">
              <Image src={team.crestAsset} alt="" width={86} height={86} className="q-team-crest" />
              <Image src={team.mascotAsset} alt="" width={140} height={140} className="q-team-mascot" />
            </div>
            <strong>{team.label}</strong>
            <small>{team.id === "psg" ? "Azul parisino" : "Rojo londinense"}</small>
          </OptionButton>
        ))}
        {question.allowNone && (
          <OptionButton
            selected={value === "none"}
            color="#FFD93D"
            onClick={() => onChange("none")}
            className="q-team-option q-team-option-wide"
          >
            {question.noneAsset ? (
              <div className="q-choice-art">
                <Image src={question.noneAsset} alt="" width={300} height={240} />
              </div>
            ) : (
              <span className="q-none-ball">0-0</span>
            )}
            <strong>{question.noneLabel ?? "Ninguno"}</strong>
            {question.noneCaption && <small>{question.noneCaption}</small>}
          </OptionButton>
        )}
      </div>
    );
  }

  if (question.type === "score-picker") {
    const score =
      typeof value === "object" && value && "home" in value
        ? value
        : { home: 1, away: 1 };
    const update = (side: "home" | "away", delta: number) => {
      onChange({
        ...score,
        [side]: Math.max(0, Math.min(question.max, score[side] + delta)),
      });
    };

    return (
      <div className="q-score-picker">
        <ScoreTeam
          label={quiniela.theme.teams.home.label}
          crest={quiniela.theme.teams.home.crestAsset}
          value={score.home}
          onMinus={() => update("home", -1)}
          onPlus={() => update("home", 1)}
        />
        <div className="q-score-vs">VS</div>
        <ScoreTeam
          label={quiniela.theme.teams.away.label}
          crest={quiniela.theme.teams.away.crestAsset}
          value={score.away}
          onMinus={() => update("away", -1)}
          onPlus={() => update("away", 1)}
        />
      </div>
    );
  }

  if (question.type === "player-card") {
    return (
      <div className="q-player-grid">
        {question.options.map((option) => (
          <OptionButton
            key={option.id}
            selected={value === option.id}
            color={option.team === "psg" ? "#004170" : option.team === "arsenal" ? "#EF0107" : "#FFD93D"}
            onClick={() => onChange(option.id)}
            className="q-player-option"
          >
            <div className="q-player-avatar">
              {option.asset ? (
                <Image
                  src={option.asset}
                  alt=""
                  fill
                  sizes="(max-width: 620px) 280px, 230px"
                  className={option.assetFit === "photo" ? "q-player-image-photo" : "q-player-image-sticker"}
                />
              ) : (
                <span>{option.label.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <strong>{option.label}</strong>
            {option.meta && <small>{option.meta}</small>}
          </OptionButton>
        ))}
      </div>
    );
  }

  if (question.type === "yes-no") {
    return (
      <div className="q-choice-grid q-choice-grid-two">
        {[
          {
            id: "yes",
            label: question.yesLabel ?? "Sí",
            caption: question.yesCaption ?? "Me la juego",
            asset: question.yesAsset,
          },
          {
            id: "no",
            label: question.noLabel ?? "No",
            caption: question.noCaption ?? "Ni de chiste",
            asset: question.noAsset,
          },
        ].map((option) => (
          <OptionButton
            key={option.id}
            selected={value === option.id}
            color={option.id === "yes" ? "#2ECC71" : "#FF4757"}
            onClick={() => onChange(option.id)}
            className="q-choice-option"
          >
            {option.asset && (
              <div className="q-choice-art">
                <Image src={option.asset} alt="" width={300} height={240} />
              </div>
            )}
            <strong>{option.label}</strong>
            <small>{option.caption}</small>
          </OptionButton>
        ))}
      </div>
    );
  }

  if (question.type === "time-tiebreaker") {
    const answer =
      typeof value === "object" && value && "minute" in value
        ? value
        : { minute: null, noGoal: false };
    return (
      <div className="q-tiebreaker-box">
        <label>
          <span>Minuto</span>
          <input
            type="number"
            min={0}
            max={120}
            value={answer.noGoal ? "" : answer.minute ?? ""}
            placeholder="23"
            disabled={answer.noGoal}
            onChange={(event) =>
              onChange({
                minute: event.target.value === "" ? null : Number(event.target.value),
                noGoal: false,
              })
            }
          />
        </label>
        <button
          type="button"
          className={answer.noGoal ? "is-selected" : ""}
          onClick={() => onChange({ minute: null, noGoal: !answer.noGoal })}
        >
          No hay gol
        </button>
      </div>
    );
  }

  return (
    <div className={question.options.length <= 3 ? "q-choice-grid" : "q-choice-grid q-choice-grid-four"}>
      {question.options.map((option, index) => (
        <ChoiceOptionButton
          key={option.id}
          option={option}
          index={index}
          selected={value === option.id}
          onClick={() => onChange(option.id)}
          drama={question.type === "drama-meter"}
        />
      ))}
    </div>
  );
}

function ChoiceOptionButton({
  option,
  index,
  selected,
  onClick,
  drama,
}: {
  option: ChoiceOption;
  index: number;
  selected: boolean;
  onClick: () => void;
  drama?: boolean;
}) {
  const fallbackColors = ["#004170", "#EF0107", "#FFD93D", "#1E90FF"];
  return (
    <OptionButton
      selected={selected}
      color={option.color ?? fallbackColors[index % fallbackColors.length]}
      onClick={onClick}
      className={drama ? "q-choice-option q-drama-option" : "q-choice-option"}
    >
      {option.asset && (
        <div className="q-choice-art">
          <Image src={option.asset} alt="" width={300} height={240} />
        </div>
      )}
      {drama && <span className="q-drama-level">{index + 1}</span>}
      <strong>{option.label}</strong>
      {option.caption && <small>{option.caption}</small>}
    </OptionButton>
  );
}

function ScoreTeam({
  label,
  crest,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  crest: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="q-score-team">
      <Image src={crest} alt="" width={76} height={76} />
      <strong>{label}</strong>
      <div className="q-score-controls">
        <button type="button" onClick={onMinus} aria-label={`Bajar goles de ${label}`}>
          -
        </button>
        <span>{value}</span>
        <button type="button" onClick={onPlus} aria-label={`Subir goles de ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

function OptionButton({
  selected,
  color,
  onClick,
  className,
  children,
}: {
  selected: boolean;
  color: string;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      className={className}
      data-selected={selected}
      style={{ "--option-color": color } as CSSProperties}
      onClick={onClick}
      whileTap={{ scale: 0.96, rotate: selected ? 0 : -1 }}
      layout
    >
      {children}
    </motion.button>
  );
}

function RegistrationGate({
  quiniela,
  player,
  answers,
  previewScore,
  error,
  onBack,
  onSubmit,
}: {
  quiniela: QuinielaContent;
  player: PlayerRegistration;
  answers: AnswersMap;
  previewScore: number;
  error: string | null;
  onBack: () => void;
  onSubmit: (player: PlayerRegistration) => void;
}) {
  const [nickname, setNickname] = useState(player.nickname);
  const [email, setEmail] = useState(player.email);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedNickname = nickname.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedNickname.length < 2) {
      setLocalError("Tu nickname necesita al menos 2 caracteres.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError("Escribe un email válido para guardar tu entrada.");
      return;
    }
    setLocalError(null);
    onSubmit({ nickname: trimmedNickname, email: trimmedEmail });
  };

  return (
    <motion.section
      className="q-register-wrap"
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
    >
      <div className="q-register-card">
        <div className="q-register-visual">
          <Image
            src={quiniela.theme.assets.celebratingMascot}
            alt=""
            width={1024}
            height={1024}
          />
          <div className="q-score-bubble">
            <span>Puntos provisionales</span>
            <strong>{previewScore}</strong>
          </div>
        </div>
        <form className="q-register-form" onSubmit={handleSubmit}>
          <span className="q-sticker-label">Último paso</span>
          <h2>Guarda tu quiniela</h2>
          <p>
            Primero jugaste, ahora dejamos tu entrada lista. El ranking final se calcula
            después del partido.
          </p>
          <label>
            <span>Nickname</span>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="ArsenalCat"
              maxLength={32}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              type="email"
            />
          </label>
          {(localError || error) && <div className="q-form-error">{localError || error}</div>}
          <div className="q-answer-recap">
            {Object.keys(answers).length} respuestas listas para entrar al tablero.
          </div>
          <div className="q-nav-row q-nav-row-form">
            <button className="q-secondary-button" type="button" onClick={onBack}>
              Revisar
            </button>
            <button className="q-primary-button" type="submit">
              Enviar quiniela
            </button>
          </div>
        </form>
      </div>
    </motion.section>
  );
}

function SubmittingScreen({ quiniela }: { quiniela: QuinielaContent }) {
  return (
    <motion.section className="q-submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="q-loader-card">
        <Image src={quiniela.theme.assets.trophy} alt="" width={240} height={240} />
        <h2>Guardando jugada...</h2>
        <div className="q-skeleton-bar" />
        <div className="q-skeleton-bar q-skeleton-short" />
      </div>
    </motion.section>
  );
}

function SuccessScreen({
  quiniela,
  answers,
  player,
  success,
  onRanking,
}: {
  quiniela: QuinielaContent;
  answers: AnswersMap;
  player: PlayerRegistration;
  success: SubmissionSuccess;
  onRanking: () => void;
}) {
  const shareRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const champion = answers.q01_campeon;
  const championLabel =
    champion === "psg" ? "PSG" : champion === "arsenal" ? "Arsenal" : "la final";

  const handleSharePng = async () => {
    if (!shareRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(shareRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        backgroundColor: "transparent",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `supergana-${quiniela.slug}-${player.nickname.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.click();
    } catch (error) {
      console.error("share export failed", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.section
      className="q-success-wrap"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
    >
      <div className="q-success-card">
        <div className="q-success-art">
          <Image src={quiniela.theme.assets.trophy} alt="" width={800} height={800} />
          <Image
            src={quiniela.theme.teams.home.mascotAsset}
            alt=""
            width={250}
            height={280}
            className="q-success-mascot-left"
          />
          <Image
            src={quiniela.theme.teams.away.mascotAsset}
            alt=""
            width={250}
            height={280}
            className="q-success-mascot-right"
          />
        </div>
        <div className="q-success-copy">
          <span className="q-sticker-label">Listo, ya participas</span>
          <h2>{player.nickname}, tu quiniela está viva</h2>
          <p>
            Vas con {championLabel}. Sumaste {success.provisionalScore} puntos de hype
            y entraste en el puesto {success.provisionalRank} del ranking provisional.
          </p>
          <div className="q-success-actions">
            <button className="q-primary-button" type="button" onClick={onRanking}>
              Ver ranking
            </button>
            <button className="q-secondary-button" type="button" onClick={handleSharePng}>
              {exporting ? "Generando..." : "Crear story PNG"}
            </button>
          </div>
          <small>ID {success.shareId}</small>
        </div>
      </div>
      <div className="q-share-render" aria-hidden="true">
        <ShareStoryCard
          ref={shareRef}
          quiniela={quiniela}
          player={player}
          answers={answers}
          success={success}
        />
      </div>
    </motion.section>
  );
}

function RankingScreen({
  quiniela,
  rows,
  currentRank,
  currentScore,
  onBack,
}: {
  quiniela: QuinielaContent;
  rows: ProvisionalLeaderboardRow[];
  currentRank: number;
  currentScore: number;
  onBack: () => void;
}) {
  const visibleRows =
    rows.length > 0
      ? rows
      : [
          {
            submission_id: "current",
            nickname: "Tu entrada",
            provisional_score: currentScore,
            final_score: null,
            rank: currentRank,
            created_at: new Date().toISOString(),
          },
        ];

  return (
    <motion.section
      className="q-ranking-wrap"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
    >
      <div className="q-ranking-card">
        <div className="q-ranking-head">
          <Image src={quiniela.theme.assets.medals} alt="" width={320} height={180} />
          <div>
            <span className="q-sticker-label">Ranking provisional</span>
            <h2>Tablero de hype</h2>
            <p>El ranking final se calcula después del partido con respuestas reales.</p>
          </div>
        </div>
        <ol className="q-ranking-list">
          {visibleRows.map((row) => (
            <li key={row.submission_id}>
              <span className="q-rank-num">{row.rank}</span>
              <strong>{row.nickname}</strong>
              <em>{row.provisional_score} pts</em>
            </li>
          ))}
        </ol>
        <button className="q-primary-button" type="button" onClick={onBack}>
          Volver a mi resultado
        </button>
      </div>
    </motion.section>
  );
}

const ShareStoryCard = forwardRef<
  HTMLDivElement,
  {
    quiniela: QuinielaContent;
    player: PlayerRegistration;
    answers: AnswersMap;
    success: SubmissionSuccess;
  }
>(function ShareStoryCard({ quiniela, player, answers, success }, ref) {
  const champion = answers.q01_campeon;
  const championLabel =
    champion === "psg" ? "PSG" : champion === "arsenal" ? "Arsenal" : "Final abierta";

  return (
    <div ref={ref} className="q-story-card">
      <Image src={quiniela.theme.assets.shareFrame} alt="" fill className="object-contain" />
      <div className="q-story-content">
        <span>Supergana presenta</span>
        <h3>Final Champions</h3>
        <strong>{championLabel}</strong>
        <p>{player.nickname} ya llenó su quiniela</p>
        <div>{success.provisionalScore} pts provisionales</div>
      </div>
    </div>
  );
});

function isAnswered(question: Question, value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (question.type === "score-picker") {
    return typeof value === "object" && "home" in value && "away" in value;
  }
  if (question.type === "time-tiebreaker") {
    return (
      typeof value === "object" &&
      "noGoal" in value &&
      (value.noGoal || typeof value.minute === "number")
    );
  }
  return typeof value === "string" && value.length > 0;
}

function calculateAnsweredPoints(questions: Question[], answers: AnswersMap) {
  return questions.reduce((total, question) => {
    if (!isAnswered(question, answers[question.id])) return total;
    return total + question.points;
  }, 0);
}
