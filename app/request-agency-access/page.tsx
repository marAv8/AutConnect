import AuthHeader from "@/app/components/auth/AuthHeader";
import Link from "next/link";
import AgencyAccessRequestForm from "./AgencyAccessRequestForm";

export default function RequestAgencyAccessPage() {
  return (
    <main className="auth-shell">
      <AuthHeader wordmark />
      <div className="auth-page">
        <section className="auth-card auth-card-create">
          <div className="auth-form-wrap">
            <h1 style={{ fontSize: 28, fontWeight: 600 }}>Request Agency Access</h1>
            <AgencyAccessRequestForm />
            <div className="auth-link-row">
              <Link href="/create-account">Return to account creation</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

