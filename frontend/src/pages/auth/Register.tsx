import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { User, Phone, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../../lib/api';
import { useAuthStore } from '../../store';

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setUser, setTokens } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '', preferredLanguage: 'en' });

  const registerMutation = useMutation({
    mutationFn: () => authApi.register(form).then((r) => r.data.data),
    onSuccess: (data) => {
      setUser(data.user);
      setTokens(data.accessToken, data.refreshToken);
      navigate('/');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-lg">D</span>
          </div>
          <h1 className="font-serif text-2xl font-bold">{t('auth.register_title')}</h1>
          <p className="text-muted-foreground mt-1">{t('auth.register_subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[{ field: 'firstName', label: t('auth.first_name'), placeholder: 'Jean-Pierre' }, { field: 'lastName', label: t('auth.last_name'), placeholder: 'Habimana' }].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label className="text-sm font-medium block mb-1.5">{label}</label>
                <div className="relative">
                  <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input required value={form[field as keyof typeof form]} onChange={(e) => setForm(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full pl-8 pr-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">{t('auth.phone')} *</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input required type="tel" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+250 780 000 000"
                className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">{t('auth.email')} (Optional)</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="jean@example.com"
                className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">{t('auth.password')}</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input required type={showPass ? 'text' : 'password'} minLength={8} value={form.password}
                onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 8 characters"
                className="w-full pl-9 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {registerMutation.error && (
            <p className="text-sm text-destructive text-center">Registration failed. Phone or email may already be used.</p>
          )}

          <button type="submit" disabled={registerMutation.isPending}
            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-70">
            {registerMutation.isPending ? 'Creating account...' : t('auth.register_btn')}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.have_account')} <Link to="/login" className="text-primary font-medium hover:underline">{t('auth.sign_in')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
