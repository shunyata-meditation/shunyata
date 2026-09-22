import { Link } from '@tanstack/react-router'
import { ApiError, errorMessage } from '../lib/contracts'
import type { ApiProblem } from '../lib/contracts'
import shunyataLogo from '../assets/shunyata_logo.svg'

export function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <img
      src={shunyataLogo}
      className={small ? 'logo-mark small' : 'logo-mark'}
      alt=""
      aria-hidden="true"
    />
  )
}
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Shunyata home">
      <LogoMark small />
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
      <LogoMark small />
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
