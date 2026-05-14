import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '')

async function checkProducts() {
  const { data: products } = await supabase.from('products').select('*')
  console.log('Products Count:', products?.length)
  console.log('Blocks:', Array.from(new Set(products?.map(p => p.block))))
  console.log('Sample Conquista products:', products?.filter(p => p.block === 'Conquista'))
}

checkProducts()
