import { create } from 'zustand'
import type { CartItem, Product, Customer, PaymentMethod } from '../types'

interface CartStore {
  items: CartItem[]
  customer: Customer | null
  paymentMethod: PaymentMethod
  discountPercent: number
  loyaltyPointsToUse: number
  notes: string

  addItem: (product: Product, qty?: number) => void
  removeItem: (productId: number) => void
  updateQty: (productId: number, qty: number) => void
  updateItemDiscount: (productId: number, discount: number) => void
  setCustomer: (customer: Customer | null) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setDiscount: (percent: number) => void
  setLoyaltyPoints: (points: number) => void
  setNotes: (notes: string) => void
  clearCart: () => void

  // Computed
  subtotal: () => number
  discountAmount: () => number
  taxAmount: () => number
  loyaltyDiscount: () => number
  total: () => number
  itemCount: () => number
}

const calcItemTotal = (item: CartItem, taxRate: number): CartItem => {
  const basePrice = item.unit_price * item.quantity
  const discountAmt = (basePrice * item.discount_percent) / 100
  const afterDiscount = basePrice - discountAmt
  const taxAmt = (afterDiscount * taxRate) / 100
  return {
    ...item,
    discount_amount: discountAmt,
    tax_amount: taxAmt,
    total: afterDiscount + taxAmt,
  }
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  customer: null,
  paymentMethod: 'cash',
  discountPercent: 0,
  loyaltyPointsToUse: 0,
  notes: '',

  addItem: (product, qty = 1) => {
    const TAX_RATE = product.tax_exempt ? 0 : 14
    set((state) => {
      const existing = state.items.find((i) => i.product.id === product.id)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product.id === product.id
              ? calcItemTotal({ ...i, quantity: i.quantity + qty }, TAX_RATE)
              : i
          ),
        }
      }
      const newItem: CartItem = {
        product,
        quantity: qty,
        unit_price: product.selling_price,
        discount_percent: product.discount_percent || 0,
        discount_amount: 0,
        tax_amount: 0,
        total: 0,
      }
      return { items: [...state.items, calcItemTotal(newItem, TAX_RATE)] }
    })
  },

  removeItem: (productId) => {
    set((state) => ({ items: state.items.filter((i) => i.product.id !== productId) }))
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      items: state.items.map((i) => {
        if (i.product.id !== productId) return i
        const TAX_RATE = i.product.tax_exempt ? 0 : 14
        return calcItemTotal({ ...i, quantity: qty }, TAX_RATE)
      }),
    }))
  },

  updateItemDiscount: (productId, discount) => {
    set((state) => ({
      items: state.items.map((i) => {
        if (i.product.id !== productId) return i
        const TAX_RATE = i.product.tax_exempt ? 0 : 14
        return calcItemTotal({ ...i, discount_percent: discount }, TAX_RATE)
      }),
    }))
  },

  setCustomer: (customer) => set({ customer }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setDiscount: (percent) => set({ discountPercent: percent }),
  setLoyaltyPoints: (points) => set({ loyaltyPointsToUse: points }),
  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      items: [],
      customer: null,
      paymentMethod: 'cash',
      discountPercent: 0,
      loyaltyPointsToUse: 0,
      notes: '',
    }),

  subtotal: () => {
    const { items } = get()
    return items.reduce((sum, i) => sum + i.unit_price * i.quantity - i.discount_amount, 0)
  },

  discountAmount: () => {
    const { subtotal, discountPercent } = get()
    return (subtotal() * discountPercent) / 100
  },

  taxAmount: () => {
    const { items } = get()
    return items.reduce((sum, i) => sum + i.tax_amount, 0)
  },

  loyaltyDiscount: () => {
    const { loyaltyPointsToUse } = get()
    return loyaltyPointsToUse / 10 // 10 points = 1 EGP
  },

  total: () => {
    const { subtotal, discountAmount, taxAmount, loyaltyDiscount } = get()
    return Math.max(0, subtotal() - discountAmount() + taxAmount() - loyaltyDiscount())
  },

  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
