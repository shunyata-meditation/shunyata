import { Link } from '@tanstack/react-router'
import { ApiError, errorMessage } from '../lib/contracts'
import type { ApiProblem } from '../lib/contracts'

export function Enso({ small = false }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={small ? 'enso small' : 'enso'}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M58 13C34 0 9 19 10 42c1 22 24 34 44 24 18-9 23-33 9-48"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M60 14C38 5 15 21 15 43c0 17 15 29 32 27"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity=".5"
      />
    </svg>
  )
}
export function Branch() {
  return (
    <svg
      className="branch"
      viewBox="0 0 180 260"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M63 247c36-67 47-124 60-220M92 172l-47-45m60-19 39-43M76 214l56-45"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <g
        fill="currentColor"
        fillOpacity=".18"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path d="M115 79c-26-3-42-26-39-52 29 4 41 25 39 52Z" />
        <path d="M122 54c-5-24 11-44 31-48 5 24-9 42-31 48Z" />
        <path d="M104 127c20-26 44-29 60-18-13 25-35 29-60 18Z" />
        <path d="M99 148c-32-5-49-30-41-52 29 9 42 27 41 52Z" />
        <path d="M80 200c-30 1-54-17-55-42 29 0 46 13 55 42Z" />
        <path d="M90 195c26-3 45-21 44-46-27 5-39 21-44 46Z" />
      </g>
    </svg>
  )
}
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Shunyata home">
      <Enso small />
      <span>
        shunyata<span className="brand-caption">a space for your practice</span>
      </span>
    </Link>
  )
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown
  retry?: () => void
}) {
  const unauthorized = error instanceof ApiError && error.problem.status === 401
  return (
    <div className="notice error" role="alert">
      <p>{errorMessage(error)}</p>
      {unauthorized ? (
        <Link to="/login">Sign in again</Link>
      ) : (
        retry && (
          <button type="button" className="text-button" onClick={retry}>
            Try again
          </button>
        )
      )}
    </div>
  )
}
export function FormProblem({ problem }: { problem: ApiProblem | null }) {
  return problem ? (
    <div className="notice error" role="alert">
      <p>{problem.message}</p>
      {problem.status === 401 && <Link to="/login">Sign in again</Link>}
    </div>
  ) : null
}
export function FieldError({
  name,
  problem,
}: {
  name: string
  problem: ApiProblem | null
}) {
  return problem?.fields[name] ? (
    <span id={`${name}-error`} className="field-error">
      {problem.fields[name]}
    </span>
  ) : null
}
export function Loading({
  label = 'Opening your journal…',
}: {
  label?: string
}) {
  return (
    <div className="loading" role="status">
      <Enso small />
      <span>{label}</span>
    </div>
  )
}
export function Footer() {
  return (
    <footer className="footer">
      <span>Small moments. A gentler rhythm.</span>
      <span>
        SHUNYATA <span aria-hidden="true">·</span> 空
      </span>
    </footer>
  )
}
