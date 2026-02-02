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
import TelegramCallback from './pages/TelegramCallback'
import type { Model } from './data/models'
import { useAuth } from './context/AuthContext'
import ToastContainer from './components/Toast'

export default function App() {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading } = useAuth()

  if (loading) {
    return <div className="app-loading" />
  }

  return (
    <>
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
          <Route path="/" element={<Home selectedModel={selectedModel} onSelectModel={setSelectedModel} />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/chat" element={<Chat selectedModel={selectedModel} />} />
          <Route path="/generate" element={<Generate selectedModel={selectedModel} />} />
          <Route path="/files" element={<Files />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="/tariffs" element={<Tariffs />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/auth/telegram-callback" element={<TelegramCallback />} />
        </Routes>
      </div>
      <ToastContainer />
    </>
  )
}