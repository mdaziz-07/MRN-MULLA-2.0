import { createContext, useContext, useReducer, useCallback, useEffect } from 'react'

const CartContext = createContext(null)

const cartReducer = (state, action) => {
    switch (action.type) {
        case 'ADD_ITEM': {
            const exists = state.items.find(i => i.id === action.payload.id)
            if (exists) {
                return {
                    ...state,
                    items: state.items.map(i =>
                        i.id === action.payload.id ? { ...i, qty: i.qty + 1 } : i
                    ),
                }
            }
            return {
                ...state,
                items: [...state.items, { ...action.payload, qty: 1 }],
            }
        }
        case 'REMOVE_ITEM':
            return {
                ...state,
                items: state.items.filter(i => i.id !== action.payload),
            }
        case 'INCREMENT': {
            return {
                ...state,
                items: state.items.map(i =>
                    i.id === action.payload ? { ...i, qty: i.qty + 1 } : i
                ),
            }
        }
        case 'DECREMENT': {
            const item = state.items.find(i => i.id === action.payload)
            if (item && item.qty <= 1) {
                return {
                    ...state,
                    items: state.items.filter(i => i.id !== action.payload),
                }
            }
            return {
                ...state,
                items: state.items.map(i =>
                    i.id === action.payload ? { ...i, qty: i.qty - 1 } : i
                ),
            }
        }
        case 'CLEAR':
            return { ...state, items: [] }
        case 'LOAD':
            return { ...state, items: action.payload }
        default:
            return state
    }
}

export function CartProvider({ children }) {
    const [state, dispatch] = useReducer(cartReducer, { items: [] })

    // Load cart from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('mrn_cart')
            if (saved) {
                dispatch({ type: 'LOAD', payload: JSON.parse(saved) })
            }
        } catch (e) {
            console.error('Failed to load cart:', e)
        }
    }, [])

    // Save cart to localStorage on change
    useEffect(() => {
        localStorage.setItem('mrn_cart', JSON.stringify(state.items))
    }, [state.items])

    const addToCart = useCallback((product) => {
        dispatch({ type: 'ADD_ITEM', payload: product })
    }, [])

    const removeFromCart = useCallback((productId) => {
        dispatch({ type: 'REMOVE_ITEM', payload: productId })
    }, [])

    const incrementQty = useCallback((productId) => {
        dispatch({ type: 'INCREMENT', payload: productId })
    }, [])

    const decrementQty = useCallback((productId) => {
        dispatch({ type: 'DECREMENT', payload: productId })
    }, [])

    const clearCart = useCallback(() => {
        dispatch({ type: 'CLEAR' })
    }, [])

    const getQty = useCallback((productId) => {
        const item = state.items.find(i => i.id === productId)
        return item ? item.qty : 0
    }, [state.items])

    const isInCart = useCallback((productId) => {
        return state.items.some(i => i.id === productId)
    }, [state.items])

    const totalItems = state.items.reduce((sum, i) => sum + i.qty, 0)
    const totalAmount = state.items.reduce((sum, i) => sum + i.price * i.qty, 0)

    return (
        <CartContext.Provider
            value={{
                items: state.items,
                addToCart,
                removeFromCart,
                incrementQty,
                decrementQty,
                clearCart,
                getQty,
                isInCart,
                totalItems,
                totalAmount,
            }}
        >
            {children}
        </CartContext.Provider>
    )
}

export const useCart = () => {
    const context = useContext(CartContext)
    if (!context) throw new Error('useCart must be used within CartProvider')
    return context
}
