import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './app.scss'
import UploadTrack from "./components/UploadTrack";
function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    <UploadTrack />
    </>
  )
}

export default App
