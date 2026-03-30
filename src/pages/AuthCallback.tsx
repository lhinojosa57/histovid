import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      const { data, error } = await supabase.auth.getSession()

      if (error || !data.session) {
        setTimeout(async () => {
          const { data: retry } = await supabase.auth.getSession()
          if (retry.session) {
            await redirectUser(retry.session.user.email ?? '')
          } else {
            navigate('/login', { replace: true })
          }
        }, 2000)
        return
      }

      await redirectUser(data.session.user.email ?? '')
    }

    async function redirectUser(email: string) {
      // Check if email is in teachers table
      const { data: teacher } = await supabase
        .from('teachers')
        .select('email')
        .eq('email', email)
        .single()

      if (teacher) {
        // Update profile role to teacher
        await supabase.from('profiles').update({ role: 'teacher' }).eq('email', email)
        navigate('/teacher', { replace: true })
      } else {
        // Update profile role to student
        await supabase.from('profiles').update({ role: 'student' }).eq('email', email)
        navigate('/student', { replace: true })
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