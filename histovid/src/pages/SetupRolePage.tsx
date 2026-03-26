import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export default function SetupRolePage() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<'teacher' | 'student' | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!selected || !user) return
    setLoading(true)
    await supabase.from('profiles').upsert({ id: user.id, email: user.email!, role: selected, full_name: user.user_metadata?.full_name, avatar_url: user.user_metadata?.avatar_url })
    await refreshProfile()
    navigate(selected === 'teacher' ? '/teacher' : '/student', { replace: true })
  }

  return (
    <div className="min-h-screen bg-sepia-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-ink-900 mb-2">¿Cuál es tu rol?</h1>
          <p className="font-body text-ink-600">Esta selección determinará tu experiencia en HistoVid</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {(['teacher', 'student'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setSelected(role)}
              className={`p-6 rounded-sm border-2 text-center transition-all duration-200 ${
                selected === role
                  ? 'border-gold-400 bg-parchment-50 shadow-raised'
                  : 'border-parchment-300 bg-parchment-50/60 hover:border-gold-300'
              }`}
            >
              <div className="text-4xl mb-3">{role === 'teacher' ? '👩‍🏫' : '🎓'}</div>
              <p className="font-display text-xl font-semibold text-ink-800">
                {role === 'teacher' ? 'Docente' : 'Estudiante'}
              </p>
              <p className="text-sm text-ink-500 font-body mt-1">
                {role === 'teacher' ? 'Gestiono grupos y asigno videos' : 'Veo videos y respondo preguntas'}
              </p>
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selected || loading}
          className="w-full bg-crimson-500 text-parchment-50 font-body font-semibold py-3 rounded-sm hover:bg-crimson-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-manuscript"
        >
          {loading ? 'Guardando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
