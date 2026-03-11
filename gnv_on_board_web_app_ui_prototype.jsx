import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Bell, Ship, Mail, Lock, ArrowRight, Home, Info, Radio, Clapperboard, Tv, BookOpen, Utensils, Baby } from "lucide-react";

export default function GNVOnBoardApp() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [signupStep, setSignupStep] = useState<'profile' | 'consents'>('profile');
  const [profile, setProfile] = useState({ firstName: '', lastName: '', country: '', dob: '', phonePrefix: '+33', phone: '', email: '', password: '' });
  const [consents, setConsents] = useState({ promo: '', analysis: '', rulesAccepted: false });
  const [forgotSent, setForgotSent] = useState(false);

  // === Demo navigation (inside app) ===
  const [page, setPage] = useState<'home' | 'radio' | 'movies' | 'webtv' | 'magazine' | 'menu' | 'kids' | 'info'>('home');
  const pageTitles: Record<typeof page, string> = {
    home: 'GNV OnBoard',
    radio: 'GNV Radio',
    movies: 'Films & Séries',
    webtv: 'WebTV',
    magazine: 'Magazine',
    menu: 'Menu du jour',
    kids: 'Kids Zone',
    info: 'Plus d\'informations',
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthed(true);
  };
  const handleSignup = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthed(true);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0E8BFE] to-[#1b4fff] p-4">
      <AnimatePresence mode="wait">
        {!isAuthed ? (
          <motion.div key={authView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full max-w-md rounded-3xl bg-white/90 p-6 shadow-xl backdrop-blur-md">
            <div className="mb-6 flex items-center gap-2 text-slate-800">
              <Ship />
              <p className="font-semibold text-lg">GNV OnBoard</p>
            </div>

            {authView === 'login' && (
              <>
                <h1 className="text-2xl font-bold text-slate-900">Connexion</h1>
                <form onSubmit={handleLogin} className="mt-5 space-y-4">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Mail size={18} className="text-slate-500" />
                    <input type="email" required placeholder="Adresse e-mail" className="w-full bg-transparent p-1 text-sm outline-none" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Lock size={18} className="text-slate-500" />
                    <input type="password" required placeholder="Mot de passe" className="w-full bg-transparent p-1 text-sm outline-none" />
                  </div>
                  <motion.button whileTap={{ scale: 0.98 }} type="submit" className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 flex justify-center items-center gap-2">
                    Se connecter <ArrowRight size={16} />
                  </motion.button>
                </form>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-700">
                  <button className="underline hover:opacity-80" onClick={() => { setAuthView('forgot'); setForgotSent(false); }}>Mot de passe oublié ?</button>
                  <button className="underline hover:opacity-80" onClick={() => setAuthView('signup')}>Créer un compte</button>
                </div>
                <div className="mt-4">
                  <button onClick={() => setIsAuthed(true)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Aperçu (démo)</button>
                </div>
              </>
            )}

            {authView === 'signup' && (
              <>
                <h1 className="text-2xl font-bold text-slate-900">Inscription</h1>
                {signupStep === 'profile' ? (
                  <form onSubmit={(e)=>{e.preventDefault(); setSignupStep('consents');}} className="mt-5 space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <label className="text-[11px] text-slate-500">PRÉNOM</label>
                        <input required value={profile.firstName} onChange={(e)=>setProfile({...profile, firstName: e.target.value})} placeholder="Prénom" className="w-full bg-transparent text-sm outline-none" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <label className="text-[11px] text-slate-500">NOM</label>
                        <input required value={profile.lastName} onChange={(e)=>setProfile({...profile, lastName: e.target.value})} placeholder="Nom" className="w-full bg-transparent text-sm outline-none" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <label className="text-[11px] text-slate-500">PAYS/RÉGION</label>
                        <select required value={profile.country} onChange={(e)=>setProfile({...profile, country: e.target.value})} className="w-full bg-transparent text-sm outline-none">
                          <option value="">Choisir</option>
                          <option>France</option>
                          <option>Maroc</option>
                          <option>Italie</option>
                          <option>Espagne</option>
                          <option>Tunisie</option>
                        </select>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <label className="text-[11px] text-slate-500">DATE DE NAISSANCE</label>
                        <input required type="date" value={profile.dob} onChange={(e)=>setProfile({...profile, dob: e.target.value})} className="w-full bg-transparent text-sm outline-none" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <label className="text-[11px] text-slate-500">PRÉFIXE</label>
                          <select value={profile.phonePrefix} onChange={(e)=>setProfile({...profile, phonePrefix: e.target.value})} className="w-full bg-transparent text-sm outline-none">
                            <option>+33</option>
                            <option>+39</option>
                            <option>+212</option>
                            <option>+34</option>
                            <option>+216</option>
                          </select>
                        </div>
                        <div className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                          <label className="text-[11px] text-slate-500">NUMÉRO DE TÉLÉPHONE</label>
                          <input value={profile.phone} onChange={(e)=>setProfile({...profile, phone: e.target.value})} placeholder="Téléphone" className="w-full bg-transparent text-sm outline-none" />
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <label className="text-[11px] text-slate-500">E‑MAIL</label>
                        <input required type="email" value={profile.email} onChange={(e)=>setProfile({...profile, email: e.target.value})} placeholder="Adresse e‑mail" className="w-full bg-transparent text-sm outline-none" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <label className="text-[11px] text-slate-500">MOT DE PASSE</label>
                        <input required type="password" value={profile.password} onChange={(e)=>setProfile({...profile, password: e.target.value})} placeholder="Créer un mot de passe" className="w-full bg-transparent text-sm outline-none" />
                      </div>
                    </div>
                    <motion.button whileTap={{ scale: 0.98 }} type="submit" className="w-full rounded-xl bg-[#0E8BFE] px-4 py-2 text-sm font-medium text-white hover:brightness-95">Continuer</motion.button>
                    <div className="text-center text-xs text-slate-600">En continuant, vous acceptez nos <a className="underline" href="#">Conditions</a> et notre <a className="underline" href="#">Politique de confidentialité</a>.</div>
                  </form>
                ) : (
                  <form onSubmit={(e)=>{e.preventDefault(); setIsAuthed(true);}} className="mt-5 space-y-4">
                    <h2 className="text-base font-semibold">Mentions légales sur la confidentialité</h2>
                    <p className="text-xs text-slate-600">Vos données personnelles seront traitées conformément au Règlement européen en matière de protection des données. <a className="underline" href="#">Cliquez ici</a> pour consulter notre politique de confidentialité.</p>
                    <p className="text-[11px] text-slate-500">* Champs obligatoires</p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">* J’accepte de recevoir des informations et des promotions spéciales</p>
                        <div className="mt-2 flex items-center gap-6">
                          <label className="flex items-center gap-2 text-sm"><input type="radio" name="promo" value="oui" required checked={consents.promo==='oui'} onChange={()=>setConsents({...consents, promo:'oui'})} /> OUI</label>
                          <label className="flex items-center gap-2 text-sm"><input type="radio" name="promo" value="non" required checked={consents.promo==='non'} onChange={()=>setConsents({...consents, promo:'non'})} /> NON</label>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium">* J’accepte l’analyse de mes habitudes de consommation et de recevoir des questionnaires de satisfaction</p>
                        <div className="mt-2 flex items-center gap-6">
                          <label className="flex items-center gap-2 text-sm"><input type="radio" name="analysis" value="oui" required checked={consents.analysis==='oui'} onChange={()=>setConsents({...consents, analysis:'oui'})} /> OUI</label>
                          <label className="flex items-center gap-2 text-sm"><input type="radio" name="analysis" value="non" required checked={consents.analysis==='non'} onChange={()=>setConsents({...consents, analysis:'non'})} /> NON</label>
                        </div>
                      </div>
                      <label className="flex items-start gap-2 text-xs text-slate-700">
                        <input type="checkbox" required checked={consents.rulesAccepted} onChange={(e)=>setConsents({...consents, rulesAccepted: e.target.checked})} className="mt-0.5 rounded border-slate-300" />
                        Je déclare avoir lu et compris le <a className="underline" href="#">Règlement du programme</a> et j’y souscris.
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <motion.button type="button" whileTap={{scale:0.98}} onClick={()=>setSignupStep('profile')} className="w-1/3 rounded-xl border border-slate-300 px-4 py-2 text-sm">Retour</motion.button>
                      <motion.button whileTap={{ scale: 0.98 }} type="submit" className="w-2/3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Créer le compte</motion.button>
                    </div>
                    <p className="text-[11px] text-slate-500">* Champs obligatoires</p>
                  </form>
                )}
                <div className="mt-4 text-center text-xs text-slate-700">
                  Déjà inscrit ? <button className="underline" onClick={() => {setAuthView('login'); setSignupStep('profile');}}>Se connecter</button>
                </div>
              </>
            )}

            {authView === 'forgot' && (
              <>
                <h1 className="text-2xl font-bold text-slate-900">Mot de passe oublié</h1>
                <p className="mt-1 text-sm text-slate-600">Saisissez votre e-mail pour recevoir un lien de réinitialisation.</p>
                <form onSubmit={(e)=>{e.preventDefault(); setForgotSent(true);}} className="mt-5 space-y-4">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Mail size={18} className="text-slate-500" />
                    <input type="email" required placeholder="Adresse e-mail" className="w-full bg-transparent p-1 text-sm outline-none" />
                  </div>
                  <motion.button whileTap={{ scale: 0.98 }} type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Envoyer le lien</motion.button>
                </form>
                {forgotSent && (
                  <p className="mt-3 rounded-lg bg-green-50 p-2 text-xs text-green-700">Si cet e-mail existe, un lien de réinitialisation a été envoyé.</p>
                )}
                <div className="mt-4 text-center text-xs text-slate-700">
                  <button className="underline" onClick={() => setAuthView('login')}>Retour à la connexion</button>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-screen flex-col w-full max-w-4xl bg-white/70 backdrop-blur-md rounded-3xl shadow-xl overflow-hidden">
            {/* Header */}
            <header className="sticky top-0 z-40 flex items-center justify-between bg-gradient-to-r from-[#0E8BFE] to-[#1b4fff] px-5 py-4 text-white shadow-lg">
              <div className="flex items-center gap-2">
                <Ship size={24} />
                <span className="text-lg font-semibold tracking-wide">{pageTitles[page]}</span>
              </div>
              <div className="flex items-center gap-5">
                <Bell size={22} className="hover:opacity-80" />
                <Menu size={22} />
              </div>
            </header>

            {/* Main with page transitions */}
            <main className="flex-1 p-6 overflow-y-auto">
              <AnimatePresence mode="wait">
                {page === 'home' ? (
                  <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-6">
                    {/* Hero */}
                    <section className="rounded-3xl p-6 text-white shadow-xl ring-1 ring-white/20 bg-gradient-to-br from-[#0E8BFE] to-[#1b4fff] relative overflow-hidden">
                      <motion.div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 6, repeat: Infinity }} />
                      <p className="text-xs/none opacity-90">Bienvenue</p>
                      <h1 className="mt-1 text-2xl font-bold drop-shadow">Ravi de vous avoir à bord</h1>
                      <p className="mt-1 max-w-2xl text-sm opacity:95">Accédez à tous les services du navire hors ligne : divertissement, infos utiles, restauration et assistance.</p>
                    </section>

                    {/* Services Grid */}
                    <section>
                      <h2 className="text-sm font-semibold text-slate-700">Services</h2>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {[
                          {key:'radio', title:'GNV Radio', desc:'Écouter maintenant', icon: <Radio size={22} className="text-blue-600" />},
                          {key:'movies', title:'Films & Séries', desc:'Catalogue à bord', icon: <Clapperboard size={22} className="text-violet-600" />},
                          {key:'webtv', title:'WebTV', desc:'Live & replay', icon: <Tv size={22} className="text-cyan-600" />},
                          {key:'magazine', title:'Magazine', desc:'Articles & conseils', icon: <BookOpen size={22} className="text-rose-600" />},
                          {key:'menu', title:'Menu du jour', desc:'Plats & horaires', icon: <Utensils size={22} className="text-amber-600" />},
                          {key:'kids', title:'Kids Zone', desc:'Games & cartoons', icon: <Baby size={22} className="text-pink-600" />},
                        ].map((s) => (
                          <motion.button key={s.key} onClick={() => setPage(s.key as typeof page)} whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }} className="group rounded-2xl bg-white/80 backdrop-blur-md p-5 text-left shadow-sm ring-1 ring-black/5 hover:shadow-lg">
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-black/5 transition-transform group-hover:rotate-1">
                                {s.icon}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-slate-800">{s.title}</p>
                                <p className="text-xs text-slate-500">{s.desc}</p>
                              </div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </section>
                  </motion.div>
                ) : (
                  <motion.div key={page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                    <div className="mx-auto max-w-3xl rounded-3xl bg-white/90 backdrop-blur-md p-6 shadow-xl ring-1 ring-black/5">
                      <h1 className="text-2xl font-bold text-slate-900">{pageTitles[page]}</h1>
                      <p className="mt-1 text-sm text-slate-600">Contenu de démo pour la section <span className="font-medium">{page}</span>.</p>
                      <div className="mt-4 flex gap-2">
                        <button onClick={()=>setPage('home')} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Retour</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            {/* Fixed bottom bar */}
            <nav className="sticky bottom-0 z-40 mt-auto flex items-center justify-around border-t border-slate-200 bg-white/80 backdrop-blur-md py-2 text-slate-700">
              <button onClick={()=>setPage('home')} className={`flex flex-col items-center text-xs ${page==='home' ? 'text-blue-600' : ''}`}>
                <Home size={18} />
                Accueil
              </button>
              <button onClick={()=>setPage('info')} className={`flex flex-col items-center text-xs ${page==='info' ? 'text-blue-600' : ''}`}>
                <Info size={18} />
                Infos
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
