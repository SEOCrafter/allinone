import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Home from './pages/Home'
import Bots from './pages/Bots'
import Chat from './pages/Chat'
import Generate from './pages/Generate'
import Files from './pages/Files'
import Login from './pages/Login'
import Register from './pages/Register'
import Account from './pages/Account'
import Tariffs from './pages/Tariffs'
import PaymentSuccess from './pages/PaymentSuccess'
import type { Model } from './data/models'
import { useAuth } from './context/AuthContext'
export default function App() {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading } = useAuth()
  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    )
  }
  return (
    <div className="app">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-content">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />
        <Routes>
          <Route path="/" element={<Home onSelectModel={setSelectedModel} />} />
          <Route path="/bots" element={<Bots onSelectModel={setSelectedModel} />} />
          <Route path="/chat" element={<Chat selectedModel={selectedModel} onSelectModel={setSelectedModel} />} />
          <Route path="/generate" element={<Generate selectedModel={selectedModel} onSelectModel={setSelectedModel} />} />
          <Route path="/files" element={<Files />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="/tarifs" element={<Tariffs />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
        </Routes>
      </div>
    </div>
  )
}