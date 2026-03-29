import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.exchangeCodeForSession(
      new URLSearchParams(window.location.search).get('code') ?? ''
    ).then(async ({ data, error }) => {
      if (error || !data.session) {
        navigate('/login', { replace: true })
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single()

      if (profile?.role) {
        navigate(profile.role === 'teacher' ? '/teacher' : '/student', { replace: true })
      } else {
        navigate('/setup-role', { replace: true })
      }
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