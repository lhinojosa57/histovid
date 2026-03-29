import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase needs a moment to exchange the hash fragment for a session
    const handleCallback = async () => {
      // Give Supabase time to process the hash fragment (#access_token=...)
      const { data, error } = await supabase.auth.getSession()

      if (error || !data.session) {
        // If no session yet, wait a bit and try again
        setTimeout(async () => {
          const { data: retryData } = await supabase.auth.getSession()
          if (retryData.session) {
            await redirectByRole(retryData.session.user.id)
          } else {
            navigate('/login', { replace: true })
          }
        }, 1500)
        return
      }

      await redirectByRole(data.session.user.id)
    }

    const redirectByRole = async (userId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (profile?.role) {
        navigate(profile.role === 'teacher' ? '/teacher' : '/student', { replace: true })
      } else {
        navigate('/setup-role', { replace: true })
      }
    }

    handleCallback()
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
