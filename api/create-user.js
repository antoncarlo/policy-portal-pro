import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('=== CREATE USER API START ===')
    
    const { email, password, full_name, phone, role, default_commission_percentage } = req.body

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      console.error('Missing required fields')
      return res.status(400).json({ error: 'Campi obbligatori mancanti' })
    }

    // Get Supabase credentials from environment
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('Supabase URL:', supabaseUrl)
    console.log('Service Key present:', !!supabaseServiceKey)
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return res.status(500).json({ error: 'Configurazione server mancante' })
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify requesting user is authenticated and is admin
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
      console.error('No authorization header')
      return res.status(401).json({ error: 'Token di autorizzazione mancante' })
    }

    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return res.status(401).json({ error: 'Token non valido' })
    }

    console.log('User authenticated:', user.id)

    // Check if user is admin
    const { data: userRole, error: roleQueryError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleQueryError) {
      console.error('Error querying user role:', roleQueryError)
      return res.status(500).json({ error: 'Errore verifica permessi' })
    }

    console.log('User role:', userRole?.role)

    if (!userRole || userRole.role !== 'admin') {
      console.error('User is not admin')
      return res.status(403).json({ error: 'Accesso negato: solo gli admin possono creare utenti' })
    }

    console.log('Admin verified, creating user...')

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
      },
    })

    if (authError) {
      console.error('Auth error:', authError)
      return res.status(400).json({ error: 'Errore creazione utente: ' + authError.message })
    }

    if (!authData.user) {
      console.error('No user data returned')
      return res.status(500).json({ error: 'Errore creazione utente' })
    }

    console.log('User created in auth:', authData.user.id)

    // Create profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      email,
      full_name,
      phone: phone || null,
      default_commission_percentage: default_commission_percentage || 0,
    })

    if (profileError) {
      console.error('Profile error:', profileError)
      // Rollback
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return res.status(400).json({ error: 'Errore creazione profilo: ' + profileError.message })
    }

    console.log('Profile created')

    // Create user role
    const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
      user_id: authData.user.id,
      role,
    })

    if (roleError) {
      console.error('Role error:', roleError)
      // Rollback
      await supabaseAdmin.from('profiles').delete().eq('id', authData.user.id)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return res.status(400).json({ error: 'Errore assegnazione ruolo: ' + roleError.message })
    }

    console.log('Role created, user setup complete')
    console.log('=== CREATE USER API SUCCESS ===')

    return res.status(200).json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name,
      }
    })

  } catch (error) {
    console.error('=== CREATE USER API ERROR ===')
    console.error('Error:', error)
    return res.status(500).json({ error: 'Errore interno: ' + error.message })
  }
}
