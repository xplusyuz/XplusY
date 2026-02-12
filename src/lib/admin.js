export function adminEmails(){const raw=(import.meta.env.VITE_ADMIN_EMAILS||'').trim();return raw.split(',').map(s=>s.trim()).filter(Boolean)}
export function isAdminUser(user){if(!user?.email) return false; return adminEmails().includes(user.email)}
