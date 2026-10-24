import { useApp } from './hooks/useApp.jsx';
import Landing from './pages/Landing.jsx';
import LevelSelect from './pages/LevelSelect.jsx';
import GamePage from './pages/GamePage.jsx';
import AlgorithmLab from './pages/AlgorithmLab.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import AnalysisPage from './pages/AnalysisPage.jsx';

export default function App() {
  const { page, transition } = useApp();
  const Page = { landing: Landing, levels: LevelSelect, game: GamePage, lab: AlgorithmLab, leaderboard: LeaderboardPage, how: HowItWorks, analysis: AnalysisPage }[page] || Landing;
  return (
    <div className={`app-shell ${transition ? 'is-leaving' : 'is-entering'}`}>
      <Page />
    </div>
  );
}
