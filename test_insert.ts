import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '')

async function testInsert() {
  const email = 'luizclaudioamorimmarques@gmail.com'
  // Try to find user by email or just use the first available specialist for testing
  const { data: users } = await supabase.from('users').select('*').limit(10)
  console.log('Users found:', users?.map(u => ({ id: u.id, email: u.email, profile: u.profile })))

  const targetUser = users?.find(u => u.email === email) || users?.[0]
  if (!targetUser) {
    console.log('No user found to test insert')
    return
  }

  const { data: products } = await supabase.from('products').select('*').limit(1)
  if (!products || products.length === 0) {
    console.log('No products found')
    return
  }

  const payload = {
    user_id: targetUser.id,
    date: new Date().toISOString().split('T')[0],
    product_id: products[0].id,
    amount: 100.50
  }

  console.log('Testing insert with payload:', payload)
  const { data, error } = await supabase.from('productions').insert([payload]).select()
  
  if (error) {
    console.error('Insert failed:', error)
  } else {
    console.log('Insert succeeded:', data)
    // Clean up
    await supabase.from('productions').delete().eq('id', data[0].id)
    console.log('Cleanup: Deleted test production')
  }
}

testInsert()
