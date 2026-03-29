# 🎬 HistoVid

**Plataforma de video interactivo para la clase de Historia**  
Inspirada en Edpuzzle · Nueva Escuela Mexicana · Google Workspace for Education

---

## ✨ Características

### Para docentes
- 🔐 Acceso con Google Workspace for Education
- 👥 Creación de grupos con código de invitación único
- 🎬 Asignación de videos (YouTube, Vimeo, mp4) con:
  - Tema del día
  - Objetivo de aprendizaje
  - Proceso de desarrollo NEM (opcional)
- ❓ Preguntas interactivas durante el video:
  - **Opción múltiple** — el video se pausa, el estudiante debe responder antes de continuar
  - **Verdadero / Falso**
  - **Pregunta abierta** (respuesta libre, con puntos por participación)
- 📊 Reportes completos:
  - Nombre y correo del estudiante
  - Timestamp de inicio y fin
  - Duración en la actividad
  - Calificación 0–100 calculada automáticamente
  - Tema y actividad
  - Exportar a CSV

### Para estudiantes
- 🔐 Acceso con Google (cuenta escolar)
- 📝 Unirse a grupos con código
- ▶️ Ver videos con preguntas integradas (el video **no avanza** hasta responder)
- 🏆 Calificación automática al completar
- 📌 Retomar actividades desde donde las dejó

---

## 🛠 Stack técnico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Autenticación | Supabase Auth (Google OAuth) |
| Base de datos | Supabase (PostgreSQL) |
| Video | react-player (YouTube, Vimeo, mp4) |
| Gráficas | Recharts |
| Deploy | Vercel / Netlify + Supabase |

---

## 🚀 Instalación y configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/histovid.git
cd histovid
npm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta el archivo `supabase/migrations/001_initial_schema.sql`
3. Ve a **Authentication → Providers → Google**:
   - Activa Google OAuth
   - Configura tu **Client ID** y **Client Secret** de Google Cloud Console
   - En **Authorized redirect URIs** de Google Cloud añade: `https://tu-proyecto.supabase.co/auth/v1/callback`

### 3. Configurar Google Cloud (para OAuth)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto o usa uno existente
3. Activa la **Google+ API** o **People API**
4. En **Credentials → OAuth 2.0 Client IDs**:
   - Tipo: Web application
   - Authorized JavaScript origins: `http://localhost:5173` y tu dominio en producción
   - Authorized redirect URIs: la URL de callback de Supabase

> **Nota para Google Workspace for Education**: En la consola de Google, puedes restringir el acceso solo a usuarios de tu dominio educativo en los ajustes de OAuth.

### 4. Variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

Encuentra estos valores en Supabase: **Settings → API**.

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173)

---

## 📁 Estructura del proyecto

```
histovid/
├── src/
│   ├── lib/
│   │   ├── supabase.ts          # Cliente Supabase + tipos TypeScript
│   │   └── auth.tsx             # Context de autenticación
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── AuthCallback.tsx
│   │   ├── SetupRolePage.tsx
│   │   ├── teacher/
│   │   │   ├── TeacherDashboard.tsx
│   │   │   ├── TeacherGroups.tsx
│   │   │   ├── TeacherAssignments.tsx
│   │   │   ├── CreateAssignment.tsx  ← Editor de actividades + preguntas
│   │   │   └── TeacherReports.tsx   ← Reportes con gráficas y CSV
│   │   └── student/
│   │       ├── StudentDashboard.tsx
│   │       └── WatchVideo.tsx       ← Reproductor interactivo
│   ├── components/
│   │   └── shared/
│   │       └── Layout.tsx           ← Sidebar + navegación
│   ├── App.tsx                      ← Router principal
│   └── main.tsx
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   ← Schema completo con RLS
├── .env.example
└── README.md
```

---

## 🗃 Esquema de base de datos

```
profiles          → Usuarios (docentes y estudiantes)
groups            → Grupos creados por docentes
group_members     → Relación estudiante ↔ grupo
video_assignments → Actividades de video con metadatos NEM
questions         → Preguntas asociadas a timestamps del video
student_sessions  → Sesiones de reproducción por estudiante
student_answers   → Respuestas de cada estudiante por pregunta
```

**Row Level Security (RLS)** está activado en todas las tablas:
- Los docentes solo ven sus propios grupos y actividades
- Los estudiantes solo ven actividades de los grupos en que están inscritos
- Las calificaciones se calculan automáticamente via triggers de PostgreSQL

---

## 🚢 Deploy en producción

### Vercel

```bash
npm run build
# Sube a GitHub y conecta en vercel.com
# Configura las env vars: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
```

### Supabase (producción)

En **Authentication → URL Configuration**:
- Site URL: `https://tu-dominio.com`
- Redirect URLs: `https://tu-dominio.com/auth/callback`

---

## 📋 Flujo de uso

### Docente
1. Inicia sesión con Google Workspace
2. Selecciona rol "Docente"
3. Crea un grupo → obtiene código de invitación
4. Crea actividad: pega URL de YouTube, llena tema y objetivo NEM
5. Agrega preguntas indicando en qué minuto pausar el video
6. Publica la actividad
7. Revisa reportes con calificaciones y tiempos

### Estudiante
1. Inicia sesión con Google
2. Selecciona rol "Estudiante"
3. Ingresa el código del grupo
4. Ve sus actividades asignadas
5. Reproduce el video → cuando llega a una pregunta, **el video se pausa automáticamente**
6. Debe responder antes de continuar
7. Al terminar, ve su calificación 0–100

---

## 🤝 Contribuir

1. Fork del repositorio
2. Crea una rama: `git checkout -b feature/mi-mejora`
3. Commit: `git commit -m 'feat: descripción'`
4. Push: `git push origin feature/mi-mejora`
5. Abre un Pull Request

---

## 📄 Licencia

MIT — libre para uso educativo.
