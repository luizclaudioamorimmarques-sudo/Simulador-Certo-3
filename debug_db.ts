import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function test() {
  const { data, error } = await supabase.from('productions').select('*').limit(1)
  console.log('Production sample:', data)
  console.log('Error:', error)
  
  const { data: cols } = await supabase.rpc('get_table_columns', { table_name: 'productions' })
  console.log('Columns:', cols)
}

test()
