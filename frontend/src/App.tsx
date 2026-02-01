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
import type { Model } from './data/models'
import { useAuth } from './context/AuthContext'

export default function App() {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-content">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <Routes>
          <Route path="/" element={<Home selectedModel={selectedModel} onSelectModel={setSelectedModel} />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/chat" element={<Chat selectedModel={selectedModel} />} />
          <Route path="/generate" element={<Generate selectedModel={selectedModel} />} />
          <Route path="/files" element={<Files />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  )
}