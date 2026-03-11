import React from 'react'
import ReactDOM from 'react-dom/client'
import { LanguageProvider } from './contexts/LanguageContext'
import AppWeb from './web/AppWeb'
import './web/web.css'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <AppWeb />
    </LanguageProvider>
  </React.StrictMode>,
)
