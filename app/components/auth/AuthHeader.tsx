type Props = {
  wordmark?: boolean;
};

export default function AuthHeader({ wordmark = false }: Props) {
  return (
    <header className="auth-brand-header" aria-label="AutConnect">
      {wordmark ? (
        <div className="auth-wordmark" aria-label="AutConnect">
          <span aria-hidden="true" className="brand-mark-light">Aut</span>
          <span aria-hidden="true" className="brand-mark-strong">Connect</span>
        </div>
      ) : (
        <div className="app-user-header-logo" aria-label="AutConnect">
          <span aria-hidden="true" className="brand-mark-light">A</span>
          <span aria-hidden="true" className="brand-mark-strong">C</span>
        </div>
      )}
    </header>
  );
}
