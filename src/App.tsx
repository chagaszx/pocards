import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import CatalogDeckPage from './pages/CatalogDeckPage'
import ExplorePage from './pages/ExplorePage'
import DeckPage from './pages/DeckPage'
import DecksPage from './pages/DecksPage'
import FeedbackPage from './pages/FeedbackPage'
import HeroPage from './pages/HeroPage'
import HomePage from './pages/HomePage'
import ImportPage from './pages/ImportPage'
import SettingsPage from './pages/SettingsPage'
import StatsPage from './pages/StatsPage'
import StudyPage from './pages/StudyPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="biblioteca" element={<DecksPage />} />
        <Route path="biblioteca/explorar" element={<ExplorePage />} />
        <Route path="biblioteca/explorar/:catalogId" element={<CatalogDeckPage />} />
        <Route path="biblioteca/resumo" element={<StatsPage />} />
        <Route path="importar" element={<ImportPage />} />
        <Route path="aventura" element={<HeroPage />} />
        <Route path="heroi" element={<HeroPage />} />
        <Route path="configuracoes" element={<SettingsPage />} />
        <Route path="configuracoes/feedback" element={<FeedbackPage />} />
        <Route path="baralho/:deckId" element={<DeckPage />} />
        <Route path="estudar/:deckId" element={<StudyPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  )
}
