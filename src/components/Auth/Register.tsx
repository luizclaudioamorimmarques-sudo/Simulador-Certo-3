import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User, UserProfile, Store } from '@/src/types';
import { User as UserIcon, Lock, IdCard, Store as StoreIcon, ArrowLeft } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface RegisterProps {
  onRegister: (user: User) => void;
  onBack: () => void;
  logoUrl?: string;
}

const PROFILES: UserProfile[] = ['Administrador', 'Especialista Santander', 'Especialista de loja', 'Líder'];

export default function Register({ onRegister, onBack, logoUrl }: RegisterProps) {
  const [name, setName] = useState('');
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<UserProfile | ''>('');
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchStores() {
      const { data } = await supabase.from('stores').select('*');
      if (data) setStores(data);
    }
    fetchStores();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!profile) {
      setError('Selecione um perfil');
      return;
    }

    if (password.length !== 6 || !/^\d+$/.test(password)) {
      setError('Senha deve ter 6 números');
      return;
    }

    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('users')
        .insert([{
          name,
          matricula,
          password,
          profile,
          store_id: profile === 'Administrador' ? null : (storeId || null)
        }])
        .select('*, store:stores(*)')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Matrícula já cadastrada');
        }
        throw new Error(insertError.message);
      }

      onRegister(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[320px] flex flex-col items-center">
      <div className="w-full mb-4 flex items-center">
        <button onClick={onBack} className="flex items-center text-gray-400 text-[10px] gap-1 font-black tracking-widest hover:text-white transition-colors">
          <span className="text-lg leading-none">←</span> VOLTAR
        </button>
      </div>

      <div className="w-full bg-white rounded-[40px] border-[6px] border-[#333] relative overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8">
          <h3 className="text-ferrari font-black italic text-2xl mb-8 tracking-tighter">CRIAR PERFIL</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Nome Completo"
              className="w-full bg-gray-50 p-4 rounded-xl text-xs font-black border border-transparent focus:border-ferrari outline-none transition-all placeholder:text-gray-300"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Matrícula"
              className="w-full bg-gray-50 p-4 rounded-xl text-xs font-black border border-transparent focus:border-ferrari outline-none transition-all placeholder:text-gray-300"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              required
            />

            <input
              type="password"
              placeholder="Senha de 6 números"
              maxLength={6}
              className="w-full bg-gray-50 p-4 rounded-xl text-xs font-black border border-transparent focus:border-ferrari outline-none transition-all placeholder:text-gray-300"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
              required
            />

            {profile !== 'Administrador' && (
              <select
                className="w-full bg-gray-50 p-4 rounded-xl text-xs font-black border border-transparent focus:border-ferrari outline-none transition-all text-gray-800"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                required={profile !== 'Administrador'}
              >
                <option value="">Escolha sua Loja</option>
                {stores.sort((a, b) => a.code.localeCompare(b.code)).map(s => (
                  <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                ))}
              </select>
            )}

            <div>
              <p className="text-[10px] font-black text-gray-400 mt-6 mb-3 uppercase tracking-widest">Selecione o seu Perfil:</p>
              <div className="grid grid-cols-2 gap-2">
                {PROFILES.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProfile(p)}
                    className={cn(
                      "p-3 text-[9px] font-black rounded-xl transition-all border-b-2 uppercase",
                      profile === p 
                        ? "bg-ferrari text-white border-ferrari-dark shadow-inner scale-95" 
                        : "bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-ferrari text-[10px] text-center font-black animate-pulse uppercase pt-2">{error}</p>}

            <div className="mt-8">
               <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-[9px] text-gray-500 font-bold border border-gray-100">
                 <span className="text-sm">ℹ️</span>
                 <span>Verifique todos os dados antes de confirmar o cadastro.</span>
               </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full bg-ferrari text-white font-black py-4 rounded-xl mt-6 shadow-xl border-b-4 border-ferrari-dark transition-all",
                loading ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-95"
              )}
            >
              {loading ? "PROCESSANDO..." : "CONFIRMAR CADASTRO"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
