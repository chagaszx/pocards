import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import DecksPage from './pages/DecksPage'
import DeckPage from './pages/DeckPage'
import StudyPage from './pages/StudyPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DecksPage />} />
        <Route path="baralho/:deckId" element={<DeckPage />} />
        <Route path="estudar/:deckId" element={<StudyPage />} />
        <Route path="*" element={<DecksPage />} />
      </Route>
    </Routes>
  )
}
