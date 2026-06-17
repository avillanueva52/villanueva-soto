import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function RestablecerPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tokenValido, setTokenValido] = useState(false)
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    // Cuando el usuario llega desde el link del email, Supabase procesa
    // automáticamente el token del hash de la URL y emite este evento.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTokenValido(true)
        setVerificando(false)
      }
    })

    // Por si el evento ya pasó antes de suscribirse, verificamos sesión
    setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setTokenValido(true)
        }
        setVerificando(false)
      })
    }, 500)

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError('No se pudo cambiar la contraseña: ' + updateError.message)
      return
    }

    setSuccess(true)
    // Cerrar sesión para que el usuario entre con la nueva contraseña
    setTimeout(async () => {
      await supabase.auth.signOut()
      navigate('/')
    }, 2500)
  }

  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a365d 0%, #2d4a73 100%)',
    padding: 20,
    fontFamily: 'Georgia, serif'
  }

  const cardStyle = {
    background: 'white',
    borderRadius: 12,
    padding: '40px 36px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  }

  if (verificando) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            <p style={{ color: '#666' }}>Verificando enlace...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!tokenValido && !success) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: '#1a365d', marginBottom: 12 }}>Enlace inválido o expirado</h2>
            <p style={{ color: '#666', marginBottom: 20, lineHeight: 1.5 }}>
              El enlace de recuperación no es válido o ya expiró.
              Solicita uno nuevo desde la pantalla de inicio de sesión.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{ background: '#1a365d', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 6, cursor: 'pointer', fontSize: '0.95rem', fontFamily: 'inherit' }}
            >
              Ir al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✓</div>
            <h2 style={{ color: '#057a55', marginBottom: 12 }}>¡Contraseña actualizada!</h2>
            <p style={{ color: '#666', marginBottom: 20 }}>
              Tu contraseña se cambió correctamente. Te llevaremos al inicio de sesión.
            </p>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ color: '#1a365d', fontSize: '1.5rem', margin: 0, marginBottom: 6 }}>
            VILLANUEVA &amp; SOTO
          </h1>
          <div style={{ color: '#999', fontSize: '0.8rem', letterSpacing: '1px' }}>ABOGADOS</div>
        </div>

        <h2 style={{ color: '#1a365d', fontSize: '1.15rem', marginBottom: 18, textAlign: 'center' }}>
          Nueva contraseña
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#444', fontWeight: 600 }}>
              Nueva contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="Mínimo 6 caracteres"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', color: '#444', fontWeight: 600 }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
              placeholder="Repite la nueva contraseña"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {error && (
            <div style={{ background: '#fee', color: '#c81e1e', padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#666' : '#1a365d',
              color: 'white',
              border: 'none',
              padding: '12px',
              borderRadius: 6,
              cursor: loading ? 'wait' : 'pointer',
              fontSize: '0.95rem',
              fontWeight: 600,
              fontFamily: 'inherit'
            }}
          >
            {loading ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}
