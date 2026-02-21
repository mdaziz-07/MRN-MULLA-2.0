import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'

export default function AdminApp() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    // Check if already logged in
    useEffect(() => {
        const saved = localStorage.getItem('mrn_admin_auth')
        if (saved === 'true') {
            setIsAuthenticated(true)
        }
    }, [])

    const handleLogin = () => {
        setIsAuthenticated(true)
        localStorage.setItem('mrn_admin_auth', 'true')
    }

    const handleLogout = () => {
        setIsAuthenticated(false)
        localStorage.removeItem('mrn_admin_auth')
    }

    if (!isAuthenticated) {
        return <AdminLogin onLogin={handleLogin} />
    }

    return <AdminDashboard onLogout={handleLogout} />
}
