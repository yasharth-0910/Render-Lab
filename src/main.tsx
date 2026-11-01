import { createRoot } from 'react-dom/client'
import { applyTheme } from './ui/components/theme'
import './ui/theme.css'
import App from './ui/App'

applyTheme()
createRoot(document.getElementById('root')!).render(<App />)
