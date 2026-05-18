import React, { useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { User } from '@/src/types';
import { User as UserIcon, Lock, LogIn } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface LoginProps {
  onLogin: (user: User) => void;
  onRegisterClick: () => void;
  logoUrl?: string;
}

export default function Login({ onLogin, onRegisterClick, logoUrl }: LoginProps) {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [recoveryStep, setRecoveryStep] = useState(1);
  const [recoveryMatricula, setRecoveryMatricula] = useState('');
  const [recoveryName, setRecoveryName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*, store:stores(*)')
        .eq('matricula', matricula)
        .eq('password', password)
        .single();

      if (fetchError || !data) {
        throw new Error('Matrícula ou senha inválida');
      }

      onLogin(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (recoveryStep === 1) {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('name')
          .eq('matricula', recoveryMatricula)
          .single();

        if (fetchError || !data) {
          throw new Error('Matrícula não encontrada');
        }
        setRecoveryStep(2);
      } else if (recoveryStep === 2) {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('id')
          .eq('matricula', recoveryMatricula)
          .eq('name', recoveryName)
          .single();

        if (fetchError || !data) {
          throw new Error('DADOS NÃO CONFEREM. VERIFIQUE SEU NOME COMPLETO.');
        }
        setRecoveryStep(3);
      } else {
        if (newPassword.length !== 6 || !/^\d+$/.test(newPassword)) {
          throw new Error('NOVA SENHA DEVE TER 6 NÚMEROS');
        }

        const { error: updateError } = await supabase
          .from('users')
          .update({ password: newPassword })
          .eq('matricula', recoveryMatricula);

        if (updateError) throw updateError;
        
        setError('SENHA ATUALIZADA COM SUCESSO!');
        setTimeout(() => {
          setView('login');
          setRecoveryStep(1);
          setError('');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[320px] flex flex-col items-center">
      <div className="w-full bg-white rounded-[40px] border-[6px] border-[#333] relative overflow-hidden flex flex-col shadow-2xl">
        <div className="bg-ferrari h-40 flex flex-col items-center justify-center pt-6 border-b-4 border-ferrari-dark">
          <div className="w-20 h-20 bg-white rounded-full border-4 border-white overflow-hidden flex items-center justify-center shadow-lg transition-transform hover:rotate-12">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <div className="text-ferrari font-black italic text-xl">S3</div>
            )}
          </div>
          <span className="text-white text-[10px] mt-2 font-black tracking-[0.2em] uppercase">Simulador Certo v3.0</span>
        </div>

        <div className="p-8 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-black text-gray-800 tracking-tighter uppercase whitespace-nowrap">
              {view === 'login' ? 'ACESSO RESTRITO' : 'RECUPERAR SENHA'}
            </h2>
            {view === 'forgot' && (
              <button 
                onClick={() => { setView('login'); setRecoveryStep(1); setError(''); }}
                className="text-[10px] font-black text-ferrari hover:opacity-70 transition-opacity"
              >
                VOLTAR
              </button>
            )}
          </div>
          
          {view === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-ferrari transition-colors">Matrícula</label>
                <input
                  type="text"
                  placeholder="Ex: 048291"
                  className="w-full border-b-2 border-gray-100 py-2 text-sm font-bold focus:border-ferrari outline-none transition-all"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  required
                />
              </div>

              <div className="group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-ferrari transition-colors">Senha de 6 números</label>
                <input
                  type="password"
                  placeholder="******"
                  className="w-full border-b-2 border-gray-100 py-2 text-sm font-bold focus:border-ferrari outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-ferrari text-[10px] text-center font-black animate-pulse uppercase">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full bg-ferrari text-white font-black py-4 rounded-xl shadow-xl transition-all border-b-4 border-ferrari-dark",
                  loading ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-95"
                )}
              >
                {loading ? "VERIFICANDO..." : "ENTRE"}
              </button>

              <button
                type="button"
                onClick={() => { setView('forgot'); setError(''); }}
                className="w-full text-[10px] font-black text-gray-400 hover:text-ferrari transition-colors tracking-widest uppercase"
              >
                ESQUECI MINHA SENHA
              </button>
            </form>
          ) : (
            <form onSubmit={handleRecovery} className="space-y-6">
              {recoveryStep === 1 && (
                <div className="group">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-ferrari transition-colors">Informe sua Matrícula</label>
                  <input
                    type="text"
                    placeholder="Ex: 048291"
                    className="w-full border-b-2 border-gray-100 py-2 text-sm font-bold focus:border-ferrari outline-none transition-all"
                    value={recoveryMatricula}
                    onChange={(e) => setRecoveryMatricula(e.target.value)}
                    required
                  />
                </div>
              )}

              {recoveryStep === 2 && (
                <div className="group">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-ferrari transition-colors">Confirme seu Nome Completo</label>
                  <input
                    type="text"
                    placeholder="Seu nome como no cadastro"
                    className="w-full border-b-2 border-gray-100 py-2 text-sm font-bold focus:border-ferrari outline-none transition-all uppercase"
                    value={recoveryName}
                    onChange={(e) => setRecoveryName(e.target.value.toUpperCase())}
                    required
                  />
                </div>
              )}

              {recoveryStep === 3 && (
                <div className="group">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block group-focus-within:text-ferrari transition-colors">Nova Senha (6 números)</label>
                  <input
                    type="password"
                    placeholder="******"
                    maxLength={6}
                    className="w-full border-b-2 border-gray-100 py-2 text-sm font-bold focus:border-ferrari outline-none transition-all"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              )}

              {error && <p className={cn(
                "text-[10px] text-center font-black animate-pulse uppercase",
                error.includes('SUCESSO') ? "text-green-600" : "text-ferrari"
              )}>{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full bg-ferrari text-white font-black py-4 rounded-xl shadow-xl transition-all border-b-4 border-ferrari-dark",
                  loading ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-95"
                )}
              >
                {loading ? "PROCESSANDO..." : recoveryStep === 3 ? "ALTERAR SENHA" : "CONTINUAR"}
              </button>
            </form>
          )}

          <button
            onClick={onRegisterClick}
            className="w-full text-ferrari text-[10px] font-black py-4 mt-2 tracking-widest hover:opacity-70 transition-opacity uppercase border-t border-gray-50 pt-6"
          >
            CRIAR NOVO USUÁRIO
          </button>
        </div>
      </div>
    </div>
  );
}
