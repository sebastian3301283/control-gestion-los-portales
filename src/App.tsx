import { FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, HelpCircle, LockKeyhole, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type View = 'chooser' | 'corporate' | 'signup' | 'personal'

function BrandMark() {
  return (
    <div className="brand-lockup" aria-label="Los Portales">
      <div className="brand-symbol" aria-hidden="true"><span /><span /></div>
      <div className="brand-name">Los Portales</div>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('chooser')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendOtp(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!email.trim()) return setMessage('Ingresa tu correo corporativo.')
    if (!isSupabaseConfigured || !supabase) {
      return setMessage('La interfaz está lista. Falta conectar las credenciales de Supabase para enviar el código OTP.')
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    setMessage(error ? error.message : 'Código enviado. Revisa tu correo corporativo.')
  }

  async function signUp(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!email.trim() || password.length < 8) return setMessage('Ingresa un correo válido y una contraseña de al menos 8 caracteres.')
    if (!isSupabaseConfigured || !supabase) return setMessage('La interfaz está lista. Falta conectar Supabase para crear cuentas.')
    setBusy(true)
    const { error } = await supabase.auth.signUp({ email: email.trim(), password })
    setBusy(false)
    setMessage(error ? error.message : 'Cuenta creada. Revisa tu correo para confirmar el registro.')
  }

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!email.trim() || !password) return setMessage('Completa correo y contraseña.')
    if (!isSupabaseConfigured || !supabase) return setMessage('La interfaz está lista. Falta conectar Supabase para iniciar sesión.')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    setMessage(error ? error.message : 'Sesión iniciada correctamente.')
  }

  const resetView = (next: View) => {
    setEmail('')
    setPassword('')
    setMessage('')
    setView(next)
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div className="brand-panel__top"><BrandMark /></div>
        <div className="brand-panel__content">
          <div className="eyebrow cyan"><ShieldCheck size={16} /> ACCESO PROTEGIDO</div>
          <h1>Bienvenido a<br />Control de Gestión</h1>
          <div className="accent-line" />
          <p>Plataforma corporativa para la gestión estratégica y operativa de Los Portales.</p>
        </div>
        <div className="city-art" aria-hidden="true">
          <span className="building b1"/><span className="building b2"/><span className="building b3"/><span className="building b4"/>
        </div>
        <div className="secure-note"><ShieldCheck size={26}/><div><strong>Acceso seguro y protegido</strong><span>Tu información está en buenas manos.</span></div></div>
      </section>

      <section className="access-panel">
        <button className="help-button"><HelpCircle size={18}/> ¿Necesitas ayuda?</button>
        <div className="access-card-wrap">
          {view === 'chooser' ? (
            <>
              <div className="eyebrow">PORTAL DE ACCESO</div>
              <h2>Elige cómo ingresar</h2>
              <p className="subtitle">Usa el método que corresponde a tu tipo de cuenta.</p>

              <div className="access-options">
                <button className="access-option access-option--primary" onClick={() => resetView('corporate')}>
                  <span className="option-icon"><Mail size={27}/></span>
                  <span className="option-copy"><strong>Ingresar con correo corporativo</strong><small>Recibe un código de acceso en tu correo empresarial para iniciar sesión de forma segura.</small></span>
                  <span className="arrow-circle"><ArrowRight size={23}/></span>
                </button>

                <button className="access-option access-option--disabled" disabled>
                  <span className="option-icon microsoft"><i/><i/><i/><i/></span>
                  <span className="option-copy"><strong>Continuar con Microsoft</strong><small>Inicio de sesión con Microsoft corporativo próximamente disponible.</small></span>
                  <span className="soon">PRÓXIMAMENTE</span>
                </button>

                <button className="access-option" onClick={() => resetView('signup')}>
                  <span className="option-icon"><UserPlus size={27}/></span>
                  <span className="option-copy"><strong>Crear una cuenta</strong><small>Regístrate utilizando tu correo electrónico para crear tu cuenta personal.</small></span>
                  <span className="arrow-circle light"><ArrowRight size={22}/></span>
                </button>
              </div>

              <div className="security-banner"><LockKeyhole size={25}/><div><strong>Comprometidos con tu seguridad</strong><small>Protegemos tu información aplicando buenas prácticas de seguridad.</small></div><ShieldCheck className="shield-bg" size={84}/></div>
              <div className="existing-account">¿Ya tienes una cuenta? <button onClick={() => resetView('personal')}>Iniciar sesión <ArrowRight size={17}/></button></div>
            </>
          ) : (
            <AuthForm
              view={view}
              email={email}
              password={password}
              busy={busy}
              message={message}
              onEmail={setEmail}
              onPassword={setPassword}
              onBack={() => resetView('chooser')}
              onSubmit={view === 'corporate' ? sendOtp : view === 'signup' ? signUp : signIn}
            />
          )}
        </div>
      </section>
    </main>
  )
}

function AuthForm(props: {
  view: Exclude<View, 'chooser'>
  email: string
  password: string
  busy: boolean
  message: string
  onEmail: (value: string) => void
  onPassword: (value: string) => void
  onBack: () => void
  onSubmit: (event: FormEvent) => void | Promise<void>
}) {
  const corporate = props.view === 'corporate'
  const signup = props.view === 'signup'
  const title = corporate ? 'Correo corporativo' : signup ? 'Crear una cuenta' : 'Iniciar sesión'
  const subtitle = corporate ? 'Te enviaremos un código de acceso de un solo uso a tu correo empresarial.' : signup ? 'Crea tu cuenta personal para acceder a la plataforma.' : 'Ingresa con tu correo electrónico y contraseña.'

  return (
    <div className="form-screen">
      <button className="back-button" onClick={props.onBack}><ArrowLeft size={18}/> Volver</button>
      <div className="form-icon">{corporate ? <Mail/> : signup ? <UserPlus/> : <Building2/>}</div>
      <div className="eyebrow">CONTROL DE GESTIÓN</div>
      <h2>{title}</h2>
      <p className="subtitle">{subtitle}</p>
      <form className="auth-form" onSubmit={props.onSubmit}>
        <label>Correo electrónico<input type="email" value={props.email} onChange={e => props.onEmail(e.target.value)} placeholder={corporate ? 'nombre@empresa.com' : 'correo@ejemplo.com'} autoComplete="email" /></label>
        {!corporate && <label>Contraseña<input type="password" value={props.password} onChange={e => props.onPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete={signup ? 'new-password' : 'current-password'} /></label>}
        <button className="submit-button" type="submit" disabled={props.busy}>{props.busy ? 'Procesando...' : corporate ? 'Enviar código de acceso' : signup ? 'Crear cuenta' : 'Iniciar sesión'}<ArrowRight size={19}/></button>
      </form>
      {props.message && <div className="form-message"><CheckCircle2 size={18}/>{props.message}</div>}
      <div className="form-security"><ShieldCheck size={18}/> Conexión segura y protegida</div>
    </div>
  )
}
