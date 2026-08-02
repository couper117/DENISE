import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { User, Phone, Mail, Globe, Moon, Lock } from 'lucide-react';
import { useAuthStore } from '../../store';
import { authApi } from '../../lib/api';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ln', label: 'Lingala' },
];

const Profile = () => {
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    preferredLanguage: user?.preferredLanguage || 'en',
    darkMode: user?.darkMode || false,
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const updateMutation = useMutation({
    mutationFn: () => authApi.updateProfile(form).then((r) => r.data.data),
    onSuccess: (data) => setUser(data),
  });

  const passwordMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }).then((r) => r.data),
    onSuccess: () => setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }),
  });

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="font-serif text-3xl font-bold mb-8">{t('account.profile')}</h1>

      <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="bg-card border border-border rounded-xl p-6 space-y-4 mb-6">
        <h2 className="font-semibold mb-2">Personal Information</h2>
        <div className="grid grid-cols-2 gap-4">
          {[{ field: 'firstName', label: t('auth.first_name'), icon: User }, { field: 'lastName', label: t('auth.last_name'), icon: User }].map(({ field, label, icon: Icon }) => (
            <div key={field}>
              <label className="text-sm font-medium block mb-1.5">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={form[field as 'firstName' | 'lastName']} onChange={(e) => setForm(p => ({ ...p, [field]: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          ))}
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">{t('auth.phone')}</label>
          <div className="relative">
            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={user?.phone || ''} disabled
              className="w-full pl-9 pr-4 py-2.5 bg-muted border border-border rounded-xl text-sm opacity-60" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Phone number cannot be changed</p>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">{t('auth.email')}</label>
          <div className="relative">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
              className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1.5">{t('account.language')}</label>
          <div className="relative">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select value={form.preferredLanguage} onChange={(e) => setForm(p => ({ ...p, preferredLanguage: e.target.value }))}
              className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input type="checkbox" checked={form.darkMode} onChange={(e) => setForm(p => ({ ...p, darkMode: e.target.checked }))} className="sr-only" />
            <div className={`w-11 h-6 rounded-full transition-colors ${form.darkMode ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.darkMode ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-sm font-medium flex items-center gap-1"><Moon size={14} /> {t('account.dark_mode')}</span>
        </label>
        <button type="submit" disabled={updateMutation.isPending}
          className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-70">
          {updateMutation.isPending ? 'Saving...' : t('account.save_changes')}
        </button>
        {updateMutation.isSuccess && <p className="text-sm text-green-600 text-center">Profile updated successfully!</p>}
      </form>

      {/* Change password */}
      <form onSubmit={(e) => { e.preventDefault(); if (passwordForm.newPassword === passwordForm.confirmPassword) passwordMutation.mutate(); }}
        className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Lock size={16} className="text-primary" /> {t('account.change_password')}</h2>
        {[{ field: 'currentPassword', label: 'Current Password' }, { field: 'newPassword', label: 'New Password' }, { field: 'confirmPassword', label: 'Confirm New Password' }].map(({ field, label }) => (
          <div key={field}>
            <label className="text-sm font-medium block mb-1.5">{label}</label>
            <input type="password" value={passwordForm[field as keyof typeof passwordForm]}
              onChange={(e) => setPasswordForm(p => ({ ...p, [field]: e.target.value }))} minLength={field !== 'currentPassword' ? 8 : undefined}
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        ))}
        {passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
          <p className="text-sm text-destructive">Passwords do not match</p>
        )}
        <button type="submit" disabled={passwordMutation.isPending}
          className="w-full py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-70">
          {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
        </button>
        {passwordMutation.isSuccess && <p className="text-sm text-green-600 text-center">Password changed successfully!</p>}
      </form>
    </div>
  );
};

export default Profile;
