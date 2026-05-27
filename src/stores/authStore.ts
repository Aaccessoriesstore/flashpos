import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

interface AuthStore {
  user: User | null
  storeId: number
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  loginWithPin: (pin: string) => Promise<void>
  logout: () => void
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      storeId: 1,
      isAuthenticated: false,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true })
        try {
          // Hash password with SHA-256
          const encoder = new TextEncoder()
          const data = encoder.encode(password)
          const hashBuffer = await crypto.subtle.digest('SHA-256', data)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

          const { data: users, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('username', username.trim())
            .eq('is_active', true)
            .single()

          if (error || !users) throw new Error('اسم المستخدم غير موجود')

          // Support both hashed and plain passwords (plain for first setup only)
          const validHash = users.password_hash === hashedPassword
          if (!validHash) throw new Error('كلمة المرور غير صحيحة')

          // Update last login
          await supabase
            .from('app_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', users.id)

          set({ user: users, storeId: users.store_id || 1, isAuthenticated: true })
        } finally {
          set({ isLoading: false })
        }
      },

      loginWithPin: async (pin) => {
        set({ isLoading: true })
        try {
          if (!pin || pin.length !== 4) throw new Error('رمز PIN يجب أن يكون 4 أرقام')

          const { data: users, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('pin_code', pin)
            .eq('is_active', true)
            .single()

          if (error || !users) throw new Error('رمز PIN غير صحيح')

          await supabase
            .from('app_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', users.id)

          set({ user: users, storeId: users.store_id || 1, isAuthenticated: true })
        } finally {
          set({ isLoading: false })
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false })
      },

      setLoading: (v) => set({ isLoading: v }),
    }),
    {
      name: 'flashpos-auth',
      partialize: (state) => ({ user: state.user, storeId: state.storeId, isAuthenticated: state.isAuthenticated }),
    }
  )
)
