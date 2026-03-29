import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Download, Filter, Users, TrendingUp, Clock, CheckSquare } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface ReportRow {
  student_name: string
  student_email: string
  assignment_title: string
  topic: string
  group_name: string
  started_at: string
  completed_at: string | null
  duration_seconds: number
  score: number
  is_completed: boolean
}

export default function TeacherReports() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [filtered, setFiltered] = useState<ReportRow[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    async function load() {
      const { data: myAssignments } = await supabase
        .from('video_assignments')
        .select('id, title')
        .eq('teacher_id', profile!.id)
        .order('created_at', { ascending: false })

      const assignmentIds = (myAssignments ?? []).map((a: any) => a.id)
      setAssignments(myAssignments ?? [])

      if (assignmentIds.length === 0) {
        setRows([])
        setFiltered([])
        setLoading(false)
        return
      }

      const { data: sessions } = await supabase
        .from('student_sessions')
        .select(`
          id, started_at, completed_at, duration_seconds, score, is_completed,
          profile:profiles!student_id(full_name, email),
          assignment:video_assignments!assignment_id(title, topic, group:groups(name))
        `)
        .in('assignment_id', assignmentIds)
        .order('started_at', { ascending: false })

      const mapped: ReportRow[] = (sessions ?? []).map((s: any) => ({
        student_name: s.profile?.full_name ?? 'Desconocido',
        student_email: s.profile?.email ?? '',
        assignment_title: s.assignment?.title ?? '',
        topic: s.assignment?.topic ?? '',
        group_name: s.assignment?.group?.name ?? '',
        started_at: s.started_at,
        completed_at: s.completed_at,
        duration_seconds: s.duration_seconds ?? 0,
        score: Math.round(s.score ?? 0),
        is_completed: s.is_completed,
      }))
      setRows(mapped)
      setFiltered(mapped)
      setLoading(false)
    }
    load()
  }, [profile?.id])

  useEffect(() => {
    if (selectedAssignment === 'all') {
      setFiltered(rows)
    } else {
      const title = assignments.find(a => a.id === selectedAssignment)?.title
      setFiltered(rows.filter(r => r.assignment_title === title))
    }
  }, [selectedAssignment, rows, assignments])

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  const avgScore = avg(filtered.map(r => r.score))
  const completionRate = filtered.length ? Math.round(filtered.filter(r => r.is_completed).length / filtered.length * 100) : 0
  const avgDuration = avg(filtered.map(r => r.duration_seconds))

  function formatDuration(s: number) {
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
  }

  const scoreDistribution = [
    { range: '0-20', count: filtered.filter(r => r.score <= 20).length },
    { range: '21-40', count: filtered.filter(r => r.score > 20 && r.score <= 40).length },
    { range: '41-60', count: filtered.filter(r => r.score > 40 && r.score <= 60).length },
    { range: '61-80', count: filtered.filter(r => r.score > 60 && r.score <= 80).length },
    { range: '81-100', count: filtered.filter(r => r.score > 80).length },
  ]

  const exportCSV = () => {
    const headers = ['Estudiante', 'Correo', 'Actividad', 'Tema', 'Grupo', 'Inicio', 'Fin', 'Duración', 'Calificación (0-100)', 'Completada']
    const csvRows = filtered.map(r => [
      r.student_name,
      r.student_email,
      r.assignment_title,
      r.topic,
      r.group_name,
      format(new Date(r.started_at), 'dd/MM/yyyy HH:mm'),
      r.completed_at ? format(new Date(r.completed_at), 'dd/MM/yyyy HH:mm') : '—',
      formatDuration(r.duration_seconds),
      r.score,
      r.is_completed ? 'Sí' : 'No',
    ])
    const csv = [headers, ...csvRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-histovid-${format(new Date(), 'yyyyMMdd')}.csv`
    a.click()
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-700'
    if (score >= 60) return 'text-gold-600'
    return 'text-crimson-500'
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">Reportes</h1>
          <p className="font-body text-ink-600 mt-1">Seguimiento del desempeño estudiantil</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 bg-ink-800 text-parchment-100 px-4 py-2.5 rounded-sm font-body font-medium hover:bg-ink-900 transition-colors shadow-manuscript">
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-ink-400" />
        <select
          value={selectedAssignment}
          onChange={e => setSelectedAssignment(e.target.value)}
          className="border border-parchment-300 rounded px-3 py-2 text-sm font-body text-ink-700 bg-white focus:outline-none focus:border-gold-400"
        >
          <option value="all">Todas las actividades</option>
          {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
        </select>
        <span className="text-sm text-ink-400 font-body">{filtered.length} registros</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Promedio general', value: `${avgScore}/100`, icon: TrendingUp, color: 'bg-gold-400/20 text-gold-600' },
          { label: 'Tasa de completado', value: `${completionRate}%`, icon: CheckSquare, color: 'bg-green-700/20 text-green-700' },
          { label: 'Total registros', value: filtered.length, icon: Users, color: 'bg-crimson-500/20 text-crimson-500' },
          { label: 'Duración promedio', value: formatDuration(avgDuration), icon: Clock, color: 'bg-ink-600/20 text-ink-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-5">
            <div className={`w-9 h-9 rounded flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
            <p className="text-xs text-ink-500 font-body mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6 mb-6">
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-4">Distribución de calificaciones</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={scoreDistribution} barSize={40}>
              <XAxis dataKey="range" tick={{ fontFamily: 'JetBrains Mono', fontSize: 12, fill: '#5c4424' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: '#7a5c34' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontFamily: 'Source Serif 4', background: '#fdf8f0', border: '1px solid #e8d3a9', borderRadius: 4 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scoreDistribution.map((_, i) => (
                  <Cell key={i} fill={['#9b1c1c', '#d4af37', '#d08030', '#2d7a4b', '#1a5c3a'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-parchment-200">
          <h2 className="font-display text-lg font-semibold text-ink-800">Detalle por estudiante</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center">
            <div className="spinner mx-auto mb-3" />
            <p className="font-body text-ink-500 text-sm">Cargando datos…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-ink-400 font-body">
            No hay datos de actividad todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sepia-100 border-b border-parchment-200">
                  {['Estudiante', 'Correo', 'Actividad / Tema', 'Grupo', 'Inicio', 'Duración', 'Calificación', 'Estado'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-parchment-200">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-sepia-100/40 transition-colors">
                    <td className="px-4 py-3 font-body font-medium text-ink-800 whitespace-nowrap">{r.student_name}</td>
                    <td className="px-4 py-3 text-ink-500 font-mono text-xs">{r.student_email}</td>
                    <td className="px-4 py-3">
                      <p className="font-body text-ink-800 leading-tight">{r.assignment_title}</p>
                      <p className="text-xs text-ink-400 mt-0.5">{r.topic}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{r.group_name}</td>
                    <td className="px-4 py-3 text-ink-500 font-mono text-xs whitespace-nowrap">
                      {format(new Date(r.started_at), 'dd/MM/yy HH:mm')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-600 whitespace-nowrap">{formatDuration(r.duration_seconds)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono font-bold text-base ${scoreColor(r.score)}`}>{r.score}</span>
                      <span className="text-ink-400 font-mono text-xs">/100</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono px-2 py-1 rounded ${r.is_completed ? 'bg-green-700/10 text-green-700' : 'bg-gold-400/20 text-gold-600'}`}>
                        {r.is_completed ? 'Completada' : 'En progreso'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
