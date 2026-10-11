import { StrictMode, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import '@app/index.css'
import { assembleErrorHandling } from '@app/errors/errors.assembly.main.ts'
import { assembleRoot } from './app.assembly.main.ts'

/** The entry point (index.html loads this): error handling first, then the app, mounted on #root. */
const { ErrorBoundary } = assembleErrorHandling()
const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root element')
createRoot(root).render(createElement(StrictMode, null, createElement(ErrorBoundary, null, createElement(assembleRoot()))))
