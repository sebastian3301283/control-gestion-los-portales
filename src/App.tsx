import { FormEvent, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, HelpCircle, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './lib/supabase'

type View = 'chooser' | 'corporate' | 'verify' | 'personal'

type MessageTone = 'info' | 'success' | 'error'

type UnitAccess = {
  code: 'HU' | 'DEP' | 'VS' | 'HOT' | 'CENTRAL'
  name: string
  unit_role: 'GERENTE_UNIDAD' | 'EQUIPO_UNIDAD' | 'GLOBAL'
}

type AccessContext = {
  user_id: string
  email: string
  full_name: string | null
  global_role: 'GESTION_ESTRATEGICA' | 'GERENTE_GENERAL' | null
  active: boolean
  global_access: boolean
  units: UnitAccess[]
}

function BrandMark() {
  return (
    <div className="brand-lockup" aria-label="Los Portales">
      <div className="brand-symbol" aria-hidden="true"><span /><span /></div>
      <div className="brand-name">Los Portales</div>
    </div>
  )
}

function roleLabel(access: AccessContext) {
  if (access.global_role === 'GESTION_ESTRATEGICA') return 'Gestión Estratégica'
  if (access.global_role === 'GERENTE_GENERAL') return 'Gerente General'
  if (access.units.some(unit => unit.unit_role === 'GERENTE_UNIDAD')) return 'Gerente de Unidad'
  return 'Equipo de Unidad'
}

function unitRoleLabel(role: UnitAccess['unit_role']) {
  if (role === 'GERENTE_UNIDAD') return 'Gerente de Unidad'
  if (role === 'EQUIPO_UNIDAD') return 'Equipo encargado'
  return 'Acceso global'
}

export default function App() {
  const [view, setView] = useState<View>('chooser')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('info')
  const [busy, setBusy] = useState(false)
  const [access, setAccess] = useState<AccessContext | null>(null)

  function setStatus(text: string, tone: MessageTone = 'info') {
    setMessage(text)
    setMessageTone(tone)
  }

  async function sendOtp(event: FormEvent) {
    event.preventDefault()
    setStatus('')

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return setStatus('Ingresa tu correo autorizado.', 'error')
    if (!isSupabaseConfigured || !supabase) {
      return setStatus('No se pudo conectar con el servicio de autenticación.', 'error')
    }

    setBusy(true)

    const { data: authorized, error: authorizationError } = await supabase.rpc('is_email_authorized', {
      email_input: normalizedEmail,
    })

    if (authorizationError) {
      setBusy(false)
      return setStatus('No pudimos validar tu acceso. Inténtalo nuevamente.', 'error')
    }

    if (!authorized) {
      setBusy(false)
      return setStatus('Este correo no está habilitado para ingresar a Control de Gestión.', 'error')
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    })

    setBusy(false)

    if (error) return setStatus(error.message, 'error')

    setEmail(normalizedEmail)
    setOtp('')
    setView('verify')
    setStatus(`Enviamos un código de acceso a ${normalizedEmail}.`, 'success')
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault()
    setStatus('')

    const token = otp.replace(/\s/g, '')
    if (!/^\d{6}$/.test(token)) {
      return setStatus('Ingresa el código de 6 dígitos que recibiste por correo.', 'error')
    }
    if (!supabase) return setStatus('No se pudo conectar con el servicio de autenticación.', 'error')

    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error) {
      setBusy(false)
      return setStatus('El código no es válido o ya venció. Solicita uno nuevo.', 'error')
    }

    const { data, error: accessError } = await supabase.rpc('current_access')
    setBusy(false)

    const currentAccess = data as AccessContext | null
    if (accessError || !currentAccess?.active) {
      await supabase.auth.signOut()
      return setStatus('Tu cuenta no tiene un perfil activo autorizado.', 'error')
    }

    if (!currentAccess.global_access && (!currentAccess.units || currentAccess.units.length === 0)) {
      await supabase.auth.signOut()
      return setStatus('Tu usuario está autorizado, pero todavía no tiene una unidad asignada.', 'error')
    }

    setAccess(currentAccess)
    setStatus('Acceso verificado correctamente.', 'success')
  }

  async function resendOtp() {
    if (!supabase || busy) return
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    setStatus(error ? error.message : 'Te enviamos un nuevo código de acceso.', error ? 'error' : 'success')
  }

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setStatus('')
    if (!email.trim() || !password) return setStatus('Completa correo y contraseña.', 'error')
    if (!isSupabaseConfigured || !supabase) return setStatus('No se pudo conectar con Supabase.', 'error')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    setStatus(error ? error.message : 'Sesión iniciada correctamente.', error ? 'error' : 'success')
  }

  const resetView = (next: View) => {
    setEmail('')
    setPassword('')
    setOtp('')
    setMessage('')
    setAccess(null)
    setView(next)
  }

  if (access) {
    return (
      <main className="auth-shell">
        <section className="brand-panel">
          <div className="brand-panel__top"><BrandMark /></div>
          <div className="brand-panel__content">
            <div className="eyebrow cyan"><ShieldCheck size={16} /> ACCESO VERIFICADO</div>
            <h1>Control de Gestión</h1>
            <div className="accent-line" />
            <p>Tu identidad corporativa y tus permisos fueron validados correctamente.</p>
          </div>
        </section>
        <section className="access-panel">
          <div className="access-card-wrap form-screen">
            <div className="form-icon"><CheckCircle2 /></div>
            <div className="eyebrow">BIENVENIDO</div>
            <h2>{access.full_name || access.email}</h2>
            <p className="subtitle">Tu acceso ya está listo. Estas son las unidades habilitadas para tu usuario.</p>
            <div className="security-banner">
              <ShieldCheck size={25}/>
              <div>
                <strong>{roleLabel(access)}</strong>
                <small>{access.global_access ? 'Acceso a las 5 unidades de negocio' : `${access.units.length} unidad${access.units.length === 1 ? '' : 'es'} asignada${access.units.length === 1 ? '' : 's'}`}</small>
              </div>
            </div>
            <div className="access-options">
              {access.units.map(unit => (
                <div className="access-option" key={unit.code}>
                  <span className="option-icon"><Building2 size={24}/></span>
                  <span className="option-copy"><strong>{unit.name}</strong><small>{unitRoleLabel(unit.unit_role)}</small></span>
                </div>
              ))}
            </div>
            <button className="submit-button" onClick={async () => { await supabase?.auth.signOut(); resetView('chooser') }}>Cerrar sesión</button>
          </div>
        </section>
      </main>
    )
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
                  <span className="option-copy"><strong>Ingresar con correo autorizado</strong><small>Recibe un código de acceso en tu correo para iniciar sesión de forma segura.</small></span>
                  <span className="arrow-circle"><ArrowRight size={23}/></span>
                </button>

                <button className="access-option access-option--disabled" disabled>
                  <span className="option-icon microsoft"><i/><i/><i/><i/></span>
                  <span className="option-copy"><strong>Continuar con Microsoft</strong><small>Inicio de sesión con Microsoft corporativo próximamente disponible.</small></span>
                  <span className="soon">PRÓXIMAMENTE</span>
                </button>
              </div>

              <div className="security-banner"><LockKeyhole size={25}/><div><strong>Comprometidos con tu seguridad</strong><small>Protegemos tu información aplicando buenas prácticas de seguridad.</small></div><ShieldCheck className="shield-bg" size={84}/></div>
              <div className="existing-account">¿Ya tienes una cuenta? <button onClick={() => resetView('personal')}>Iniciar sesión <ArrowRight size={17}/></button></div>
            </>
          ) : view === 'verify' ? (
            <OtpVerification
              email={email}
              otp={otp}
              busy={busy}
              message={message}
              tone={messageTone}
              onOtp={setOtp}
              onBack={() => resetView('corporate')}
              onVerify={verifyOtp}
              onResend={resendOtp}
            />
          ) : (
            <AuthForm
              view={view}
              email={email}
              password={password}
              busy={busy}
              message={message}
              tone={messageTone}
              onEmail={setEmail}
              onPassword={setPassword}
              onBack={() => resetView('chooser')}
              onSubmit={view === 'corporate' ? sendOtp : signIn}
            />
          )}
        </div>
      </section>
    </main>
  )
}

