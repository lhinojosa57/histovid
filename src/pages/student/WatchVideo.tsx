import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactPlayer from 'react-player'
import { useAuth } from '@/lib/auth'
import { supabase, VideoAssignment, Question, StudentSession, StudentAnswer } from '@/lib/supabase'
import { CheckCircle, ArrowLeft, Send, ChevronRight } from 'lucide-react'

type QuestionState = 'playing' | 'paused_question' | 'completed'

export default function WatchVideo() {
  const { assignmentId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const playerRef = useRef<ReactPlayer>(null)
  const lastUpdateRef = useRef<number>(Date.now())
  const durationAccRef = useRef<number>(0)

  const [assignment, setAssignment] = useState<VideoAssignment | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [session, setSession] = useState<StudentSession | null>(null)
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({})

  const [state, setState] = useState<QuestionState>('playing')
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set())
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; points: number } | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!profile?.id || !assignmentId) return

    async function load() {
      const [asgRes, qRes] = await Promise.all([
        supabase.from('video_assignments').select('*, group:groups(name)').eq('id', assignmentId).single(),
        supabase.from('questions').select('*').eq('assignment_id', assignmentId).order('timestamp_seconds'),
      ])
      if (!asgRes.data) { navigate('/student'); return }
      setAssignment(asgRes.data)
      setQuestions(qRes.data ?? [])

      let { data: sess } = await supabase
        .from('student_sessions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', profile!.id)
        .single()

      if (!sess) {
        const { data: newSess } = await supabase
          .from('student_sessions')
          .insert({ assignment_id: assignmentId, student_id: profile!.id })
          .select()
          .single()
        sess = newSess
      }
      setSession(sess)

      if (sess?.is_completed) {
        setCompleted(true)
        setLoading(false)
        return
      }

      if (sess?.id) {
        const { data: existingAnswers } = await supabase
          .from('student_answers')
          .select('*, question:questions(*)')
          .eq('session_id', sess.id)
        const ansMap: Record<string, StudentAnswer> = {}
        const answeredSet = new Set<string>()
        ;(existingAnswers ?? []).forEach((a: StudentAnswer) => {
          ansMap[a.question_id] = a
          answeredSet.add(a.question_id)
        })
        setAnswers(ansMap)
        setAnsweredQuestions(answeredSet)
      }

      if (sess?.max_video_position && sess.max_video_position > 0) {
        setTimeout(() => {
          playerRef.current?.seekTo(sess.max_video_position, 'seconds')
        }, 1500)
      }

      lastUpdateRef.current = Date.now()
      durationAccRef.current = sess?.duration_seconds ?? 0
      setLoading(false)
      setPlaying(true)
    }
    load()
  }, [profile?.id, assignmentId])

  useEffect(() => {
    if (!session || completed) return
    const interval = setInterval(async () => {
      const now = Date.now()
      const elapsed = Math.floor((now - lastUpdateRef.current) / 1000)
      lastUpdateRef.current = now
      durationAccRef.current += elapsed
      await supabase.from('student_sessions').update({ duration_seconds: durationAccRef.current }).eq('id', session.id)
    }, 15000)
    return () => clearInterval(interval)
  }, [session, completed])

  const handleProgress = useCallback(({ playedSeconds }: { playedSeconds: number }) => {
    if (session && playedSeconds > (session.max_video_position ?? 0)) {
      supabase.from('student_sessions').update({ max_video_position: playedSeconds }).eq('id', session.id)
    }
    for (const q of questions) {
      if (answeredQuestions.has(q.id)) continue
      const diff = Math.abs(playedSeconds - q.timestamp_seconds)
      if (diff < 0.8) {
        setPlaying(false)
        setActiveQuestion(q)
        setState('paused_question')
        setCurrentAnswer('')
        setAnswerResult(null)
        break
      }
    }
  }, [questions, answeredQuestions, session])

  const submitAnswer = async () => {
    if (!activeQuestion || !session || !profile?.id || !currentAnswer.trim()) return
    setSubmitting(true)

    let isCorrect: boolean | null = null
    let pointsEarned = 0

    if (activeQuestion.question_type === 'multiple_choice') {
      isCorrect = currentAnswer === activeQuestion.correct_answer
      pointsEarned = isCorrect ? activeQuestion.points : 0
    } else if (activeQuestion.question_type === 'true_false') {
      isCorrect = currentAnswer === activeQuestion.correct_answer
      pointsEarned = isCorrect ? activeQuestion.points : 0
    } else {
      isCorrect = null
      pointsEarned = Math.floor(activeQuestion.points * 0.5)
    }

    await supabase.from('student_answers').upsert({
      session_id: session.id,
      question_id: activeQuestion.id,
      student_id: profile!.id,
      answer_text: currentAnswer,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    })

    setAnswerResult({ correct: isCorrect ?? true, points: pointsEarned })
    setAnsweredQuestions(prev => new Set([...prev, activeQuestion.id]))
    setSubmitting(false)
  }

  const continueVideo = () => {
    setState('playing')
    setActiveQuestion(null)
    setAnswerResult(null)
    setCurrentAnswer('')
    setPlaying(true)
  }

  const handleVideoEnd = async () => {
    if (!session || !profile?.id) return
    setPlaying(false)

    const unanswered = questions.filter(q => !answeredQuestions.has(q.id))
    if (unanswered.length > 0) {
      setActiveQuestion(unanswered[0])
      setState('paused_question')
      return
    }

    const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000)
    durationAccRef.current += elapsed

    await supabase.from('student_sessions').update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      duration_seconds: durationAccRef.current,
    }).eq('id', session.id)

    setCompleted(true)
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-sepia-100 flex items-center justify-center p-4">
        <div className="bg-parchment-50 rounded-sm shadow-raised border border-parchment-200 p-10 max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-700/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-9 h-9 text-green-700" />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">¡Actividad completada!</h2>
          <p className="font-body text-ink-600 mb-6">{assignment?.title}</p>
          {session && (
            <div className="bg-sepia-100 rounded p-4 mb-6 border border-parchment-200">
              <p className="text-xs text-ink-500 font-mono uppercase tracking-wider mb-1">Tu calificación</p>
              <p className={`font-display text-5xl font-bold ${session.score >= 80 ? 'text-green-700' : session.score >= 60 ? 'text-gold-600' : 'text-crimson-500'}`}>
                {Math.round(session.score)}
              </p>
              <p className="font-mono text-ink-400 text-sm">/100</p>
            </div>
          )}
          <button onClick={() => navigate('/student')} className="w-full bg-crimson-500 text-parchment-50 py-3 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors">
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ borderColor: '#e8c07e', borderTopColor: '#d4af37' }} />
          <p className="text-parchment-200 font-body">Cargando actividad…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-900 flex flex-col">
      <div className="flex items-center gap-4 px-5 py-3 border-b border-ink-700">
        <button onClick={() => navigate('/student')} className="text-ink-400 hover:text-parchment-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-display text-parchment-100 font-semibold truncate">{assignment?.title}</p>
          <p className="text-ink-400 text-xs font-body truncate">{assignment?.topic} · {(assignment as any)?.group?.name}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-ink-400">
          <span className="text-gold-400">{answeredQuestions.size}</span>
          <span>/</span>
          <span>{questions.length}</span>
          <span className="text-ink-500">preguntas</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        <div className="flex-1 bg-black flex items-center justify-center relative min-h-0">
          <div className="w-full aspect-video max-h-[calc(100vh-120px)]">
            <ReactPlayer
              ref={playerRef}
              url={assignment?.video_url}
              playing={playing}
              controls={false}
              width="100%"
              height="100%"
              onProgress={handleProgress}
              onEnded={handleVideoEnd}
              progressInterval={500}
              config={{
                youtube: { playerVars: { disablekb: 1, modestbranding: 1, rel: 0, iv_load_policy: 3, fs: 0, playsinline: 1 } },
              }}
            />
          </div>

          {state === 'paused_question' && (
            <div className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-lg animate-slide-up">
                <QuestionOverlay
                  question={activeQuestion!}
                  currentAnswer={currentAnswer}
                  onAnswer={setCurrentAnswer}
                  onSubmit={submitAnswer}
                  submitting={submitting}
                  result={answerResult}
                  onContinue={continueVideo}
                />
              </div>
            </div>
          )}
        </div>

        <div className="lg:w-72 bg-ink-800 border-t lg:border-t-0 lg:border-l border-ink-700 overflow-y-auto">
          <div className="p-4 border-b border-ink-700">
            <h3 className="font-display text-parchment-100 font-semibold text-sm mb-1">Datos de la actividad</h3>
          </div>
          <div className="p-4">
            <p className="text-xs font-mono uppercase text-ink-400 tracking-wider mb-2">Progreso</p>
               <p className="text-parchment-300 font-body text-sm">
                    {answeredQuestions.size} de {questions.length} preguntas respondidas
                </p>
              </div>
            )}
            {assignment?.nem_process && (
              <div>
                <p className="text-xs font-mono uppercase text-ink-400 tracking-wider mb-1">Proceso NEM</p>
                <p className="text-sm font-body text-parchment-300 leading-relaxed">{assignment.nem_process}</p>
              </div>
            )}
            {questions.length > 0 && (
              <div>
                <p className="text-xs font-mono uppercase text-ink-400 tracking-wider mb-2">Preguntas</p>
                <div className="space-y-1.5">
                  {questions.map((q, i) => {
                    const answered = answeredQuestions.has(q.id)
                    return (
                      <div key={q.id} className={`flex items-center gap-2.5 py-1.5 px-2 rounded text-xs ${answered ? 'text-green-400' : 'text-ink-400'}`}>
                        <span className="w-4 h-4 flex-shrink-0">{answered ? '✓' : `${i + 1}.`}</span>
                        <span className="font-mono">{Math.floor(q.timestamp_seconds / 60)}:{String(Math.floor(q.timestamp_seconds % 60)).padStart(2, '0')}</span>
                        <span className="truncate font-body">{q.question_text.substring(0, 35)}…</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function QuestionOverlay({ question, currentAnswer, onAnswer, onSubmit, submitting, result, onContinue }: {
  question: Question
  currentAnswer: string
  onAnswer: (a: string) => void
  onSubmit: () => void
  submitting: boolean
  result: { correct: boolean; points: number } | null
  onContinue: () => void
}) {
  const typeLabel = {
    multiple_choice: 'Opción múltiple',
    true_false: 'Verdadero / Falso',
    open: 'Pregunta abierta',
  }[question.question_type]

  return (
    <div className="bg-parchment-50 rounded-sm shadow-raised border border-parchment-200 overflow-hidden">
      <div className="bg-crimson-500 px-5 py-3 flex items-center justify-between">
        <span className="text-parchment-100 text-xs font-mono uppercase tracking-wider">⏸ {typeLabel}</span>
        <span className="text-parchment-200 text-xs font-mono">{question.points} pts</span>
      </div>

      <div className="p-5">
        <p className="font-display text-lg font-semibold text-ink-800 mb-5 leading-snug">{question.question_text}</p>

        {result !== null ? (
          <div className={`rounded p-4 mb-4 border ${result.correct ? 'bg-green-700/10 border-green-700/20' : 'bg-crimson-500/10 border-crimson-500/20'}`}>
            <p className={`font-body font-semibold mb-1 ${result.correct ? 'text-green-700' : 'text-crimson-500'}`}>
              {question.question_type === 'open' ? '✓ Respuesta registrada' : result.correct ? '✓ ¡Correcto!' : '✗ Incorrecto'}
            </p>
            <p className="text-sm text-ink-600 font-body">
              {question.question_type === 'open'
                ? `+${result.points} puntos por responder`
                : result.correct
                ? `+${result.points} puntos`
                : question.correct_answer
                ? `La respuesta correcta era: ${question.question_type === 'true_false' ? (question.correct_answer === 'true' ? 'Verdadero' : 'Falso') : question.options?.find(o => o.id === question.correct_answer)?.text ?? question.correct_answer}`
                : ''
              }
            </p>
          </div>
        ) : (
          <>
            {question.question_type === 'multiple_choice' && question.options && (
              <div className="space-y-2 mb-4">
                {question.options.filter(o => o.text.trim()).map(opt => (
                  <label key={opt.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-all ${currentAnswer === opt.id ? 'border-gold-400 bg-gold-400/10' : 'border-parchment-300 hover:border-gold-300 bg-white'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${currentAnswer === opt.id ? 'border-gold-500 bg-gold-500' : 'border-parchment-400'}`} />
                    <span className="text-xs font-mono text-ink-400">{opt.id.toUpperCase()})</span>
                    <span className="font-body text-sm text-ink-800">{opt.text}</span>
                    <input type="radio" className="sr-only" checked={currentAnswer === opt.id} onChange={() => onAnswer(opt.id)} />
                  </label>
                ))}
              </div>
            )}

            {question.question_type === 'true_false' && (
              <div className="flex gap-3 mb-4">
                {[{ val: 'true', label: '✓ Verdadero' }, { val: 'false', label: '✗ Falso' }].map(({ val, label }) => (
                  <button key={val} onClick={() => onAnswer(val)} className={`flex-1 py-3 rounded border font-body font-medium transition-all ${currentAnswer === val ? 'border-gold-400 bg-gold-400/10 text-ink-800' : 'border-parchment-300 bg-white text-ink-600 hover:border-gold-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {question.question_type === 'open' && (
              <textarea
                value={currentAnswer}
                onChange={e => onAnswer(e.target.value)}
                rows={4}
                placeholder="Escribe tu respuesta aquí…"
                className="w-full border border-parchment-300 rounded px-3 py-2.5 font-body text-sm text-ink-800 bg-white focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 resize-none mb-4"
              />
            )}
          </>
        )}

        {result !== null ? (
          <button onClick={onContinue} className="w-full flex items-center justify-center gap-2 bg-crimson-500 text-parchment-50 py-3 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors">
            Continuar video <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={onSubmit} disabled={!currentAnswer.trim() || submitting} className="w-full flex items-center justify-center gap-2 bg-ink-800 text-parchment-100 py-3 rounded-sm font-body font-medium hover:bg-ink-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Send className="w-4 h-4" />
            {submitting ? 'Enviando…' : 'Responder'}
          </button>
        )}
      </div>
    </div>
  )
}
