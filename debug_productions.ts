import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '')

async function debug() {
  const email = 'luizclaudioamorimmarques@gmail.com'
  const { data: users } = await supabase.from('users').select('*').eq('email', email)
  console.log('User profile:', users)

  if (users && users.length > 0) {
    const user = users[0]
    const { data: prods } = await supabase
      .from('productions')
      .select('*, product:products(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    console.log('Last 5 productions for user:', prods)
  }

  // Check table schema/columns for productions
  const { data: columns, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'productions' })
  if (colError) console.log('RPC get_table_columns failed (expected if not defined).')
  else console.log('Table columns:', columns)
}

debug()