function OtpVerification(props: {
  email: string
  otp: string
  busy: boolean
  message: string
  tone: MessageTone
  onOtp: (value: string) => void
  onBack: () => void
  onVerify: (event: FormEvent) => void | Promise<void>
  onResend: () => void | Promise<void>
}) {
  return (
    <div className="form-screen">
      <button className="back-button" onClick={props.onBack}><ArrowLeft size={18}/> Cambiar correo</button>
      <div className="form-icon"><KeyRound/></div>
      <div className="eyebrow">VERIFICACIÓN DE ACCESO</div>
      <h2>Ingresa tu código</h2>
      <p className="subtitle">Enviamos un código de 6 dígitos a <strong>{props.email}</strong>.</p>
      <form className="auth-form" onSubmit={props.onVerify}>
        <label>Código de acceso
          <input
            className="otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={props.otp}
            onChange={e => props.onOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
          />
        </label>
        <button className="submit-button" type="submit" disabled={props.busy}>{props.busy ? 'Verificando...' : 'Verificar y continuar'}<ArrowRight size={19}/></button>
      </form>
      <button className="resend-button" type="button" disabled={props.busy} onClick={props.onResend}>No recibí el código · Reenviar</button>
      {props.message && <div className={`form-message form-message--${props.tone}`}><CheckCircle2 size={18}/>{props.message}</div>}
      <div className="form-security"><ShieldCheck size={18}/> El código es temporal y de un solo uso</div>
    </div>
  )
}

function AuthForm(props: {
  view: Exclude<View, 'chooser' | 'verify'>
  email: string
  password: string
  busy: boolean
  message: string
  tone: MessageTone
  onEmail: (value: string) => void
  onPassword: (value: string) => void
  onBack: () => void
  onSubmit: (event: FormEvent) => void | Promise<void>
}) {
  const corporate = props.view === 'corporate'
  const title = corporate ? 'Correo autorizado' : 'Iniciar sesión'
  const subtitle = corporate ? 'Validaremos que tu correo esté autorizado y luego te enviaremos un código de acceso.' : 'Ingresa con tu correo electrónico y contraseña.'

  return (
    <div className="form-screen">
      <button className="back-button" onClick={props.onBack}><ArrowLeft size={18}/> Volver</button>
      <div className="form-icon">{corporate ? <Mail/> : <Building2/>}</div>
      <div className="eyebrow">CONTROL DE GESTIÓN</div>
      <h2>{title}</h2>
      <p className="subtitle">{subtitle}</p>
      <form className="auth-form" onSubmit={props.onSubmit}>
        <label>Correo electrónico<input type="email" value={props.email} onChange={e => props.onEmail(e.target.value)} placeholder={corporate ? 'correo@ejemplo.com' : 'correo@ejemplo.com'} autoComplete="email" /></label>
        {!corporate && <label>Contraseña<input type="password" value={props.password} onChange={e => props.onPassword(e.target.value)} placeholder="Contraseña" autoComplete="current-password" /></label>}
        <button className="submit-button" type="submit" disabled={props.busy}>{props.busy ? 'Procesando...' : corporate ? 'Enviar código de acceso' : 'Iniciar sesión'}<ArrowRight size={19}/></button>
      </form>
      {props.message && <div className={`form-message form-message--${props.tone}`}><CheckCircle2 size={18}/>{props.message}</div>}
      <div className="form-security"><ShieldCheck size={18}/> Conexión segura y protegida</div>
    </div>
  )
}
