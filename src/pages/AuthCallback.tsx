import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
  supabase.auth.getSession().then(async ({ data, error }) => {
    if (error || !data.session) {
      setTimeout(async () => {
        const { data: retry } = await supabase.auth.getSession()
        if (retry.session) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', retry.session.user.id).single()
          navigate(profile?.role === 'teacher' ? '/teacher' : profile?.role === 'student' ? '/student' : '/setup-role', { replace: true })
        } else {
          navigate('/login', { replace: true })
        }
      }, 2000)
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).single()
    navigate(profile?.role === 'teacher' ? '/teacher' : profile?.role === 'student' ? '/student' : '/setup-role', { replace: true })
  })
}, [navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-sepia-100">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="font-body text-ink-600 text-lg">Verificando acceso...</p>
        <p className="font-body text-ink-400 text-sm mt-1">Iniciando sesión con Google Workspace</p>
      </div>
    </div>
  )
}